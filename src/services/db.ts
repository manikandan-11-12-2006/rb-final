import {
  Hospital,
  User,
  Patient,
  Visit,
  ReviewRequest,
  UserRole,
  HospitalSheetConnection,
  ColumnMapping,
  SyncRun,
  SyncError,
  VisitStatus,
} from '../types/database';
import { analyzeSentimentLocally } from './sentimentAnalysisService';

export const WHATSAPP_REVIEW_TEMPLATE = `Thank you for visiting [Hospital Name]!

We hope you had a great experience during your visit. Please click the feedback form link below to share your valuable feedback:

[Review Link]

Your feedback helps us serve you better. Thank you!`;

export function getFeedbackFormUrl(token: string, patientName?: string, hospitalName?: string, phone?: string): string {
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

  // Format clean professional token (e.g. rb-1001 or visit-uid)
  const cleanToken = (token || '').trim();
  const tokenQuery = cleanToken ? `token=${encodeURIComponent(cleanToken)}` : '';
  const hospQuery = hospitalName ? `&hospital=${encodeURIComponent(hospitalName.trim())}` : '';
  const nameQuery = patientName ? `&patient=${encodeURIComponent(patientName.trim())}` : '';
  const phoneQuery = phone ? `&phone=${encodeURIComponent(phone.trim())}` : '';
  const queryStr = `${tokenQuery}${hospQuery}${nameQuery}${phoneQuery}`.replace(/^&/, '');

  return queryStr ? `${cleanBase}${separator}${queryStr}` : cleanBase;
}

export const FIREBASE_BASE_URL = ((import.meta as any).env?.VITE_FIREBASE_DATABASE_URL || 'https://rescuebridge-fe59b-default-rtdb.firebaseio.com').replace(/\/+$/, '');

export async function fetchFromFirebase<T = any>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${FIREBASE_BASE_URL}/${path.replace(/^\/+/, '')}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Firebase read error at /${path}:`, err);
    return null;
  }
}

export async function syncToFirebase(path: string, data: any, method: 'PUT' | 'POST' | 'PATCH' | 'DELETE' = 'PUT'): Promise<boolean> {
  try {
    const res = await fetch(`${FIREBASE_BASE_URL}/${path.replace(/^\/+/, '')}.json`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'DELETE' ? undefined : JSON.stringify(data),
    });
    return res.ok;
  } catch (err) {
    console.warn(`Firebase write error at /${path}:`, err);
    return false;
  }
}

const SEED_HOSPITALS: Hospital[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'City Care Hospital',
    subdomain: 'citycare',
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    sheet_id: '',
    sheet_type: 'google_sheets',
    logo: undefined,
    whatsapp_template_name: 'patient_review_v1',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    sync_status: 'active',
    last_synced: 'Just now',
  },
  {
    id: 'tambaram-medical-center-1874',
    name: 'Tambaram Medical Center',
    subdomain: 'tambaram',
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    sheet_id: '',
    sheet_type: 'google_sheets',
    logo: undefined,
    whatsapp_template_name: 'patient_review_v1',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    sync_status: 'active',
    last_synced: 'Just now',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Apex Multi-Specialty Clinic',
    subdomain: 'apex',
    google_place_id: 'ChIJ3S4IddeuEmsRil83y53frY2',
    sheet_id: '',
    sheet_type: 'excel_365',
    logo: undefined,
    whatsapp_template_name: 'patient_review_v1',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    sync_status: 'active',
    last_synced: 'Just now',
  },
];

const SEED_USERS: User[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    hospital_id: null,
    name: 'Super Administrator',
    email: 'superadmin@rescuebridge.com',
    role: 'super_admin',
    password_hash: 'admin123',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    hospital_id: '11111111-1111-1111-1111-111111111111',
    name: 'Dr. Ramesh Kumar (Admin)',
    email: 'admin@citycare.com',
    role: 'hospital_admin',
    password_hash: 'admin123',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: '41d871cf-e6a8-49e2-b596-03b6506a14e1',
    hospital_id: 'tambaram-medical-center-1874',
    name: 'Tambaram Medical Center Admin',
    email: 'privacy@tambarammedicalcenter.com',
    role: 'hospital_admin',
    password_hash: 'Tambaram1234',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    hospital_id: '22222222-2222-2222-2222-222222222222',
    name: 'Dr. Priya V (Apex Admin)',
    email: 'admin@apexclinic.com',
    role: 'hospital_admin',
    password_hash: 'admin123',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

const SEED_PATIENTS: Patient[] = [];
const SEED_VISITS: Visit[] = [];
const SEED_REVIEW_REQUESTS: ReviewRequest[] = [];

// ---------------------------------------------------------------------------
// ISO Date and Deterministic UUID Helpers for Database Integrity
// ---------------------------------------------------------------------------
export function toIsoDate(dStr?: string | null): string {
  if (!dStr) return new Date().toISOString().split('T')[0];
  const str = String(dStr).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  // Strip timestamp time if present e.g. "9/30/2026 19:20:18" or "10/2/2026 18:05:04"
  const datePart = str.includes(' ') ? str.split(' ')[0] : str.includes('T') ? str.split('T')[0] : str;

  // 1. Match YYYY-MM-DD or YYYY-DD-MM
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

  // 2. Match M/D/YYYY, MM/DD/YYYY, DD-MM-YYYY, DD/MM/YYYY
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
      month = p1;
      day = p2;
    } else {
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

// ---------------------------------------------------------------------------
// ID Generators: Name + Unique Random Number
// ---------------------------------------------------------------------------
export function generateHospitalId(name: string, existingIds?: Set<string>): string {
  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'hospital';

  let randomNum = Math.floor(1000 + Math.random() * 9000);
  let id = `${cleanName}-${randomNum}`;
  while (existingIds && existingIds.has(id)) {
    randomNum = Math.floor(1000 + Math.random() * 9000);
    id = `${cleanName}-${randomNum}`;
  }
  return id;
}

export function generatePatientId(
  patientName: string,
  suffixOrRowId?: string | number,
  existingIds?: Set<string>
): string {
  const cleanName = patientName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'patient';

  let suffix = '';
  if (suffixOrRowId) {
    const digits = String(suffixOrRowId).replace(/\D+/g, '');
    if (digits) suffix = `-${digits}`;
  }
  if (!suffix) {
    suffix = `-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  let id = `${cleanName}${suffix}`;
  while (existingIds && existingIds.has(id)) {
    const extra = Math.floor(100 + Math.random() * 900);
    id = `${cleanName}${suffix}-${extra}`;
  }
  return id;
}

export function toPatientUuid(visitUidOrPhone: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitUidOrPhone)) {
    return visitUidOrPhone;
  }
  let hash = 0;
  for (let i = 0; i < visitUidOrPhone.length; i++) {
    hash = (hash << 5) - hash + visitUidOrPhone.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(12, '0').slice(-12);
  const mid = (Math.abs(hash * 31) % 0xffff).toString(16).padStart(4, '0');
  return `00000000-${mid}-4000-8000-${hex}`;
}

export function toVisitUuid(visitUidOrPhone: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visitUidOrPhone)) {
    return visitUidOrPhone;
  }
  let hash = 0;
  for (let i = 0; i < visitUidOrPhone.length; i++) {
    hash = (hash << 5) - hash + visitUidOrPhone.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(12, '0').slice(-12);
  const mid = (Math.abs(hash * 37) % 0xffff).toString(16).padStart(4, '0');
  return `11111111-${mid}-4000-8000-${hex}`;
}

// ---------------------------------------------------------------------------
// LocalStorage Persistence Helpers (Syncs in real-time)
// ---------------------------------------------------------------------------
function getStore<T>(key: string, initial: T[]): T[] {
  try {
    const raw = localStorage.getItem(`rb_${key}`);
    if (!raw) {
      localStorage.setItem(`rb_${key}`, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return initial;
  }
}

function setStore<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(`rb_${key}`, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to write to localStorage for key rb_${key}:`, err);
  }
}

function isCorruptedText(text?: string | null): boolean {
  if (!text) return false;
  return (
    text.includes('[Content_Types]') ||
    text.includes('PK\x03\x04') ||
    text.includes('PK\u0003\u0004') ||
    (text.includes('PK') && text.includes('.xml')) ||
    (text.includes('\ufffd') && text.length > 5) ||
    /^[^\w\s]{3,}.*xml/i.test(text)
  );
}

const DUMMY_NAMES = new Set([
  'rajesh sharma',
  'anita desai',
  'suresh kumar',
  'kavitha sundaram',
  'arun kumar',
  'deepa venkat',
  'mohammed farooq',
  'suresh raina',
  'meena kumari',
  'vijay shankar',
  'pooja nair',
  'sunita sharma',
  'venkatesh rao',
  'karthik subramanian',
  'ganesh moorthy'
]);

function isDummyOrCorrupted(name?: string | null, id?: string | null): boolean {
  if (!name && !id) return true;
  if (isCorruptedText(name)) return true;
  if (name && DUMMY_NAMES.has(name.trim().toLowerCase())) return true;
  if (id && (id.startsWith('33333333-') || id.startsWith('44444444-') || id.startsWith('55555555-'))) return true;
  return false;
}

function cleanCorruptedData(): void {
  try {
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const visits = getStore<Visit>('visits', SEED_VISITS);

    const validPatients = patients.filter((p) => !isDummyOrCorrupted(p.name, p.id));
    const validPatientIdSet = new Set(validPatients.map((p) => p.id));
    const validVisits = visits.filter(
      (v) =>
        validPatientIdSet.has(v.patient_id) &&
        !isDummyOrCorrupted(v.doctor, v.id) &&
        !isCorruptedText(v.visit_uid) &&
        !isCorruptedText(v.sheet_row_id) &&
        !v.visit_uid?.startsWith('GS-') &&
        !v.sheet_row_id?.startsWith('GS-') &&
        !v.id?.startsWith('GS-')
    );

    if (validPatients.length !== patients.length || validVisits.length !== visits.length) {
      setStore('patients', validPatients);
      setStore('visits', validVisits);
    }
  } catch (err) {
    console.error('Failed to clean corrupted records:', err);
  }
}

// ---------------------------------------------------------------------------
// Date crossed check: Returns true when visit date is strictly earlier than today
// ---------------------------------------------------------------------------
export function isDateCrossed(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const str = String(dateStr).trim();
  if (!str) return false;

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let visitTime: number | null = null;

  // 1. Check DD-MM-YYYY or DD/MM/YYYY or D-M-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    visitTime = new Date(year, month, day).getTime();
  } else {
    // 2. Check YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      visitTime = new Date(year, month, day).getTime();
    } else {
      // 3. Fallback to Date.parse
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        const d = new Date(parsed);
        visitTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }
    }
  }

  if (visitTime === null || isNaN(visitTime)) return false;
  return visitTime < todayMidnight;
}

// ---------------------------------------------------------------------------
// Multi-Tenant Pure Firebase Realtime Database Client
// ---------------------------------------------------------------------------
export const db = {
  // ── Hospitals ─────────────────────────────────────────────────────────────
  async getHospitals(): Promise<Hospital[]> {
    const localHospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const hospitalMap = new Map<string, Hospital>();
    localHospitals.forEach((h) => {
      if (h && h.id) hospitalMap.set(h.id, h);
    });

    // 1. Fetch from Firebase RTDB
    try {
      const fbData = await fetchFromFirebase<Record<string, Hospital>>('hospitals');
      if (fbData && typeof fbData === 'object') {
        Object.values(fbData).forEach((remote) => {
          if (remote && remote.id) {
            const existing = hospitalMap.get(remote.id);
            hospitalMap.set(remote.id, {
              ...existing,
              ...remote,
              logo: remote.logo || existing?.logo,
            });
          }
        });
      } else {
        // First run seeding to Firebase RTDB
        const seedBatch: Record<string, Hospital> = {};
        SEED_HOSPITALS.forEach((h) => { seedBatch[encodeURIComponent(h.id)] = h; });
        syncToFirebase('hospitals', seedBatch, 'PATCH').catch(() => {});
      }
    } catch (err) {
      console.warn('Failed to fetch hospitals from Firebase:', err);
    }

    const merged = Array.from(hospitalMap.values());
    setStore('hospitals', merged);
    return merged;
  },

  async getHospitalById(id: string): Promise<Hospital | null> {
    const hospitals = await this.getHospitals();
    return hospitals.find((h) => h.id === id) || null;
  },

  async getHospitalBySubdomain(subdomain: string): Promise<Hospital | null> {
    const hospitals = await this.getHospitals();
    return (
      hospitals.find(
        (h) => h.subdomain.toLowerCase() === subdomain.toLowerCase()
      ) || null
    );
  },

  async createHospital(
    hospitalData: Omit<Hospital, 'id' | 'created_at'>,
    adminData?: { name: string; email: string }
  ): Promise<Hospital> {
    const current = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const existingIds = new Set(current.map((h) => h.id));
    const hospitalId = generateHospitalId(hospitalData.name, existingIds);

    // Compute unique subdomain
    const existingSubdomains = new Set(
      current.map((h) => h.subdomain?.toLowerCase().trim()).filter(Boolean)
    );
    let finalSubdomain = (hospitalData.subdomain || hospitalData.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'hospital';

    if (existingSubdomains.has(finalSubdomain)) {
      const parts = hospitalId.split('-');
      const numPart = parts[parts.length - 1] || Math.floor(1000 + Math.random() * 9000);
      finalSubdomain = `${finalSubdomain}-${numPart}`;
    }

    const newHospital: Hospital = {
      ...hospitalData,
      id: hospitalId,
      subdomain: finalSubdomain,
      created_at: new Date().toISOString(),
      sync_status: 'active',
      last_synced: 'Just now',
    };

    // 1. Persist to localStorage
    const updated = [newHospital, ...current.filter((h) => h.id !== newHospital.id)];
    setStore('hospitals', updated);

    // 2. Persist directly to Firebase RTDB
    await syncToFirebase(`hospitals/${encodeURIComponent(newHospital.id)}`, newHospital, 'PUT');

    // 3. Create first hospital admin if provided
    if (adminData && adminData.email) {
      await this.createUser({
        hospital_id: newHospital.id,
        name: adminData.name,
        email: adminData.email,
        role: 'hospital_admin',
      });
    }

    return newHospital;
  },

  async updateHospital(id: string, updates: Partial<Hospital>): Promise<Hospital> {
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const idx = hospitals.findIndex((h) => h.id === id);
    if (idx === -1) throw new Error('Hospital not found');

    const updated: Hospital = {
      ...hospitals[idx],
      ...updates,
    };
    hospitals[idx] = updated;
    setStore('hospitals', hospitals);

    // Sync to Firebase RTDB
    await syncToFirebase(`hospitals/${encodeURIComponent(id)}`, updated, 'PUT');

    return updated;
  },

  async deleteHospital(id: string): Promise<void> {
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const filtered = hospitals.filter((h) => h.id !== id);
    setStore('hospitals', filtered);

    // Delete from Firebase RTDB
    await syncToFirebase(`hospitals/${encodeURIComponent(id)}`, null, 'DELETE');
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  async getUsers(hospitalId?: string | null): Promise<User[]> {
    const localUsers = getStore<User>('users', SEED_USERS);
    const userMap = new Map<string, User>();
    localUsers.forEach((u) => {
      if (u && u.email) userMap.set(u.email.toLowerCase().trim(), u);
    });

    try {
      const fbUsers = await fetchFromFirebase<Record<string, User>>('users');
      if (fbUsers && typeof fbUsers === 'object') {
        Object.values(fbUsers).forEach((remote) => {
          if (remote && remote.email) {
            const key = remote.email.toLowerCase().trim();
            const existing = userMap.get(key);
            userMap.set(key, {
              ...existing,
              ...remote,
              password_hash: existing?.password_hash || remote.password_hash,
            });
          }
        });
      } else {
        // First run seed to Firebase RTDB
        const seedUserBatch: Record<string, User> = {};
        SEED_USERS.forEach((u) => { seedUserBatch[encodeURIComponent(u.id)] = u; });
        syncToFirebase('users', seedUserBatch, 'PATCH').catch(() => {});
      }
    } catch (err) {
      console.warn('Firebase getUsers error:', err);
    }

    const allUsers = Array.from(userMap.values());
    setStore('users', allUsers);

    if (!hospitalId) return allUsers;
    return allUsers.filter(
      (u) => u.hospital_id === hospitalId || u.role === 'super_admin'
    );
  },

  async createUser(userData: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const cleanEmail = userData.email.trim().toLowerCase();
    const newUser: User = {
      ...userData,
      email: cleanEmail,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    // 1. Persist locally
    const currentUsers = getStore<User>('users', SEED_USERS);
    const filtered = currentUsers.filter((u) => u.email.toLowerCase().trim() !== cleanEmail);
    const updatedUsers = [newUser, ...filtered];
    setStore('users', updatedUsers);

    // 2. Persist to Firebase RTDB
    await syncToFirebase(`users/${encodeURIComponent(newUser.id)}`, newUser, 'PUT');

    return newUser;
  },

  // ── Visits & Patients ─────────────────────────────────────────────────────
  async getPatients(hospitalId?: string | null): Promise<Patient[]> {
    cleanCorruptedData();
    let localPatients = getStore<Patient>('patients', []).filter(
      (p) => !isDummyOrCorrupted(p.name, p.id)
    );

    // Fetch directly from Firebase RTDB (source of truth)
    try {
      const fbData = await fetchFromFirebase<Record<string, Patient>>('patients');
      if (fbData !== null) {
        const remotePatients: Patient[] =
          fbData && typeof fbData === 'object'
            ? Object.values(fbData).filter((remote) => remote?.id && !isDummyOrCorrupted(remote.name, remote.id))
            : [];
        setStore('patients', remotePatients);
        if (hospitalId && hospitalId !== 'all') {
          return remotePatients.filter((p) => p.hospital_id === hospitalId);
        }
        return remotePatients;
      }
    } catch (err) {
      console.warn('Firebase getPatients error:', err);
    }

    if (hospitalId && hospitalId !== 'all') {
      return localPatients.filter((p) => p.hospital_id === hospitalId);
    }
    return localPatients;
  },

  async getVisits(
    hospitalId?: string | null,
    filters?: {
      department?: string;
      doctor?: string;
      status?: string;
      date?: string;
    }
  ): Promise<Visit[]> {
    cleanCorruptedData();
    let visits = getStore<Visit>('visits', []).filter((v) => !isDummyOrCorrupted(v.doctor, v.id));

    // 1. Fetch from Firebase RTDB (source of truth)
    try {
      const fbData = await fetchFromFirebase<Record<string, Visit>>('visits');
      if (fbData !== null) {
        const remoteVisits: Visit[] =
          fbData && typeof fbData === 'object'
            ? Object.values(fbData).filter((remote) => remote?.id && !isDummyOrCorrupted(remote.doctor, remote.id))
            : [];
        visits = remoteVisits;
        setStore('visits', visits);
      }
    } catch (err) {
      console.warn('Firebase getVisits error:', err);
    }

    // Fetch ALL patients and ALL reviews so visits can ALWAYS hydrate correctly
    const patients = await this.getPatients();
    const hospitals = await this.getHospitals();
    const reviews = await this.getReviews();

    let filtered = visits;
    if (hospitalId && hospitalId !== 'all') {
      filtered = filtered.filter((v) => v.hospital_id === hospitalId);
    }
    if (filters?.department && filters.department !== 'all') {
      filtered = filtered.filter((v) => v.department === filters.department);
    }
    if (filters?.doctor && filters.doctor !== 'all') {
      filtered = filtered.filter((v) => v.doctor === filters.doctor);
    }
    if (filters?.date) {
      filtered = filtered.filter((v) => v.visit_date === filters.date);
    }

    // Hydrate with patient, hospital, review_request and mark completed if reviewed or date crossed
    const hydrated = filtered
      .map((v) => {
        let patient = patients.find((p) => p.id === v.patient_id);
        if (!patient && (v as any).patient_name) {
          const vName = ((v as any).patient_name || '').trim().toLowerCase();
          patient = patients.find((p) => p.name.trim().toLowerCase() === vName);
        }
        if (!patient && v.sheet_row_id) {
          patient = patients.find((p) => p.id === v.sheet_row_id);
        }
        if (!patient) {
          const normVName = ((v as any).patient_name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const normVPhone = ((v as any).phone || '').replace(/\D/g, '').slice(-10);
          patient = patients.find((p) => {
            const pPh = (p.phone || '').replace(/\D/g, '').slice(-10);
            if (normVPhone && pPh && pPh === normVPhone) return true;
            const pNm = (p.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            if (normVName && pNm && (pNm === normVName || (normVName.length >= 4 && pNm.includes(normVName)) || (pNm.length >= 4 && normVName.includes(pNm)))) return true;
            return false;
          });
        }

        const pName = (patient?.name || (v as any).patient_name || '').trim().toLowerCase();
        const pPhone = (patient?.phone || (v as any).phone || '').replace(/\D/g, '').slice(-10);

        // Strict visit review matching: Match only if token, id, visit_uid or sheet_row_id matches
        const exactReviews = reviews.filter((r) => {
          if (r.visit_id && (r.visit_id === v.id || r.visit_id === v.visit_uid || r.visit_id === v.token || r.visit_id === v.sheet_row_id)) return true;
          if (r.token && (r.token === v.token || r.token === v.id || r.token === v.visit_uid || r.token === v.sheet_row_id)) return true;
          return false;
        });

        // Only fallback if this visit explicitly requested a review and has no exact match yet
        let matchingReviews = exactReviews;
        if (matchingReviews.length === 0 && v.review_requested) {
          matchingReviews = reviews.filter((r) => {
            if (r.token && r.token !== v.token) return false;
            if (r.visit_id && r.visit_id !== v.id && r.visit_id !== v.visit_uid && r.visit_id !== v.sheet_row_id) return false;
            if (patient && r.patient_id && (r.patient_id === patient.id || r.patient_id === patient.name)) return true;
            const rName = ((r as any).patient_name || (r as any).patient_id || (r as any).patient || '').trim().toLowerCase();
            const rPhone = (((r as any).phone || (r as any).phone_number || (r as any).mobile || '') as string).replace(/\D/g, '').slice(-10);
            if (pName && rName && pName.length >= 4 && rName.length >= 4 && pName === rName) {
              if (!pPhone || !rPhone || pPhone === rPhone) return true;
            }
            return false;
          });
        }

        // Prioritize any matching review that has an actual star rating submitted
        const ratedReview = matchingReviews.find((r) => {
          const num = Number(r.rating);
          return !isNaN(num) && num >= 1 && num <= 5;
        });
        const sentRequest = matchingReviews.find((r) => ['sent', 'delivered', 'read'].includes(r.whatsapp_status));

        const effectiveRating = ratedReview ? Number(ratedReview.rating) : null;

        let reviewReq = ratedReview || sentRequest || (v.review_requested ? matchingReviews[0] : undefined);
        if (effectiveRating && exactReviews.length > 0) {
          const numRating = Number(effectiveRating);
          const isHighRating = numRating >= 4;
          reviewReq = {
            id: ratedReview?.id || reviewReq?.id || `rev-${v.id}`,
            hospital_id: v.hospital_id,
            visit_id: v.id,
            token: v.token,
            patient_id: patient?.id || v.patient_id,
            patient_name: patient?.name || (v as any).patient_name,
            phone: patient?.phone || (v as any).phone,
            rating: numRating,
            review_channel: ratedReview?.review_channel || (isHighRating ? 'google_review' : 'web'),
            is_google_review: Boolean(ratedReview?.is_google_review || isHighRating),
            google_review_posted: Boolean(ratedReview?.google_review_posted || isHighRating),
            whatsapp_status: ratedReview?.whatsapp_status || sentRequest?.whatsapp_status || 'sent',
            sent_at: sentRequest?.sent_at || ratedReview?.sent_at || ratedReview?.submitted_at || new Date().toISOString(),
            feedback_text: ratedReview?.feedback_text || null,
            submitted_at: ratedReview?.submitted_at || new Date().toISOString(),
          };
        }

        const isSent = Boolean(v.review_requested || (reviewReq && ['sent', 'delivered', 'read'].includes(reviewReq.whatsapp_status)));
        const isReviewed = Boolean(effectiveRating && Number(effectiveRating) >= 1);
        const isCompleted = isReviewed || isSent || v.status === 'completed';

        return {
          ...v,
          status: isCompleted ? ('completed' as const) : ('registered' as const),
          rating: isReviewed ? effectiveRating : null,
          is_reviewed: isReviewed,
          review_requested: isSent,
          patient,
          hospital: hospitals.find((h) => h.id === v.hospital_id),
          review_request: isSent || isReviewed ? reviewReq : undefined,
        };
      })
      .filter((v) => !isDummyOrCorrupted(v.patient?.name, v.patient?.id) && !isCorruptedText(v.visit_uid) && !v.visit_uid?.startsWith('GS-') && !v.sheet_row_id?.startsWith('GS-') && !v.id?.startsWith('GS-'));

    // Deduplicate consultations
    const seenConsultationKeys = new Set<string>();
    const deduplicatedHydrated: typeof hydrated = [];

    for (const v of hydrated) {
      const normName = (v.patient?.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const normPhone = (v.patient?.phone || '').replace(/\D/g, '').slice(-10);
      const normDate = (v.visit_date || '').trim();
      const normDoc = (v.doctor || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const sheetIdScope = v.sheet_id || 'main';

      const exactKey = v.visit_uid && !v.visit_uid.startsWith('GS-')
        ? `${v.hospital_id}|${sheetIdScope}|${v.visit_uid}`
        : `${v.hospital_id}|${sheetIdScope}|${normName}|${normPhone}|${normDate}|${normDoc}`;

      if (!seenConsultationKeys.has(exactKey)) {
        seenConsultationKeys.add(exactKey);
        deduplicatedHydrated.push(v);
      }
    }

    if (filters?.status && filters.status !== 'all') {
      return deduplicatedHydrated.filter((v) => v.status === filters.status);
    }
    return deduplicatedHydrated;
  },

  async purgeCorruptedVisits(hospitalId?: string): Promise<number> {
    cleanCorruptedData();
    const visits = getStore<Visit>('visits', []);
    const patients = getStore<Patient>('patients', []);
    const patientMap = new Map(patients.map((p) => [p.id, p]));
    const before = visits.length;

    const seenKeys = new Set<string>();
    const clean: Visit[] = [];
    const duplicateIdsToDelete: string[] = [];

    for (const v of visits) {
      if (hospitalId && v.hospital_id !== hospitalId) {
        clean.push(v);
        continue;
      }

      if (
        (v.visit_uid && v.visit_uid.startsWith('GS-')) ||
        (v.sheet_row_id && v.sheet_row_id.startsWith('GS-')) ||
        (v.id && v.id.startsWith('GS-'))
      ) {
        duplicateIdsToDelete.push(v.id);
        continue;
      }

      const p = patientMap.get(v.patient_id);
      if (!p || !p.name || isDummyOrCorrupted(p.name, p.id) || isDummyOrCorrupted(v.doctor, v.id) || isCorruptedText(v.visit_uid)) {
        duplicateIdsToDelete.push(v.id);
        continue;
      }
      const normName = p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const cleanPhone = (p.phone || '').replace(/\D/g, '').slice(-10);
      const cleanDate = (v.visit_date || '').trim();
      const cleanDoc = (v.doctor || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const sheetIdScope = v.sheet_id || 'main';

      const exactKey = v.visit_uid && !v.visit_uid.startsWith('GS-')
        ? `${v.hospital_id}|${sheetIdScope}|${v.visit_uid}`
        : `${v.hospital_id}|${sheetIdScope}|${normName}|${cleanPhone}|${cleanDate}|${cleanDoc}`;

      if (seenKeys.has(exactKey)) {
        duplicateIdsToDelete.push(v.id);
      } else {
        seenKeys.add(exactKey);
        clean.push(v);
      }
    }

    setStore('visits', clean);

    // Remove duplicates from Firebase RTDB
    if (duplicateIdsToDelete.length > 0) {
      duplicateIdsToDelete.forEach((id) => {
        syncToFirebase(`visits/${encodeURIComponent(id)}`, null, 'DELETE').catch(() => {});
      });
    }

    return before - clean.length;
  },

  async deduplicateVisits(hospitalId?: string): Promise<number> {
    return this.purgeCorruptedVisits(hospitalId);
  },

  async purgeAllDummyData(hospitalId?: string): Promise<void> {
    cleanCorruptedData();
    const cleanPatients = getStore<Patient>('patients', []).filter((p) => !isDummyOrCorrupted(p.name, p.id));
    const validPatIds = new Set(cleanPatients.map((p) => p.id));
    const cleanVisits = getStore<Visit>('visits', []).filter((v) => validPatIds.has(v.patient_id) && !isDummyOrCorrupted(v.doctor, v.id));
    setStore('patients', cleanPatients);
    setStore('visits', cleanVisits);
  },

  async createVisit(data: {
    hospital_id: string;
    patient_name: string;
    phone: string;
    department: string;
    doctor: string;
    visit_date?: string;
    whatsapp_consent?: boolean;
    sheet_row_id?: string;
    sheet_id?: string;
    sheet_name?: string;
    status?: VisitStatus;
    visit_uid?: string;
  }): Promise<Visit> {
    const patients = getStore<Patient>('patients', []);
    const phoneClean = data.phone.trim();
    const patientName = data.patient_name.trim();
    const visitUid = data.visit_uid || data.sheet_row_id || `V-${Date.now().toString().slice(-4)}`;

    let patient = patients.find(
      (p) => p.hospital_id === data.hospital_id && p.name.toLowerCase().trim() === patientName.toLowerCase().trim()
    );

    const existingPatientIds = new Set(patients.map((p) => p.id));
    const readablePatientId = generatePatientId(patientName, visitUid, existingPatientIds);
    const patientId = patient ? patient.id : readablePatientId;

    if (!patient) {
      patient = {
        id: patientId,
        hospital_id: data.hospital_id,
        name: patientName,
        phone: phoneClean,
        whatsapp_consent: data.whatsapp_consent ?? true,
        created_at: new Date().toISOString(),
        review_sent: false,
        review_status: 'pending',
      };
      setStore('patients', [patient, ...patients.filter((p) => p.id !== patientId)]);
    } else {
      // Ensure patient is ready for review dispatch for this new consultation
      const existingPat: Patient = patient;
      patient = {
        ...existingPat,
        phone: phoneClean || existingPat.phone,
        review_sent: false,
        review_status: 'pending',
      };
      setStore('patients', [patient, ...patients.filter((p) => p.id !== existingPat.id)]);
    }

    const visitId = toVisitUuid(visitUid);
    const isoDate = toIsoDate(data.visit_date);
    const token = `rb-${visitUid.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
    const rawStatus = (data.status || 'registered').toLowerCase();
    const cleanStatus: VisitStatus = rawStatus === 'completed' ? 'completed' : 'registered';

    const newVisit: Visit = {
      id: visitId,
      hospital_id: data.hospital_id,
      patient_id: patient.id,
      department: data.department || 'General Medicine',
      doctor: data.doctor || 'Duty Medical Officer',
      visit_date: isoDate,
      status: cleanStatus,
      sheet_row_id: visitUid,
      visit_uid: visitUid,
      sheet_id: data.sheet_id || 'manual_entry',
      sheet_name: data.sheet_name || 'Direct Consultation Form',
      token,
      created_at: new Date().toISOString(),
      review_requested: false,
      rating: null,
      is_reviewed: false,
    };

    const visits = getStore<Visit>('visits', []);
    setStore('visits', [newVisit, ...visits.filter((v) => v.id !== visitId && v.visit_uid !== visitUid)]);

    // Save directly to Firebase RTDB
    await syncToFirebase(`patients/${encodeURIComponent(patient.id)}`, patient, 'PUT');
    await syncToFirebase(`visits/${encodeURIComponent(newVisit.id)}`, newVisit, 'PUT');

    return {
      ...newVisit,
      patient,
    };
  },

  async markVisitComplete(
    visitId: string,
    webhookUrl?: string
  ): Promise<{ visit: Visit; reviewRequest: ReviewRequest; webhookFired: boolean }> {
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const visitIdx = visits.findIndex((v) => v.id === visitId);

    if (visitIdx === -1) {
      throw new Error(`Visit ${visitId} not found`);
    }

    visits[visitIdx].status = 'completed';
    setStore('visits', visits);

    const updatedVisit = visits[visitIdx];
    await syncToFirebase(`visits/${encodeURIComponent(visitId)}`, updatedVisit, 'PUT');
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const patient = patients.find((p) => p.id === updatedVisit.patient_id);
    const hospital = hospitals.find((h) => h.id === updatedVisit.hospital_id);

    const reviewRequests = getStore<ReviewRequest>(
      'review_requests',
      SEED_REVIEW_REQUESTS
    );
    let reviewReq = reviewRequests.find((r) => r.visit_id === visitId);

    if (!reviewReq) {
      reviewReq = {
        id: crypto.randomUUID(),
        hospital_id: updatedVisit.hospital_id,
        visit_id: visitId,
        sent_at: new Date().toISOString(),
        whatsapp_status: 'sent',
        rating: null,
        feedback_text: null,
        review_channel: 'whatsapp',
        submitted_at: null,
        created_at: new Date().toISOString(),
      };
      setStore('review_requests', [reviewReq, ...reviewRequests]);
      await syncToFirebase(`review_requests/${encodeURIComponent(reviewReq.id)}`, reviewReq, 'PUT');
    }

    let webhookFired = false;
    const targetWebhook =
      webhookUrl ||
      localStorage.getItem('rb_make_webhook_url') ||
      '';

    if (targetWebhook) {
      try {
        fetch(targetWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'visit_completed',
            hospital: {
              id: hospital?.id,
              name: hospital?.name,
              google_place_id: hospital?.google_place_id,
              template_name: hospital?.whatsapp_template_name,
            },
            patient: {
              name: patient?.name,
              phone: patient?.phone,
              consent: patient?.whatsapp_consent,
            },
            visit: {
              id: updatedVisit.id,
              department: updatedVisit.department,
              doctor: updatedVisit.doctor,
              visit_date: updatedVisit.visit_date,
              token: updatedVisit.token,
              review_url: getFeedbackFormUrl(updatedVisit.token, patient?.name, hospital?.name, patient?.phone),
            },
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
        webhookFired = true;
      } catch (err) {
        console.warn('Webhook trigger error:', err);
      }
    }

    return {
      visit: {
        ...updatedVisit,
        patient,
        hospital,
      },
      reviewRequest: reviewReq,
      webhookFired,
    };
  },

  // ── WhatsApp Direct Review Flow (Anti-Spam Flag Protection) ─────────
  async sendWhatsAppReview(params: {
    hospitalId: string;
    visitId: string;
    customTemplate?: string;
  }): Promise<{
    success: boolean;
    skipped?: boolean;
    reason?: string;
    messageContent: string;
    patientName: string;
    phone: string;
  }> {
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);

    const visit = visits.find((v) => v.id === params.visitId);
    if (!visit) throw new Error('Visit not found');

    const patient = patients.find((p) => p.id === visit.patient_id);
    if (!patient) throw new Error('Patient not found');

    const hospital = hospitals.find((h) => h.id === params.hospitalId) || {
      name: 'Hospital',
    };

    if (visit.review_requested) {
      return {
        success: false,
        skipped: true,
        reason: 'Patient has already received a review request for this consultation (1-Time Anti-Spam Protected).',
        messageContent: patient.last_message_content || '',
        patientName: patient.name,
        phone: patient.phone,
      };
    }

    const template = params.customTemplate || WHATSAPP_REVIEW_TEMPLATE;
    const reviewUrl = getFeedbackFormUrl(visit.token, patient.name, hospital.name, patient.phone);
    const personalizedMessage = template
      .replace(/\[Patient Name\]/gi, patient.name)
      .replace(/\[Hospital Name\]/gi, hospital.name)
      .replace(/\[Review Link\]/gi, reviewUrl);

    patient.review_sent = true;
    patient.review_sent_at = new Date().toISOString();
    patient.last_message_content = personalizedMessage;
    setStore('patients', patients);

    visit.status = 'completed';
    visit.review_requested = true;
    setStore('visits', visits);

    const reviewRequests = getStore<ReviewRequest>('review_requests', SEED_REVIEW_REQUESTS);
    const existingReq = reviewRequests.find((r) => r.visit_id === visit.id);
    if (existingReq) {
      existingReq.whatsapp_status = 'sent';
      existingReq.sent_at = new Date().toISOString();
      existingReq.message_template = personalizedMessage;
    } else {
      reviewRequests.push({
        id: crypto.randomUUID(),
        hospital_id: params.hospitalId,
        visit_id: visit.id,
        sent_at: new Date().toISOString(),
        whatsapp_status: 'sent',
        message_template: personalizedMessage,
        rating: null,
        feedback_text: null,
        review_channel: 'whatsapp',
        submitted_at: null,
        created_at: new Date().toISOString(),
      });
    }
    setStore('review_requests', reviewRequests);

    const activeReq = reviewRequests.find((r) => r.visit_id === visit.id);

    // Sync all directly to Firebase RTDB
    await syncToFirebase(`patients/${encodeURIComponent(patient.id)}`, patient, 'PUT');
    await syncToFirebase(`visits/${encodeURIComponent(visit.id)}`, visit, 'PUT');
    if (activeReq?.id) {
      await syncToFirebase(`review_requests/${encodeURIComponent(activeReq.id)}`, activeReq, 'PUT');
    }

    return {
      success: true,
      skipped: false,
      messageContent: personalizedMessage,
      patientName: patient.name,
      phone: patient.phone,
    };
  },

  async sendAllPendingWhatsAppReviews(params: {
    hospitalId: string;
    customTemplate?: string;
  }): Promise<{
    totalProcessed: number;
    sentCount: number;
    skippedCount: number;
    details: Array<{
      patientName: string;
      phone: string;
      status: 'sent' | 'skipped';
      reason?: string;
      message: string;
    }>;
  }> {
    const visits = await this.getVisits(params.hospitalId);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);

    let sentCount = 0;
    let skippedCount = 0;
    const details: Array<{
      patientName: string;
      phone: string;
      status: 'sent' | 'skipped';
      reason?: string;
      message: string;
    }> = [];

    for (const v of visits) {
      const patient = patients.find((p) => p.id === v.patient_id) || v.patient;
      if (!patient || !patient.phone) {
        skippedCount++;
        details.push({
          patientName: patient?.name || 'Unknown',
          phone: '',
          status: 'skipped',
          reason: 'No phone number provided',
          message: '',
        });
        continue;
      }

      const res = await this.sendWhatsAppReview({
        hospitalId: params.hospitalId,
        visitId: v.id,
        customTemplate: params.customTemplate,
      });

      if (res.success) {
        sentCount++;
        details.push({
          patientName: patient.name,
          phone: patient.phone,
          status: 'sent' as const,
          message: res.messageContent,
        });
      } else {
        skippedCount++;
        details.push({
          patientName: patient.name,
          phone: patient.phone,
          status: 'skipped' as const,
          reason: res.reason,
          message: '',
        });
      }
    }

    return {
      totalProcessed: visits.length,
      sentCount,
      skippedCount,
      details,
    };
  },

  async getReviews(hospitalId?: string): Promise<ReviewRequest[]> {
    let reviews = getStore<ReviewRequest>(
      'review_requests',
      SEED_REVIEW_REQUESTS
    );
    
    try {
      const fbData = await fetchFromFirebase<Record<string, ReviewRequest>>('review_requests');
      if (fbData !== null) {
        const fbReviews: ReviewRequest[] =
          fbData && typeof fbData === 'object'
            ? Object.keys(fbData).map((key) => {
                const r = fbData[key];
                const rawRating = r.rating !== undefined && r.rating !== null ? Number(r.rating) : null;
                return {
                  ...r,
                  _firebaseId: key,
                  id: r.id || key,
                  rating: !isNaN(rawRating as number) && rawRating !== null ? rawRating : null,
                  whatsapp_status: r.whatsapp_status || 'sent',
                  review_channel: r.review_channel || (rawRating && rawRating >= 4 ? 'google_review' : 'web'),
                };
              })
            : [];
        reviews = fbReviews;
        setStore('review_requests', reviews);
      }
    } catch (err) {
      console.warn('Failed to fetch from Firebase RTDB:', err);
    }
    
    if (!hospitalId || hospitalId === 'all') return reviews;
    return reviews.filter((r) => r.hospital_id === hospitalId);
  },

  async deleteReview(reviewId: string): Promise<boolean> {
    try {
      const cleanId = (reviewId || '').trim();
      if (!cleanId) return false;

      // 1. Remove from local review_requests
      const reviews = getStore<ReviewRequest>('review_requests', []);
      const targetReview = reviews.find((r) => r.id === cleanId || (r as any)._firebaseId === cleanId || r.visit_id === cleanId);
      const filtered = reviews.filter((r) => r.id !== cleanId && (r as any)._firebaseId !== cleanId && r.visit_id !== cleanId);
      setStore('review_requests', filtered);

      // 2. Delete from Firebase RTDB
      await syncToFirebase(`review_requests/${encodeURIComponent(cleanId)}`, null, 'DELETE');
      if (targetReview && (targetReview as any)._firebaseId && (targetReview as any)._firebaseId !== cleanId) {
        await syncToFirebase(`review_requests/${encodeURIComponent((targetReview as any)._firebaseId)}`, null, 'DELETE');
      }

      // 3. Search and delete any matching records in Firebase RTDB
      try {
        const fbData = await fetchFromFirebase<Record<string, any>>('review_requests');
        if (fbData && typeof fbData === 'object') {
          for (const [key, val] of Object.entries(fbData)) {
            if (
              key === cleanId ||
              val?.id === cleanId ||
              (val?.visit_id && (val.visit_id === cleanId || val.visit_id === targetReview?.visit_id)) ||
              (targetReview?.token && val?.token === targetReview.token)
            ) {
              await syncToFirebase(`review_requests/${encodeURIComponent(key)}`, null, 'DELETE');
            }
          }
        }
      } catch (fbErr) {
        console.warn('Firebase review deletion check error:', fbErr);
      }

      // 4. Reset review state on associated visit
      if (targetReview?.visit_id) {
        const visits = getStore<Visit>('visits', []);
        const vIdx = visits.findIndex((v) => v.id === targetReview.visit_id || v.token === targetReview.visit_id || v.visit_uid === targetReview.visit_id);
        if (vIdx !== -1) {
          visits[vIdx].is_reviewed = false;
          visits[vIdx].rating = null;
          setStore('visits', visits);
          await syncToFirebase(`visits/${encodeURIComponent(visits[vIdx].id)}`, visits[vIdx], 'PUT');
        }
      }

      // 5. Reset review state on associated patient
      if (targetReview?.patient_id || targetReview?.phone) {
        const patients = getStore<Patient>('patients', []);
        const pIdx = patients.findIndex((p) => p.id === targetReview.patient_id || (targetReview.phone && p.phone === targetReview.phone));
        if (pIdx !== -1) {
          patients[pIdx].rating = null;
          patients[pIdx].feedback_text = null;
          patients[pIdx].review_submitted_at = null;
          patients[pIdx].review_status = 'pending';
          setStore('patients', patients);
          await syncToFirebase(`patients/${encodeURIComponent(patients[pIdx].id)}`, patients[pIdx], 'PUT');
        }
      }

      return true;
    } catch (err) {
      console.error('Failed to delete review in db:', err);
      return false;
    }
  },

  async deleteAllReviews(hospitalId?: string): Promise<boolean> {
    try {
      // 1. Remove from local store
      const reviews = getStore<ReviewRequest>('review_requests', []);
      const toDelete = hospitalId && hospitalId !== 'all'
        ? reviews.filter((r) => r.hospital_id === hospitalId)
        : reviews;
      const remaining = hospitalId && hospitalId !== 'all'
        ? reviews.filter((r) => r.hospital_id !== hospitalId)
        : [];
      setStore('review_requests', remaining);

      // 2. Delete from Firebase RTDB
      try {
        const fbData = await fetchFromFirebase<Record<string, any>>('review_requests');
        if (fbData && typeof fbData === 'object') {
          for (const [key, val] of Object.entries(fbData)) {
            const matches = !hospitalId || hospitalId === 'all' || val?.hospital_id === hospitalId;
            if (matches) {
              await syncToFirebase(`review_requests/${encodeURIComponent(key)}`, null, 'DELETE');
            }
          }
        }
      } catch (fbErr) {
        console.warn('Firebase batch review delete error:', fbErr);
      }

      // 3. Reset ratings on visits
      const visits = getStore<Visit>('visits', []);
      const toDeleteVisitIds = new Set(toDelete.map((r) => r.visit_id).filter(Boolean));
      const updatedVisits = visits.map((v) => {
        if (toDeleteVisitIds.has(v.id) || toDeleteVisitIds.has(v.token) || (!hospitalId || v.hospital_id === hospitalId)) {
          return { ...v, is_reviewed: false, rating: null };
        }
        return v;
      });
      setStore('visits', updatedVisits);

      // 4. Reset ratings on patients
      const patients = getStore<Patient>('patients', []);
      const updatedPatients = patients.map((p) => {
        if (!hospitalId || p.hospital_id === hospitalId) {
          return { ...p, rating: null, feedback_text: null, review_submitted_at: null, review_status: 'pending' as const };
        }
        return p;
      });
      setStore('patients', updatedPatients);

      return true;
    } catch (err) {
      console.error('Failed to delete all reviews in db:', err);
      return false;
    }
  },

  async deleteVisit(visitId: string): Promise<boolean> {
    try {
      const cleanId = (visitId || '').trim();
      if (!cleanId) return false;

      const visits = getStore<Visit>('visits', []);
      const filtered = visits.filter(
        (v) => v.id !== cleanId && v.visit_uid !== cleanId && v.token !== cleanId
      );
      setStore('visits', filtered);

      await syncToFirebase(`visits/${encodeURIComponent(cleanId)}`, null, 'DELETE');
      return true;
    } catch (err) {
      console.error('Failed to delete visit:', err);
      return false;
    }
  },

  async deleteAllVisits(hospitalId?: string): Promise<boolean> {
    try {
      const visits = getStore<Visit>('visits', []);
      const remaining =
        hospitalId && hospitalId !== 'all'
          ? visits.filter((v) => v.hospital_id !== hospitalId)
          : [];
      setStore('visits', remaining);

      try {
        const fbData = await fetchFromFirebase<Record<string, any>>('visits');
        if (fbData && typeof fbData === 'object') {
          for (const [key, val] of Object.entries(fbData)) {
            const matches = !hospitalId || hospitalId === 'all' || val?.hospital_id === hospitalId;
            if (matches) {
              await syncToFirebase(`visits/${encodeURIComponent(key)}`, null, 'DELETE');
            }
          }
        }
      } catch (fbErr) {
        console.warn('Firebase batch visit delete error:', fbErr);
      }

      return true;
    } catch (err) {
      console.error('Failed to delete all visits:', err);
      return false;
    }
  },

  // ── Public Review Flow ────────────────────────────────────────────────────
  async getVisitByToken(tokenOrId: string): Promise<Visit | null> {
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);
    const hospitals = getStore<Hospital>('hospitals', SEED_HOSPITALS);
    const reviews = getStore<ReviewRequest>(
      'review_requests',
      SEED_REVIEW_REQUESTS
    );

    const visit = visits.find(
      (v) => v.token === tokenOrId || v.id === tokenOrId
    );
    if (!visit) return null;

    return {
      ...visit,
      patient: patients.find((p) => p.id === visit.patient_id),
      hospital: hospitals.find((h) => h.id === visit.hospital_id),
      review_request: reviews.find((r) => r.visit_id === visit.id),
    };
  },

  async submitReview(params: {
    tokenOrId: string;
    rating: number;
    patientName?: string;
    phone?: string;
    hospitalId?: string;
    hospitalName?: string;
    feedbackText?: string;
    voiceTranscript?: string;
    cleanedReview?: string;
    feedbackType?: 'text' | 'voice';
    detectedLanguage?: string;
  }): Promise<{
    success: boolean;
    redirectUrl?: string;
    isLowRating: boolean;
  }> {
    let visit = await this.getVisitByToken(params.tokenOrId);
    const hospitals = await this.getHospitals();
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const patients = getStore<Patient>('patients', SEED_PATIENTS);

    const patientDisplayName = params.patientName?.trim() || visit?.patient?.name || 'Valued Patient';
    const patientPhone = params.phone?.trim() || visit?.patient?.phone || '';

    if (!visit) {
      const normName = patientDisplayName.toLowerCase().trim();
      const normPhone = patientPhone.replace(/\D/g, '').slice(-10);

      const matchedPatient = patients.find((p) => {
        const pPhone = (p.phone || '').replace(/\D/g, '').slice(-10);
        if (normPhone && pPhone && pPhone === normPhone) return true;
        const pName = (p.name || '').toLowerCase().trim();
        if (normName && pName && (pName === normName || (normName.length >= 4 && pName.includes(normName)) || (pName.length >= 4 && normName.includes(pName)))) {
          return true;
        }
        return false;
      });

      if (matchedPatient) {
        const foundVisit = visits.find((v) => v.patient_id === matchedPatient.id);
        if (foundVisit) {
          visit = {
            ...foundVisit,
            patient: matchedPatient,
            hospital: hospitals.find((h) => h.id === foundVisit.hospital_id),
          };
        }
      } else if (normName && normName !== 'valued patient' && normName !== 'anonymous patient') {
        const foundVisit = visits.find((v) => {
          const vPatName = (v.patient?.name || '').trim().toLowerCase();
          return vPatName && (vPatName === normName || vPatName.includes(normName) || normName.includes(vPatName));
        });
        if (foundVisit) {
          visit = {
            ...foundVisit,
            patient: patients.find((p) => p.id === foundVisit.patient_id),
            hospital: hospitals.find((h) => h.id === foundVisit.hospital_id),
          };
        }
      }
    }

    const finalFeedbackText =
      params.cleanedReview ||
      params.voiceTranscript ||
      params.feedbackText ||
      null;

    // NLP Sentiment Analysis:
    // If text contains negative sentiment or complaints, it is negative regardless of star rating
    const sentimentResult = analyzeSentimentLocally(finalFeedbackText || '', params.rating);
    const isSentimentPositive = sentimentResult.sentiment === 'positive';

    // RULE: Only 4-5 stars with POSITIVE feedback can post on Google Reviews.
    // 1-5 stars with negative feedback and 1-3 stars with positive feedback are stored to hospital feedback.
    const isGoogleReviewEligible = params.rating >= 4 && isSentimentPositive;
    const isLowRating = !isGoogleReviewEligible;

    const voiceMeta = params.feedbackType === 'voice'
      ? JSON.stringify({
          feedbackType: 'voice',
          voiceTranscript: params.voiceTranscript || '',
          cleanedReview: params.cleanedReview || '',
          detectedLanguage: params.detectedLanguage || 'unknown',
        })
      : undefined;

    let matchedHospital = hospitals.find((h) => h.id === params.hospitalId || h.id === visit?.hospital_id);
    if (!matchedHospital && params.hospitalName) {
      const qHosp = params.hospitalName.toLowerCase().trim();
      matchedHospital = hospitals.find((h) =>
        h.name.toLowerCase().includes(qHosp) ||
        qHosp.includes(h.name.toLowerCase()) ||
        h.subdomain.toLowerCase().includes(qHosp)
      );
    }
    if (!matchedHospital) {
      matchedHospital = hospitals[0];
    }

    const effectiveHospitalId = matchedHospital?.id || params.hospitalId || visit?.hospital_id || '11111111-1111-1111-1111-111111111111';
    const effectiveHospitalName = matchedHospital?.name || params.hospitalName || 'Tambaram Medical Center';

    let redirectUrl: string | undefined = undefined;
    if (isGoogleReviewEligible) {
      const envGoogleReview = (import.meta as any).env?.VITE_GOOGLE_REVIEW_URL?.trim();
      if (envGoogleReview) {
        redirectUrl = envGoogleReview;
      } else {
        redirectUrl = 'https://www.google.com/search?q=Tambaram%20Medical%20Center%20Google%20reviews#sv=CAESzQEKuQEStgEKd0FKaVQ0dExfWHgwY3JMVU1XbVVJcmsxMjdKS2tVRFBEZGxnQ0lqdkxVMlZ2YkpudkNtd2tIcUZJLWZ4ZFNPWTdySEpHQXN2QTBxUEZvZjYzOW9mdllpT1lxdWIyYmdKaUlDeTBBZmcwNklzQTJ4LWtiR2xmdktJEhczWXZBYXJMTEg1dU5zZU1Qb3BiYWlRVRoiQURzcjlmUzRSNzhzZzNpMzJNWGRDUy00SGoxSlZ3bUFBQRIEODA1MRoBMyoAMAA4AUAAGAAg8NSOHEoCEAE';
      }
    }

    const reviewId = `tmc-${Date.now()}`;
    // Preserve the existing whatsapp_status from a prior review request if one exists.
    // A patient submitting a rating proves the message was at minimum delivered — but we
    // should never downgrade a status that was already 'delivered' or 'read' by a webhook.
    const existingReviewReqs = getStore<ReviewRequest>('review_requests', SEED_REVIEW_REQUESTS);
    const existingReq = existingReviewReqs.find(
      (r) => r.visit_id === (visit?.id || params.tokenOrId) || r.token === params.tokenOrId
    );
    const existingStatus = existingReq?.whatsapp_status;
    const resolvedStatus: ReviewRequest['whatsapp_status'] =
      existingStatus === 'read' || existingStatus === 'delivered'
        ? existingStatus
        : 'delivered'; // patient submitted → at minimum delivered

    const reviewRecord: ReviewRequest = {
      id: reviewId,
      hospital_id: effectiveHospitalId,
      visit_id: visit?.id || params.tokenOrId || `visit-${Date.now()}`,
      token: visit?.token || params.tokenOrId,
      patient_id: visit?.patient_id || patientDisplayName,
      patient_name: patientDisplayName,
      phone: patientPhone,
      phone_number: patientPhone,
      sent_at: new Date().toISOString(),
      whatsapp_status: resolvedStatus,
      rating: Number(params.rating),
      sentiment: sentimentResult.sentiment,
      healthcare_topic: sentimentResult.topic,
      feedback_text: finalFeedbackText,
      review_channel: isGoogleReviewEligible ? 'google_review' : 'web',
      is_google_review: isGoogleReviewEligible,
      google_review_posted: isGoogleReviewEligible,
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      message_template: voiceMeta,
    };

    const reviewRequests = getStore<ReviewRequest>('review_requests', SEED_REVIEW_REQUESTS);
    setStore('review_requests', [reviewRecord, ...reviewRequests.filter((r) => r.id !== reviewId)]);

    // Update visit & patient status locally and in Firebase RTDB
    if (visit) {
      const allVisits = getStore<Visit>('visits', SEED_VISITS);
      const vIdx = allVisits.findIndex((v) => v.id === visit.id);
      if (vIdx !== -1) {
        allVisits[vIdx].status = 'completed';
        allVisits[vIdx].review_requested = true;
        allVisits[vIdx].rating = Number(params.rating);
        allVisits[vIdx].is_reviewed = true;
        setStore('visits', allVisits);
        await syncToFirebase(`visits/${encodeURIComponent(visit.id)}`, allVisits[vIdx], 'PUT');
      }

      const allPatients = getStore<Patient>('patients', SEED_PATIENTS);
      const pIdx = allPatients.findIndex((p) => p.id === visit.patient_id);
      if (pIdx !== -1) {
        allPatients[pIdx].review_sent = true;
        allPatients[pIdx].rating = Number(params.rating);
        allPatients[pIdx].review_status = 'completed';
        allPatients[pIdx].review_channel = isGoogleReviewEligible ? 'google_review' : 'web';
        allPatients[pIdx].is_google_review = isGoogleReviewEligible;
        allPatients[pIdx].google_review_posted = isGoogleReviewEligible;
        allPatients[pIdx].feedback_text = finalFeedbackText;
        allPatients[pIdx].review_submitted_at = new Date().toISOString();
        allPatients[pIdx].last_message_content = finalFeedbackText || '';
        setStore('patients', allPatients);
        await syncToFirebase(`patients/${encodeURIComponent(visit.patient_id)}`, allPatients[pIdx], 'PUT');
      }
    }

    // Direct dynamic update under patient and visit in Firebase RTDB by phone/name/token
    try {
      const remotePatients = await fetchFromFirebase<Record<string, Patient>>('patients') || {};
      const targetPhone = (patientPhone || '').replace(/\D/g, '').slice(-10);
      const targetName = patientDisplayName.toLowerCase().trim();

      for (const [pKey, pVal] of Object.entries(remotePatients)) {
        if (!pVal) continue;
        const phone = (pVal.phone || '').replace(/\D/g, '').slice(-10);
        const name = (pVal.name || '').toLowerCase().trim();
        const phoneMatches = Boolean(targetPhone && phone && phone === targetPhone);
        const nameMatches = Boolean(targetName && name && (name === targetName || (targetName.length >= 4 && name.includes(targetName)) || (name.length >= 4 && targetName.includes(name))));
        const isMatched = (targetName && targetName !== 'valued patient' && targetName !== 'anonymous patient')
          ? (phoneMatches && nameMatches) || (nameMatches && !phone)
          : phoneMatches;
        if (isMatched) {
          const updatedPatient: Patient = {
            ...pVal,
            rating: Number(params.rating),
            review_status: 'completed',
            review_sent: true,
            review_channel: isGoogleReviewEligible ? 'google_review' : 'web',
            google_review_posted: isGoogleReviewEligible,
            is_google_review: isGoogleReviewEligible,
            feedback_text: finalFeedbackText,
            review_submitted_at: new Date().toISOString()
          };
          await syncToFirebase(`patients/${encodeURIComponent(pKey)}`, updatedPatient, 'PUT');
          break;
        }
      }

      const remoteVisits = await fetchFromFirebase<Record<string, Visit>>('visits') || {};
      for (const [vKey, vVal] of Object.entries(remoteVisits)) {
        if (!vVal) continue;
        if (params.tokenOrId && (vVal.token === params.tokenOrId || vVal.id === params.tokenOrId || vKey === params.tokenOrId)) {
          const updatedVisit: Visit = {
            ...vVal,
            status: 'completed',
            rating: Number(params.rating),
            review_requested: true,
            is_reviewed: true
          };
          await syncToFirebase(`visits/${encodeURIComponent(vKey)}`, updatedVisit, 'PUT');
          break;
        }
      }
    } catch (e) {
      console.warn('Error dynamically updating remote patient/visit in Firebase:', e);
    }

    // Save review directly to Firebase RTDB
    await syncToFirebase(`review_requests/${encodeURIComponent(reviewRecord.id)}`, {
      ...reviewRecord,
      hospital_name: effectiveHospitalName,
    }, 'PUT');

    return { success: true, redirectUrl, isLowRating };
  },

  // ── Sheet Connection, Backfill & Delta Sync Engine ───────────────────────
  async getSheetConnection(hospitalId: string): Promise<HospitalSheetConnection | null> {
    const list = await this.getSheetConnections(hospitalId);
    return list.find((c) => c.status === 'active') || list[0] || null;
  },

  async getSheetConnections(hospitalId: string): Promise<HospitalSheetConnection[]> {
    let list = getStore<HospitalSheetConnection>('sheet_connections', []);

    try {
      const fbData = await fetchFromFirebase<Record<string, HospitalSheetConnection>>('sheet_connections');
      if (fbData && typeof fbData === 'object') {
        const connMap = new Map<string, HospitalSheetConnection>();
        list.forEach((c) => connMap.set(c.id, c));
        Object.values(fbData).forEach((remote) => {
          if (remote && remote.id) {
            connMap.set(remote.id, { ...connMap.get(remote.id), ...remote });
          }
        });
        list = Array.from(connMap.values());
        setStore('sheet_connections', list);
      }
    } catch (err) {
      console.warn('Firebase getSheetConnections error:', err);
    }

    return list.filter((c) => c.hospital_id === hospitalId);
  },

  async updateVisitRating(visitId: string, rating: number, feedbackText?: string): Promise<void> {
    const reviewRequests = getStore<ReviewRequest>('review_requests', SEED_REVIEW_REQUESTS);
    const visits = getStore<Visit>('visits', SEED_VISITS);
    const visit = visits.find((v) => v.id === visitId);

    const reqIdx = reviewRequests.findIndex((r) => r.visit_id === visitId);
    let record: ReviewRequest;
    if (reqIdx !== -1) {
      reviewRequests[reqIdx].rating = rating;
      if (feedbackText) reviewRequests[reqIdx].feedback_text = feedbackText;
      reviewRequests[reqIdx].submitted_at = new Date().toISOString();
      // Preserve existing delivery status (e.g. 'delivered' or 'read' from WhatsApp webhook).
      // Only upgrade to 'delivered' if the current status is just 'sent' — submitting a rating
      // proves the patient at least received the message.
      const currentStatus = reviewRequests[reqIdx].whatsapp_status;
      if (!currentStatus || currentStatus === 'sent') {
        reviewRequests[reqIdx].whatsapp_status = 'delivered';
      }
      record = reviewRequests[reqIdx];
    } else if (visit) {
      record = {
        id: crypto.randomUUID(),
        hospital_id: visit.hospital_id,
        visit_id: visit.id,
        sent_at: new Date().toISOString(),
        whatsapp_status: 'delivered', // patient received and submitted — at minimum delivered
        rating,
        feedback_text: feedbackText || null,
        review_channel: 'whatsapp',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      reviewRequests.push(record);
    } else {
      record = {
        id: crypto.randomUUID(),
        hospital_id: 'unknown',
        visit_id: visitId,
        sent_at: new Date().toISOString(),
        whatsapp_status: 'delivered', // at minimum delivered since patient submitted
        rating,
        feedback_text: feedbackText || null,
        review_channel: 'direct',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      reviewRequests.push(record);
    }
    setStore('review_requests', reviewRequests);

    await syncToFirebase(`review_requests/${encodeURIComponent(record.id)}`, record, 'PUT');
  },

  async saveSheetConnection(data: {
    hospital_id: string;
    sheet_type: 'google_sheets' | 'excel_365' | 'onedrive';
    sheet_id: string;
    table_name: string;
    column_mapping: ColumnMapping;
    total_rows_tracked?: number;
    id?: string;
  }): Promise<HospitalSheetConnection> {
    const list = getStore<HospitalSheetConnection>('sheet_connections', []);
    const existingIdx = data.id
      ? list.findIndex((c) => c.id === data.id)
      : list.findIndex((c) => c.hospital_id === data.hospital_id && c.sheet_id === data.sheet_id);

    const connection: HospitalSheetConnection = {
      ...data,
      id: existingIdx !== -1 ? list[existingIdx].id : crypto.randomUUID(),
      status: 'active',
      last_synced_at: new Date().toISOString(),
      total_rows_tracked:
        data.total_rows_tracked !== undefined
          ? data.total_rows_tracked
          : existingIdx !== -1
          ? list[existingIdx].total_rows_tracked
          : 0,
      created_at: existingIdx !== -1 ? list[existingIdx].created_at : new Date().toISOString(),
    };

    if (existingIdx !== -1) {
      list[existingIdx] = connection;
    } else {
      list.push(connection);
    }
    setStore('sheet_connections', list);

    await syncToFirebase(`sheet_connections/${encodeURIComponent(connection.id)}`, connection, 'PUT');

    return connection;
  },

  async disconnectSheet(hospitalId: string): Promise<void> {
    const list = getStore<HospitalSheetConnection>('sheet_connections', []);
    const idx = list.findIndex((c) => c.hospital_id === hospitalId);
    if (idx !== -1) {
      list[idx].status = 'disconnected';
      setStore('sheet_connections', list);

      await syncToFirebase(`sheet_connections/${encodeURIComponent(list[idx].id)}`, list[idx], 'PUT');
    }
  },

  computeRowHash(data: {
    visit_uid: string;
    patient_name: string;
    phone: string;
    visit_date: string;
    department: string;
    doctor: string;
    status: string;
  }): string {
    const str = `${data.visit_uid}|${data.patient_name.trim().toLowerCase()}|${data.phone.trim()}|${data.visit_date}|${data.department.trim().toLowerCase()}|${data.doctor.trim().toLowerCase()}|${data.status.trim().toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  },

  async previewSheetImport(
    hospitalId: string,
    rawRows: Record<string, any>[],
    mapping: ColumnMapping
  ): Promise<{
    previewRows: Array<{
      rowNumber: number;
      visit_uid: string;
      patient_name: string;
      phone: string;
      visit_date: string;
      department: string;
      doctor: string;
      status: string;
      isValid: boolean;
      errorReason?: string;
    }>;
    totalRows: number;
    validCount: number;
    errorCount: number;
  }> {
    const existingVisits = await this.getVisits(hospitalId);
    const existingUids = new Set(existingVisits.map((v) => v.visit_uid).filter(Boolean));
    const seenUidsInSheet = new Set<string>();

    const previewRows = rawRows.map((row, index) => {
      const rowNumber = index + 1;
      const getVal = (field: keyof ColumnMapping): string => {
        const colName = mapping[field];
        if (!colName) return '';
        const exact = row[colName];
        if (exact !== undefined && exact !== null && exact !== '') return String(exact).trim();
        const lowerCol = colName.toLowerCase().trim();
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase().trim() === lowerCol) {
            return String(v ?? '').trim();
          }
        }
        return '';
      };

      const visit_uid = getVal('visit_uid') || `ROW-${rowNumber}`;
      const patient_name = getVal('patient_name');
      const phone = getVal('phone');
      const visit_date = getVal('visit_date') || new Date().toISOString().split('T')[0];
      const department = getVal('department') || 'General';
      const doctor = getVal('doctor') || 'Duty Doctor';
      const status = getVal('status') || 'completed';

      let isValid = true;
      let errorReason: string | undefined;

      if (!patient_name) {
        isValid = false;
        errorReason = 'Missing patient name';
      } else if (seenUidsInSheet.has(visit_uid)) {
        isValid = false;
        errorReason = `Duplicate Visit UID "${visit_uid}" in sheet`;
      } else if (existingUids.has(visit_uid)) {
        isValid = false;
        errorReason = `Visit UID "${visit_uid}" already exists in database`;
      }

      if (isValid) {
        seenUidsInSheet.add(visit_uid);
      }

      return {
        rowNumber,
        visit_uid,
        patient_name,
        phone,
        visit_date,
        department,
        doctor,
        status,
        isValid,
        errorReason,
      };
    });

    const validCount = previewRows.filter((r) => r.isValid).length;
    const errorCount = previewRows.filter((r) => !r.isValid).length;

    return {
      previewRows,
      totalRows: rawRows.length,
      validCount,
      errorCount,
    };
  },

  async runInitialBackfill(
    hospitalId: string,
    rawRows: Record<string, any>[],
    mapping: ColumnMapping,
    sheetInfo?: { sheet_id?: string; sheet_name?: string }
  ): Promise<{
    syncRun: SyncRun;
    importedCount: number;
    rejectedCount: number;
    errors: string[];
  }> {
    const startedAt = new Date().toISOString();
    const runId = crypto.randomUUID();

    const targetSheetId = sheetInfo?.sheet_id || 'manual_entry';
    const targetSheetName = sheetInfo?.sheet_name || 'Direct Consultation Form';

    let patients = getStore<Patient>('patients', []);
    let visits = getStore<Visit>('visits', []);

    let importedCount = 0;
    let rejectedCount = 0;
    const errors: string[] = [];
    const syncErrors: SyncError[] = [];

    const existingUidSet = new Set(
      visits
        .filter((v) => v.hospital_id === hospitalId && !v.deleted_at)
        .map((v) => v.visit_uid)
        .filter(Boolean)
    );

    const seenInBatch = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNumber = i + 1;

      const getVal = (field: keyof ColumnMapping): string => {
        const colName = mapping[field];
        if (!colName) return '';
        const exact = row[colName];
        if (exact !== undefined && exact !== null && exact !== '') return String(exact).trim();
        const lowerCol = colName.toLowerCase().trim();
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase().trim() === lowerCol) {
            return String(v ?? '').trim();
          }
        }
        return '';
      };

      const visit_uid = getVal('visit_uid') || `ROW-${rowNumber}`;
      const patient_name = getVal('patient_name');
      const rawPhone = getVal('phone');
      const visit_date = getVal('visit_date') || new Date().toISOString().split('T')[0];
      const department = getVal('department') || 'General Medicine';
      const doctor = getVal('doctor') || 'Duty Doctor';
      const rawStatus = (getVal('status') || '').toLowerCase().trim();
      const status: VisitStatus = (rawStatus === 'completed' || rawStatus === 'done' || rawStatus === 'attended') ? 'completed' : 'registered';

      if (!patient_name) {
        rejectedCount++;
        const errMsg = `Row ${rowNumber}: Missing patient name`;
        errors.push(errMsg);
        syncErrors.push({
          id: crypto.randomUUID(),
          run_id: runId,
          hospital_id: hospitalId,
          row_number: rowNumber,
          raw_data: row,
          error_reason: errMsg,
          resolved: false,
          created_at: new Date().toISOString(),
        });
        continue;
      }

      if (seenInBatch.has(visit_uid)) {
        rejectedCount++;
        const errMsg = `Row ${rowNumber}: Duplicate Visit UID "${visit_uid}" within this sheet file`;
        errors.push(errMsg);
        continue;
      }

      const digits = rawPhone.replace(/\D/g, '');
      const phoneWithCode =
        digits.length === 10
          ? `+91${digits}`
          : digits.length === 12 && digits.startsWith('91')
          ? `+${digits}`
          : rawPhone.startsWith('+')
          ? rawPhone.replace(/\s+/g, '')
          : digits.length > 5
          ? `+91${digits}`
          : (rawPhone.trim() || '');

      const existingPatientIds = new Set(patients.map((p) => p.id));
      const readablePatientId = generatePatientId(patient_name, visit_uid, existingPatientIds);

      const normPatName = patient_name.trim().toLowerCase();
      let patient = patients.find(
        (p) =>
          p.hospital_id === hospitalId &&
          p.name.toLowerCase().trim() === normPatName
      );
      if (!patient) {
        patient = {
          id: readablePatientId,
          hospital_id: hospitalId,
          name: patient_name || 'Patient',
          phone: phoneWithCode,
          whatsapp_consent: true,
          created_at: new Date().toISOString(),
        };
        patients.push(patient);
      } else {
        if (phoneWithCode) {
          patient.phone = phoneWithCode;
        }
      }

      const rowHash = this.computeRowHash({
        visit_uid,
        patient_name: patient.name,
        phone: phoneWithCode,
        visit_date,
        department,
        doctor,
        status,
      });

      const vId = toVisitUuid(`${hospitalId}_${targetSheetId}_${visit_uid}`);
      const isoDate = toIsoDate(visit_date);
      const cleanStatus: VisitStatus = status === 'completed' ? 'completed' : 'registered';

      const newVisit: Visit = {
        id: vId,
        hospital_id: hospitalId,
        patient_id: patient.id,
        department,
        doctor,
        visit_date: isoDate,
        status: cleanStatus,
        visit_uid,
        sheet_row_id: visit_uid,
        sheet_id: targetSheetId,
        sheet_name: targetSheetName,
        row_hash: rowHash,
        historical: false,
        review_requested: false,
        deleted_at: null,
        token: `rb-${visit_uid.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: new Date().toISOString(),
      };

      const exIdx = visits.findIndex(
        (v) =>
          v.hospital_id === hospitalId &&
          !v.deleted_at &&
          (
            v.id === newVisit.id ||
            ((v.sheet_id === targetSheetId || v.sheet_id === 'active_sheet') && (v.visit_uid === newVisit.visit_uid || v.sheet_row_id === newVisit.sheet_row_id))
          )
      );

      if (exIdx !== -1) {
        visits[exIdx] = {
          ...visits[exIdx],
          patient_id: patient.id,
          department,
          doctor,
          visit_date: isoDate,
          sheet_id: targetSheetId,
          sheet_name: targetSheetName,
        };
      } else {
        visits.unshift(newVisit);
        importedCount++;
      }

      seenInBatch.add(visit_uid);
      existingUidSet.add(visit_uid);
    }

    setStore('patients', patients);
    setStore('visits', visits);

    // Sync ALL visits & patients to Firebase RTDB in real time
    try {
      const fbVisitsBatch: Record<string, Visit> = {};
      visits.forEach((v) => { if (v.id) fbVisitsBatch[encodeURIComponent(v.id)] = v; });
      syncToFirebase('visits', fbVisitsBatch, 'PATCH').catch(() => {});

      const fbPatientsBatch: Record<string, Patient> = {};
      patients.forEach((p) => { if (p.id) fbPatientsBatch[encodeURIComponent(p.id)] = p; });
      syncToFirebase('patients', fbPatientsBatch, 'PATCH').catch(() => {});
    } catch {}

    const allErrors = getStore<SyncError>('sync_errors', []);
    setStore('sync_errors', [...syncErrors, ...allErrors]);

    const syncRun: SyncRun = {
      id: runId,
      hospital_id: hospitalId,
      sync_type: 'initial_backfill',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      rows_added: importedCount,
      rows_updated: 0,
      rows_rejected: rejectedCount,
      status: rejectedCount === 0 ? 'success' : 'partial',
    };

    const allRuns = getStore<SyncRun>('sync_runs', []);
    setStore('sync_runs', [syncRun, ...allRuns]);

    await this.saveSheetConnection({
      hospital_id: hospitalId,
      sheet_type: 'google_sheets',
      sheet_id: targetSheetId,
      table_name: targetSheetName,
      column_mapping: mapping,
      total_rows_tracked: importedCount,
    });

    return {
      syncRun,
      importedCount,
      rejectedCount,
      errors,
    };
  },

  async runDeltaSync(
    hospitalId: string,
    rawRows: Record<string, any>[],
    mapping?: ColumnMapping,
    sheetInfo?: { sheet_id?: string; sheet_name?: string }
  ): Promise<{
    syncRun: SyncRun;
    added: number;
    updated: number;
    unchanged: number;
    deleted: number;
    reviewDispatchedCount: number;
    errors: string[];
  }> {
    const startedAt = new Date().toISOString();
    const runId = crypto.randomUUID();

    const activeMapping: ColumnMapping = mapping || {
      visit_uid: 'visit_uid',
      patient_name: 'patient_name',
      phone: 'phone',
      visit_date: 'visit_date',
      department: 'department',
      doctor: 'doctor',
      status: 'status',
    };

    const targetSheetId = sheetInfo?.sheet_id || 'manual_entry';
    const targetSheetName = sheetInfo?.sheet_name || 'Direct Consultation Form';

    let patients = getStore<Patient>('patients', []);
    let visits = getStore<Visit>('visits', []);

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let deleted = 0;
    let reviewDispatchedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNumber = i + 1;

      const getVal = (field: keyof ColumnMapping): string => {
        const colName = activeMapping[field];
        if (!colName) return '';
        const exact = row[colName];
        if (exact !== undefined && exact !== null && exact !== '') return String(exact).trim();
        const lowerCol = colName.toLowerCase().trim();
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase().trim() === lowerCol) {
            return String(v ?? '').trim();
          }
        }
        return '';
      };

      const visit_uid = getVal('visit_uid') || `ROW-${rowNumber}`;
      const patient_name = getVal('patient_name');
      const rawPhone = getVal('phone');
      const visit_date = getVal('visit_date') || new Date().toISOString().split('T')[0];
      const department = getVal('department') || 'General Medicine';
      const doctor = getVal('doctor') || 'Duty Doctor';
      const rawStatus = (getVal('status') || '').toLowerCase().trim();
      const isExplicitCompleted = rawStatus === 'completed' || rawStatus === 'done' || rawStatus === 'attended';
      const cleanStatus: VisitStatus = isExplicitCompleted ? 'completed' : 'registered';

      if (!patient_name) {
        errors.push(`Row ${rowNumber}: Missing patient name`);
        continue;
      }

      const digits = rawPhone.replace(/\D/g, '');
      const phoneWithCode =
        digits.length === 10
          ? `+91${digits}`
          : digits.length === 12 && digits.startsWith('91')
          ? `+${digits}`
          : rawPhone.startsWith('+')
          ? rawPhone.replace(/\s+/g, '')
          : digits.length > 5
          ? `+91${digits}`
          : (rawPhone.trim() || '');

      const newHash = this.computeRowHash({
        visit_uid,
        patient_name,
        phone: phoneWithCode,
        visit_date,
        department,
        doctor,
        status: cleanStatus,
      });

      const existingPatientIds = new Set(patients.map((p) => p.id));
      const readablePatientId = generatePatientId(patient_name, visit_uid, existingPatientIds);

      const vId = toVisitUuid(`${hospitalId}_${targetSheetId}_${visit_uid}`);
      const isoDate = toIsoDate(visit_date);

      const normPatName = patient_name.trim().toLowerCase();
      let patient = patients.find(
        (p) =>
          p.hospital_id === hospitalId &&
          p.name.toLowerCase().trim() === normPatName
      );
      if (!patient) {
        patient = {
          id: readablePatientId,
          hospital_id: hospitalId,
          name: patient_name || 'Patient',
          phone: phoneWithCode,
          whatsapp_consent: true,
          created_at: new Date().toISOString(),
          review_sent: false,
          review_status: 'pending',
        };
        patients.push(patient);
      } else {
        if (phoneWithCode) {
          patient.phone = phoneWithCode;
        }
      }

      const existingIdx = visits.findIndex(
        (v) =>
          v.hospital_id === hospitalId &&
          !v.deleted_at &&
          (
            v.id === vId ||
            ((v.sheet_id === targetSheetId || v.sheet_id === 'active_sheet') && (v.visit_uid === visit_uid || v.sheet_row_id === visit_uid))
          )
      );

      if (existingIdx === -1) {
        const newVisit: Visit = {
          id: vId,
          hospital_id: hospitalId,
          patient_id: patient.id,
          department,
          doctor,
          visit_date: isoDate,
          status: cleanStatus,
          visit_uid,
          sheet_row_id: visit_uid,
          sheet_id: targetSheetId,
          sheet_name: targetSheetName,
          row_hash: newHash,
          historical: false,
          review_requested: false,
          deleted_at: null,
          token: `rb-${visit_uid.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: new Date().toISOString(),
        };

        visits.unshift(newVisit);
        added++;
      } else {
        const existing = visits[existingIdx];
        existing.patient_id = patient.id;

        if (targetSheetId && (!existing.sheet_id || existing.sheet_id === 'active_sheet')) {
          existing.sheet_id = targetSheetId;
        }
        if (targetSheetName && (!existing.sheet_name || existing.sheet_name === 'PatientVisits')) {
          existing.sheet_name = targetSheetName;
        }

        const isChanged =
          existing.doctor !== doctor ||
          existing.department !== department ||
          existing.visit_date !== isoDate;

        if (isChanged) {
          existing.department = department;
          existing.doctor = doctor;
          existing.visit_date = isoDate;
          if (isExplicitCompleted) {
            existing.status = 'completed';
          }
          existing.row_hash = newHash;
          updated++;
        } else {
          unchanged++;
        }
      }
    }

    setStore('patients', patients);
    setStore('visits', visits);

    // Sync updates directly to Firebase RTDB for newly added or updated rows only
    if (added > 0 || updated > 0) {
      try {
        const fbVisitsBatch: Record<string, Visit> = {};
        const changedVisits = visits.slice(0, added + updated);
        changedVisits.forEach((v) => { if (v.id) fbVisitsBatch[encodeURIComponent(v.id)] = v; });
        syncToFirebase('visits', fbVisitsBatch, 'PATCH').catch(() => {});

        const fbPatientsBatch: Record<string, Patient> = {};
        patients.slice(0, added + updated).forEach((p) => { if (p.id) fbPatientsBatch[encodeURIComponent(p.id)] = p; });
        syncToFirebase('patients', fbPatientsBatch, 'PATCH').catch(() => {});
      } catch {}
    }

    const syncRun: SyncRun = {
      id: runId,
      hospital_id: hospitalId,
      sync_type: 'delta_sync',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      rows_added: added,
      rows_updated: updated,
      rows_rejected: errors.length,
      status: errors.length === 0 ? 'success' : 'partial',
    };

    const allRuns = getStore<SyncRun>('sync_runs', []);
    setStore('sync_runs', [syncRun, ...allRuns]);

    return {
      syncRun,
      added,
      updated,
      unchanged,
      deleted,
      reviewDispatchedCount,
      errors,
    };
  },

  async syncAllLocalRowsToSupabase(
    hospitalId: string,
    rawRows?: Record<string, any>[]
  ): Promise<{ syncedCount: number; errors: string[] }> {
    if (rawRows && rawRows.length > 0) {
      const res = await this.runInitialBackfill(hospitalId, rawRows, {
        visit_uid: 'visit_uid',
        patient_name: 'patient_name',
        phone: 'phone',
        visit_date: 'visit_date',
        department: 'department',
        doctor: 'doctor',
        status: 'status',
      });
      return { syncedCount: res.importedCount, errors: res.errors };
    }

    const visits = getStore<Visit>('visits', []).filter((v) => v.hospital_id === hospitalId && !isDummyOrCorrupted(v.doctor, v.id));
    const patients = getStore<Patient>('patients', []).filter((p) => p.hospital_id === hospitalId && !isDummyOrCorrupted(p.name, p.id));
    
    // Sync all directly to Firebase RTDB
    const fbVisitsObj: Record<string, Visit> = {};
    visits.forEach((v) => { if (v.id) fbVisitsObj[encodeURIComponent(v.id)] = v; });
    await syncToFirebase('visits', fbVisitsObj, 'PATCH');

    const fbPatientsObj: Record<string, Patient> = {};
    patients.forEach((p) => { if (p.id) fbPatientsObj[encodeURIComponent(p.id)] = p; });
    await syncToFirebase('patients', fbPatientsObj, 'PATCH');

    return { syncedCount: visits.length, errors: [] };
  },

  async getSyncRuns(hospitalId: string): Promise<SyncRun[]> {
    const runs = getStore<SyncRun>('sync_runs', []);
    return runs.filter((r) => r.hospital_id === hospitalId);
  },

  async getSyncErrors(hospitalId: string): Promise<SyncError[]> {
    const errs = getStore<SyncError>('sync_errors', []);
    return errs.filter((e) => e.hospital_id === hospitalId);
  },

  async syncSheetRows(
    hospitalId: string,
    rows: any[],
    apiKey?: string
  ): Promise<{
    accepted: number;
    rejected: number;
    errors: string[];
  }> {
    const res = await this.runDeltaSync(hospitalId, rows);
    return {
      accepted: res.added + res.updated,
      rejected: res.errors.length,
      errors: res.errors,
    };
  },
};
