/**
 * excelService.ts
 *
 * Parses an uploaded Excel (.xlsx) or CSV file and returns a list of PatientRow records.
 *
 * Integration boundary:
 *   This service runs entirely in the browser using the SheetJS (xlsx) library
 *   loaded via CDN if available, or falls back to a manual CSV parser.
 *   In production, validation could be performed server-side as well.
 *
 * Expected column names (case-insensitive, any order):
 *   Name / Patient Name
 *   Phone / Mobile / Contact
 *   Visit Date / Date
 *   Visit ID / ID / Patient ID
 *   Doctor / Doctor Name        (optional)
 *   Department                  (optional)
 */

import type { PatientRow } from '../types/patient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId(): string {
  return `pat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  return phone.slice(0, -6).replace(/\d/g, '*') + digits.slice(-4).padStart(6, '*').slice(-4);
}

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

/** Try to find a column value using multiple possible header aliases */
function pick(row: Record<string, string>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const norm = normaliseKey(alias);
    for (const key of Object.keys(row)) {
      if (normaliseKey(key) === norm) return (row[key] ?? '').trim();
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// CSV parser (no external dependency)
// ---------------------------------------------------------------------------
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

// ---------------------------------------------------------------------------
// XLSX parser using SheetJS loaded from window (CDN) if present,
// otherwise falls back to treating the file as CSV.
// ---------------------------------------------------------------------------
async function parseXLSX(file: File): Promise<Record<string, string>[]> {
  // Try SheetJS if it was loaded via CDN or is in node_modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (window as any).XLSX;
  if (XLSX) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, string>[];
  }

  // Fallback: read as text (works for CSV saved as .xlsx rarely, but handles .csv)
  const text = await file.text();
  return parseCSV(text);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function parsePatientFile(file: File): Promise<PatientRow[]> {
  let rawRows: Record<string, string>[] = [];

  if (file.name.endsWith('.csv')) {
    const text = await file.text();
    rawRows = parseCSV(text);
  } else {
    rawRows = await parseXLSX(file);
  }

  if (rawRows.length === 0) {
    throw new Error('The file appears to be empty or has no recognisable columns.');
  }

  const rows: PatientRow[] = rawRows
    .filter((r) => pick(r, 'Name', 'Patient Name', 'PatientName').length > 0)
    .map((r, idx) => {
      const phone = pick(r, 'Phone', 'Mobile', 'Contact', 'Phone Number', 'Mobile Number');
      const visitDate =
        pick(r, 'Visit Date', 'VisitDate', 'Date', 'Appointment Date') ||
        new Date().toISOString().slice(0, 10);

      return {
        id: generateId(),
        name: pick(r, 'Name', 'Patient Name', 'PatientName'),
        phone,
        maskedPhone: phone ? maskPhone(phone) : '+91 ******0000',
        visitDate,
        visitId:
          pick(r, 'Visit ID', 'VisitID', 'ID', 'Patient ID', 'PatientID') ||
          `VIS-${String(idx + 1).padStart(4, '0')}`,
        doctor: pick(r, 'Doctor', 'Doctor Name', 'DoctorName') || undefined,
        department: pick(r, 'Department', 'Dept') || undefined,
        sendStatus: 'pending',
      };
    });

  if (rows.length === 0) {
    throw new Error(
      'No patient records found. Ensure the file has a "Name" column and at least one data row.'
    );
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Generate a sample CSV the user can download to understand the format
// ---------------------------------------------------------------------------
export function getSampleCSV(): string {
  return [
    'Name,Phone,Visit Date,Visit ID,Doctor,Department',
    'Priya Sharma,+919876543210,2026-09-25,VIS-0001,Dr. Anand,Cardiology',
    'Arun Kumar,+919812345678,2026-09-25,VIS-0002,Dr. Meena,General',
    'Meena Raj,+919900112233,2026-09-24,VIS-0003,Dr. Suresh,Orthopedics',
    'Rahul Krishnan,+919988776655,2026-09-24,VIS-0004,Dr. Anand,Cardiology',
    'Divya Anand,+919123456789,2026-09-23,VIS-0005,Dr. Priya,Pediatrics',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// WhatsApp send via wa.me deep-link
// ---------------------------------------------------------------------------
export async function sendWhatsAppMessage(
  patient: PatientRow,
  hospitalName: string,
  feedbackUrl: string
): Promise<{ success: boolean; message: string }> {
  // Strip all non-digit characters from the phone number
  const digits = patient.phone.replace(/\D/g, '');

  if (!digits) {
    return { success: false, message: `No valid phone number for ${patient.name}` };
  }

  let baseUrl = '';
  if (typeof window !== 'undefined' && window.location?.origin) {
    baseUrl = `${window.location.origin}/feedback-interface`;
  } else {
    const envBase = (import.meta as any).env?.VITE_PUBLIC_FEEDBACK_URL?.trim();
    baseUrl = envBase || 'https://rescue-bridge.netlify.app/feedback-interface';
  }

  let cleanBase = baseUrl.replace(/\/+$/, '');
  try {
    const parsed = new URL(cleanBase);
    if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
      parsed.pathname = '/feedback-interface';
      cleanBase = parsed.toString().replace(/\/+$/, '');
    }
  } catch {
    if (!cleanBase.includes('/feedback-interface') && !cleanBase.includes('/feedback')) {
      cleanBase = `${cleanBase}/feedback-interface`;
    }
  }

  const separator = cleanBase.includes('?') ? '&' : '?';
  const cleanToken = (patient.id || '').trim();
  const tokenQuery = cleanToken ? `token=${encodeURIComponent(cleanToken)}` : '';
  const hospQuery = hospitalName ? `&hospital=${encodeURIComponent(hospitalName.trim())}` : '';
  const queryStr = `${tokenQuery}${hospQuery}`.replace(/^&/, '');
  const targetUrl = feedbackUrl || (queryStr ? `${cleanBase}${separator}${queryStr}` : cleanBase);

  const message =
    `Thank you for visiting ${hospitalName}!\n\n` +
    `We hope you had a great experience. Please click the feedback form link below to share your valuable feedback:\n\n` +
    `${targetUrl}\n\n` +
    `Your feedback helps us serve you better. Thank you!`;

  const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  // Open WhatsApp in a new tab
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  return {
    success: true,
    message: `WhatsApp opened for ${patient.maskedPhone}`,
  };
}
