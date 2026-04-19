/**
 * js/app.js
 * Application controller — orchestrates data loading,
 * wires up UI events, renders tables, modals, and progress.
 *
 * No Chart.js calls here — those live in charts.js.
 * No fetch/parsing here — those live in dataService.js.
 */

import { SHEETS, STATE_PILL_MAP } from './config.js';
import { fmtBaht, fmtBG, fmtPct, esc, escAttr, pctColor } from './utils.js';
import { fetchSheet, groupByRO, buildVendorMap, fetchBGSheet, debugLog } from './dataService.js';
import {
  renderBudgetChart, renderMonthlyChart,
  renderVendorChart, renderBGCharts,
} from './charts.js';


// ── Application State ──────────────────────────
const state = {
  allData:    [],
  roGroups:   [],
  sheetStats: {},
  vendorMap:  new Map(),

  bgTotalBudget2026: 0,

  sort: { key: '_total', dir: 'desc' },
};


// ── Bootstrap ──────────────────────────────────
export async function init() {
  document.getElementById('btn-refresh').addEventListener('click', loadAllData);
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('btn-debug').addEventListener('click', toggleDebug);

  document.getElementById('budget-select').addEventListener('change', onBudgetChange);
  document.getElementById('toggle-group').addEventListener('change', renderTable);
  document.getElementById('filter-budget').addEventListener('change', renderTable);
  document.getElementById('filter-status').addEventListener('change', renderTable);
  document.getElementById('filter-search').addEventListener('input', renderTable);

  document.getElementById('vendor-top-n').addEventListener('change', refreshVendorChart);
  document.getElementById('vendor-sort').addEventListener('change', refreshVendorChart);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModalDirect(); });

  await Promise.all([loadAllData(), loadBGSheet()]);
}


// ── Load All Budget Sheets ─────────────────────
async function loadAllData() {
  _showLoading(true);
  _setBadge('กำลังโหลด...');
  state.allData    = [];
  state.sheetStats = {};
  debugLog.length  = 0;

  for (let i = 0; i < SHEETS.length; i++) {
    const s = SHEETS[i];
    _setStatus(`โหลด ${s.name} — ${s.label} (${i + 1}/${SHEETS.length})`);
    const rows = await fetchSheet(s);
    state.allData.push(...rows);
    const grp = groupByRO(rows);
    state.sheetStats[s.gid] = {
      name:      s.name,
      label:     s.label,
      group:     s.group,
      totalRO:   grp.length,
      totalRows: rows.length,
      grpo:      grp.filter(r => r._state === 'GRPO').length,
      archived:  grp.filter(r => r._state === 'Archived').length,
      valTotal:  rows.reduce((a, r) => a + (r._total || 0), 0),
      valPO:     rows.filter(r => r._state === 'GRPO' || r._state === 'Archived').reduce((a, r) => a + (r._total || 0), 0),
    };
  }

  state.roGroups = groupByRO(state.allData);
  state.vendorMap = buildVendorMap(state.allData, null);

  // Update debug panel content
  document.getElementById('debug-content').textContent = debugLog.map(d =>
    `[${d.sheet}]  RO:"${d.roCol || '❌'}"  State:"${d.stateCol || '❌'}"  Vendor:"${d.vendorCol || '❌'}"  Desc:"${d.descCol || '❌'}"  ROName:"${d.roNameCol || '❌'}"  PODate:"${d.poDateCol || '❌'}"  PONum:"${d.poNumCol || '❌'}"${d.error ? `\n  ERROR: ${d.error}` : ''}\n  Headers: ${(d.headers || []).join(' | ')}`
  ).join('\n\n');

  const loaded = Object.values(state.sheetStats).filter(s => s.totalRows > 0).length;
  _setStatus(`โหลดเสร็จ · ${state.roGroups.length.toLocaleString()} RO (${state.allData.length.toLocaleString()} บรรทัด) จาก ${loaded}/${SHEETS.length} budgets`);
  _setBadge(`✓ ${state.roGroups.length.toLocaleString()} RO`);
  if (state.allData.length > 0) _showLoading(false);

  _updateMetrics(state.roGroups);
  updateValueSummary(state.allData);
  renderBudgetChart(state.sheetStats);
  renderMonthlyChart(state.allData, null);
  refreshVendorChart();
  renderTable();
  renderProgress();
}


// ── BG Sheet ───────────────────────────────────
async function loadBGSheet() {
  const statusEl = document.getElementById('bg-load-status');
  statusEl.textContent = 'กำลังโหลด...';

  const { data, isLive } = await fetchBGSheet();
  state.bgTotalBudget2026 = data.reduce((a, r) => a + (r.budget || 0), 0);

  statusEl.textContent = isLive
    ? `โหลดสำเร็จ · ${data.length} หมวด (Live จาก Google Sheets)`
    : 'ใช้ข้อมูล Snapshot (ไม่สามารถดึง Live ได้ — ตรวจสอบสิทธิ์ Sheet)';

  updateValueSummary(state.allData);
  _renderBGTable(data);
  renderBGCharts(data);
}


// ── Value Summary Card ─────────────────────────
export function updateValueSummary(rows) {
  const data   = rows || state.allData;
  const vTotal = data.reduce((a, r) => a + (r._total || 0), 0);
  const vPO    = data.filter(r => r._state === 'GRPO' || r._state === 'Archived').reduce((a, r) => a + (r._total || 0), 0);
  const vUnPO  = Math.max(0, vTotal - vPO);
  const bg     = state.bgTotalBudget2026;

  const pTotal = bg > 0 ? (vTotal / bg * 100).toFixed(1) : null;
  const pPO    = bg > 0 ? (vPO    / bg * 100).toFixed(1) : null;
  const pUnPO  = bg > 0 ? (vUnPO  / bg * 100).toFixed(1) : null;

  _el('v-budget2026').textContent = bg > 0 ? fmtBaht(bg) : '—';
  _el('v-total').textContent      = fmtBaht(vTotal);
  _el('v-total-pct-bg').textContent = pTotal ? `${pTotal}% ของงบประมาณ` : 'ผลรวมทุก RO';
  _el('v-po').textContent         = fmtBaht(vPO);
  _el('v-po-pct').textContent     = pPO    ? `${pPO}% ของงบประมาณ · GRPO+Archived` : 'GRPO + Archived';
  _el('v-remain').textContent     = fmtBaht(vUnPO);
  _el('v-remain-pct').textContent = pUnPO  ? `${pUnPO}% ของงบประมาณ` : 'ยังไม่ PO';

  const bar = _el('value-bar');
  if (bg > 0) {
    const wPO   = Math.min(100, vPO / bg * 100);
    const wUnPO = Math.min(100 - wPO, vUnPO / bg * 100);
    bar.innerHTML = `
      <div class="pc-fill" style="width:${wPO.toFixed(1)}%;background:var(--green)"></div>
      <div class="pc-fill" style="width:${wUnPO.toFixed(1)}%;background:var(--amber)"></div>
      <div class="pc-fill" style="width:${(Math.max(0, 100 - wPO - wUnPO)).toFixed(1)}%;background:var(--bg-tertiary)"></div>`;
  } else {
    const pPOr = vTotal > 0 ? Math.round(vPO / vTotal * 100) : 0;
    bar.innerHTML = `
      <div class="pc-fill" style="width:${pPOr}%;background:var(--green)"></div>
      <div class="pc-fill" style="width:${100 - pPOr}%;background:var(--amber)"></div>`;
  }
}


// ── Table ──────────────────────────────────────
export function renderTable() {
  const isGrouped = _el('toggle-group').checked;
  const budgetF   = _el('filter-budget').value;
  const statusF   = _el('filter-status').value;
  const searchF   = (_el('filter-search').value || '').toLowerCase().trim();

  _el('toggle-desc').textContent = isGrouped
    ? 'เปิด — RO เดียวกันรวมเป็นบรรทัดเดียว (คลิก RO Name เพื่อดูรายละเอียด)'
    : 'ปิด — แสดงทุกบรรทัดแยกกัน';

  isGrouped ? _renderGrouped(budgetF, statusF, searchF) : _renderFlat(budgetF, statusF, searchF);
}

function _renderGrouped(budgetF, statusF, searchF) {
  // Reset to grouped-compatible sort key if needed
  if (['_code', '_desc', '_qty', '_price'].includes(state.sort.key)) {
    state.sort.key = '_total'; state.sort.dir = 'desc';
  }

  _el('thead-row').innerHTML = `<tr>
    <th style="width:40px">#</th>
    <th class="${_thCls('_sheet')}"  onclick="app.setSort('_sheet')">Budget${_sortIcon('_sheet')}</th>
    <th class="${_thCls('_roName')}" onclick="app.setSort('_roName')">RO Name${_sortIcon('_roName')}</th>
    <th class="${_thCls('_poDate')}" onclick="app.setSort('_poDate')">PO Date${_sortIcon('_poDate')}</th>
    <th class="${_thCls('_total')}"  onclick="app.setSort('_total')" style="text-align:right">มูลค่ารวม (฿)${_sortIcon('_total')}</th>
    <th class="${_thCls('_vendor')}" onclick="app.setSort('_vendor')">ร้านค้า / Vendor${_sortIcon('_vendor')}</th>
    <th class="${_thCls('_state')}"  onclick="app.setSort('_state')">State${_sortIcon('_state')}</th>
  </tr>`;

  let data = state.roGroups;
  if (budgetF) data = data.filter(r => r._gid === budgetF);
  if (statusF) data = data.filter(r => r._state === statusF);
  if (searchF) data = data.filter(r =>
    r._ro.toLowerCase().includes(searchF) ||
    (r._roName || '').toLowerCase().includes(searchF) ||
    (r._vendor || '').toLowerCase().includes(searchF) ||
    r._items.some(i => (i._desc || '').toLowerCase().includes(searchF) || (i._code || '').toLowerCase().includes(searchF))
  );

  data = _sortGrouped(data);
  const show = data.slice(0, 500);
  _el('row-count').textContent = `${show.length.toLocaleString()} RO (จาก ${data.length.toLocaleString()})`;
  _el('table-body').innerHTML = show.map((g, idx) => `
    <tr class="ro-group">
      <td style="color:var(--text-tertiary);font-size:12px">${idx + 1}</td>
      <td><span class="pill pill--gray">${g._sheet}</span></td>
      <td>
        <button class="ro-link" onclick="app.openModal('${escAttr(g._gid + '||' + g._ro)}')">${esc(g._roName || g._ro)}</button>
        ${!g._hasRO ? '<span style="font-size:10px;color:var(--text-tertiary);margin-left:4px">(auto)</span>' : ''}
      </td>
      <td style="font-size:12px;color:var(--text-secondary)">${g._poDateRaw || '—'}</td>
      <td style="text-align:right;font-weight:600;font-size:14px">${fmtBaht(g._total)}</td>
      <td style="font-size:12px;color:var(--text-secondary);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(g._vendor)}">${esc(g._vendor) || '—'}</td>
      <td>${_sPill(g._state, g._stateRaw)}</td>
    </tr>`).join('') || _noData(7);

  _el('table-note').textContent = data.length > 500
    ? `* แสดง 500 RO แรก จากทั้งหมด ${data.length.toLocaleString()} RO` : '';
}

function _renderFlat(budgetF, statusF, searchF) {
  if (['_poDate'].includes(state.sort.key)) { state.sort.key = '_total'; state.sort.dir = 'desc'; }

  _el('thead-row').innerHTML = `<tr>
    <th>#</th>
    <th class="${_thCls('_sheet')}"  onclick="app.setSort('_sheet')">Budget${_sortIcon('_sheet')}</th>
    <th class="${_thCls('_roName')}" onclick="app.setSort('_roName')">RO Name${_sortIcon('_roName')}</th>
    <th class="${_thCls('_code')}"   onclick="app.setSort('_code')">รหัส${_sortIcon('_code')}</th>
    <th class="${_thCls('_desc')}"   onclick="app.setSort('_desc')">Description${_sortIcon('_desc')}</th>
    <th class="${_thCls('_qty')}"    onclick="app.setSort('_qty')" style="text-align:right">จำนวน${_sortIcon('_qty')}</th>
    <th>หน่วย</th>
    <th class="${_thCls('_price')}"  onclick="app.setSort('_price')" style="text-align:right">ราคา/หน่วย${_sortIcon('_price')}</th>
    <th class="${_thCls('_total')}"  onclick="app.setSort('_total')" style="text-align:right">มูลค่ารวม${_sortIcon('_total')}</th>
    <th class="${_thCls('_vendor')}" onclick="app.setSort('_vendor')">ร้านค้า${_sortIcon('_vendor')}</th>
    <th class="${_thCls('_state')}"  onclick="app.setSort('_state')">State${_sortIcon('_state')}</th>
  </tr>`;

  let data = state.allData;
  if (budgetF) data = data.filter(r => r._gid === budgetF);
  if (statusF) data = data.filter(r => r._state === statusF);
  if (searchF) data = data.filter(r =>
    r._ro.toLowerCase().includes(searchF) ||
    (r._roName || '').toLowerCase().includes(searchF) ||
    (r._desc || '').toLowerCase().includes(searchF) ||
    (r._code || '').toLowerCase().includes(searchF)
  );

  data = _sortFlat(data);
  const show = data.slice(0, 300);
  _el('row-count').textContent = `${show.length.toLocaleString()} บรรทัด (จาก ${data.length.toLocaleString()})`;
  _el('table-body').innerHTML = show.length
    ? show.map((r, i) => `<tr>
        <td style="color:var(--text-tertiary);font-size:12px">${i + 1}</td>
        <td><span class="pill pill--gray">${r._sheet}</span></td>
        <td style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r._roName || r._ro) || '—'}</td>
        <td class="mono">${esc(r._code) || '—'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r._desc)}">${esc(r._desc) || '—'}</td>
        <td style="text-align:right">${r._qty ? r._qty.toLocaleString() : '—'}</td>
        <td>${r._unit || '—'}</td>
        <td style="text-align:right">${r._price ? fmtBaht(r._price) : '—'}</td>
        <td style="text-align:right;font-weight:600">${fmtBaht(r._total)}</td>
        <td style="font-size:12px;color:var(--text-secondary);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r._vendor) || '—'}</td>
        <td>${_sPill(r._state, r._stateRaw)}</td>
      </tr>`).join('')
    : _noData(11);

  _el('table-note').textContent = data.length > 300
    ? `* แสดง 300 บรรทัดแรก จากทั้งหมด ${data.length.toLocaleString()} บรรทัด` : '';
}


// ── Sort ───────────────────────────────────────
export function setSort(key) {
  state.sort.dir = state.sort.key === key && state.sort.dir === 'desc' ? 'asc' : 'desc';
  state.sort.key = key;
  renderTable();
}

function _cmpNullLast(a, b, dir) {
  const empty = v => v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v));
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1;
  if (empty(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
  if (typeof a === 'string' && typeof b === 'string')
    return a.localeCompare(b, 'th', { sensitivity: 'base' }) * dir;
  return (a < b ? -1 : a > b ? 1 : 0) * dir;
}

function _sortGrouped(data) {
  const dir = state.sort.dir === 'desc' ? -1 : 1;
  return [...data].sort((a, b) => {
    const k = state.sort.key;
    let va, vb;
    if      (k === '_sheet')  { va = a._sheet;  vb = b._sheet; }
    else if (k === '_roName') { va = (a._roName || a._ro).toLowerCase(); vb = (b._roName || b._ro).toLowerCase(); }
    else if (k === '_poDate') { va = a._poDate ? a._poDate.sortVal : null; vb = b._poDate ? b._poDate.sortVal : null; }
    else if (k === '_vendor') { va = (a._vendor || '').toLowerCase(); vb = (b._vendor || '').toLowerCase(); }
    else if (k === '_state')  { va = a._stateRaw || a._state; vb = b._stateRaw || b._state; }
    else                      { va = a._total || 0; vb = b._total || 0; }
    return _cmpNullLast(va, vb, dir);
  });
}

function _sortFlat(data) {
  const dir = state.sort.dir === 'desc' ? -1 : 1;
  return [...data].sort((a, b) => {
    const k = state.sort.key;
    let va, vb;
    if      (k === '_sheet')  { va = a._sheet;  vb = b._sheet; }
    else if (k === '_roName') { va = (a._roName || a._ro).toLowerCase(); vb = (b._roName || b._ro).toLowerCase(); }
    else if (k === '_code')   { va = (a._code  || '').toLowerCase(); vb = (b._code  || '').toLowerCase(); }
    else if (k === '_desc')   { va = (a._desc  || '').toLowerCase(); vb = (b._desc  || '').toLowerCase(); }
    else if (k === '_qty')    { va = a._qty   || 0; vb = b._qty   || 0; }
    else if (k === '_price')  { va = a._price || 0; vb = b._price || 0; }
    else if (k === '_vendor') { va = (a._vendor || '').toLowerCase(); vb = (b._vendor || '').toLowerCase(); }
    else if (k === '_state')  { va = a._stateRaw || a._state; vb = b._stateRaw || b._state; }
    else                      { va = a._total || 0; vb = b._total || 0; }
    return _cmpNullLast(va, vb, dir);
  });
}


// ── Modal ──────────────────────────────────────
export function openModal(key) {
  const g = state.roGroups.find(r => (r._gid + '||' + r._ro) === key);
  if (!g) return;

  _el('modal-title').textContent = g._roName || g._ro;
  _el('modal-subtitle').innerHTML =
    `<span class="pill pill--gray" style="font-size:11px">${g._sheet} — ${g._label}</span>` +
    ` ${_sPill(g._state, g._stateRaw)}` +
    (g._poDateRaw ? ` <span style="font-size:12px;color:var(--text-secondary)">PO Date: ${esc(g._poDateRaw)}</span>` : '') +
    (g._poNum     ? ` <span style="font-size:12px;color:var(--text-secondary)">PO#: <strong>${esc(g._poNum)}</strong></span>` : '') +
    (g._vendor    ? ` <span style="font-size:12px;color:var(--text-secondary)">ร้านค้า: <strong>${esc(g._vendor)}</strong></span>` : '');

  const rowsHtml = g._items.map(item => `
    <tr>
      <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(item._desc)}">${esc(item._desc) || '—'}</td>
      <td style="text-align:right">${item._qty ? item._qty.toLocaleString() : '—'}</td>
      <td>${item._unit || '—'}</td>
      <td style="text-align:right">${item._price ? fmtBaht(item._price) : '—'}</td>
      <td style="text-align:right;font-weight:600">${fmtBaht(item._total)}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-secondary)">${esc(item._vendor || g._vendor) || '—'}</td>
    </tr>`).join('');

  _el('modal-body').innerHTML = `
    <table>
      <thead><tr>
        <th>ชื่อสินค้า (Description)</th>
        <th style="text-align:right">จำนวนที่สั่ง</th>
        <th>หน่วย</th>
        <th style="text-align:right">ราคาต่อหน่วย</th>
        <th style="text-align:right">ผลรวมราคา</th>
        <th>ร้านค้าที่สั่ง</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="modal__total">
      <span class="modal__total-label">มูลค่ารวมทั้งหมด (${g._items.length} รายการ)</span>
      <span class="modal__total-value">${fmtBaht(g._total)}</span>
    </div>`;

  _el('modal-overlay').classList.add('show');
}

export function closeModal(e) { if (e.target === _el('modal-overlay')) closeModalDirect(); }
export function closeModalDirect() { _el('modal-overlay').classList.remove('show'); }


// ── Budget Dropdown ────────────────────────────
function onBudgetChange() {
  const gid = _el('budget-select').value;
  _el('filter-budget').value = gid;
  renderTable();
  renderMonthlyChart(state.allData, gid || null);
  const vmap = gid ? buildVendorMap(state.allData, gid) : state.vendorMap;
  _refreshVendorChartWith(vmap);
  const fRows = gid ? state.allData.filter(r => r._gid === gid) : state.allData;
  const fRO   = gid ? state.roGroups.filter(r => r._gid === gid) : state.roGroups;
  _updateMetrics(fRO);
  updateValueSummary(fRows);
}

function refreshVendorChart() {
  const gid   = _el('budget-select').value || null;
  const vmap  = gid ? buildVendorMap(state.allData, gid) : state.vendorMap;
  _refreshVendorChartWith(vmap);
}

function _refreshVendorChartWith(vmap) {
  const topN   = parseInt(_el('vendor-top-n').value) || 0;
  const sortBy = _el('vendor-sort').value;
  renderVendorChart(vmap, topN, sortBy);
}


// ── Progress ───────────────────────────────────
function renderProgress() {
  const grps = { equipment: [], service: [], general: [] };
  SHEETS.forEach(s => {
    const st = state.sheetStats[s.gid] || { totalRO: 0, grpo: 0, archived: 0 };
    if (s.group in grps) grps[s.group].push({ label: s.label, total: st.totalRO, done: st.grpo + st.archived });
  });

  [['equipment', 'progress-equip'], ['service', 'progress-svc'], ['general', 'progress-gen']].forEach(([g, id]) => {
    const el = _el(id);
    if (!grps[g].length) { el.innerHTML = '<p style="font-size:12px;color:var(--text-tertiary)">ไม่มีข้อมูล</p>'; return; }
    el.innerHTML = grps[g].map(item => {
      const pct = item.total > 0 ? Math.round((item.done / item.total) * 100) : 0;
      const col = pct >= 75 ? '#1D9E75' : pct >= 40 ? '#378ADD' : '#BA7517';
      return `<div class="prog-item">
        <div class="prog-header">
          <span class="prog-header__label">${item.label}</span>
          <span class="prog-header__stat">${item.done}/${item.total} · ${pct}%</span>
        </div>
        <div class="prog-bar"><div class="prog-bar__fill" style="width:${pct}%;background:${col}"></div></div>
      </div>`;
    }).join('');
  });
}


// ── BG Table ───────────────────────────────────
function _renderBGTable(data) {
  const totalBudget  = data.reduce((a, r) => a + r.budget, 0);
  const totalExpense = data.reduce((a, r) => a + r.expense, 0);
  const totalRemain  = data.reduce((a, r) => a + r.remain, 0);
  const totalPctR    = totalBudget > 0 ? (totalRemain / totalBudget * 100) : 0;

  _el('bg-totals').innerHTML = [
    { label: 'งบประมาณรวม',  value: fmtBG(totalBudget),  color: 'var(--amber)' },
    { label: 'ใช้ไปแล้ว',    value: fmtBG(totalExpense), color: 'var(--blue)'  },
    { label: 'คงเหลือ',      value: fmtBG(totalRemain),  color: totalRemain >= 0 ? 'var(--green)' : 'var(--red)' },
    { label: '% คงเหลือรวม', value: fmtPct(totalPctR),   color: pctColor(totalPctR) },
  ].map(t => `<div style="text-align:right">
    <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:2px;text-transform:uppercase;letter-spacing:.04em">${t.label}</div>
    <div style="font-size:17px;font-weight:600;color:${t.color}">฿${t.value}</div>
  </div>`).join('');

  _el('bg-tbody').innerHTML = data.map(r => {
    const col       = pctColor(r.pctRemain);
    const negRemain = r.remain < 0;
    return `<tr>
      <td style="padding:8px 10px;border-bottom:0.5px solid var(--border);color:var(--text-tertiary);font-size:11px">${r.no}</td>
      <td style="padding:8px 10px;border-bottom:0.5px solid var(--border);font-weight:500;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.desc)}">${esc(r.desc)}</td>
      <td style="padding:8px 10px;border-bottom:0.5px solid var(--border);text-align:center"><span class="pill pill--gray" style="font-size:11px">${r.code}</span></td>
      <td style="padding:8px 10px;border-bottom:0.5px solid var(--border);text-align:right;font-size:12px">฿${fmtBG(r.budget)}</td>
      <td style="padding:8px 10px;border-bottom:0.5px solid var(--border);text-align:right;font-size:12px;color:var(--blue)">฿${fmtBG(r.expense)}</td>
      <td style="padding:8px 10px;border-bottom:0.5px solid var(--border);text-align:right;font-size:12px;font-weight:500;color:${negRemain ? 'var(--red)' : 'var(--green)'}">฿${fmtBG(r.remain)}</td>
      <td style="padding:8px 10px;border-bottom:0.5px solid var(--border);text-align:right">
        <span style="font-size:12px;font-weight:600;color:${col}">${fmtPct(r.pctRemain)}</span>
        <div style="height:4px;border-radius:99px;background:var(--bg-secondary);overflow:hidden;margin-top:4px;width:64px;margin-left:auto">
          <div style="height:100%;border-radius:99px;background:${col};width:${Math.max(0, Math.min(100, r.pctRemain))}%"></div>
        </div>
      </td>
      <td style="padding:8px 10px;border-bottom:0.5px solid var(--border);text-align:right;font-size:12px;color:var(--text-secondary)">${fmtPct(r.pctPerBudget)}</td>
    </tr>`;
  }).join('') + `<tr style="background:var(--bg-secondary)">
    <td colspan="3" style="padding:8px 10px;font-weight:600;font-size:12px;border-top:0.5px solid var(--border-md)">Total</td>
    <td style="padding:8px 10px;text-align:right;font-weight:600;font-size:12px;border-top:0.5px solid var(--border-md)">฿${fmtBG(totalBudget)}</td>
    <td style="padding:8px 10px;text-align:right;font-weight:600;font-size:12px;color:var(--blue);border-top:0.5px solid var(--border-md)">฿${fmtBG(totalExpense)}</td>
    <td style="padding:8px 10px;text-align:right;font-weight:600;font-size:12px;color:${totalRemain >= 0 ? 'var(--green)' : 'var(--red)'};border-top:0.5px solid var(--border-md)">฿${fmtBG(totalRemain)}</td>
    <td style="padding:8px 10px;text-align:right;font-weight:600;font-size:12px;color:${pctColor(totalPctR)};border-top:0.5px solid var(--border-md)">${fmtPct(totalPctR)}</td>
    <td style="padding:8px 10px;text-align:right;font-size:12px;border-top:0.5px solid var(--border-md)">100%</td>
  </tr>`;
}


// ── Export ─────────────────────────────────────
function exportCSV() {
  if (!state.roGroups.length) { alert('ยังไม่มีข้อมูล'); return; }
  const isGrouped = _el('toggle-group').checked;
  let rows, header;
  if (isGrouped) {
    header = ['RO Name', 'Budget', 'PO#', 'PO Date', 'มูลค่ารวม (฿)', 'ร้านค้า', 'State'];
    rows = state.roGroups.map(g => [g._roName || g._ro, g._sheet, g._poNum, g._poDate ? `${g._poDate.year}/${g._poDate.month}` : '', Math.round(g._total), g._vendor, g._stateRaw || g._state]);
  } else {
    header = ['Budget', 'RO Name', 'รหัส', 'Description', 'จำนวน', 'หน่วย', 'ราคา/หน่วย', 'มูลค่ารวม', 'ร้านค้า', 'State'];
    rows = state.allData.map(r => [r._sheet, r._roName || r._ro, r._code, r._desc, r._qty, r._unit, r._price, Math.round(r._total || 0), r._vendor, r._stateRaw || r._state]);
  }
  const csv = [header, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `procurement_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}


// ── Debug ──────────────────────────────────────
function toggleDebug() {
  const p = _el('debug-panel');
  p.classList.toggle('show');
  _el('btn-debug').textContent = p.classList.contains('show') ? '✕ Debug' : '🔍 Debug';
}


// ── Metrics (internal) ─────────────────────────
function _updateMetrics(ro) {
  const data   = ro || state.roGroups;
  const total  = data.length;
  const grpo   = data.filter(r => r._state === 'GRPO').length;
  const arch   = data.filter(r => r._state === 'Archived').length;

  const el = _el('ro-summary-pills');
  if (!el) return;

  const pills = [
    { label: 'RO ทั้งหมด',      value: total.toLocaleString(),                                         bg: '#E6F1FB', tc: '#185FA5', bc: '#B5D4F4' },
    { label: 'PO (GRPO)',       value: `${grpo.toLocaleString()} (${total > 0 ? Math.round(grpo / total * 100) : 0}%)`, bg: '#EAF3DE', tc: '#3B6D11', bc: '#C0DD97' },
    { label: 'ส่งของ (Archived)', value: `${arch.toLocaleString()} (${total > 0 ? Math.round(arch / total * 100) : 0}%)`, bg: '#EEEDFE', tc: '#3C3489', bc: '#CECBF6' },
  ];

  el.innerHTML = pills.map(p => `
    <div style="background:${p.bg};border:0.5px solid ${p.bc};border-radius:var(--radius-md);padding:8px 14px;min-width:140px;">
      <div style="font-size:10px;color:${p.tc};text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;font-weight:500">${p.label}</div>
      <div style="font-size:18px;font-weight:700;color:${p.tc}">${p.value}</div>
    </div>`).join('');
}


// ── Private helpers ────────────────────────────
function _el(id)  { return document.getElementById(id); }

function _showLoading(show) { _el('loading-section').style.display = show ? 'block' : 'none'; }
function _setStatus(msg)    { _el('load-status').textContent = msg; }
function _setBadge(msg)     { _el('status-badge').textContent = msg; }

function _sortIcon(key) {
  if (state.sort.key !== key) return `<span class="sort-icon">↕</span>`;
  return state.sort.dir === 'desc' ? `<span class="sort-icon">↓</span>` : `<span class="sort-icon">↑</span>`;
}

function _thCls(key) {
  if (state.sort.key !== key) return 'sortable';
  return `sortable sort-${state.sort.dir}`;
}

function _sPill(stateKey, raw) {
  const label = raw || stateKey || '—';
  const mod   = STATE_PILL_MAP[stateKey] || 'gray';
  return `<span class="pill pill--${mod}">${esc(label)}</span>`;
}

function _noData(colSpan) {
  return `<tr><td colspan="${colSpan}" style="text-align:center;padding:32px;color:var(--text-tertiary)">ไม่พบรายการที่ตรงกับตัวกรอง</td></tr>`;
}
