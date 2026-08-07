/**
 * RAXSA Portal — Rekap Module
 *
 * Responsibility: fetch, validate, normalize, and safely render
 * grouped rekap cards from Google Sheets CSV.
 */

const REKAP_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQlTJuPbx408Jf9E9oxfK6ygtBGA0bjpUOW7c7-WIou_8oB1uu7fzocq46MG4zKITK1BL1ckx9eYaip/pub?output=csv";

const REKAP_SHEET_EDIT_URL =
  "https://docs.google.com/spreadsheets/d/1InEBk-TB4NlI45DRLBMnhVW-R7XcHO2Y_ZRQxzyWA9w/edit?usp=sharing";

console.log("[REKAP] CSV URL:", REKAP_SHEET_URL || "(belum di-set)");
console.log("[REKAP] Edit URL:", REKAP_SHEET_EDIT_URL || "(belum di-set)");

// Sample fallback data — generic placeholders only, no invented business categories
const SAMPLE_REKAP = [];

const REKAP_ICONS = {
  folder:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  money:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  users:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>',
  box: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  image:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  monitor:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  file: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
};

let allRekapData = [];

// ─── Safe HTML Escape ───
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Escape RegExp special characters ───
function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Validate URL ───
function isValidHttpUrl(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

// ─── Parse CSV text into rows (handles quoted fields, multiline, escaped quotes, CRLF) ───
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (!inQuotes && (char === "\n" || (char === "\r" && next === "\n"))) {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      if (char === "\r" && next === "\n") {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      currentRow.push(currentField.trim());
      currentField = "";
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  currentRow.push(currentField.trim());
  if (currentRow.length > 1 || currentRow[0] !== "") {
    rows.push(currentRow);
  }

  return rows;
}

// ─── Strip BOM ───
function stripBOM(text) {
  if (text.charCodeAt(0) === 0xFEFF) return text.slice(1);
  return text;
}

// ─── Validate & Normalize Row ───
function validateRekapRow(rawRow, rowIndex) {
  const name = typeof rawRow.name === "string" ? rawRow.name.trim() : "";
  if (!name) {
    console.warn(`[REKAP] Skipping row ${rowIndex}: name is empty`);
    return null;
  }

  const vendor = typeof rawRow.vendor === "string"
    ? rawRow.vendor.trim()
    : (typeof rawRow.category === "string" ? rawRow.category.trim() : "Lainnya");

  const url = typeof rawRow.url === "string" ? rawRow.url.trim() : "";

  const description = typeof rawRow.description === "string" ? rawRow.description.trim() : "";

  const icon = typeof rawRow.icon === "string" ? rawRow.icon.trim().toLowerCase() : "file";

  return { name, vendor, url, description, icon };
}

// ─── Fetch Rekap Data ───
async function fetchRekapData() {
  if (!REKAP_SHEET_URL) return null;
  try {
    const response = await fetch(REKAP_SHEET_URL);
    if (!response.ok) {
      console.warn("[REKAP] HTTP error:", response.status);
      return null;
    }
    const text = stripBOM(await response.text());
    const rows = parseCSV(text);

    if (rows.length < 2) {
      console.warn("[REKAP] Sheet has no data rows");
      return null;
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const data = [];

    for (let i = 1; i < rows.length; i++) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = rows[i][idx] || "";
      });
      const item = validateRekapRow(row, i + 1);
      if (item) data.push(item);
    }

    console.log("[REKAP] Loaded from sheet:", data.length, "items");
    return data;
  } catch (e) {
    console.warn("[REKAP] Gagal fetch sheet:", e);
    return null;
  }
}

// ─── Group by Vendor ───
function groupByVendor(data) {
  const groups = {};
  data.forEach((item) => {
    const v = item.vendor || "Lainnya";
    if (!groups[v]) groups[v] = [];
    groups[v].push(item);
  });
  return Object.keys(groups)
    .sort()
    .reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {});
}

// ─── Build Highlighted Text Nodes (Safe) ───
function createHighlightedNodes(text, query) {
  const fragment = document.createDocumentFragment();
  if (!query) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }
  const q = query.toLowerCase();
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(regex);
  parts.forEach((part) => {
    if (part.toLowerCase() === q) {
      const mark = document.createElement("mark");
      mark.textContent = part;
      fragment.appendChild(mark);
    } else {
      fragment.appendChild(document.createTextNode(part));
    }
  });
  return fragment;
}

// ─── Render Single Card (Safe DOM) ───
function renderCardElement(item) {
  const iconSvg = REKAP_ICONS[item.icon] || REKAP_ICONS.file;
  const hasValidUrl = isValidHttpUrl(item.url);

  const card = document.createElement(hasValidUrl ? "a" : "div");
  card.className = "sheet-card rekap-card";
  card.dataset.url = item.url;
  card.dataset.name = item.name.toLowerCase();
  card.dataset.desc = (item.description || "").toLowerCase();
  card.dataset.vendor = item.vendor.toLowerCase();

  if (hasValidUrl) {
    card.href = item.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
  } else {
    card.style.cursor = "pointer";
  }

  const iconWrap = document.createElement("div");
  iconWrap.className = "sheet-icon";
  iconWrap.innerHTML = iconSvg;
  card.appendChild(iconWrap);

  const title = document.createElement("div");
  title.className = "sheet-title";
  title.textContent = item.name;
  card.appendChild(title);

  const desc = document.createElement("div");
  desc.className = "sheet-desc";
  desc.textContent = item.description || "Rekap data operasional.";
  card.appendChild(desc);

  const meta = document.createElement("div");
  meta.className = "sheet-meta";
  meta.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span></span>`;
  meta.querySelector("span").textContent = item.vendor;
  card.appendChild(meta);

  if (!hasValidUrl) {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.RaxsaNav) {
        RaxsaNav.showToast(
          "🔗 Edit Google Sheets dan masukkan URL yang valid!",
        );
      }
    });
  }

  return card;
}

// ─── Render Grouped Cards (Safe DOM) ───
function renderGrouped(data) {
  const container = document.getElementById("rekap-container");
  if (!container) {
    console.error("[REKAP] Element #rekap-container tidak ditemukan!");
    return;
  }

  container.innerHTML = "";

  if (!data || !data.length) {
    const empty = document.createElement("div");
    empty.style.textAlign = "center";
    empty.style.padding = "40px";
    empty.style.color = "var(--color-text-muted)";
    empty.textContent = "Tidak ada data rekap.";
    container.appendChild(empty);
    return;
  }

  const groups = groupByVendor(data);

  Object.entries(groups).forEach(([vendor, items]) => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "rekap-group";
    groupDiv.dataset.vendor = vendor.toLowerCase();

    const header = document.createElement("div");
    header.className = "rekap-group-header";

    const badge = document.createElement("span");
    badge.className = "rekap-group-badge";
    badge.textContent = vendor;
    header.appendChild(badge);

    const count = document.createElement("span");
    count.className = "rekap-group-count";
    count.textContent = `${items.length} dokumen`;
    header.appendChild(count);

    groupDiv.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "sheet-grid rekap-group-grid";

    items.forEach((item) => {
      grid.appendChild(renderCardElement(item));
    });

    groupDiv.appendChild(grid);
    container.appendChild(groupDiv);
  });
}

// ─── Filter Rekap ───
function filterRekap(query) {
  const q = query.toLowerCase().trim();
  const groups = document.querySelectorAll(".rekap-group");

  if (!q) {
    groups.forEach((g) => {
      g.style.display = "";
    });
    document.querySelectorAll(".rekap-card").forEach((card) => {
      card.style.display = "";
      const title = card.querySelector(".sheet-title");
      const desc = card.querySelector(".sheet-desc");
      if (title) {
        title.innerHTML = "";
        title.textContent = card.dataset.name || "";
      }
      if (desc) {
        desc.innerHTML = "";
        desc.textContent = card.dataset.desc || "";
      }
    });
    return;
  }

  groups.forEach((group) => {
    const cards = group.querySelectorAll(".rekap-card");
    let hasVisible = false;

    cards.forEach((card) => {
      const name = card.dataset.name || "";
      const desc = card.dataset.desc || "";
      const vendor = card.dataset.vendor || "";
      const match = name.includes(q) || desc.includes(q) || vendor.includes(q);

      if (match) {
        card.style.display = "";
        hasVisible = true;
        const titleEl = card.querySelector(".sheet-title");
        const descEl = card.querySelector(".sheet-desc");
        if (titleEl) {
          titleEl.innerHTML = "";
          titleEl.appendChild(createHighlightedNodes(card.dataset.name || "", q));
        }
        if (descEl) {
          descEl.innerHTML = "";
          descEl.appendChild(createHighlightedNodes(card.dataset.desc || "", q));
        }
      } else {
        card.style.display = "none";
      }
    });

    group.style.display = hasVisible ? "" : "none";
  });
}

// ─── Init Search ───
function initRekapSearch() {
  const input = document.getElementById("rekap-search");
  if (!input) return;

  input.addEventListener("input", (e) => {
    filterRekap(e.target.value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      filterRekap("");
    }
  });
}

// ─── Setup Edit Button ───
function setupEditButton() {
  const btn = document.getElementById("edit-sheet-btn");
  const hint = document.getElementById("edit-sheet-hint");

  if (!btn) {
    console.error("[REKAP] Tombol #edit-sheet-btn TIDAK DITEMUKAN di HTML!");
    return;
  }

  const isValid = isValidHttpUrl(REKAP_SHEET_EDIT_URL);

  if (isValid) {
    btn.href = REKAP_SHEET_EDIT_URL;
    btn.style.display = "inline-flex";
    if (hint) hint.style.display = "none";
    console.log("[REKAP] Tombol AKTIF, URL:", REKAP_SHEET_EDIT_URL);
  } else {
    btn.style.display = "none";
    if (hint) hint.style.display = "block";
    console.log("[REKAP] Tombol DISembunyikan (URL belum valid)");
  }
}

// ─── Init ───
async function initRekap() {
  console.log("[REKAP] initRekap() mulai...");
  const data = await fetchRekapData();
  allRekapData = data || SAMPLE_REKAP;
  renderGrouped(allRekapData);
  initRekapSearch();
  setupEditButton();
  console.log("[REKAP] initRekap() selesai.");
}

window.RaxsaRekap = { initRekap };
