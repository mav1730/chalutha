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

| Shop | Mix |
| --- | --- |
| Deluxe Saloon | 90s counter radio |
| STD / PCO | Long-distance ache |
| Cyber Café '06 | Night-pack dance |
| Lab PC-01 | Seventh period |
| Caller Tune Shop | 20-second missed-call clips |
| Chitrahaar | Sunday television, no skip |
| Sleeper Berth 2 | Side-upper leak |
| Xerox Uncle | Uncle FM |
| Night Chemist | Soft, volume locked |
| Generator Shaadi | Sangeet + power cuts |

Audio is streamed through YouTube’s official player from curated official uploads. The site does not host music files.

## Run locally

```bash
py -3 -m http.server 8765
```

Then open [http://127.0.0.1:8765/](http://127.0.0.1:8765/).

Static site. No build step.

## Stack

HTML, CSS, vanilla JS. YouTube IFrame API for audio. BroadcastChannel + PeerJS for booth presence.
