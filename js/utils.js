/**
 * js/utils.js
 * Pure helper functions — CSV parsing, column detection,
 * state normalisation, date parsing, number helpers, HTML escaping.
 * No DOM access; all functions are exported and side-effect-free.
 */

import { COL_KEYWORDS } from './config.js';

// ── CSV Parser ─────────────────────────────────
/**
 * Parse raw CSV text → { headers: string[], rows: object[] }
 */
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1)
    .map(line => {
      const vals = parseLine(line);
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      return obj;
    })
    .filter(r => Object.values(r).some(v => v !== ''));

  return { headers, rows };
}

function parseLine(line) {
  const vals = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"')       inQ = !inQ;
    else if (c === ',' && !inQ) { vals.push(cur.replace(/^"|"$/g, '')); cur = ''; }
    else cur += c;
  }
  vals.push(cur.replace(/^"|"$/g, ''));
  return vals;
}


// ── Column Detection ───────────────────────────
/**
 * Find a header that best matches the given keyword list.
 * Priority: exact match → starts-with → includes → last-keyword exact
 */
export function detectCol(headers, keywords) {
  const lc = headers.map(h => h.toLowerCase().trim());

  // 1. Exact match (all but last fallback keyword)
  for (let i = 0; i < lc.length; i++)
    if (keywords.slice(0, -1).some(kw => lc[i] === kw)) return headers[i];

  // 2. Starts-with (keywords length > 2)
  for (let i = 0; i < lc.length; i++)
    if (keywords.some(kw => kw.length > 2 &&
        (lc[i].startsWith(kw + ' ') || lc[i].startsWith(kw + '_') || lc[i].startsWith(kw + '.'))))
      return headers[i];

  // 3. Contains (keywords length ≥ 3)
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  for (let i = 0; i < lc.length; i++)
    if (sorted.some(kw => kw.length >= 3 && lc[i].includes(kw))) return headers[i];

  // 4. Last-keyword exact fallback
  const last = keywords[keywords.length - 1];
  for (let i = 0; i < lc.length; i++) if (lc[i] === last) return headers[i];

  return null;
}

/**
 * Detect State column — prefers exact 'state', then 'status', then contains.
 */
export function detectStateCol(headers) {
  const lc = headers.map(h => h.toLowerCase().trim());
  const exact = lc.findIndex(h => h === 'state');
  if (exact >= 0)  return headers[exact];
  const stat  = lc.findIndex(h => h === 'status');
  if (stat  >= 0)  return headers[stat];
  for (let i = 0; i < lc.length; i++)
    if (COL_KEYWORDS.STATE.some(kw => lc[i].includes(kw))) return headers[i];
  return null;
}

/**
 * Detect PO Number column — avoids matching PO Date variants.
 */
export function detectPONumCol(headers) {
  const lc = headers.map(h => h.toLowerCase().trim());
  for (let i = 0; i < lc.length; i++)
    if (['po no','po number','po#','po_no','po_number'].includes(lc[i])) return headers[i];
  for (let i = 0; i < lc.length; i++) {
    const h = lc[i];
    if (h.startsWith('po') && !h.includes('date') && !h.includes('วัน')) return headers[i];
  }
  return null;
}


// ── State Normalisation ────────────────────────
/**
 * Map raw state strings → canonical values.
 */
export function normalizeState(raw) {
  if (!raw) return 'Open';
  const v = raw.trim();
  if (/^grpo$/i.test(v))      return 'GRPO';
  if (/^archived?$/i.test(v)) return 'Archived';
  if (/^open$/i.test(v))      return 'Open';
  if (/^cancel/i.test(v) || /ยกเลิก/.test(v)) return 'Cancelled';
  if (/^closed?$/i.test(v))   return 'Closed';
  if (/grpo/i.test(v))        return 'GRPO';
  if (/archiv/i.test(v))      return 'Archived';
  if (/cancel/i.test(v))      return 'Cancelled';
  if (/close/i.test(v))       return 'Closed';
  return v || 'Open';
}


// ── Date Parsing ───────────────────────────────
/**
 * Parse a PO date string into a structured object.
 * Handles: DD/MM/YYYY, YYYY-MM-DD, MM/YYYY
 * Returns null if unparseable.
 *
 * Special rule: Dec 2025 is folded into Jan 2026 for chart purposes.
 */
export function parsePODate(raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  let d = null;

  const p1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (p1) {
    let [, a, b, c] = p1;
    const yr = c.length === 2 ? 2000 + parseInt(c) : parseInt(c);
    if      (parseInt(a) > 12) d = new Date(yr, parseInt(b) - 1, parseInt(a)); // a=day
    else if (parseInt(b) > 12) d = new Date(yr, parseInt(a) - 1, parseInt(b)); // b=day
    else                       d = new Date(yr, parseInt(b) - 1, parseInt(a)); // Thai DD/MM/YYYY
  }

  const p2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!d && p2) d = new Date(parseInt(p2[1]), parseInt(p2[2]) - 1, parseInt(p2[3]));

  const p3 = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (!d && p3) d = new Date(parseInt(p3[2]), parseInt(p3[1]) - 1, 1);

  if (!d || isNaN(d.getTime())) return null;

  const year = d.getFullYear(), month = d.getMonth() + 1, day = d.getDate();
  let sortYear = year, sortMonth = month;
  if (year === 2025 && month === 12) { sortYear = 2026; sortMonth = 1; }

  return {
    year, month, day,
    sortVal:    sortYear * 10000 + sortMonth * 100 + day,
    chartYear:  sortYear,
    chartMonth: sortMonth,
  };
}


// ── Row Field Helpers ──────────────────────────
/**
 * Extract first positive numeric value matching any keyword.
 */
export function getNum(row, keywords) {
  for (const k of Object.keys(row)) {
    if (keywords.some(kw => k.toLowerCase().includes(kw))) {
      const v = parseFloat((row[k] || '').replace(/,/g, ''));
      if (!isNaN(v) && v > 0) return v;
    }
  }
  return 0;
}

/**
 * Extract first non-empty string value matching any keyword.
 */
export function getStr(row, keywords) {
  for (const k of Object.keys(row)) {
    if (keywords.some(kw => k.toLowerCase().includes(kw))) {
      if (row[k] && row[k].trim()) return row[k].trim();
    }
  }
  return '';
}


// ── Number / String Formatters ─────────────────
/** Format as Thai Baht with thousands separator; returns '—' for zero/null. */
export function fmtBaht(n) {
  return n ? '฿' + Math.round(n).toLocaleString() : '—';
}

/** Format number with thousands separator. */
export function fmtBG(n) {
  if (n === null || n === undefined) return '—';
  return Math.round(n).toLocaleString();
}

/** Format as percentage with 2 decimal places. */
export function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(2) + '%';
}


// ── HTML Helpers ───────────────────────────────
/** Escape text for safe innerHTML insertion. */
export function esc(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape text for use inside HTML attribute values (single-quote context). */
export function escAttr(s) {
  return (s || '')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;');
}


// ── Colour Helpers ─────────────────────────────
/** Return a traffic-light colour based on % budget remaining. */
export function pctColor(pct) {
  if (pct <= 0)  return '#A32D2D';  // over budget — red
  if (pct <= 30) return '#BA7517';  // low remain  — amber
  if (pct <= 70) return '#378ADD';  // mid         — blue
  return '#1D9E75';                 // high remain — green
}
