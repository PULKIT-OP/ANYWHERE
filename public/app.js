/* ── State ─────────────────────────────────────────────────────────────────── */
let selectedFile = null;
let currentCode = null;
let foundCode = null;

/* ── Tab Switching ─────────────────────────────────────────────────────────── */
function switchTab(tab) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.toggle("active", p.id === tab + "-panel"));
}

/* ── File Type → Emoji ─────────────────────────────────────────────────────── */
function fileEmoji(name, mime) {
  const ext = name.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext))
    return "🖼️";
  if (["pdf"].includes(ext)) return "📕";
  if (["ppt", "pptx"].includes(ext)) return "📊";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📈";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "🎬";
  if (["mp3", "wav", "flac", "ogg", "aac"].includes(ext)) return "🎵";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "📦";
  if (
    ["js", "ts", "py", "java", "cpp", "c", "html", "css", "json"].includes(ext)
  )
    return "💻";
  return "📄";
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/* ── Drop Zone ─────────────────────────────────────────────────────────────── */
const dropZone = document.getElementById("dropZone");
const browseBtn = document.getElementById("browseBtn");
const fileInput = document.getElementById("fileInput");

browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("dragover"),
);
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

function setFile(file) {
  selectedFile = file;

  const emoji = fileEmoji(file.name, file.type);
  document.getElementById("fileCardIcon").textContent = emoji;
  document.getElementById("fileCardName").textContent = file.name;
  document.getElementById("fileCardSize").textContent = formatBytes(file.size);

  document.getElementById("fileCard").classList.remove("hidden");
  document.getElementById("expirationSection").classList.remove("hidden");
  document.getElementById("customCodeSection").classList.remove("hidden");
  document.getElementById("uploadBtn").disabled = false;

  // Reset result
  document.getElementById("resultBox").classList.add("hidden");
  document.getElementById("progressWrap").classList.add("hidden");
  document.getElementById("progressBar").style.width = "0%";
}

function clearFile() {
  selectedFile = null;
  fileInput.value = "";
  document.getElementById("fileCard").classList.add("hidden");
  document.getElementById("expirationSection").classList.add("hidden");
  document.getElementById("enableExpiration").checked = false;
  document.getElementById("expirationOptions").classList.add("hidden");
  document.getElementById("customCodeSection").classList.add("hidden");
  document.getElementById("enableCustomCode").checked = false;
  document.getElementById("customCodeInputWrap").classList.add("hidden");
  document.getElementById("customCodeInput").value = "";
  document.getElementById("uploadBtn").disabled = true;
}

/* ── Custom Code Options ──────────────────────────────────────────────────── */
function toggleCustomCodeInput() {
  const enableCustomCode = document.getElementById("enableCustomCode").checked;
  const customCodeInputWrap = document.getElementById("customCodeInputWrap");
  if (enableCustomCode) {
    customCodeInputWrap.classList.remove("hidden");
    document.getElementById("customCodeInput").focus();
  } else {
    customCodeInputWrap.classList.add("hidden");
    document.getElementById("customCodeInput").value = "";
  }
}

function getCustomCode() {
  const isEnabled = document.getElementById("enableCustomCode").checked;
  if (!isEnabled) return null;
  const code = document.getElementById("customCodeInput").value.trim();
  return code.length > 0 ? code : null;
}

/* ── Expiration Options ────────────────────────────────────────────────────── */
function toggleExpirationOptions() {
  const enableExpiration = document.getElementById("enableExpiration").checked;
  const expirationOptions = document.getElementById("expirationOptions");
  if (enableExpiration) {
    expirationOptions.classList.remove("hidden");
  } else {
    expirationOptions.classList.add("hidden");
    document.getElementById("expirationSelect").value = "";
    document.getElementById("customExpiration").classList.add("hidden");
  }
}

function getExpirationMinutes() {
  const MAX_MINUTES = 4320; // 3 days max
  const isEnabled = document.getElementById("enableExpiration").checked;

  // If expiration is enabled, get the selected duration
  if (isEnabled) {
    const expirationSelect = document.getElementById("expirationSelect");
    const selectedValue = expirationSelect.value;

    if (selectedValue === "custom") {
      const customMinutes = parseInt(
        document.getElementById("customExpiration").value,
      );
      if (customMinutes > MAX_MINUTES) {
        showToast("⚠️ Maximum delete time is 3 days (4320 minutes).");
        return MAX_MINUTES;
      }
      return customMinutes > 0 ? customMinutes : MAX_MINUTES; // Default to 3 days if invalid
    }

    return selectedValue ? parseInt(selectedValue) : MAX_MINUTES; // Default to 3 days if not selected
  }

  // If expiration is NOT enabled, default to 3 days (4320 minutes)
  return MAX_MINUTES;
}

document
  .getElementById("expirationSelect")
  .addEventListener("change", function () {
    const customInput = document.getElementById("customExpiration");
    if (this.value === "custom") {
      customInput.classList.remove("hidden");
      customInput.focus();
    } else {
      customInput.classList.add("hidden");
    }
  });

/* ── Upload ────────────────────────────────────────────────────────────────── */
async function uploadFile() {
  if (!selectedFile) return;

  const btn = document.getElementById("uploadBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressBar = document.getElementById("progressBar");
  const resultBox = document.getElementById("resultBox");

  btn.disabled = true;
  btn.querySelector(".btn-label").textContent = "Uploading…";
  progressWrap.classList.remove("hidden");

  // Animate progress bar (XHR gives real progress; fetch doesn't, so we fake it)
  const formData = new FormData();
  formData.append("file", selectedFile);

  // Get custom code if provided
  const customCode = getCustomCode();
  if (customCode) {
    formData.append("customCode", customCode);
  }

  // Add expiration time (always has a value now, with 3-day default)
  const expirationMinutes = getExpirationMinutes();
  formData.append("expirationMinutes", expirationMinutes);

  try {
    // Use XHR for real upload progress
    const result = await uploadWithProgress(formData, (pct) => {
      progressBar.style.width = pct + "%";
    });

    if (!result.success) throw new Error(result.error || "Upload failed.");

    currentCode = result.code;

    document.getElementById("codeDisplay").textContent = result.code;

    // Build metadata text
    const metaText = `${result.name} · ${result.size} · uploaded just now`;

    document.getElementById("resultMeta").textContent = metaText;
    resultBox.classList.remove("hidden");

    // Reset button
    btn.querySelector(".btn-label").textContent = "Upload & Generate Code";
    clearFile();
    progressWrap.classList.add("hidden");
    progressBar.style.width = "0%";
  } catch (err) {
    showToast("❌ " + err.message);
    btn.querySelector(".btn-label").textContent = "Upload & Generate Code";
    btn.disabled = false;
    progressWrap.classList.add("hidden");
  }
}

function uploadWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener("load", () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error("Invalid server response."));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error.")));
    xhr.send(formData);
  });
}

/* ── Copy / Share ──────────────────────────────────────────────────────────── */
function copyCode() {
  if (!currentCode) return;
  navigator.clipboard
    .writeText(currentCode)
    .then(() => showToast("✅ Code copied to clipboard!"))
    .catch(() => showToast("⚠️ Could not copy — please copy manually."));
}

function shareCode() {
  if (!currentCode) return;
  if (navigator.share) {
    navigator
      .share({
        title: "FileShare Code",
        text: `Your file code: ${currentCode}`,
      })
      .catch(() => {});
  } else {
    copyCode();
  }
}

/* ── Code Input ────────────────────────────────────────────────────────────── */
function onCodeInput() {
  const val = document.getElementById("codeInput").value;
  document.getElementById("lookupBtn").disabled = val.trim().length < 8;
  // Hide previous results
  document.getElementById("foundCard").classList.add("hidden");
  document.getElementById("errorBox").classList.add("hidden");
}

/* ── Lookup ────────────────────────────────────────────────────────────────── */
async function lookupFile() {
  const code = document.getElementById("codeInput").value.trim().toUpperCase();
  if (code.length < 8) return;

  const lookupBtn = document.getElementById("lookupBtn");
  lookupBtn.textContent = "Searching…";
  lookupBtn.disabled = true;

  document.getElementById("foundCard").classList.add("hidden");
  document.getElementById("errorBox").classList.add("hidden");

  try {
    const res = await fetch(`/api/file/${code}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || "Not found.");

    foundCode = data.code;

    document.getElementById("foundIcon").textContent = fileEmoji(
      data.name,
      data.mimeType,
    );
    document.getElementById("foundName").textContent = data.name;
    document.getElementById("foundMeta").textContent =
      `${data.size} · uploaded ${timeAgo(data.uploadedAt)}`;
    document.getElementById("foundCard").classList.remove("hidden");
  } catch (err) {
    document.getElementById("errorMsg").textContent = err.message;
    document.getElementById("errorBox").classList.remove("hidden");
  }

  lookupBtn.textContent = "Find File";
  lookupBtn.disabled = false;
}

/* ── Preview ───────────────────────────────────────────────────────────────── */
function previewFile() {
  if (!foundCode) return;
  window.open(`/api/preview/${foundCode}`, "_blank");
}

/* ── Download ──────────────────────────────────────────────────────────────── */
function downloadFile() {
  if (!foundCode) return;
  window.location.href = `/api/download/${foundCode}`;
}

/* ── Delete ────────────────────────────────────────────────────────────────── */
async function deleteFile() {
  if (!foundCode) return;

  // Confirm deletion
  const confirmed = confirm(
    `⚠️ This will permanently delete the file. Are you sure?`,
  );
  if (!confirmed) return;

  const deleteBtn = document.getElementById("deleteBtn");
  const originalText = deleteBtn.textContent;
  deleteBtn.textContent = "Deleting…";
  deleteBtn.disabled = true;

  try {
    const res = await fetch(`/api/file/${foundCode}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (!data.success) throw new Error(data.error || "Delete failed.");

    showToast("✅ File deleted successfully!");
    foundCode = null;
    document.getElementById("foundCard").classList.add("hidden");
    document.getElementById("codeInput").value = "";
  } catch (err) {
    showToast("❌ " + err.message);
    deleteBtn.textContent = originalText;
    deleteBtn.disabled = false;
  }
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const diff = (Date.now() - date) / 1000;

  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) return Math.floor(diff / 3600) + " hr ago";
  return Math.floor(diff / 86400) + " days ago";
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    t.classList.add("hidden");
  }, 3000);
}
