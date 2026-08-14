# CHALU THA · Vol. IV

**Two chairs. One radio.**

A 2000s Indian gali of ten shops. Walk in. Invite a friend. You both hear the same second of the same song.

**Live:** [mav1730.github.io/chalutha](https://mav1730.github.io/chalutha/)

## How to jam

1. Open the site and take a seat (your name).
2. Walk into a shop.
3. Hit **Jam with a friend** and send the booth link.
4. Press **Tune in** together. The station does not wait — you join mid-song, like a real shop radio.

Public rooms already share a frequency. A private booth just closes the door.

## The shops

Each room has its own forgotten reel — not the five songs everyone still plays.

| Shop | What you actually hear |
| --- | --- |
| Deluxe Saloon | *Tere Naam*, *O Jaana*, *Dil Ne Yeh Kaha*, *Aati Kya Khandala* |
| STD / PCO | *Main Yahaan Hoon*, *Tere Naam (sad)*, *Kal Ho Naa Ho* |
| Cyber Café '06 | *Koi Kahe Kehta Rahe*, *It's the Time to Disco*, *Pretty Woman* |
| Lab PC-01 | *Jaane Kyon*, *You Are My Soniya*, *Mitwa* |
| Caller Tune Shop | 20 seconds of *Ajab Si*, *Pehli Nazar*, *Kya Mujhe Pyaar Hai* |
| Chitrahaar | *Lag Ja Gale*, *Jaadu Teri Nazar*, then *Tujhe Dekha Toh* |
| Sleeper Berth 2 | *Kabhi Alvida Naa Kehna* leaking from the side-upper |
| Xerox Uncle | *Ho Gaya Hai Tujhko* — the DDLJ song he actually plays |
| Night Chemist | *Beete Lamhein* at 2am, fridge louder than KK |
| Generator Shaadi | *Maahi Ve*, *Say Shava Shava*, then the lights die |

Audio is streamed through YouTube’s official player from curated official uploads. The site does not host music files.

## Run locally

```bash
py -3 -m http.server 8765
```

Then open [http://127.0.0.1:8765/](http://127.0.0.1:8765/).

Static site. No build step.

## Stack

HTML, CSS, vanilla JS. YouTube IFrame API for audio. BroadcastChannel + PeerJS for booth presence.
