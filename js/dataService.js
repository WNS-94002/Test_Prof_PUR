/**
 * js/dataService.js
 * All data-fetching and transformation logic.
 * Returns plain objects — no DOM access.
 */

import { SHEET_ID, SHEETS, BG_GID, BG_FALLBACK, COL_KEYWORDS, STATE_RANK } from './config.js';
import {
  parseCSV, detectCol, detectStateCol, detectPONumCol,
  normalizeState, parsePODate, getNum, getStr,
} from './utils.js';

// ── Public debug log (filled during load) ─────
export const debugLog = [];


/**
 * Detect columns from headers, then map all rows at once.
 */
function detectAndMapRows(rawRows, headers, { gid, name, label, group }) {
  const roCol     = detectCol(headers, COL_KEYWORDS.RO_NO);
  const stateCol  = detectStateCol(headers);
  const vendorCol = detectCol(headers, COL_KEYWORDS.VENDOR);
  const descCol   = detectCol(headers, COL_KEYWORDS.DESC);
  const roNameCol = detectCol(headers, COL_KEYWORDS.RO_NAME);
  const poDateCol = detectCol(headers, COL_KEYWORDS.PO_DATE);
  const poNumCol  = detectPONumCol(headers);

  debugLog.push({
    sheet: name, headers, roCol, stateCol,
    vendorCol, descCol, roNameCol, poDateCol, poNumCol,
  });

  return rawRows.map((r, i) => {
    const roVal     = roCol     ? (r[roCol]     || '').trim() : '';
    const stateRaw  = stateCol  ? (r[stateCol]  || '').trim() : '';
    const qty       = getNum(r, COL_KEYWORDS.QTY);
    const price     = getNum(r, COL_KEYWORDS.PRICE);
    const total     = getNum(r, COL_KEYWORDS.TOTAL) || (qty * price);
    const descVal   = descCol   ? (r[descCol]   || '').trim() : '';
    const roNameVal = roNameCol ? (r[roNameCol] || '').trim() : (descVal || roVal || `${name}-row${i + 1}`);
    const poDateRaw = poDateCol ? (r[poDateCol] || '') : '';
    const poNumVal  = poNumCol  ? (r[poNumCol]  || '').trim() : '';

    return {
      ...r,
      _gid:     gid,
      _sheet:   name,
      _label:   label,
      _group:   group,
      _stateRaw: stateRaw,
      _state:   normalizeState(stateRaw),
      _ro:      roVal || `${name}-row${i + 1}`,
      _roName:  roNameVal,
      _hasRO:   !!roVal,
      _vendor:  vendorCol ? (r[vendorCol] || '').trim() : getStr(r, COL_KEYWORDS.VENDOR),
      _desc:    descVal,
      _code:    getStr(r, COL_KEYWORDS.CODE),
      _qty:     qty,
      _unit:    getStr(r, COL_KEYWORDS.UNIT),
      _price:   price,
      _total:   total,
      _poDate:  parsePODate(poDateRaw),
      _poDateRaw: poDateRaw,
      _poNum:   poNumVal,
    };
  });
}


// ── Sheet Fetcher ──────────────────────────────
/**
 * Fetch a single budget sheet and return normalised rows.
 * Returns [] on network / parse error.
 */
export async function fetchSheet({ gid, name, label, group }) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const { headers, rows } = parseCSV(text);
    return detectAndMapRows(rows, headers, { gid, name, label, group });
  } catch (err) {
    console.warn(`Budget ${name} failed:`, err.message);
    debugLog.push({ sheet: name, headers: [], roCol: null, error: err.message });
    return [];
  }
}


// ── Group By RO ────────────────────────────────
/**
 * Aggregate flat rows into one entry per (gid, roNumber) pair.
 * - Highest STATE_RANK wins for the group state
 * - Latest PO Date (by sortVal) is kept
 * - Total is summed
 */
export function groupByRO(rows) {
  const map = new Map();

  for (const r of rows) {
    const key = `${r._gid}||${r._ro}`;

    if (!map.has(key)) {
      map.set(key, {
        _key:     key,
        _ro:      r._ro,
        _roName:  r._roName,
        _hasRO:   r._hasRO,
        _gid:     r._gid,
        _sheet:   r._sheet,
        _label:   r._label,
        _group:   r._group,
        _state:   r._state,
        _stateRaw: r._stateRaw,
        _total:   0,
        _vendor:  r._vendor,
        _poDate:  r._poDate,
        _poDateRaw: r._poDateRaw,
        _poNum:   r._poNum,
        _items:   [],
      });
    }

    const g = map.get(key);
    g._total += (r._total || 0);
    g._items.push(r);

    if (!g._vendor  && r._vendor)  g._vendor  = r._vendor;
    if (!g._roName  && r._roName)  g._roName  = r._roName;
    if (!g._poNum   && r._poNum)   g._poNum   = r._poNum;

    // Keep latest PO date
    if (r._poDate && (!g._poDate || r._poDate.sortVal > g._poDate.sortVal)) {
      g._poDate    = r._poDate;
      g._poDateRaw = r._poDateRaw;
    }

    // Upgrade state to highest rank
    if ((STATE_RANK[r._state] || 0) > (STATE_RANK[g._state] || 0)) {
      g._state    = r._state;
      g._stateRaw = r._stateRaw;
    }
  }

  return [...map.values()];
}


// ── Vendor Map Builder ─────────────────────────
/**
 * Aggregate vendor PO counts (deduplicated by PO number) and values.
 *
 * @param {object[]} rows   - flat normalised rows
 * @param {string|null} filterGid - restrict to one budget tab; null = all
 * @returns {Map<string, { vendor, poSet, value }>}
 */
export function buildVendorMap(rows, filterGid = null) {
  const src = filterGid ? rows.filter(r => r._gid === filterGid) : rows;
  const map  = new Map();

  for (const r of src) {
    const poNum  = r._poNum  ? r._poNum.trim()  : '';
    const vendor = r._vendor ? r._vendor.trim() : '';
    if (!poNum || !vendor) continue;

    // Filter to 2026 only (Dec 2025 already folded in parsePODate)
    if (r._poDate && r._poDate.year !== 2026) continue;

    const vKey = vendor.toLowerCase();
    if (!map.has(vKey)) map.set(vKey, { vendor, poSet: new Set(), value: 0 });

    const entry = map.get(vKey);
    entry.poSet.add(poNum);
    entry.value += (r._total || 0);
  }

  return map;
}


// ── BG Sheet Loader ────────────────────────────
/**
 * Fetch and parse the Budget-overview (BG) sheet.
 * Falls back to BG_FALLBACK if the sheet is inaccessible.
 *
 * @returns {{ data: object[], isLive: boolean }}
 */
export async function fetchBGSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${BG_GID}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const { headers, rows } = parseCSV(text);
    const hLc = headers.map(h => h.toLowerCase().trim());
    const col  = kws => { for (let i = 0; i < hLc.length; i++) if (kws.some(k => hLc[i].includes(k))) return headers[i]; return null; };

    const noCol      = col(['no.','no','#','ลำดับ']);
    const descCol    = col(['description','รายละเอียด','desc','ชื่อ']);
    const codeCol    = col(['code','รหัส']);
    const budgetCol  = col(['budget','งบ']);
    const expenseCol = col(['ro expense','expense','ค่าใช้จ่าย','ro exp']);
    const remainCol  = col(['remain','คงเหลือ']);
    const pctRCol    = col(['% remain','%remain','pct remain','remain%']);
    const pctPBCol   = col(['% per','per budget','%per']);

    const parsed = rows
      .filter(r => {
        const d = descCol ? (r[descCol] || '') : '';
        return d && !d.toLowerCase().includes('total') && !d.match(/^\d+$/) && d.trim() !== '';
      })
      .map((r, i) => ({
        no:          noCol      ? (parseInt(r[noCol]) || i + 1) : i + 1,
        desc:        descCol    ? (r[descCol]    || '').trim() : '',
        code:        codeCol    ? (r[codeCol]    || '').trim() : '',
        budget:      budgetCol  ? parseFloat((r[budgetCol]  || '0').replace(/,/g, '')) : 0,
        expense:     expenseCol ? parseFloat((r[expenseCol] || '0').replace(/,/g, '')) : 0,
        remain:      remainCol  ? parseFloat((r[remainCol]  || '0').replace(/,/g, '')) : 0,
        pctRemain:   pctRCol    ? parseFloat((r[pctRCol]    || '0').replace(/[%,]/g, '')) : 0,
        pctPerBudget:pctPBCol   ? parseFloat((r[pctPBCol]   || '0').replace(/[%,]/g, '')) : 0,
      }))
      .filter(r => r.desc);

    if (parsed.length > 0) return { data: parsed, isLive: true };
  } catch (e) {
    // fall through
  }

  return { data: BG_FALLBACK, isLive: false };
}
