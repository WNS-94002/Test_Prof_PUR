/**
 * js/config.js
 * Application constants — sheet IDs, sheet definitions,
 * keyword lists for column detection, and static label arrays.
 */

// ── Google Sheets ──────────────────────────────
export const SHEET_ID = '1x8nzBNv4RGV-x6AtMIqm8HWJt5k0a-aVuEV8Zezess4';
export const BG_GID   = '2052519392';

/** All budget tabs */
export const SHEETS = [
  { gid: '0',          name: '0-101', label: 'Conveyor Equipment',       group: 'equipment' },
  { gid: '696948322',  name: '4-501', label: 'Lubricant',                group: 'equipment' },
  { gid: '1216432940', name: '6-101', label: 'Spreader',                 group: 'equipment' },
  { gid: '594703843',  name: '6-102', label: 'Bucket Wheel Excavator',   group: 'equipment' },
  { gid: '1309658412', name: '6-103', label: 'Crusher',                  group: 'equipment' },
  { gid: '188899962',  name: '6-104', label: 'Conveyor System',          group: 'equipment' },
  { gid: '1019106348', name: '6-105', label: 'Aux. CV Equipment',        group: 'equipment' },
  { gid: '1624105960', name: '6-106', label: 'Service CV Equipment',     group: 'service'   },
  { gid: '1225728737', name: '6-111', label: 'General Consume CV',       group: 'general'   },
  { gid: '1177087368', name: '6-227', label: 'Hydraulic Hose & Fitting', group: 'equipment' },
  { gid: '1566400890', name: '7-101', label: 'Service Spreader',         group: 'service'   },
  { gid: '1228114688', name: '7-102', label: 'Service BWE',              group: 'service'   },
  { gid: '1252174840', name: '7-103', label: 'Service Crusher',          group: 'service'   },
  { gid: '287824465',  name: '7-104', label: 'Service Conveyor System',  group: 'service'   },
  { gid: '1562418173', name: '9-111', label: 'General Expense CV',       group: 'general'   },
];

// ── Column-detection keyword lists ────────────
export const COL_KEYWORDS = {
  RO_NO:   ['ro no','ro number','ro#','r.o. no','repair order no','ro_no','ro_number','rono',
             'หมายเลข ro','เลข ro','ro เลขที่','เลขที่ ro','work order no','wo no','wo_no',
             'order no','order number','req no','job no','ro'],
  VENDOR:  ['vendor','supplier','ร้านค้า','บริษัท','vendor name','supplier name',
             'ชื่อผู้ขาย','ผู้จัดจำหน่าย','card name','bp name','business partner'],
  DESC:    ['description','item description','รายการ','ชื่อสินค้า','รายละเอียด','detail'],
  RO_NAME: ['ro name','ro description','ro desc','ro_name','ro_desc',
             'document title','title','name','ชื่อ ro','ชื่อรายการ','ชื่อ'],
  PO_DATE: ['po date','posting date','doc date','document date','วันที่ po',
             'วันที่สั่ง','order date','purchase date','date'],
  PO_NUM:  ['po no','po number','po#','po_no','po_number','purchase order no',
             'purchase order number','เลข po','หมายเลข po','po'],
  STATE:   ['state','สถานะ','status','doc status','document status'],
  QTY:     ['qty','จำนวน','quantity','count'],
  PRICE:   ['unit price','unit_price','price/unit','ราคา/หน่วย','ราคาต่อหน่วย','price','ราคา','rate'],
  TOTAL:   ['total amount','grand total','total price','มูลค่ารวม','ยอดรวม','total','รวม','มูลค่า','sum','value'],
  UNIT:    ['unit','หน่วย','uom'],
  CODE:    ['part no','part_no','partno','material code','mat.code','item code','รหัส','code','id','no.'],
};

// ── UI constants ───────────────────────────────
export const MONTH_LABELS_TH = [
  'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.',
];

export const VENDOR_COLORS = [
  '#378ADD','#1D9E75','#BA7517','#534AB7','#D85A30','#D4537E','#639922',
  '#185FA5','#0F6E56','#854F0B','#3C3489','#993C1D','#99355a','#3B6D11',
  '#0c447c','#5f5e5a','#A32D2D','#082851',
];

export const STATE_PILL_MAP = {
  GRPO:      'green',
  Archived:  'purple',
  Open:      'blue',
  Cancelled: 'red',
  Closed:    'teal',
};

export const STATE_RANK = { GRPO: 5, Archived: 4, Closed: 3, Cancelled: 2, Open: 1 };

/** Fallback BG data (used when Sheet BG is inaccessible) */
export const BG_FALLBACK = [
  { no:1,  desc:'CONVEYOR EQUIPMENT',                               code:'0-101', budget:50480000.00,  expense:32868045.00, remain:17611955.00,  pctRemain:34.89,  pctPerBudget:13.23 },
  { no:2,  desc:'LUBRICANT CV',                                     code:'4-501', budget:7827839.10,   expense:2912273.00,  remain:4915566.10,   pctRemain:62.80,  pctPerBudget:1.17  },
  { no:3,  desc:'SPREADER',                                         code:'6-101', budget:12894496.00,  expense:2064444.72,  remain:10830051.28,  pctRemain:83.99,  pctPerBudget:0.83  },
  { no:4,  desc:'BUCKET WHEEL EXCVATOR, BELT WAGON, HOPPER',        code:'6-102', budget:68140580.00,  expense:14594698.13, remain:53545881.87,  pctRemain:78.58,  pctPerBudget:5.88  },
  { no:5,  desc:'CRUSHER 5500 TPH, 1500 TPH',                      code:'6-103', budget:32360280.00,  expense:7982739.21,  remain:24377540.79,  pctRemain:75.33,  pctPerBudget:3.21  },
  { no:6,  desc:'CONVEYOR',                                         code:'6-104', budget:51080670.00,  expense:12696456.04, remain:38384213.96,  pctRemain:75.14,  pctPerBudget:5.11  },
  { no:7,  desc:'AUXILIARY CV EQUIPMENT',                           code:'6-105', budget:9617497.00,   expense:3207117.50,  remain:6410379.50,   pctRemain:66.65,  pctPerBudget:1.29  },
  { no:8,  desc:'SERVICE CV EQUIPMENT',                             code:'6-106', budget:6261952.00,   expense:2473655.00,  remain:3788297.00,   pctRemain:60.50,  pctPerBudget:1.00  },
  { no:9,  desc:'HYDRAULIC HOSE AND FITTING',                       code:'6-227', budget:436000.00,    expense:0.00,        remain:436000.00,    pctRemain:100.00, pctPerBudget:0.00  },
  { no:10, desc:'GENERAL CONSUME MATERIAL CV',                      code:'6-111', budget:2180000.00,   expense:2445390.64,  remain:-265390.64,   pctRemain:-12.17, pctPerBudget:0.98  },
  { no:11, desc:'SERVICE SPREADER',                                 code:'7-101', budget:200000.00,    expense:0.00,        remain:200000.00,    pctRemain:100.00, pctPerBudget:0.00  },
  { no:12, desc:'SERVICE BUCKET WHEEL EXCVATOR, BELT WAGON, HOPPER',code:'7-102', budget:1200000.00,   expense:0.00,        remain:1200000.00,   pctRemain:100.00, pctPerBudget:0.00  },
  { no:13, desc:'SERVICE CRUSHER 5500 TPH, 1500 TPH',               code:'7-103', budget:200000.00,    expense:0.00,        remain:200000.00,    pctRemain:100.00, pctPerBudget:0.00  },
  { no:14, desc:'SERVICE CONVEYOR',                                  code:'7-104', budget:1500000.00,   expense:80124.00,    remain:1419876.00,   pctRemain:94.66,  pctPerBudget:0.03  },
  { no:15, desc:'GENERAL EXPENSE CV',                                code:'9-111', budget:4001336.59,   expense:166988.00,   remain:3834348.59,   pctRemain:95.83,  pctPerBudget:0.07  },
];
