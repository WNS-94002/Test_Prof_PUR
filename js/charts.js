/**
 * js/charts.js
 * All Chart.js chart creation and update logic.
 * Depends on Chart.js being loaded globally (via CDN in index.html).
 */

import { SHEETS, MONTH_LABELS_TH, VENDOR_COLORS } from './config.js';
import { pctColor } from './utils.js';

// ── Chart instances (module-level references for destroy/re-create) ──
let chartBudget  = null;
let chartMonthly = null;
let chartVendor  = null;
let chartBGBar   = null;
let chartBGRemain = null;


// ── 1. RO Count by Budget ──────────────────────
export function renderBudgetChart(sheetStats) {
  const labels   = SHEETS.map(s => s.name);
  const roCount  = SHEETS.map(s => (sheetStats[s.gid] || {}).totalRO   || 0);
  const grpoCnt  = SHEETS.map(s => (sheetStats[s.gid] || {}).grpo      || 0);
  const archCnt  = SHEETS.map(s => (sheetStats[s.gid] || {}).archived  || 0);

  if (chartBudget) chartBudget.destroy();

  chartBudget = new Chart(document.getElementById('chart-budget'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'RO ทั้งหมด', data: roCount, backgroundColor: '#378ADD', borderRadius: 4 },
        { label: 'GRPO',       data: grpoCnt, backgroundColor: '#1D9E75', borderRadius: 4 },
        { label: 'Archived',   data: archCnt, backgroundColor: '#534AB7', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}` } },
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: false }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { font: { size: 11 } } },
      },
      animation: { onComplete: function () { _drawBudgetLabels(this); } },
    },
  });
}

function _drawBudgetLabels(chart) {
  const ctx = chart.ctx;
  ctx.save();
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  chart.data.datasets.forEach((ds, di) => {
    const meta = chart.getDatasetMeta(di);
    if (meta.hidden) return;
    meta.data.forEach((bar, i) => {
      const val = ds.data[i];
      if (!val) return;
      ctx.fillStyle = ds.backgroundColor;
      ctx.fillText(val, bar.x, bar.y - 2);
    });
  });
  ctx.restore();
}


// ── 2. Monthly Spending ────────────────────────
export function renderMonthlyChart(allData, filterGid = null) {
  const monthly = new Array(12).fill(0);
  const src = filterGid ? allData.filter(r => r._gid === filterGid) : allData;

  for (const r of src) {
    if (!r._poDate) continue;
    const { chartYear, chartMonth } = r._poDate;
    if (chartYear === 2026 && chartMonth >= 1 && chartMonth <= 12)
      monthly[chartMonth - 1] += (r._total || 0);
  }

  const rounded    = monthly.map(v => Math.round(v));
  const cumulative = [];
  let sum = 0;
  rounded.forEach(v => { sum += v; cumulative.push(Math.round(sum)); });

  if (chartMonthly) chartMonthly.destroy();

  chartMonthly = new Chart(document.getElementById('chart-monthly'), {
    type: 'bar',
    data: {
      labels: MONTH_LABELS_TH,
      datasets: [
        {
          type: 'bar',
          label: 'มูลค่ารายเดือน (฿)',
          data: rounded,
          backgroundColor: rounded.map((_, i) => i === 0 ? '#378ADD' : 'rgba(55,138,221,0.55)'),
          borderRadius: 5,
          borderSkipped: false,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: 'ยอดสะสม (฿)',
          data: cumulative,
          borderColor: '#BA7517',
          backgroundColor: 'rgba(186,117,23,0.12)',
          borderWidth: 2.5,
          pointBackgroundColor: '#BA7517',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: false,
          yAxisID: 'y2',
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { boxWidth: 12, boxHeight: 12, font: { size: 11 }, padding: 12, usePointStyle: true },
        },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ฿${Math.round(ctx.parsed.y).toLocaleString()}` } },
      },
      scales: {
        x: { ticks: { font: { size: 11 } }, grid: { display: false } },
        y: {
          beginAtZero: true, position: 'left',
          ticks: { font: { size: 10 }, callback: v => v >= 1e6 ? '฿' + Math.round(v / 1e6) + 'M' : v >= 1e3 ? '฿' + Math.round(v / 1e3) + 'K' : '฿' + v },
          grid: { color: 'rgba(0,0,0,0.05)' },
          title: { display: true, text: 'รายเดือน', font: { size: 10 }, color: '#378ADD' },
        },
        y2: {
          beginAtZero: true, position: 'right',
          ticks: { font: { size: 10 }, callback: v => v >= 1e6 ? '฿' + Math.round(v / 1e6) + 'M' : v >= 1e3 ? '฿' + Math.round(v / 1e3) + 'K' : '฿' + v },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'สะสม', font: { size: 10 }, color: '#BA7517' },
        },
      },
      animation: { onComplete: function () { _drawMonthlyLabels(this); } },
    },
  });
}

function _drawMonthlyLabels(chart) {
  const ctx     = chart.ctx;
  const barMeta = chart.getDatasetMeta(0);
  ctx.save();
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#185FA5';
  barMeta.data.forEach((bar, i) => {
    const val = chart.data.datasets[0].data[i];
    if (!val) return;
    const label = val >= 1e6 ? (Math.round(val / 1e5) / 10) + 'M' : val >= 1e3 ? Math.round(val / 1e3) + 'K' : val.toString();
    ctx.fillText(label, bar.x, bar.y - 2);
  });
  ctx.restore();
}


// ── 3. Vendor Chart ────────────────────────────
export function renderVendorChart(vendorMap, topN = 5, sortBy = 'po') {
  let entries = [...vendorMap.values()].map(e => ({
    vendor:  e.vendor,
    poCount: e.poSet.size,
    value:   Math.round(e.value),
  }));

  entries.sort((a, b) => sortBy === 'value' ? b.value - a.value : b.poCount - a.poCount);
  const display = topN > 0 ? entries.slice(0, topN) : entries;

  // Update badge
  const badge = document.getElementById('vendor-total-badge');
  if (badge) badge.textContent = `${entries.length} Vendor ทั้งหมด`;

  // Dynamic height
  const h = Math.max(180, display.length * 36 + 60);
  const wrap = document.getElementById('vendor-chart-wrap');
  if (wrap) wrap.style.height = h + 'px';

  const labels  = display.map(e => e.vendor.length > 32 ? e.vendor.slice(0, 30) + '…' : e.vendor);
  const poData  = display.map(e => e.poCount);
  const valData = display.map(e => e.value);

  if (chartVendor) chartVendor.destroy();

  chartVendor = new Chart(document.getElementById('chart-vendor'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'จำนวน PO (ไม่ซ้ำ)',
        data: poData,
        backgroundColor: display.map((_, i) => VENDOR_COLORS[i % VENDOR_COLORS.length]),
        borderRadius: 4,
        yAxisID: 'y',
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 42 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label:      ctx => `จำนวน PO: ${ctx.parsed.x.toLocaleString()}`,
            afterLabel: ctx => `มูลค่า: ฿${valData[ctx.dataIndex].toLocaleString()}`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true, ticks: { font: { size: 11 }, stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
      animation: { onComplete: function () { _drawVendorLabels(this, poData); } },
    },
  });
}

function _drawVendorLabels(chart, poData) {
  const ctx  = chart.ctx;
  const meta = chart.getDatasetMeta(0);
  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  ctx.textBaseline = 'middle';
  meta.data.forEach((bar, i) => {
    const val = poData[i];
    if (!val) return;
    const x = bar.x + 5, y = bar.y;
    const txt = val.toString();
    const tw  = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(55,138,221,0.15)';
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 9, tw + 8, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#185FA5';
    ctx.fillText(txt, x + 1, y);
  });
  ctx.restore();
}


// ── 4. BG Budget Charts ────────────────────────
export function renderBGCharts(data) {
  const labels   = data.map(r => r.code);
  const budgets  = data.map(r => Math.round(r.budget));
  const expenses = data.map(r => Math.round(r.expense));
  const remains  = data.map(r => Math.round(Math.max(0, r.remain)));
  const pctArr   = data.map(r => parseFloat(r.pctRemain.toFixed(2)));

  // Stacked bar: Expense + Remain = Budget
  if (chartBGBar) chartBGBar.destroy();
  chartBGBar = new Chart(document.getElementById('chart-bg-bar'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'RO Expense', data: expenses, backgroundColor: '#378ADD', borderRadius: 3, stack: 'total' },
        { label: 'Remain',     data: remains,  backgroundColor: 'rgba(29,158,117,0.35)', borderRadius: 3, stack: 'total' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterBody: items => {
              const i = items[0].dataIndex;
              return [`Budget: ฿${budgets[i].toLocaleString()}`, `% Used: ${(100 - pctArr[i]).toFixed(2)}%`];
            },
          },
        },
      },
      scales: {
        x: { stacked: true, ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: false }, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 }, callback: v => '฿' + Math.round(v / 1e6) + 'M' } },
      },
    },
  });

  // Horizontal bar: % Remain
  const barColors = pctArr.map(p => pctColor(p));
  if (chartBGRemain) chartBGRemain.destroy();
  chartBGRemain = new Chart(document.getElementById('chart-bg-remain'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: '% Remain', data: pctArr, backgroundColor: barColors, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.x.toFixed(2)}% คงเหลือ` } },
      },
      scales: {
        x: { beginAtZero: true, max: 110, ticks: { font: { size: 10 }, callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}
