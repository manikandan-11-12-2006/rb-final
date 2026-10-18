/**
 * googleSheetsService.ts
 *
 * Dedicated Google Spreadsheet API integration service.
 * Supports connecting and extracting rows directly from any Google Spreadsheet link via:
 *  1. Google Sheets API v4 (if API key or token configured)
 *  2. Google Sheets Gviz / JSON API (instant structured data from any accessible sheet link)
 *  3. Google Sheets CSV Export API
 *  4. CORS Proxy fallback
 */

import * as XLSX from 'xlsx';

export interface FetchedSpreadsheetRow {
  visit_uid: string;
  patient_name: string;
  phone: string;
  visit_date: string;
  department: string;
  doctor: string;
  status: string;
  raw?: Record<string, any>;
}

export interface GoogleSheetFetchResult {
  success: boolean;
  sheetId: string;
  sheetTitle?: string;
  rows: FetchedSpreadsheetRow[];
  totalRows: number;
  headers: string[];
  errorMessage?: string;
}

/**
 * Extract Google Sheet ID from any format of Google Sheets link
 */
export function extractGoogleSheetId(url: string): { sheetId: string | null; gid: string | null } {
  if (!url) return { sheetId: null, gid: null };
  const clean = url.trim();

  // 1. Pattern: /spreadsheets/d/e/{PUBLISHED_ID}/... (Published to web)
  const pubMatch = clean.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/i);
  if (pubMatch) {
    const gidMatch = clean.match(/[#&?]gid=([0-9]+)/i);
    return { sheetId: pubMatch[1], gid: gidMatch ? gidMatch[1] : '0' };
  }

  // 2. Pattern: /spreadsheets/(?:u/\d+/)?d/{SHEET_ID}/...
  const idMatch = clean.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/i);
  const sheetId = idMatch ? idMatch[1] : /^[a-zA-Z0-9-_]{20,}$/.test(clean) ? clean : null;

  // 3. Pattern: gid={GID}
  const gidMatch = clean.match(/[#&?]gid=([0-9]+)/i);
  const gid = gidMatch ? gidMatch[1] : '0';

  return { sheetId, gid };
}

/**
 * Pick column value using multiple possible aliases
 */
/**
 * Pick column value using multiple possible aliases with strict matching priorities
 */
function pickValue(row: Record<string, any>, ...aliases: string[]): string {
  const normKeys = Object.keys(row).map((k) => ({
    orig: k,
    norm: k.toLowerCase().replace(/[\s_\-.]/g, ''),
  }));

  // Pass 1: Strict Exact Match
  for (const alias of aliases) {
    const target = alias.toLowerCase().replace(/[\s_\-.]/g, '');
    const found = normKeys.find((k) => k.norm === target);
    if (found && row[found.orig] !== undefined && row[found.orig] !== null) {
      const val = String(row[found.orig]).trim();
      if (val) return val;
    }
  }

  // Pass 2: Prefix / Specific Match (ignoring conflicting generic keywords like 'name' or 'id')
  for (const alias of aliases) {
    const target = alias.toLowerCase().replace(/[\s_\-.]/g, '');
    if (['name', 'id', 'date', 'phone', 'token'].includes(target)) continue;
    const found = normKeys.find((k) => k.norm.includes(target));
    if (found && row[found.orig] !== undefined && row[found.orig] !== null) {
      const val = String(row[found.orig]).trim();
      if (val) return val;
    }
  }

  return '';
}

/**
 * Clean and normalize phone numbers (e.g. +91 98765 43210 -> +919876543210)
 */
function normalizePhone(raw: string): string {
  if (!raw) return '';
  const clean = String(raw).trim();
  const digits = clean.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (clean.startsWith('+')) return clean.replace(/\s+/g, '');
  return digits ? `+${digits}` : clean;
}

/**
 * Normalize date into standard YYYY-MM-DD
 */
function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const str = String(raw).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  // 0. Pattern: Google Gviz Date(YYYY, M, D) or Date(YYYY, M, D, H, M, S)
  const gvizDateMatch = str.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})/i);
  if (gvizDateMatch) {
    const year = gvizDateMatch[1];
    const month = parseInt(gvizDateMatch[2], 10) + 1; // Google Gviz months are 0-indexed
    const day = parseInt(gvizDateMatch[3], 10);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Strip timestamp time if present e.g. "9/30/2026 19:20:18" or "10/2/2026 18:05:04"
  const datePart = str.includes(' ') ? str.split(' ')[0] : str.includes('T') ? str.split('T')[0] : str;

  // 1. Pattern: YYYY-MM-DD or YYYY-DD-MM
  const ymdMatch = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const p2 = parseInt(ymdMatch[2], 10);
    const p3 = parseInt(ymdMatch[3], 10);

    let month = p2;
    let day = p3;
    if (p2 > 12 && p3 <= 12) {
      day = p2;
      month = p3;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 2. Pattern: M/D/YYYY, MM/DD/YYYY, DD-MM-YYYY, DD/MM/YYYY
  const dmyMatch = datePart.match(/^(\d{1,2})([-/.\s])(\d{1,2})[-/.\s](\d{4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const separator = dmyMatch[2];
    const p2 = parseInt(dmyMatch[3], 10);
    const year = dmyMatch[4];

    let month: number;
    let day: number;

    if (p1 > 12 && p2 <= 12) {
      // Definite DD-MM-YYYY (e.g. 30-09-2026 or 14/10/2026)
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      // Definite MM-DD-YYYY (e.g. 09-30-2026 or 10/14/2026)
      month = p1;
      day = p2;
    } else if (separator === '/') {
      // In Google Sheets, '/' is standard M/D/YYYY (e.g. 10/1/2026 -> Oct 1, 10/2/2026 -> Oct 2)
      month = p1;
      day = p2;
    } else {
      // Default to DD-MM-YYYY if hyphenated
      day = p1;
      month = p2;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Generate clean deterministic Visit ID (e.g. VIS-1001, VIS-1002)
 */
export function generateDeterministicVisitUid(
  patientName: string,
  phone: string,
  visitDate: string,
  rowIdx: number,
  sheetId?: string
): string {
  return `VIS-${1000 + rowIdx + 1}`;
}

/**
 * Check if row is corrupted or header artifact
 */
function isInvalidRow(name: string): boolean {
  if (!name || typeof name !== 'string') return true;
  const lower = name.toLowerCase().trim();
  return (
    lower.length < 2 ||
    lower === 'patient name' ||
    lower === 'patient' ||
    lower === 'name' ||
    lower === 'doctor' ||
    lower === 'doctor name' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'sample' ||
    lower === 'test'
  );
}

/**
 * Extract structured fields from a spreadsheet row using header names AND positional inspection
 */
export function extractRowFields(
  rowObj: Record<string, any>,
  rowValues: any[],
  rowIndex: number,
  headers: string[] = []
): FetchedSpreadsheetRow | null {
  const cleanVals = (rowValues || []).map((v) => (v !== undefined && v !== null ? String(v).trim() : ''));

  // Detect timestamp column (e.g. Google Forms submission timestamp in column 0)
  let timestampColIdx = -1;
  headers.forEach((h, i) => {
    const norm = h.toLowerCase().replace(/[\s_\-.]/g, '');
    if (norm.includes('timestamp') || norm.includes('submissiontime') || norm.includes('submittedat')) {
      timestampColIdx = i;
    }
  });

  if (timestampColIdx === -1 && cleanVals.length > 0) {
    if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\s+\d{1,2}:\d{2}/.test(cleanVals[0])) {
      timestampColIdx = 0;
    }
  }

  // 1. Patient Name
  let patientName = pickValue(
    rowObj,
    'patient_name', 'patientname', 'patient name', 'name of patient', 'name_of_patient',
    'patient', 'customer_name', 'customername', 'client_name', 'client', 'name', 'full_name'
  );

  if (!patientName || isInvalidRow(patientName)) {
    if (timestampColIdx === 0 && cleanVals[1] && !isInvalidRow(cleanVals[1])) {
      patientName = cleanVals[1];
    } else if (cleanVals[0] && !isInvalidRow(cleanVals[0]) && !/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(cleanVals[0])) {
      patientName = cleanVals[0];
    } else if (cleanVals[1] && !isInvalidRow(cleanVals[1])) {
      patientName = cleanVals[1];
    }
  }

  if (!patientName || isInvalidRow(patientName)) return null;

  // 2. Phone Number
  let phoneRaw = pickValue(
    rowObj,
    'phone_number', 'phonenumber', 'phone number', 'contact_number', 'contactnumber', 'contact number',
    'mobile_number', 'mobilenumber', 'mobile number', 'phone', 'mobile', 'contact', 'whatsapp_number',
    'whatsappnumber', 'whatsapp', 'phnumber', 'ph_number', 'ph'
  );

  if (!phoneRaw) {
    for (let i = 0; i < cleanVals.length; i++) {
      if (i === timestampColIdx) continue;
      const digits = cleanVals[i].replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 13 && !cleanVals[i].includes('/') && !cleanVals[i].includes('-202')) {
        phoneRaw = cleanVals[i];
        break;
      }
    }
  }
  const phone = normalizePhone(phoneRaw);

  // 3. Doctor Name
  let doctor = pickValue(
    rowObj,
    'doctor_name', 'doctorname', 'doctor name', 'doctor_consulted', 'doctorconsulted', 'doctor consulted',
    'consultant', 'consultant_name', 'physician', 'physician_name', 'dr_name', 'drname', 'dr name',
    'doctor', 'dr'
  );

  if (!doctor) {
    if (timestampColIdx === 0 && cleanVals[3] && !/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(cleanVals[3])) {
      doctor = cleanVals[3];
    } else {
      const foundDr = cleanVals.find((v) => /^dr\.?\s+/i.test(v));
      if (foundDr) doctor = foundDr;
      else doctor = 'Dr. Ramesh Kumar';
    }
  }

  // 4. Visited Date (strictly separate from submission timestamp)
  let dateRaw = pickValue(
    rowObj,
    'visited_date', 'visiteddate', 'visited date', 'visit_date', 'visitdate', 'visit date',
    'date_of_visit', 'date of visit', 'consultation_date', 'consultationdate', 'consultation date',
    'appointment_date', 'appointmentdate', 'appointment date'
  );

  if (!dateRaw) {
    const dateKey = Object.keys(rowObj).find((k) => {
      const norm = k.toLowerCase().replace(/[\s_\-.]/g, '');
      return norm === 'date' && !norm.includes('timestamp') && !norm.includes('submission');
    });
    if (dateKey && rowObj[dateKey]) {
      dateRaw = String(rowObj[dateKey]).trim();
    }
  }

  if (!dateRaw) {
    if (timestampColIdx === 0 && cleanVals[4] && /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(cleanVals[4])) {
      dateRaw = cleanVals[4];
    } else {
      for (let i = 1; i < cleanVals.length; i++) {
        if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(cleanVals[i]) || /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(cleanVals[i])) {
          dateRaw = cleanVals[i];
          break;
        }
      }
    }
  }

  const visitDate = normalizeDate(dateRaw);

  // 5. Department / Reason
  let department = pickValue(
    rowObj,
    'department', 'dept', 'specialty', 'specialization', 'reason', 'reason_for_visit',
    'symptoms', 'illness', 'complaint', 'diagnosis', 'problem'
  );

  if (!department) {
    if (timestampColIdx === 0 && cleanVals[5]) {
      department = cleanVals[5];
    } else {
      department = 'General Medicine';
    }
  }

  // 6. Visit UID
  const explicitUid = pickValue(
    rowObj,
    'visit_id', 'visitid', 'visit id', 'visit_uid', 'visituid', 'visit uid', 'uid', 'token',
    'id', 'sl_no', 'slno', 's_no', 'sno', 'serial_number'
  );
  const visitUid = explicitUid ? String(explicitUid).trim() : `VIS-${1000 + rowIndex + 1}`;

  return {
    visit_uid: visitUid,
    patient_name: String(patientName).trim(),
    phone,
    visit_date: visitDate,
    department,
    doctor,
    status: 'pending',
    raw: rowObj,
  };
}

/**
 * Fetch rows from Google Spreadsheet link
 */
export async function fetchGoogleSheetData(sheetUrl: string, apiKey?: string): Promise<GoogleSheetFetchResult> {
  const { sheetId, gid } = extractGoogleSheetId(sheetUrl);

  if (!sheetId) {
    return {
      success: false,
      sheetId: '',
      rows: [],
      totalRows: 0,
      headers: [],
      errorMessage: 'Invalid Google Spreadsheet URL. Please copy and paste the full Google Sheets link.',
    };
  }

  const effectiveApiKey =
    apiKey ||
    (import.meta as any).env?.VITE_GOOGLE_SHEETS_API_KEY ||
    (import.meta as any).env?.GOOGLE_SHEETS_API_KEY ||
    '';

  // ── Strategy 1: Google Sheets API v4 (if API key available) ─────────────────
  if (effectiveApiKey) {
    try {
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z500?key=${effectiveApiKey}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const json = await res.json();
        if (json && json.values && json.values.length > 1) {
          const headers: string[] = json.values[0].map((h: any) => String(h).trim());
          const dataRows = json.values.slice(1);

          const parsedRows: FetchedSpreadsheetRow[] = [];
          dataRows.forEach((rowVals: any[], idx: number) => {
            const rowObj: Record<string, any> = {};
            headers.forEach((h, hIdx) => {
              rowObj[h] = rowVals[hIdx] !== undefined ? rowVals[hIdx] : '';
            });

            const parsed = extractRowFields(rowObj, rowVals, idx, headers);
            if (parsed) {
              parsedRows.push(parsed);
            }
          });

          if (parsedRows.length > 0) {
            return {
              success: true,
              sheetId,
              rows: parsedRows,
              totalRows: parsedRows.length,
              headers,
            };
          }
        }
      }
    } catch (errApi) {
      console.warn('Google Sheets API v4 fetch attempt notice:', errApi);
    }
  }

  // ── Strategy 2: Google Visualization Gviz API (Instant & Structured) ─────────
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json${gid ? `&gid=${gid}` : ''}`;
    const gvizRes = await fetch(gvizUrl);
    if (gvizRes.ok) {
      const gvizText = await gvizRes.text();
      const match = gvizText.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
      if (match && match[1]) {
        const payload = JSON.parse(match[1]);
        const cols = payload.table?.cols || [];
        const rawRows = payload.table?.rows || [];

        let headers: string[] = cols.map((c: any, i: number) => c?.label?.trim() || `col_${i}`);
        let rowsToProcess = rawRows;

        // Check if the first row contains actual string headers
        if (rawRows.length > 0 && headers.every((h) => h.startsWith('col_'))) {
          const firstRowCells = rawRows[0].c || [];
          const candidateHeaders = firstRowCells.map((c: any) => (c?.f !== undefined ? String(c.f).trim() : c?.v !== undefined ? String(c.v).trim() : ''));
          const hasCommonKeywords = candidateHeaders.some((h: string) => {
            const norm = h.toLowerCase();
            return norm.includes('name') || norm.includes('timestamp') || norm.includes('phone') || norm.includes('doctor') || norm.includes('date');
          });
          if (hasCommonKeywords) {
            headers = candidateHeaders;
            rowsToProcess = rawRows.slice(1);
          }
        }

        const parsedRows: FetchedSpreadsheetRow[] = [];

        rowsToProcess.forEach((r: any, idx: number) => {
          const rowObj: Record<string, any> = {};
          const cVals = r.c || [];
          const valArray: any[] = [];
          headers.forEach((h, hIdx) => {
            const cell = cVals[hIdx];
            const cellVal = cell ? (cell.f !== undefined ? cell.f : cell.v !== undefined ? cell.v : '') : '';
            rowObj[h] = cellVal;
            valArray.push(cellVal);
          });

          const parsed = extractRowFields(rowObj, valArray, idx, headers);
          if (parsed) {
            parsedRows.push(parsed);
          }
        });

        if (parsedRows.length > 0) {
          return {
            success: true,
            sheetId,
            rows: parsedRows,
            totalRows: parsedRows.length,
            headers,
          };
        }
      }
    }
  } catch (errGviz) {
    console.warn('Google Sheets Gviz fetch attempt notice:', errGviz);
  }

  // ── Strategy 3: Google Sheets CSV Export API via SheetJS & Proxies ────────────
  const exportUrls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`,
    `https://docs.google.com/spreadsheets/d/e/${sheetId}/pub?output=csv`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`)}`,
    `https://corsproxy.io/?${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`)}`,
  ];

  for (const exportUrl of exportUrls) {
    try {
      const resp = await fetch(exportUrl);
      if (resp.ok) {
        const csvText = await resp.text();
        if (csvText && csvText.length > 10 && !csvText.includes('<!DOCTYPE html>')) {
          const workbook = XLSX.read(csvText, { type: 'string' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' });

          if (rawJson && rawJson.length > 0) {
            const headers = Object.keys(rawJson[0]);
            const parsedRows: FetchedSpreadsheetRow[] = [];

            rawJson.forEach((row, idx) => {
              const valArray = Object.values(row);
              const parsed = extractRowFields(row, valArray, idx, headers);
              if (parsed) {
                parsedRows.push(parsed);
              }
            });

            if (parsedRows.length > 0) {
              return {
                success: true,
                sheetId,
                rows: parsedRows,
                totalRows: parsedRows.length,
                headers,
              };
            }
          }
        }
      }
    } catch (errCsv) {
      console.warn(`Export CSV attempt failed for ${exportUrl}:`, errCsv);
    }
  }

  return {
    success: false,
    sheetId,
    rows: [],
    totalRows: 0,
    headers: [],
    errorMessage:
      'Could not access the Google Spreadsheet. Please ensure the Google Sheet link sharing setting is set to "Anyone with the link can view".',
  };
}

