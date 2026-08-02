// Descarga Fantasma — background.js
// Service worker. Acá vive toda la lógica de subida a Drive.
// Lautaro Subeldia — github.com/LautaroSantiago

const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FOLDER_NAME = "Descargas Extension";

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message
  });
}

async function logUpload(entry) {
  const { uploadLog = [] } = await chrome.storage.local.get("uploadLog");
  uploadLog.unshift(entry);
  await chrome.storage.local.set({ uploadLog: uploadLog.slice(0, 30) });
}

// interactive=true dispara el popup de login si no hay token cacheado.
// false se usa solo para chequear el estado sin molestar al usuario.
function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "No se pudo autenticar con Google"));
      } else {
        resolve(token);
      }
    });
  });
}

// Busca la carpeta destino por nombre; si no existe la crea. El id queda
// cacheado en storage para no pegarle a la API en cada subida.
async function getOrCreateFolder(token) {
  const stored = await chrome.storage.local.get("driveFolderId");
  if (stored.driveFolderId) return stored.driveFolderId;

  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await fetch(`${DRIVE_FILES_URL}?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    const id = searchData.files[0].id;
    await chrome.storage.local.set({ driveFolderId: id });
    return id;
  }

  const createRes = await fetch(DRIVE_FILES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" })
  });
  const createData = await createRes.json();
  await chrome.storage.local.set({ driveFolderId: createData.id });
  return createData.id;
}

function guessFilenameFromUrl(url) {
  try {
    const clean = url.split("?")[0].split("#")[0];
    return clean.substring(clean.lastIndexOf("/") + 1) || "archivo";
  } catch {
    return "archivo";
  }
}

// Content-Disposition es más confiable que la URL para sacar el filename real.
function filenameFromContentDisposition(disposition) {
  if (!disposition) return null;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch ? plainMatch[1] : null;
}

// Protocolo resumable de Drive: primero un POST con metadata que devuelve
// una session URL (header Location), después un PUT con el binario a esa URL.
async function uploadToDrive(blob, filename, mimeType, token) {
  const folderId = await getOrCreateFolder(token);
  const metadata = { name: filename, parents: [folderId] };

  const initRes = await fetch(DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType || "application/octet-stream",
      "X-Upload-Content-Length": String(blob.size)
    },
    body: JSON.stringify(metadata)
  });

  if (!initRes.ok) throw new Error(`No se pudo iniciar la subida (HTTP ${initRes.status})`);

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("Google no devolvió session URL");

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType || "application/octet-stream" },
    body: blob
  });

  if (!putRes.ok) throw new Error(`Falló la subida (HTTP ${putRes.status})`);
  return putRes.json();
}

// Trae el archivo con fetch (queda en RAM, nunca pisa disco) y lo sube.
async function handleDownload(url, filenameHint) {
  let filename = filenameHint || guessFilenameFromUrl(url);
  try {
    notify("Descargando…", filename);

    // credentials: include manda cookies de sesión, hace falta para links
    // de descarga detrás de login (intranets, drives corporativos, etc).
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`No se pudo obtener el archivo (HTTP ${res.status})`);

    const blob = await res.blob();
    const mimeType = res.headers.get("Content-Type") || blob.type || "application/octet-stream";

    if (!filenameHint) {
      const cd = filenameFromContentDisposition(res.headers.get("Content-Disposition"));
      if (cd) filename = cd;
    }

    const token = await getAuthToken(true);
    notify("Subiendo a Drive…", filename);
    await uploadToDrive(blob, filename, mimeType, token);

    notify("Listo ✅", filename);
    await logUpload({ filename, date: new Date().toISOString(), status: "ok" });
  } catch (err) {
    console.error("handleDownload:", err);
    notify("Error al subir", `${filename}: ${err.message}`);
    await logUpload({ filename, date: new Date().toISOString(), status: "error", error: err.message });
  }
}

// Fallback por si content.js no llega a interceptar el link (ej. descarga
// disparada por el propio server sin pasar por un <a>). Apenas Chrome crea
// la descarga la cancelamos, borramos cualquier resto en disco y subimos
// el archivo a mano.
chrome.downloads.onCreated.addListener((item) => {
  chrome.downloads.cancel(item.id, () => {
    void chrome.runtime.lastError;
    chrome.downloads.removeFile(item.id, () => {
      void chrome.runtime.lastError;
      chrome.downloads.erase({ id: item.id }, () => void chrome.runtime.lastError);
    });
  });
  handleDownload(item.finalUrl || item.url, item.filename || null);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "DOWNLOAD_LINK") {
    handleDownload(msg.url, msg.filename);
    sendResponse({ ok: true });
  }
  if (msg?.type === "CONNECT_DRIVE") {
    getAuthToken(true)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // canal async abierto
  }
  return true;
});
