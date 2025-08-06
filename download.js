function processMarkdownBlocks() {
  const blocks = document.getElementsByClassName("interactive-markdown__code");

  for (let block of blocks) {
    if (block.dataset.processed === "true") continue;

    const children = block.children;
    if (children.length < 2) {
      continue;
    }

    const menu1 = children[0];
    const menu2 = children[1];
    const content = children[2] || block;

    const fileName = menu1?.textContent || "";
    if (!fileName.includes(".webm")) {
      continue;
    }
    const fName = fileName.substring(fileName.indexOf(' ')+1,fileName.indexOf(':'));

    const video = content.querySelector("video");
    if (!video) {
      continue;
    }

    let originalSrc = video.currentSrc || video.src;
    if ((!originalSrc || !originalSrc.includes(".webm")) && video.querySelector("source")) {
      originalSrc = video.querySelector("source").src || "";
    }

    if (!originalSrc || !originalSrc.includes(".webm")) {
      continue;
    }

    chrome.runtime.sendMessage({ action: "remuxWebM", url: originalSrc })
      .then((response) => {
        if (response?.buffer) {
          const blob = new Blob([new Uint8Array(response.buffer)], { type: "video/webm" });
          const blobUrl = URL.createObjectURL(blob);

          // Replace video
          video.src = blobUrl;
          video.load();

          // Add download link
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = fName + "-fix.webm";
          link.textContent = "[Download fix]";
          link.className = "daisy-link interactive-markdown__code__menu-item";
          link.style = "color:deeppink !important;";
          menu2.appendChild(link);
        }
      });

    block.dataset.processed = "true";
  }
}

processMarkdownBlocks();

const observer = new MutationObserver(processMarkdownBlocks);
observer.observe(document.body, { childList: true, subtree: true });