(function () {
  const THEMES = window.CHALU_THEMES || [];
  const PUBLIC_EPOCH = window.CHALU_PUBLIC_EPOCH || Date.UTC(2026, 0, 5, 18, 30, 0);
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    view: "gali",
    theme: THEMES[0],
    jamId: null,
    epoch: PUBLIC_EPOCH,
    name: localStorage.getItem("chalu-name") || "",
    friend: "",
    player: null,
    playing: false,
    timers: [],
    peer: null,
    conn: null,
    isHost: false,
    bc: null,
    shutterBusy: false,
    tuning: false,
    toastTimer: 0,
    ackAt: 0,
    ignoreHash: false,
    lastTrackId: ""
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function pad(n) {
    n = Math.floor(Math.max(0, n));
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  }

  function istClock() {
    return new Date().toLocaleTimeString("en-IN", {
      hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata"
    });
  }

  function onlineFor(id) {
    const h = new Date().getHours();
    const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
    return 28 + ((seed * 19 + h * 9) % 160);
  }

  function themeById(id) {
    return THEMES.find((t) => t.id === id) || THEMES[0];
  }

  function parseHash() {
    const raw = (location.hash || "").replace(/^#\/?/, "");
    const [theme, jam] = raw.split("/");
    return { theme: theme || "", jam: jam || "" };
  }

  function writeHash(themeId, jamId) {
    const next = !themeId ? "" : (jamId ? `#${themeId}/${jamId}` : `#${themeId}`);
    if (location.hash === next || (!location.hash && !next)) return;
    state.ignoreHash = true;
    location.hash = next.replace(/^#/, "");
    setTimeout(() => { state.ignoreHash = false; }, 0);
  }

  function catalogLen(theme) {
    return theme.tracks.reduce((s, t) => s + t.dur, 0) || 1;
  }

  function radioNow(theme, epoch) {
    const tracks = theme.tracks;
    const total = catalogLen(theme);
    let elapsed = Math.floor((Date.now() - epoch) / 1000) % total;
    if (elapsed < 0) elapsed = 0;
    let acc = 0;
    for (let i = 0; i < tracks.length; i++) {
      if (elapsed < acc + tracks[i].dur) {
        return { track: tracks[i], offset: elapsed - acc, index: i, elapsed };
      }
      acc += tracks[i].dur;
    }
    return { track: tracks[0], offset: 0, index: 0, elapsed: 0 };
  }

  function toast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("is-on"), 2600);
  }

  function setModal(html) {
    $("modalSheet").innerHTML = html;
    $("modal").classList.add("is-on");
  }

  function closeModal() {
    $("modal").classList.remove("is-on");
  }

  function initials(name) {
    const p = (name || "M").trim().split(/\s+/);
    return ((p[0] || "M")[0] + (p[1] ? p[1][0] : "")).toUpperCase();
  }

  function paintBooth() {
    $("seatMe").textContent = initials(state.name || "Mehman");
    $("seatMe").classList.add("on");
    if (state.friend) {
      $("seatYou").textContent = initials(state.friend);
      $("seatYou").className = "seat on pop";
    } else {
      $("seatYou").textContent = "+";
      $("seatYou").className = "seat empty";
    }
    const jam = state.jamId ? escapeHtml(state.jamId.toUpperCase()) : "";
    const me = escapeHtml(state.name || "You");
    const fr = escapeHtml(state.friend);
    if (state.jamId) {
      $("boothCopy").innerHTML = state.friend
        ? `<b>Private booth ${jam}</b><br />${me} and ${fr} · same bar.`
        : `<b>Private booth ${jam}</b><br />Empty chair. Waiting for your friend.`;
    } else {
      $("boothCopy").innerHTML = `<b>Public frequency</b><br />Anyone in this shop hears this bar.`;
    }
  }

  function paintGali() {
    $("galiClock").textContent = istClock();
    const n = THEMES.reduce((s, t) => s + onlineFor(t.id), 0);
    $("galiLive").textContent = `${n} in the gali`;
  }

  function renderShops() {
    $("shops").innerHTML = THEMES.map((t, i) => `
      <button class="shop" data-enter="${t.id}" type="button">
        <div class="thumb" style="background-image:url('${t.image}')">
          <span class="num">${String(i + 1).padStart(2, "0")}</span>
        </div>
        <div class="meta">
          <div class="hi">${t.nameHi}</div>
          <div class="en">${t.name}</div>
          <div class="rule">${t.genre}</div>
        </div>
      </button>
    `).join("");
  }

  function renderRail(id) {
    $("roomRail").innerHTML = THEMES.map((t) => `
      <button class="mini ${t.id === id ? "is-on" : ""}" data-enter="${t.id}" type="button">
        <span class="dotimg" style="background-image:url('${t.image}')"></span>${t.name}
      </button>
    `).join("");
  }

  function nextQuote(reset) {
    const qs = state.theme.quotes;
    const i = reset ? 0 : Math.floor(Math.random() * qs.length);
    const box = $("quoteBox");
    const apply = () => {
      $("quoteText").textContent = `“${qs[i].text}”`;
      $("quoteWho").textContent = qs[i].who;
      box.classList.remove("is-swap");
    };
    if (reset || reduce) return apply();
    box.classList.add("is-swap");
    setTimeout(apply, 180);
  }

  function applyTheme(t) {
    document.body.className = `theme-${t.id}${state.playing ? " is-playing" : ""}`;
    document.documentElement.style.setProperty("--accent", t.accent);
    $("roomBg").style.backgroundImage = `url('${t.image}')`;
    $("roomHi").textContent = t.nameHi;
    $("roomEn").textContent = `${t.name} · ${t.time}`;
    $("ruleChip").innerHTML = `<strong>Rule</strong> · ${escapeHtml(t.rule)}`;
    $("genreChip").innerHTML = `<strong>${escapeHtml(t.genre)}</strong>`;
    $("liveChip").innerHTML = `<strong>${onlineFor(t.id) + (state.friend ? 1 : 0)}</strong> inside`;
    $("trackSub").textContent = t.blurb;
    $("ytLink").href = `https://www.youtube.com/playlist?list=${t.playlistId}`;
    $("cover").style.backgroundImage = `url('https://img.youtube.com/vi/${t.tracks[0].id}/hqdefault.jpg')`;
    $("setTune").classList.toggle("hidden", !t.clipSeconds);
    $("coinWidget").classList.toggle("hidden", !t.coinTimer);
    $("sessionWidget").classList.toggle("hidden", !t.sessionMins);
    $("tuneWidget").classList.toggle("hidden", !t.clipSeconds);
    $("chairWidget").classList.toggle("hidden", !t.chairs);
    renderRail(t.id);
    nextQuote(true);
    paintBooth();
  }

  function show(view) {
    state.view = view;
    $("gali").classList.toggle("is-on", view === "gali");
    $("room").classList.toggle("is-on", view === "room");
    document.body.classList.toggle("in-room", view === "room");
  }

  function shutter(then) {
    if (state.shutterBusy || reduce) {
      then();
      return;
    }
    state.shutterBusy = true;
    $("shutter").classList.add("is-on");
    setTimeout(() => {
      then();
      setTimeout(() => {
        $("shutter").classList.remove("is-on");
        state.shutterBusy = false;
      }, 420);
    }, 520);
  }

  function clearTimers() {
    state.timers.forEach(clearInterval);
    state.timers = [];
  }

  function every(ms, fn) {
    fn();
    state.timers.push(setInterval(fn, ms));
  }

  function startLoops() {
    clearTimers();
    every(1000, () => { $("roomClock").textContent = istClock(); });
    every(15000, () => nextQuote(false));
    every(400, tickRadio);
    every(1000, tickRules);
  }

  function tickRules() {
    const t = state.theme;
    const pos = radioNow(t, state.epoch);
    if (t.coinTimer) {
      const left = t.coinTimer - (pos.elapsed % t.coinTimer);
      $("coinLeft").textContent = pad(left);
      $("coinStatus").textContent = left < 6 ? "Call dropping." : "The other person is silent.";
    }
    if (t.sessionMins) {
      const cycle = t.sessionMins * 60;
      $("sessionLeft").textContent = pad(cycle - (pos.elapsed % cycle));
    }
    if (t.chairs) $("chairLine").textContent = `You are number ${2 + (pos.index % 4)} for PC-01`;
    if (t.clipSeconds) $("roomTune").textContent = `Now demoing · ${pos.track.title}`;
    if (t.powerCut) {
      const pulse = pos.elapsed % 52;
      $("blackout").classList.toggle("is-on", pulse < 3 && state.playing);
    }
    if (t.bumper) {
      const nearEnd = pos.track.dur - pos.offset < 8 && pos.offset > 10;
      $("bumper").classList.toggle("is-on", nearEnd && state.playing);
    }
  }

  function setPlaying(on) {
    state.playing = on;
    document.body.classList.toggle("is-playing", on);
  }

  function paintTrack(track, announce) {
    $("trackName").textContent = track.title;
    if ($("trackMeta")) {
      $("trackMeta").textContent = [track.film, track.year].filter(Boolean).join(" · ");
    }
    if ($("trackMemory")) {
      $("trackMemory").textContent = track.memory || "";
    }
    $("cover").style.backgroundImage = `url('https://img.youtube.com/vi/${track.id}/hqdefault.jpg')`;
    if (announce && track.id !== state.lastTrackId && track.memory) {
      state.lastTrackId = track.id;
      toast(track.memory);
    }
    state.lastTrackId = track.id;
  }

  function tickRadio() {
    const pos = radioNow(state.theme, state.epoch);
    paintTrack(pos.track, true);
    $("now").textContent = pad(pos.offset);
    $("end").textContent = pad(pos.track.dur);
    $("fill").style.width = `${Math.min(100, (pos.offset / pos.track.dur) * 100)}%`;
    $("playIcon").innerHTML = state.playing
      ? '<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';

    if (!state.player || !state.playing || !state.player.loadVideoById) return;
    const data = state.player.getVideoData ? state.player.getVideoData() : {};
    if (data.video_id && data.video_id !== pos.track.id) {
      state.player.loadVideoById({ videoId: pos.track.id, startSeconds: pos.offset });
      if (state.theme.volumeLock) state.player.setVolume(state.theme.volumeLock);
      return;
    }
    const cur = state.player.getCurrentTime ? state.player.getCurrentTime() : 0;
    if (Math.abs(cur - pos.offset) > 2.8) state.player.seekTo(pos.offset, true);
    if (state.theme.volumeLock) state.player.setVolume(state.theme.volumeLock);
  }

  function bootPlayer() {
    if (state.player || !(window.YT && window.YT.Player)) return;
    const pos = radioNow(state.theme, state.epoch);
    try {
      state.player = new YT.Player("ytMount", {
        height: "1",
        width: "1",
        videoId: pos.track.id,
        playerVars: {
          autoplay: 0, controls: 0, enablejsapi: 1, playsinline: 1, rel: 0, origin: location.origin
        },
        events: {
          onReady() {
            if (state.theme.volumeLock) state.player.setVolume(state.theme.volumeLock);
          },
          onStateChange(e) {
            if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
            if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) setPlaying(false);
          },
          onError() {
            toast("This reel skipped. Next one is already on.");
          }
        }
      });
    } catch (e) {
      toast("Radio is warming up. Try Tune in again.");
    }
  }

  window.onYouTubeIframeAPIReady = function () {
    if (state.view === "room") bootPlayer();
  };

  function tuneIn() {
    if (state.tuning) return;
    if (!state.player) {
      state.tuning = true;
      bootPlayer();
      setTimeout(() => { state.tuning = false; tuneIn(); }, 550);
      return;
    }
    if (state.playing) {
      try { state.player.pauseVideo(); } catch (e) {}
      setPlaying(false);
      return;
    }
    const pos = radioNow(state.theme, state.epoch);
    try {
      state.player.loadVideoById({ videoId: pos.track.id, startSeconds: pos.offset });
      state.player.playVideo();
      if (state.theme.volumeLock) state.player.setVolume(state.theme.volumeLock);
      setPlaying(true);
    } catch (e) {
      toast("Tap Tune in once more — the radio needs a nudge.");
    }
  }

  function enter(id, fromPeer) {
    const t = themeById(id);
    if (state.view === "room" && state.theme.id === t.id) return;
    state.lastTrackId = "";
    state.theme = t;
    localStorage.setItem("chalu-last", t.id);
    writeHash(t.id, state.jamId);
    applyTheme(t);
    show("room");
    startLoops();
    if (window.YT && window.YT.Player) bootPlayer();
    if (!fromPeer) broadcast({ type: "room", id: t.id, name: state.name });
  }

  function leave(fromHash) {
    if (!fromHash) writeHash("", null);
    show("gali");
    paintGali();
    $("blackout").classList.remove("is-on");
    $("bumper").classList.remove("is-on");
    if (state.playing && state.player) {
      try { state.player.pauseVideo(); } catch (e) {}
      setPlaying(false);
    }
  }

  function jamLink() {
    const url = new URL(location.href);
    url.hash = `${state.theme.id}/${state.jamId}`;
    return url.toString();
  }

  function openNameModal() {
    setModal(`
      <div class="vol" style="font-family:Cinzel,serif;letter-spacing:.28em;font-size:10px;color:var(--gold)">YOUR SEAT</div>
      <h3>What should the shopkeeper call you?</h3>
      <p class="hint">This is the name your friend sees when they sit down.</p>
      <input id="nameInput" maxlength="18" placeholder="e.g. Arjun" value="${escapeHtml(state.name)}" />
      <div class="row">
        <button class="btn gold" id="saveName" type="button">Sit down</button>
        <button class="btn" data-close type="button">Later</button>
      </div>
    `);
    setTimeout(() => $("nameInput") && $("nameInput").focus(), 50);
  }

  function openInvite() {
    if (!state.jamId) {
      const elapsed = (Date.now() - PUBLIC_EPOCH) % (catalogLen(state.theme) * 1000);
      const epoch = Date.now() - elapsed;
      state.jamId = epoch.toString(36);
      state.epoch = epoch;
      writeHash(state.theme.id, state.jamId);
      startJamNet();
    }
    paintBooth();
    const link = jamLink();
    setModal(`
      <div class="vol" style="font-family:Cinzel,serif;letter-spacing:.28em;font-size:10px;color:var(--gold)">PRIVATE BOOTH</div>
      <h3>Jam with a friend</h3>
      <p class="hint">Send this. When they open it, you both lock to the same second. Walk shops together.</p>
      <input id="linkInput" readonly value="${escapeHtml(link)}" />
      <div class="row">
        <button class="btn gold" id="copyLink" type="button">Copy booth link</button>
        <button class="btn" data-close type="button">Close</button>
      </div>
    `);
  }

  function openJoin() {
    setModal(`
      <div class="vol" style="font-family:Cinzel,serif;letter-spacing:.28em;font-size:10px;color:var(--gold)">BOOTH CODE</div>
      <h3>Sit in their booth</h3>
      <p class="hint">Paste the full link, or just the code after the slash.</p>
      <input id="codeInput" placeholder="saloon/mjk8x2k1" />
      <div class="row">
        <button class="btn gold" id="goCode" type="button">Walk in</button>
        <button class="btn" data-close type="button">Cancel</button>
      </div>
    `);
  }

  function applyJamFromCode(raw) {
    let theme = state.theme.id;
    let jam = raw.trim();
    try {
      if (/^https?:/i.test(jam)) {
        const u = new URL(jam);
        jam = (u.hash || "").replace(/^#\/?/, "");
      }
    } catch (e) {}
    if (jam.includes("/")) {
      const parts = jam.split("/");
      theme = parts[0];
      jam = parts[1];
    }
    jam = (jam || "").replace(/[^a-z0-9]/gi, "");
    if (!jam) {
      toast("That booth code looks empty.");
      return;
    }
    state.jamId = jam;
    const parsed = parseInt(jam, 36);
    state.epoch = Number.isFinite(parsed) ? parsed : Date.now();
    startJamNet();
    shutter(() => enter(theme));
  }

  function broadcast(msg) {
    const payload = { ...msg, at: Date.now() };
    try { if (state.bc) state.bc.postMessage(payload); } catch (e) {}
    try { if (state.conn && state.conn.open) state.conn.send(payload); } catch (e) {}
  }

  function onPeerMsg(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "hello" && msg.name) {
      state.friend = String(msg.name).slice(0, 18);
      paintBooth();
      toast(`${state.friend} sat down.`);
      if (Date.now() - state.ackAt > 900) {
        state.ackAt = Date.now();
        broadcast({ type: "hello-ack", name: state.name || "Mehman", room: state.theme.id });
      }
    }
    if (msg.type === "hello-ack" && msg.name) {
      state.friend = String(msg.name).slice(0, 18);
      paintBooth();
      if (!state.isHost && msg.room && msg.room !== state.theme.id) {
        shutter(() => enter(msg.room, true));
      }
    }
    if (msg.type === "room" && msg.id && msg.id !== state.theme.id) {
      shutter(() => enter(msg.id, true));
      toast(`${msg.name || "Your friend"} walked into another shop.`);
    }
    if (msg.type === "react" && msg.emo) spawnReact(String(msg.emo).slice(0, 4));
  }

  function startJamNet() {
    if (!state.jamId) return;
    if (state.bc) try { state.bc.close(); } catch (e) {}
    try {
      state.bc = new BroadcastChannel("chalu-v4-" + state.jamId);
      state.bc.onmessage = (e) => onPeerMsg(e.data);
    } catch (e) {
      state.bc = null;
    }
    broadcast({ type: "hello", name: state.name || "Mehman" });

    if (!window.Peer) return;
    try { if (state.peer) state.peer.destroy(); } catch (e) {}
    const hostId = "chalu4-" + state.jamId;
    let guestTried = false;
    const host = new Peer(hostId);
    host.on("open", () => {
      state.peer = host;
      state.isHost = true;
      host.on("connection", wireConn);
    });
    host.on("error", (err) => {
      const taken = err && (err.type === "unavailable-id" || /taken|unavailable/i.test(String(err)));
      if (!taken || guestTried) return;
      guestTried = true;
      try { host.destroy(); } catch (e) {}
      const guest = new Peer();
      guest.on("open", () => {
        state.peer = guest;
        state.isHost = false;
        wireConn(guest.connect(hostId));
      });
      guest.on("error", () => toast("Booth radio is on. Presence may take a second."));
    });
  }

  function wireConn(c) {
    state.conn = c;
    c.on("open", () => broadcast({ type: "hello", name: state.name || "Mehman" }));
    c.on("data", onPeerMsg);
    c.on("close", () => {
      state.friend = "";
      paintBooth();
      toast("Your friend left the booth.");
    });
  }

  function spawnReact(emo) {
    const el = document.createElement("div");
    el.className = "float-react";
    el.textContent = emo;
    el.style.left = 30 + Math.random() * 50 + "%";
    el.style.bottom = "28%";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  function seedFx() {
    const moths = $("moths");
    const steam = $("steam");
    const twinkles = $("twinkles");
    const flies = $("flies");
    if (moths) {
      moths.innerHTML = Array.from({ length: 7 }, (_, i) =>
        `<i class="moth" style="left:${10 + i * 12}%;top:${20 + (i % 4) * 15}%;animation-delay:${i * 0.7}s"></i>`
      ).join("");
    }
    if (steam) {
      steam.innerHTML = `<span></span><span style="left:48%;animation-delay:1.2s"></span><span style="left:55%;animation-delay:2.1s"></span>`;
    }
    if (twinkles) {
      twinkles.innerHTML = Array.from({ length: 14 }, (_, i) =>
        `<i class="twinkle" style="left:${8 + (i * 6.5) % 90}%;top:${8 + (i * 11) % 40}%;animation-delay:${i * 0.18}s"></i>`
      ).join("");
    }
    if (flies) {
      flies.innerHTML = Array.from({ length: 6 }, (_, i) =>
        `<i class="fly" style="left:${15 + i * 13}%;top:${40 + (i % 3) * 12}%;animation-delay:${i}s"></i>`
      ).join("");
    }
  }

  function dust() {
    if (reduce) return;
    const c = $("dust");
    if (!c || !c.getContext) return;
    const ctx = c.getContext("2d");
    const bits = Array.from({ length: 42 }, () => ({
      x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 1.2, v: 0.00015 + Math.random() * 0.00035
    }));
    function size() {
      c.width = innerWidth;
      c.height = innerHeight;
    }
    size();
    addEventListener("resize", size);
    function frame() {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = "rgba(232,211,164,.28)";
      bits.forEach((b) => {
        b.y -= b.v;
        if (b.y < 0) b.y = 1;
        ctx.beginPath();
        ctx.arc(b.x * c.width, b.y * c.height, b.s, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    frame();
  }

  function onHash() {
    if (state.ignoreHash) return;
    const route = parseHash();
    if (!route.theme) {
      if (state.view === "room") leave(true);
      return;
    }
    if (route.jam && route.jam !== state.jamId) {
      state.jamId = route.jam;
      const parsed = parseInt(route.jam, 36);
      state.epoch = Number.isFinite(parsed) ? parsed : PUBLIC_EPOCH;
      startJamNet();
    }
    if (route.theme !== state.theme.id || state.view !== "room") {
      shutter(() => enter(route.theme, true));
    }
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) { closeModal(); return; }
    if (e.target.closest("#saveName")) {
      const v = (($("nameInput") && $("nameInput").value) || "").trim().slice(0, 18);
      state.name = v || "Mehman";
      localStorage.setItem("chalu-name", state.name);
      paintBooth();
      broadcast({ type: "hello", name: state.name });
      closeModal();
      toast(`Seat reserved for ${state.name}.`);
      return;
    }
    if (e.target.closest("#copyLink")) {
      const v = $("linkInput") && $("linkInput").value;
      if (v) {
        navigator.clipboard.writeText(v).then(() => toast("Booth link copied.")).catch(() => {
          $("linkInput").select();
          document.execCommand("copy");
          toast("Copied.");
        });
      }
      return;
    }
    if (e.target.closest("#goCode")) {
      const v = $("codeInput") && $("codeInput").value;
      closeModal();
      if (v) applyJamFromCode(v);
      return;
    }

    const door = e.target.closest("[data-enter]");
    if (door) {
      shutter(() => enter(door.dataset.enter));
      return;
    }
    if (e.target.closest("#backBtn")) leave();
    if (e.target.closest("#playBtn")) tuneIn();
    if (e.target.closest("#quoteBox")) nextQuote(false);
    if (e.target.closest("#nameBtn")) openNameModal();
    if (e.target.closest("#joinCodeBtn")) openJoin();
    if (e.target.closest("#inviteBtn")) {
      if (!state.name) openNameModal();
      else openInvite();
    }
    if (e.target.closest("#setTune")) {
      $("roomTune").textContent = `Shop tune · ${$("trackName").textContent}`;
      toast("Set as the shop's missed-call tune.");
    }
    const react = e.target.closest("[data-react]");
    if (react) {
      spawnReact(react.dataset.react);
      broadcast({ type: "react", emo: react.dataset.react, name: state.name });
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if ($("modal").classList.contains("is-on")) closeModal();
      else if (state.view === "room") leave();
    }
    if (e.code === "Space" && state.view === "room" && e.target === document.body) {
      e.preventDefault();
      tuneIn();
    }
    if (e.code === "Enter" && $("modal").classList.contains("is-on")) {
      if ($("saveName")) $("saveName").click();
      else if ($("goCode")) $("goCode").click();
    }
  });

  $("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });

  window.addEventListener("hashchange", onHash);

  renderShops();
  paintGali();
  seedFx();
  setInterval(paintGali, 30000);
  dust();

  setTimeout(() => {
    $("intro").classList.add("is-gone");
    $("gali").classList.add("is-on");
    const route = parseHash();
    if (route.jam) {
      state.jamId = route.jam;
      const parsed = parseInt(route.jam, 36);
      state.epoch = Number.isFinite(parsed) ? parsed : PUBLIC_EPOCH;
      startJamNet();
    }
    if (route.theme && themeById(route.theme).id === route.theme) {
      setTimeout(() => shutter(() => enter(route.theme, true)), 350);
    } else {
      show("gali");
    }
    if (!state.name) setTimeout(openNameModal, 800);
  }, 1500);
})();
