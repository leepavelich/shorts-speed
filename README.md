# Shorts Speed

A tiny Chrome extension that adds playback speed controls to YouTube Shorts on the web (`youtube.com/shorts/...`), which YouTube doesn't offer.

## Features

- A small `− 1× +` pill next to YouTube's own pause/mute buttons on each short
- Click the speed to choose a preset (0.5× – 3×), or scroll the mouse wheel over the pill
- Keyboard: **Shift + >** faster, **Shift + <** slower, **Shift + ?** back to 1×
- Range 0.25× – 4× in 0.25× steps
- Your speed carries over as you swipe from short to short, and is remembered (synced via your Chrome profile)
- Fades in and out with YouTube's own controls when you hover the short
- YouTube's own press-and-hold 2× is left alone

## Install (unpacked)

1. Clone or download this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the repo folder.
4. Open any short at `youtube.com/shorts`.

To update: `git pull`, then click the reload icon on the extension's card in `chrome://extensions`.

## How it works

A single content script (`content.js`) runs on youtube.com. Shorts reuses one `<video>` element and resets its `playbackRate` each time a new short loads. The script listens for media events in the capture phase and puts your chosen speed back. Permissions: `storage` only. No network access and no data collection.

## License

MIT
