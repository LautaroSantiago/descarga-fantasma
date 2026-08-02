// Descarga Fantasma — content.js
// Se inyecta en cada página y frena los clicks en links de descarga
// antes de que el navegador arranque a escribir en disco.
// Lautaro Subeldia — github.com/LautaroSantiago

const FILE_EXT_REGEX =
  /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|tar|gz|csv|txt|rtf|png|jpe?g|gif|webp|bmp|svg|mp3|wav|mp4|avi|mov|mkv|iso|exe|msi|dmg|apk)(\?.*)?$/i;

document.addEventListener(
  "click",
  (e) => {
    const link = e.target.closest?.("a");
    if (!link || !link.href) return;

    const hasDownloadAttr = link.hasAttribute("download");
    const looksLikeFile = FILE_EXT_REGEX.test(link.href);
    if (!hasDownloadAttr && !looksLikeFile) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    chrome.runtime.sendMessage({
      type: "DOWNLOAD_LINK",
      url: link.href,
      filename: link.getAttribute("download") || null
    });
  },
  true // capture, para adelantarnos a otros listeners de la página
);
