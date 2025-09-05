import { FFmpeg } from "/assets/ffmpeg/package/dist/esm/index.js"; 
import { fetchFile } from "/assets/util/package/dist/esm/index.js";

let ffmpegInstance = null;

async function ensureFFmpegLoaded() {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: "/assets/core/package/dist/esm/ffmpeg-core.js",
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

async function remuxWebMFromURL(url) {
  try {
    const ffmpeg = await ensureFFmpegLoaded();
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], "input.webm", { type: "video/webm" });

    await ffmpeg.writeFile("input.webm", await fetchFile(file));
    await ffmpeg.exec(["-i", "input.webm", "-c", "copy", "output.webm"]);
    const outputData = await ffmpeg.readFile("output.webm");
    const fixedBlob = new Blob([outputData.buffer], { type: "video/webm" });
    const blobUrl = URL.createObjectURL(fixedBlob);
    return new Blob([outputData.buffer], { type: "video/webm" });
  } catch (err) {
    console.error("Remuxing failed:", err);
    return { error: err.message };
  }
}

async function remuxMKVFromURL(url) {
  try {
    const ffmpeg = await ensureFFmpegLoaded();
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], "input.mkv", { type: "video/x-matroska" });

    await ffmpeg.writeFile("input.mkv", await fetchFile(file));
    await ffmpeg.exec(["-i", "input.mkv", "-c", "copy", "output.mp4"]);
    const outputData = await ffmpeg.readFile("output.mp4");
    return new Blob([outputData.buffer], { type: "video/mp4" });
  } catch (err) {
    console.error("Remuxing failed:", err);
    return null;
  }
}


// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "remuxWebM" && msg.url) {
    remuxWebMFromURL(msg.url)
      .then((blob) => {
        if (!blob) {
          sendResponse({ error: "Failed to remux WebM: Blob is null" });
        } else {
          // Convert Blob to ArrayBuffer and return it
          blob.arrayBuffer().then((buffer) => {
            sendResponse({ buffer });
          });
        }
      })
      .catch((err) => {
        console.error("[remux.js] Remux error:", err);
        sendResponse({ error: err.message || "Unknown error" });
      });

    return true; // Keep channel open for async sendResponse
  }

  else if (msg.action === "remuxMKV" && msg.url) {
    remuxMKVFromURL(msg.url)
      .then((blob) => {
        if (!blob) {
          sendResponse({ error: "Failed to remux MKV: Blob is null" });
        } else {
          blob.arrayBuffer().then((buffer) => {
            sendResponse({ buffer });
          });
        }
      })
      .catch((err) => {
        console.error("[remux.js] Remux error:", err);
        sendResponse({ error: err.message || "Unknown error" });
      });

    return true;
  }

});
