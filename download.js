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
          link.download = fileName.substring(fileName.indexOf(':')+2, fileName.indexOf(".webm")) + "-fix.webm";
          link.textContent = "[Download fix]";
          link.className = "daisy-link interactive-markdown__code__menu-item";
          link.style = "color:deeppink !important;";
          menu2.appendChild(link);
        }
      });

    block.dataset.processed = "true";
  }
}

function processAttachmentBlocks() {
  const blocks = document.getElementsByClassName("spec-attachment-link");
  for (let block of blocks) {
    if (block.dataset.processed === "true") continue;

    const fileName = block?.textContent || "";
    if (!fileName.includes(".webm")) {
      continue;
    }

    const originalSrc = block.href;
    if (!originalSrc || !originalSrc.includes(".webm")) {
      continue;
    }

    chrome.runtime.sendMessage({ action: "remuxWebM", url: originalSrc })
      .then((response) => {
        if (response?.buffer) {
          const blob = new Blob([new Uint8Array(response.buffer)], { type: "video/webm" });
          const blobUrl = URL.createObjectURL(blob);

          // Add download link
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = fileName.substring(0, fileName.indexOf(".webm")) + "-fix.webm";
          link.textContent = "[Fix]";
          link.className = "spec-attachment-link";
          link.style = "color:deeppink !important;";
          block.appendChild(document.createTextNode(' '));
          block.insertAdjacentElement("afterend", link);
        }
      });

    block.dataset.processed = "true";
  }
}

function handleMutations() {
  processMarkdownBlocks();
  processAttachmentBlocks();
}

const observer = new MutationObserver(handleMutations);
observer.observe(document.body, { childList: true, subtree: true });

handleMutations();

(function () {
  function getResponseContentType(href) {
    try {
      const match = href.match(/[?&]response-content-type=([^&]+)/i);
      if (!match) return null;
      const decoded = decodeURIComponent(match[1]); // e.g., "video/*
      return decoded.toLowerCase();
    } catch (e) {
      return null;
    }
  }

  function isVideoByContentType(href) {
    const ct = getResponseContentType(href);
    if (!ct) return false;
    const topType = ct.split('/')[0];
    return topType === 'video';
  }

  function isWebMByContentType(href) {
    const ct = getResponseContentType(href);
    return ct ? ct.toLowerCase().startsWith('video/webm') : (href.toLowerCase().includes('.webm'));
  }

  function isMKVByContentType(href) {
    const ct = getResponseContentType(href);
    if (ct) {
      const lower = ct.toLowerCase();
      if (lower.includes('video/x-matroska') || lower.includes('matroska')) return true;
    }
    return href.toLowerCase().includes('.mkv');
  }

  async function fetchBlob(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error fetching attachment');
    const blob = await res.blob();
    return blob;
  }

  async function getFixedWebMBlob(url) {
    // Reuse background script that fixes webm
    const response = await chrome.runtime.sendMessage({ action: "remuxWebM", url });
    if (response?.buffer) {
      return new Blob([new Uint8Array(response.buffer)], { type: "video/webm" });
    }
    // Fallback: fetch original if remux not available
    return await fetchBlob(url);
  }

async function getFixedMKVBlob(url) {
  // Remux mkv to mp4
  const response = await chrome.runtime.sendMessage({ action: "remuxMKV", url });
  if (response?.buffer) {
    return new Blob([new Uint8Array(response.buffer)], { type: "video/mp4" });
  }
  // Fallback: fetch original if remux not available
  return await fetchBlob(url);
}


  function makeEmbedLink(anchor) {
    const embed = document.createElement('a');
    embed.href = '#';
    embed.textContent = "[Embed]";
    embed.className = "spec-attachment-link";
    embed.style = "color:deeppink !important; cursor:pointer;";
  
    let insertAfter = anchor;
    const parent = anchor.parentElement;
    if (parent) {
      const candidates = Array.from(parent.querySelectorAll('a.spec-attachment-link'))
        .filter(a => a.textContent?.trim() === "[Fix]");
      if (candidates.length) {
        insertAfter = candidates[candidates.length - 1];
      }
    }
  
    insertAfter.insertAdjacentElement('afterend', embed);
    embed.insertAdjacentText('beforebegin', ' ');
  
    return embed;
  }
  

  async function handleEmbedClick(ev, anchor) {
    ev.preventDefault();
    try {
      const href = anchor.getAttribute('href') || anchor.href || "";
      const container = anchor.closest('.mt-sm') || anchor.parentElement || anchor;
      let blob;
      if (isWebMByContentType(href)) {
        blob = await getFixedWebMBlob(href);
      } else if (isMKVByContentType(href)) {
        blob = await getFixedMKVBlob(href);
      } else {
        blob = await fetchBlob(href);
      }
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.controls = true;
      video.src = url;
      video.style.maxWidth = '100%';
      video.style.display = 'block';
      video.style.marginTop = '0.5rem';
      if (container && container.classList.contains('mt-sm')) {
        container.appendChild(video);
      } else {
        anchor.insertAdjacentElement('afterend', video);
      }
      // Remove Embed link
      const embedLink = anchor.__embedLink;
      if (embedLink && embedLink.parentElement) {
        embedLink.remove();
      }
    } catch (e) {
      console.error("Embed failed:", e);
      alert("Sorry, embedding the video failed.");
    }
  }

  function processAttachmentEmbeds() {
    const attachBoxes = document.querySelectorAll('div.mt-sm');
    attachBoxes.forEach(box => {
      const links = box.querySelectorAll('a.spec-attachment-link');
      links.forEach(a => {
        if (a.dataset.embedProcessed === "true") return;
        const href = a.getAttribute('href') || a.href || "";
        if (!href) { a.dataset.embedProcessed = "true"; return; }
        if (!isVideoByContentType(href)) { a.dataset.embedProcessed = "true"; return; }

        const embed = makeEmbedLink(a);
        a.__embedLink = embed;
        embed.addEventListener('click', (ev) => handleEmbedClick(ev, a), { once: false });
        a.dataset.embedProcessed = "true";
      });
    });
  }

  processAttachmentEmbeds();
  const embedObserver = new MutationObserver(processAttachmentEmbeds);
  embedObserver.observe(document.body, { childList: true, subtree: true });
})();
