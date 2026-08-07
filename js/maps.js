/**
 * RAXSA Portal — Maps Module
 *
 * Responsibility: map orchestration, interaction, and safe UI rendering.
 * Data layer lives in maps-data.js.
 */

const DEFAULT_CENTER = [-7.7619, 110.3961];
const DEFAULT_ZOOM = 12;

const TYPE_COLORS = { kantor: "#F5B800", vendor: "#EF4444", mitra: "#10B981" };
const TYPE_LABELS = { kantor: "Kantor", vendor: "Vendor", mitra: "Mitra" };

let map,
  markers = [],
  allLocations = [];

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

// ─── Load Leaflet ───
async function loadLeaflet() {
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
  if (typeof L === "undefined") {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
}

// ─── Build Safe Popup Element ───
function buildPopupElement(loc) {
  const color = TYPE_COLORS[loc.type] || TYPE_COLORS.vendor;
  const wrapper = document.createElement("div");
  wrapper.style.fontFamily = "Inter, sans-serif";
  wrapper.style.minWidth = "220px";

  const nameEl = document.createElement("strong");
  nameEl.style.fontSize = "14px";
  nameEl.style.color = "#0f172a";
  nameEl.textContent = loc.name;
  wrapper.appendChild(nameEl);

  const typeRow = document.createElement("div");
  typeRow.style.marginTop = "4px";
  typeRow.style.fontSize = "12px";
  typeRow.style.color = "#64748b";

  const dot = document.createElement("span");
  dot.style.display = "inline-block";
  dot.style.width = "8px";
  dot.style.height = "8px";
  dot.style.background = color;
  dot.style.borderRadius = "50%";
  dot.style.marginRight = "4px";
  typeRow.appendChild(dot);

  typeRow.appendChild(document.createTextNode(TYPE_LABELS[loc.type] || loc.type));
  wrapper.appendChild(typeRow);

  if (loc.address) {
    const addrEl = document.createElement("div");
    addrEl.style.marginTop = "6px";
    addrEl.style.fontSize = "12px";
    addrEl.style.color = "#475569";
    addrEl.textContent = loc.address;
    wrapper.appendChild(addrEl);
  }

  const linkWrap = document.createElement("div");
  linkWrap.style.marginTop = "8px";

  const link = document.createElement("a");
  link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.lat)},${encodeURIComponent(loc.lng)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.fontSize = "12px";
  link.style.color = "#F5B800";
  link.style.textDecoration = "none";
  link.style.fontWeight = "600";
  link.textContent = "Buka di Google Maps →";
  linkWrap.appendChild(link);

  wrapper.appendChild(linkWrap);
  return wrapper;
}

// ─── Show Map Error State ───
function showMapError(message) {
  const container = document.getElementById("location-list");
  if (container) {
    container.innerHTML = "";
    const err = document.createElement("div");
    err.style.padding = "20px";
    err.style.textAlign = "center";
    err.style.color = "var(--color-text-muted)";
    err.style.fontSize = "13px";
    err.textContent = message;
    container.appendChild(err);
  }
  const mapContainer = document.getElementById("map");
  if (mapContainer) {
    mapContainer.innerHTML = "";
    const err = document.createElement("div");
    err.style.padding = "40px";
    err.style.textAlign = "center";
    err.style.color = "var(--color-text-muted)";
    err.style.fontSize = "14px";
    err.textContent = message;
    mapContainer.appendChild(err);
  }
}

// ─── Init Map ───
async function initMap() {
  const container = document.getElementById("map");
  if (!container) return;

  await loadLeaflet();

  let locations = null;
  if (window.RaxsaMapsData) {
    locations = await window.RaxsaMapsData.fetchSheetData();
  }

  if (!locations) {
    console.warn("[MAPS] Failed to load location data from Google Sheets");
    showMapError("Gagal memuat data lokasi. Periksa koneksi internet atau URL Google Sheets.");
    return;
  }

  if (!locations.length) {
    console.warn("[MAPS] Sheet returned empty data");
    showMapError("Tidak ada data lokasi yang tersedia.");
    return;
  }

  allLocations = locations;

  map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const bounds = L.latLngBounds();
  markers = [];

  locations.forEach((loc) => {
    const color = TYPE_COLORS[loc.type] || TYPE_COLORS.vendor;

    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: 10,
      fillColor: color,
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(map);

    marker.bindPopup(buildPopupElement(loc));
    markers.push({ marker, loc });
    bounds.extend([loc.lat, loc.lng]);
  });

  if (markers.length) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }

  buildList(locations);
  initSearch(locations);
}

// ─── Build Location List (Safe DOM) ───
function buildList(locations) {
  const container = document.getElementById("location-list");
  if (!container) return;

  container.innerHTML = "";

  if (!locations || !locations.length) {
    const empty = document.createElement("div");
    empty.style.padding = "20px";
    empty.style.textAlign = "center";
    empty.style.color = "var(--color-text-muted)";
    empty.style.fontSize = "13px";
    empty.textContent = "Tidak ada lokasi.";
    container.appendChild(empty);
    return;
  }

  const grouped = { kantor: [], vendor: [], mitra: [] };
  locations.forEach((loc) => {
    (grouped[loc.type] || grouped.vendor).push(loc);
  });

  Object.entries(grouped).forEach(([type, items]) => {
    if (!items.length) return;
    const color = TYPE_COLORS[type];

    const groupDiv = document.createElement("div");
    groupDiv.style.marginBottom = "16px";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "6px";
    header.style.marginBottom = "8px";
    header.style.fontSize = "12px";
    header.style.fontWeight = "700";
    header.style.textTransform = "uppercase";
    header.style.color = "var(--color-text-muted)";

    const dot = document.createElement("span");
    dot.style.width = "8px";
    dot.style.height = "8px";
    dot.style.background = color;
    dot.style.borderRadius = "50%";
    header.appendChild(dot);

    header.appendChild(document.createTextNode(`${TYPE_LABELS[type]} (${items.length})`));
    groupDiv.appendChild(header);

    items.forEach((loc) => {
      const idx = markers.findIndex((m) => m.loc === loc);
      const btn = document.createElement("button");
      btn.className = "loc-item";
      btn.dataset.idx = idx;

      const strong = document.createElement("strong");
      strong.textContent = loc.name;
      btn.appendChild(strong);

      if (loc.address) {
        const span = document.createElement("span");
        span.textContent = loc.address;
        btn.appendChild(span);
      }

      btn.addEventListener("click", () => flyToMarker(idx));
      groupDiv.appendChild(btn);
    });

    container.appendChild(groupDiv);
  });
}

// ─── Fly to Marker ───
function flyToMarker(idx) {
  if (!markers[idx]) return;
  const m = markers[idx];
  map.flyTo(m.marker.getLatLng(), 17, { duration: 1 });
  m.marker.openPopup();

  document.querySelectorAll(".loc-item").forEach((b) => {
    b.style.borderColor = "var(--color-border)";
  });
  const btn = document.querySelector(`.loc-item[data-idx="${idx}"]`);
  if (btn) {
    btn.style.borderColor = "var(--color-primary)";
    btn.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// ─── Filter by Type ───
function filterMarkers(type) {
  markers.forEach(({ marker, loc }) => {
    if (type === "all" || loc.type === type) marker.addTo(map);
    else marker.remove();
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(`.filter-btn[data-filter="${type}"]`);
  if (activeBtn) activeBtn.classList.add("active");
}

// ─── Build Highlighted Text Nodes (Safe, no innerHTML) ───
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

// ─── Search + Autocomplete (Safe DOM) ───
function initSearch(locations) {
  const input = document.getElementById("map-search");
  const dropdown = document.getElementById("search-suggestions");
  if (!input || !dropdown) return;

  let activeIndex = -1;

  function clearDropdown() {
    dropdown.innerHTML = "";
    dropdown.classList.remove("show");
    activeIndex = -1;
  }

  function renderSuggestions(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      clearDropdown();
      return;
    }

    const matches = locations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        (loc.address && loc.address.toLowerCase().includes(q)),
    );

    dropdown.innerHTML = "";

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "suggestion-empty";
      empty.textContent = "Tidak ada lokasi yang cocok.";
      dropdown.appendChild(empty);
      dropdown.classList.add("show");
      return;
    }

    matches.forEach((loc, i) => {
      const color = TYPE_COLORS[loc.type] || TYPE_COLORS.vendor;
      const idx = markers.findIndex((m) => m.loc === loc);

      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.dataset.idx = idx;
      item.dataset.i = i;

      const dot = document.createElement("span");
      dot.className = "suggestion-dot";
      dot.style.background = color;
      item.appendChild(dot);

      const info = document.createElement("div");
      info.className = "suggestion-info";

      const nameEl = document.createElement("div");
      nameEl.className = "suggestion-name";
      nameEl.appendChild(createHighlightedNodes(loc.name, q));
      info.appendChild(nameEl);

      if (loc.address) {
        const addrEl = document.createElement("div");
        addrEl.className = "suggestion-address";
        addrEl.appendChild(createHighlightedNodes(loc.address, q));
        info.appendChild(addrEl);
      }

      item.appendChild(info);

      const typeEl = document.createElement("span");
      typeEl.className = "suggestion-type";
      typeEl.textContent = TYPE_LABELS[loc.type] || loc.type;
      item.appendChild(typeEl);

      item.addEventListener("click", () => {
        flyToMarker(idx);
        clearDropdown();
        input.value = "";
      });

      dropdown.appendChild(item);
    });

    dropdown.classList.add("show");
    activeIndex = -1;
  }

  function updateActive(items) {
    items.forEach((item, i) => item.classList.toggle("active", i === activeIndex));
    if (items[activeIndex]) {
      items[activeIndex].scrollIntoView({ block: "nearest" });
    }
  }

  input.addEventListener("input", (e) => renderSuggestions(e.target.value));

  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll(".suggestion-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = activeIndex >= 0 ? items[activeIndex] : items[0];
      if (target) target.click();
    } else if (e.key === "Escape") {
      clearDropdown();
    }
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      clearDropdown();
    }
  });
}

window.RaxsaMaps = { initMap, filterMarkers };
