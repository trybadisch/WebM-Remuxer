# WebM-Remuxer

Extension to recontainerize HackerOne WebM files to restore duration and playback controls.

## About this project

WebM files on HackerOne are broken since their duration isn't set (I suspect because H1 strips its metadata contents). Thus, the total duration of evidence WebMs cannot be seen, which also breaks the playback controls in the embedded video player.

The only available fix is to recontainerize (remux) the WebMs to include their actual duration via ffmpeg, although this process requires downloading the file locally:

```shell
ffmpeg -i no-duration.webm -c copy fixed-duration.webm
```

This Firefox extension leverages the [WASM port of ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) to perform the WebM remuxing in-browser, and replaces the broken WebMs with the fixed blobs in the embedded player, thus fixing the duration and implementing playback controls. Additionally, it creates additional download links to the fixed WebMs, in case that they need to be downloaded locally.

As remuxing does not require reencoding any files, the process is almost seamless, without significant performance penalties for the browser. However, since H1 loads its resources dynamically, the extension requires constant monitoring of active H1 tabs to detect any changes to the DOM where a WebM file may have been included. This is the most resource intensive task, although I have not detected a significant performance downgrade in my testing.

## Installation

The latest packaged release can be downloaded from [releases](https://github.com/trybadisch/WebM-Remuxer/releases/).

The extension .xpi must be installed as a local file from `about:addons`. It is tentatively signed by Mozilla, although it is not publicly available in the extension marketplace. It will ask for permissions on `hackerone.com` and `amazonaws.com` subdomains (since there's where H1 attachments are hosted). No further configuration is involved.

## How does it work

- `download.js`: Creates an observer to monitor the DOM. When it detects a block containing a WebM file, it passes its source to `remux.js`. After the file comes back from remuxing, it replaces the video source with the remuxed data blob and includes download links to the file in the DOM.
- `remux.js`: Imports ffmpeg-wasm components from `/assets/` and applies `"ffmpeg -i", "input.webm", "-c", "copy", "output.webm"` to files sent by `download.js`. It works as a background script, and communication with `download.js` is achieved via sendMessage listener.
- `/assets/` folder: Contains the `ffmpeg-wasm` vanilla JavaScript implementation, as well as the `/assets/core/package/dist/esm/ffmpeg-core.wasm` WebAssembly.
