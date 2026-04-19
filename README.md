# Procurement Dashboard — โครงสร้างโปรเจกต์

## 📁 File Structure

```
procurement-dashboard/
│
├── index.html              ← HTML เท่านั้น: โครงสร้าง + semantics (ไม่มี JS/CSS inline)
│
├── css/
│   └── styles.css          ← CSS ทั้งหมด: Design tokens, layout, components
│
└── js/
    ├── config.js           ← ค่าคงที่: Sheet IDs, keywords, labels, fallback data
    ├── utils.js            ← Pure functions: CSV parser, column detection, formatters
    ├── dataService.js      ← Data layer: fetch, transform, group, aggregate
    ├── charts.js           ← Chart layer: Chart.js render functions เท่านั้น
    └── app.js              ← App controller: wire UI events, orchestrate modules
```

---

## 🎯 หลักการ Separation of Concerns

| ไฟล์ | รับผิดชอบ | ไม่มี |
|------|-----------|-------|
| `index.html` | โครงสร้าง HTML | Inline JS, Inline CSS |
| `styles.css` | Visual styling ทั้งหมด | Logic, Data |
| `config.js` | ค่าคงที่ทั้งหมด | DOM access, Side effects |
| `utils.js` | Pure helper functions | DOM access, Fetch |
| `dataService.js` | Fetch + Transform ข้อมูล | DOM access, Chart.js |
| `charts.js` | สร้างและอัปเดต Charts | Fetch, Business logic |
| `app.js` | Controller: ประสาน modules + DOM events | Business logic โดยตรง |

---

## 🔑 สิ่งที่ปรับปรุงจาก Single-file เดิม

### CSS
- ใช้ **BEM-inspired naming** (`.value-card__title`, `.modal__header`)
- แบ่งเป็น **sections** ที่มี comment header ชัดเจน
- **CSS custom properties** สำหรับ design tokens ครบถ้วน
- Pill classes เปลี่ยนจาก `.pill-green` → `.pill--green` (BEM modifier)

### JavaScript
- ใช้ **ES Modules** (`import` / `export`) — ไม่ใช่ global variables
- **State object** รวมศูนย์ใน `app.js` — ไม่มี global variables กระจาย
- **Private functions** ใช้ prefix `_` (convention)
- แต่ละ module มี **single responsibility** ชัดเจน
- Debug log เป็น exported array — ไม่ใช่ global

### HTML
- Semantic elements (`<header>`, `<main>`, `<section>`, `<footer>`)
- `id` และ `for` attribute ถูกต้องครบ
- ไม่มี `onclick` ที่ embedded inline logic — ผ่าน `window.app` bridge เท่านั้น

---

## 🚀 วิธีรัน

```bash
# ต้องรันผ่าน HTTP server (ES Modules ไม่ทำงาน file://)
npx serve .
# หรือ
python -m http.server 8080
```

เปิด http://localhost:8080

---

## 📦 Dependencies

- **Chart.js 4.4.1** — โหลดจาก CDN (ไม่ต้อง install)
- ไม่ใช้ framework ใด — Vanilla JS + ES Modules

---

## 🔄 ถ้าต้องการ Scale ต่อ

```
js/
├── config.js
├── utils.js
├── dataService.js
├── charts.js
├── app.js
└── components/           ← เพิ่มในอนาคต
    ├── modal.js
    ├── table.js
    └── filters.js
```
