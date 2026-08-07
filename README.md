# RAXSA Portal — Production Refactor

Portal internal untuk tim RAXSA Apparel.  
Brand colors: Kuning + Hitam + Putih.

> **Security Notice:** This is a static client-side portal. Production access control is enforced by **Cloudflare Access** at the deployment perimeter. The client-side login UI is preserved for UX compatibility only and does not constitute a security boundary.

---

## Struktur File

```
├── index.html              ← Login page (UX state only)
├── css/
│   ├── base.css            ← Design tokens, reset, typography
│   ├── layout.css          ← Sidebar, topbar, grid, responsive
│   ├── components.css      ← Cards, buttons, badges, forms, toast
│   ├── theme.css           ← Dark mode utilities
│   └── pages/
│       ├── auth.css        ← Login page styles only
│       ├── dashboard.css   ← Dashboard page styles only
│       ├── rekap.css       ← Rekap page styles only
│       └── maps.css        ← Maps page styles only
├── js/
│   ├── auth.js             ← UX session guard (NOT a security perimeter)
│   ├── theme.js            ← Dark mode toggle module
│   ├── nav.js              ← Sidebar, mobile nav, toast module
│   ├── maps-data.js        ← Fetch, parse, validate, normalize sheet data
│   ├── maps.js             ← Map orchestration, interaction, safe rendering
│   └── rekap.js            ← Rekap fetch, validate, safe rendering
└── pages/
    ├── dashboard.html      ← Main hub
    ├── rekap.html          ← Google Sheets links
    └── maps.html           ← Interactive map
```

## Module Responsibility

| File | Responsibility |
|------|----------------|
| `auth.js` | Client-side UX session state. Sets/reads session flag. **Not security.** |
| `theme.js` | Dark/light mode toggle, localStorage preference, icon update. |
| `nav.js` | Sidebar, mobile navigation, active state, toast, logout interaction. |
| `maps-data.js` | Fetch Google Sheets CSV → parse → validate → normalize → return clean data. |
| `maps.js` | Leaflet map init, markers, popups, location list, search, autocomplete, filtering. |
| `rekap.js` | Fetch Google Sheets CSV → validate → group by vendor → safe DOM rendering. |

## Security Architecture

```
Internet
   │
   ▼
Cloudflare Access  ←── Production security perimeter (identity provider)
   │
   ▼
Cloudflare Pages   ←── Static hosting (this portal)
   │
   ▼
Google Sheets CSV  ←── Data source (external, untrusted input)
```

- **Cloudflare Access** is the only production-grade access control.
- **No password** is stored in this repository.
- **No credential** is stored in localStorage or source code.
- Client-side JavaScript performs data validation and safe DOM rendering to prevent XSS from untrusted sheet data.

## Google Sheets Data Limitations

> **Important:** Google Sheets CSV links used in this portal are **publicly accessible** to anyone who has the URL. They are not protected by authentication at the data layer.
>
> - Do not store sensitive personal data, financial secrets, or confidential business information in these sheets.
> - If the CSV publish link is leaked, the data is readable by anyone on the internet.
> - For sensitive data, use Google Sheets with restricted sharing and access the data through a backend proxy, not direct public CSV links.
>
> This architecture is acceptable only for operational data with low sensitivity.

## How to Update Maps Data

1. Edit Google Sheets with columns: `name, type, lat, lng, address`
2. Valid `type` values: `kantor`, `vendor`, `mitra`
3. `lat` must be between `-90` and `90`; `lng` between `-180` and `180`
4. Publish to web as **CSV**
5. Paste the CSV URL into `js/maps-data.js` → `SHEET_CSV_URL`
6. Or edit fallback data in `js/maps-data.js` → `getSampleLocations()`
7. Deploy

## How to Update Rekap Data

1. Edit Google Sheets with columns: `name, vendor, url, description, icon`
2. `vendor` determines the group heading
3. `url` must start with `https://` to be clickable
4. Optional `icon` values: `folder`, `money`, `users`, `box`, `image`, `monitor`, `file`
5. Paste the CSV URL into `js/rekap.js` → `REKAP_SHEET_URL`
6. Paste the edit URL into `js/rekap.js` → `REKAP_SHEET_EDIT_URL`
7. Deploy

## Deployment

1. Push to GitHub
2. Connect repository to **Cloudflare Pages**
3. Enable **Cloudflare Access** on the custom domain
4. Deploy static

No build step required. This is a vanilla HTML/CSS/JS static site.

## Data Validation & Safe Rendering

All external data from Google Sheets is treated as **untrusted input**:

- Invalid rows are skipped with console warnings
- `name`, `address`, `description`, and `vendor` are escaped before DOM insertion
- External Google Sheets text is never injected into HTML using `innerHTML`
- URLs are validated (`http://` or `https://` only) before creating links
- External links use `target="_blank"` + `rel="noopener noreferrer"`

---

RAXSA Apparel © 2026
