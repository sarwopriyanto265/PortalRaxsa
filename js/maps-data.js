/**
 * RAXSA Portal — Maps Data Module
 *
 * Responsibility: fetch, parse, validate, normalize Google Sheets CSV data.
 */

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_vyXIo1uHg03AQ1vl2L3PomHiWfnelcUch352c0HH9J1Y13qtXnk_SwY_MpYMDC7elBCYQ-szT4RE/pub?output=csv";

const VALID_TYPES = new Set(["kantor", "vendor", "mitra"]);

// ─── Strip BOM if present ───
function stripBOM(text) {
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
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
      // End of row
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

  // Push final field and row
  currentRow.push(currentField.trim());
  if (currentRow.length > 1 || currentRow[0] !== "") {
    rows.push(currentRow);
  }

  return rows;
}

// ─── Parse Coordinate (Indonesian comma-decimal format) ───
function parseCoord(val) {
  if (val == null) return NaN;
  const cleaned = String(val).trim().replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

// ─── Validate Single Location ───
function validateLocation(row, rowIndex) {
  const errors = [];

  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) errors.push("name is empty");

  const typeRaw = typeof row.type === "string" ? row.type.trim().toLowerCase() : "";
  const type = VALID_TYPES.has(typeRaw) ? typeRaw : "";
  if (!type) errors.push(`type "${typeRaw}" is invalid (expected: kantor, vendor, mitra)`);

  const lat = parseCoord(row.lat);
  const lng = parseCoord(row.lng);

  if (!Number.isFinite(lat)) {
    errors.push(`lat "${row.lat}" is not a valid number`);
  } else if (lat < -90 || lat > 90) {
    errors.push(`lat ${lat} is out of range [-90, 90]`);
  }

  if (!Number.isFinite(lng)) {
    errors.push(`lng "${row.lng}" is not a valid number`);
  } else if (lng < -180 || lng > 180) {
    errors.push(`lng ${lng} is out of range [-180, 180]`);
  }

  const address = typeof row.address === "string" ? row.address.trim() : "";

  if (errors.length) {
    console.warn(`[MAPS-DATA] Skipping row ${rowIndex}: ${errors.join("; ")}`);
    return null;
  }

  return { name, type, lat, lng, address };
}

// ─── Fetch & Parse Sheet Data ───
async function fetchSheetData() {
  if (!SHEET_CSV_URL) return null;
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) {
      console.warn("[MAPS-DATA] HTTP error:", response.status);
      return null;
    }
    const text = stripBOM(await response.text());
    const rows = parseCSV(text);

    if (rows.length < 2) {
      console.warn("[MAPS-DATA] Sheet has no data rows");
      return null;
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const data = [];

    for (let i = 1; i < rows.length; i++) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = rows[i][idx] || "";
      });
      const loc = validateLocation(row, i + 1);
      if (loc) data.push(loc);
    }

    console.log("[MAPS-DATA] Loaded", data.length, "valid locations from sheet");
    return data;
  } catch (e) {
    console.warn("[MAPS-DATA] Failed to fetch sheet:", e);
    return null;
  }
}

// ─── Sample Fallback Data ───
// Returns empty array in production. Real vendor data must come from Google Sheets.
function getSampleLocations() {
  return [];
}

window.RaxsaMapsData = {
  fetchSheetData,
  getSampleLocations,
  parseCSV,
  parseCoord,
  validateLocation,
};
