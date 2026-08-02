// Descarga Fantasma — popup.js
// Estado de conexión con Drive + historial de subidas.
// Lautaro Subeldia — github.com/LautaroSantiago

const statusEl = document.getElementById("status");
const connectBtn = document.getElementById("connectBtn");
const logEl = document.getElementById("log");

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = cls || "";
}

function checkConnection() {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (chrome.runtime.lastError || !token) {
      setStatus("No conectado a Google Drive", "error");
      connectBtn.textContent = "Conectar con Google Drive";
    } else {
      setStatus("Conectado a Google Drive ✅", "ok");
      connectBtn.textContent = "Reconectar";
    }
  });
}

connectBtn.addEventListener("click", () => {
  setStatus("Conectando…", "");
  chrome.runtime.sendMessage({ type: "CONNECT_DRIVE" }, (res) => {
    if (res?.ok) {
      setStatus("Conectado a Google Drive ✅", "ok");
      connectBtn.textContent = "Reconectar";
    } else {
      setStatus(`Error: ${res?.error || "no se pudo conectar"}`, "error");
    }
  });
});

function renderLog(items) {
  logEl.innerHTML = "";
  if (!items?.length) {
    logEl.innerHTML = '<div class="empty">Todavía no subiste nada</div>';
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    li.className = item.status;
    const time = new Date(item.date).toLocaleString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit"
    });
    li.innerHTML = `<span class="name" title="${item.filename}">${item.status === "ok" ? "✅" : "❌"} ${item.filename}</span><span>${time}</span>`;
    logEl.appendChild(li);
  }
}

chrome.storage.local.get("uploadLog", ({ uploadLog }) => renderLog(uploadLog));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.uploadLog) renderLog(changes.uploadLog.newValue);
});

checkConnection();
