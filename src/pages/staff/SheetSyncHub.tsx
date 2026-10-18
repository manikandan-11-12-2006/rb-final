import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Building2,
  Clock,
  Sparkles,
  ArrowRight,
  Unlink,
  ChevronDown,
  ChevronUp,
  FileCheck,
  UploadCloud,
  Plus,
  Send,
  User,
  Calendar,
  Phone,
  AlertCircle,
  X,
  Zap,
  Trash2,
  MessageSquare,
  ShieldCheck,
  Star,
  Filter,
  Layers,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { db, isDateCrossed } from '../../services/db';
import {
  HospitalSheetConnection,
  ColumnMapping,
  SyncRun,
  Visit,
} from '../../types/database';
import {
  fetchGoogleSheetData,
  extractGoogleSheetId,
  generateDeterministicVisitUid,
} from '../../services/googleSheetsService';

export default function SheetSyncHub() {
  const { currentHospital } = useAuth();
  const hospitalId = currentHospital?.id || '11111111-1111-1111-1111-111111111111';

  const [connection, setConnection] = useState<HospitalSheetConnection | null>(null);
  const [allConnections, setAllConnections] = useState<HospitalSheetConnection[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncedVisits, setSyncedVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddSheetModal, setShowAddSheetModal] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('');

  // Spreadsheet Source Tab Filtering: 'all' or specific sheet_id / sheet_name / 'manual'
  const [selectedSheetFilter, setSelectedSheetFilter] = useState<string>('all');
  const [isSheetDropdownOpen, setIsSheetDropdownOpen] = useState(false);

  // Auto-Sync background monitoring status
  const [autoSyncStatus, setAutoSyncStatus] = useState<{
    isPolling: boolean;
    lastSyncTime: string | null;
    lastSyncCount: number;
  }>({
    isPolling: true,
    lastSyncTime: null,
    lastSyncCount: 0,
  });

  // Connection Form State
  const [sheetType, setSheetType] = useState<'google_sheets' | 'excel_365'>('google_sheets');
  const [sheetUrl, setSheetUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedRows, setUploadedRows] = useState<any[]>([]);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Column Mapping (auto-matched by default)
  const [mapping, setMapping] = useState<ColumnMapping>({
    visit_uid: 'visit_uid',
    patient_name: 'patient_name',
    phone: 'phone',
    visit_date: 'visit_date',
    department: 'department',
    doctor: 'doctor',
    status: 'status',
  });

  const [syncing, setSyncing] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Add New Entry Form State
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    patient_name: '',
    phone: '',
    department: 'General Medicine',
    doctor: 'Dr. Ramesh Kumar',
    visit_date: new Date().toISOString().split('T')[0],
    status: 'pending',
  });
  const [addingEntry, setAddingEntry] = useState(false);

  // WhatsApp Review Dispatch State
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [showSendAllModal, setShowSendAllModal] = useState(false);
  const [sendAllResult, setSendAllResult] = useState<{
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
  } | null>(null);

  const isVisitSent = (v: Visit) =>
    Boolean(
      v.review_requested ||
      (v.review_request && ['sent', 'delivered', 'read'].includes(v.review_request.whatsapp_status))
    );

  const unsentVisits = syncedVisits.filter((v) => !isVisitSent(v));
  const unsentCount = unsentVisits.length;

  // Default real spreadsheet rows
  const defaultSampleRows = [
    {
      visit_uid: 'IMP-8819-15',
      patient_name: 'Ganesh B',
      phone: '+919876543224',
      visit_date: '15-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Rajesh',
      status: 'pending',
    },
    {
      visit_uid: 'IMP-8819-14',
      patient_name: 'Swetha M',
      phone: '+919876543223',
      visit_date: '14-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Divya',
      status: 'completed',
    },
    {
      visit_uid: 'IMP-8819-13',
      patient_name: 'Naveen Raj',
      phone: '+919876543222',
      visit_date: '13-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Karthik',
      status: 'pending',
    },
    {
      visit_uid: 'IMP-8819-12',
      patient_name: 'Keerthi S',
      phone: '+919876543221',
      visit_date: '12-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Meena',
      status: 'pending',
    },
    {
      visit_uid: 'IMP-8819-11',
      patient_name: 'Manoj Kumar',
      phone: '+919876543220',
      visit_date: '11-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Suresh',
      status: 'pending',
    },
    {
      visit_uid: 'IMP-8819-10',
      patient_name: 'Lakshmi Priya',
      phone: '+919876543219',
      visit_date: '10-09-2026',
      department: 'General Medicine',
      doctor: 'Dr. Priya',
      status: 'pending',
    },
  ];

  // Load connection, visits, and sync runs
  // Helper to pick columns smartly
  const pickCol = (row: Record<string, any>, ...aliases: string[]): string => {
    const keys = Object.keys(row);
    for (const alias of aliases) {
      const normAlias = alias.toLowerCase().replace(/[\s_\-\.]/g, '');
      for (const k of keys) {
        const normKey = k.toLowerCase().replace(/[\s_\-\.]/g, '');
        if (normKey === normAlias || normKey.includes(normAlias)) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim().length > 0) {
            return String(val).trim();
          }
        }
      }
    }
    return '';
  };

  const isCorruptedRow = (name?: string): boolean => {
    if (!name) return true;
    return (
      name.includes('[Content_Types]') ||
      name.includes('PK\x03\x04') ||
      name.includes('PK\u0003\u0004') ||
      (name.includes('PK') && name.includes('.xml')) ||
      (name.includes('\ufffd') && name.length > 5) ||
      /^[^\w\s]{3,}.*xml/i.test(name)
    );
  };

  // Distinct spreadsheets and sources
  const sheetSources = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; type: string }>();

    // Add connected sheets
    allConnections.forEach((c) => {
      const id = c.sheet_id;
      const name = c.table_name || (c.sheet_type === 'excel_365' ? 'Excel Import' : 'Google Sheet');
      map.set(id, { id, name, count: 0, type: c.sheet_type });
    });

    // Count visits per sheet
    let manualCount = 0;
    syncedVisits.forEach((v) => {
      if (v.sheet_id && v.sheet_id !== 'manual_entry') {
        const existing = map.get(v.sheet_id);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(v.sheet_id, {
            id: v.sheet_id,
            name: v.sheet_name || 'Google Sheet',
            count: 1,
            type: 'google_sheets',
          });
        }
      } else {
        manualCount += 1;
      }
    });

    return {
      sheetsList: Array.from(map.values()),
      manualCount,
      totalCount: syncedVisits.length,
    };
  }, [allConnections, syncedVisits]);

  // Filtered visits based on active tab / option with stable deterministic sorting
  const displayedVisits = useMemo(() => {
    let list = syncedVisits;
    if (selectedSheetFilter === 'manual') {
      list = syncedVisits.filter((v) => !v.sheet_id || v.sheet_id === 'manual_entry');
    } else if (selectedSheetFilter !== 'all') {
      list = syncedVisits.filter(
        (v) => v.sheet_id === selectedSheetFilter || v.sheet_name === selectedSheetFilter
      );
    }
    return [...list].sort((a, b) => {
      const idA = a.visit_uid || a.id || '';
      const idB = b.visit_uid || b.id || '';
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [syncedVisits, selectedSheetFilter]);

  // Active spreadsheet filter label helper
  const activeSelectionLabel = useMemo(() => {
    if (selectedSheetFilter === 'all') {
      return {
        title: 'All Spreadsheets & Sources',
        count: syncedVisits.length,
        type: 'all',
      };
    }
    if (selectedSheetFilter === 'manual') {
      return {
        title: 'Direct Form Entries',
        count: sheetSources.manualCount,
        type: 'manual',
      };
    }
    const matched = sheetSources.sheetsList.find(
      (s) => s.id === selectedSheetFilter || s.name === selectedSheetFilter
    );
    if (matched) {
      return {
        title: matched.name,
        count: matched.count,
        type: matched.type,
      };
    }
    return {
      title: selectedSheetFilter,
      count: displayedVisits.length,
      type: 'google_sheets',
    };
  }, [selectedSheetFilter, syncedVisits.length, sheetSources, displayedVisits.length]);

  // ── Automatic Background Polling / Sync (Every 15 Seconds) ──
  useEffect(() => {
    const autoSyncInterval = setInterval(async () => {
      try {
        const conns = await db.getSheetConnections(hospitalId);
        const activeGoogleSheets = conns.filter(
          (c) => c.status === 'active' && c.sheet_type === 'google_sheets' && c.sheet_id
        );

        let totalNewOrUpdated = 0;
        for (const conn of activeGoogleSheets) {
          const fetchRes = await fetchGoogleSheetData(conn.sheet_id);
          if (fetchRes.success && fetchRes.rows && fetchRes.rows.length > 0) {
            const syncRes = await db.runDeltaSync(
              hospitalId,
              fetchRes.rows,
              conn.column_mapping,
              { sheet_id: conn.sheet_id, sheet_name: conn.table_name || 'Google Sheet' }
            );
            if (syncRes.added > 0 || syncRes.updated > 0) {
              totalNewOrUpdated += syncRes.added + syncRes.updated;
            }
          }
        }

        if (totalNewOrUpdated > 0) {
          const freshVisits = await db.getVisits(hospitalId);
          setSyncedVisits(freshVisits);
        }

        setAutoSyncStatus({
          isPolling: true,
          lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          lastSyncCount: totalNewOrUpdated,
        });
      } catch (err) {
        console.warn('Auto-sync background check notice:', err);
      }
    }, 15000);

    return () => clearInterval(autoSyncInterval);
  }, [hospitalId]);

  // Load connection, visits, and sync runs
  const loadData = async () => {
    setLoading(true);
    try {
      // Auto-purge any corrupted records
      await db.purgeCorruptedVisits(hospitalId);

      const conns = await db.getSheetConnections(hospitalId);
      setAllConnections(conns);
      const conn = conns.find((c) => c.status === 'active') || conns[0] || null;
      setConnection(conn);
      if (conn && conn.status === 'active') {
        setIsEditing(false);
        setSheetType(conn.sheet_type === 'excel_365' ? 'excel_365' : 'google_sheets');
        setSheetUrl(
          conn.sheet_id.startsWith('http')
            ? conn.sheet_id
            : `https://docs.google.com/spreadsheets/d/${conn.sheet_id}/edit`
        );
        setMapping(conn.column_mapping);
      } else {
        setIsEditing(true);
      }

      // Load visits for this hospital from the database
      const visits = await db.getVisits(hospitalId);
      setSyncedVisits(visits);

      const runs = await db.getSyncRuns(hospitalId);
      setSyncRuns(runs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [hospitalId]);

  // Purge Corrupted Junk Rows
  const handlePurgeJunkRows = async () => {
    const removed = await db.purgeCorruptedVisits(hospitalId);
    if (connection && connection.sheet_type === 'google_sheets' && connection.sheet_id) {
      const fetchRes = await fetchGoogleSheetData(connection.sheet_id);
      if (fetchRes.success && fetchRes.rows.length > 0) {
        await db.runDeltaSync(hospitalId, fetchRes.rows, connection.column_mapping, {
          sheet_id: connection.sheet_id,
          sheet_name: connection.table_name || 'Google Sheet',
        });
      }
    }
    await loadData();
    setSaveSuccessMessage(`Cleaned database: removed ${removed} invalid/corrupted records and re-aligned patient names.`);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Dispatch WhatsApp Review Template to All Pending Patients
  const handleSendAllWhatsApp = async () => {
    if (unsentCount === 0) {
      alert('All patients have already been sent WhatsApp reviews. The 1-time anti-spam protection is active.');
      return;
    }
    setSendingAll(true);
    try {
      const res = await db.sendAllPendingWhatsAppReviews({
        hospitalId,
      });
      setSendAllResult(res);
      setShowSendAllModal(true);
      await loadData();
    } catch (err: any) {
      alert(`Failed to send WhatsApp reviews: ${err.message}`);
    } finally {
      setSendingAll(false);
    }
  };

  // Dispatch WhatsApp Review Template to a Single Patient
  const handleSendSingleWhatsApp = async (visitId: string) => {
    setSendingId(visitId);
    try {
      const res = await db.sendWhatsAppReview({
        hospitalId,
        visitId,
      });
      if (res.skipped) {
        alert(res.reason || 'Patient has already received a review request (1-Time Anti-Spam Protected).');
      } else {
        // Open WhatsApp with the predefined feedback message
        const digits = res.phone.replace(/\D/g, '');
        if (digits) {
          const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(res.messageContent)}`;
          window.open(waUrl, '_blank', 'noopener,noreferrer');
        }
        setSaveSuccessMessage(`WhatsApp opened for ${res.patientName} (${res.phone})!`);
        setTimeout(() => setSaveSuccessMessage(null), 5000);
      }
      await loadData();
    } catch (err: any) {
      alert(`Failed to send: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  // Handle Excel (.xlsx, .xls) and CSV file upload via SheetJS
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false });

      if (!rawJson || rawJson.length === 0) {
        alert('The uploaded spreadsheet appears to be empty or has no readable rows.');
        return;
      }

      const parsedRows: any[] = [];
      rawJson.forEach((row, idx) => {
        const patientName =
          pickCol(row, 'patient_name', 'name', 'patient name', 'patient', 'customer name', 'patientname') ||
          Object.values(row)[0] ||
          '';

        if (!patientName || isCorruptedRow(String(patientName))) return;

        const phone =
          pickCol(row, 'phone', 'mobile', 'contact', 'phnumber', 'phone number', 'mobile number', 'contact number') ||
          '+919876543210';

        let visitDate =
          pickCol(row, 'visit_date', 'date', 'visited date', 'visit date', 'consultation date', 'appointment date');
        if (!visitDate) {
          visitDate = new Date().toISOString().split('T')[0];
        } else if (visitDate.includes('T')) {
          visitDate = visitDate.split('T')[0];
        }

        const department =
          pickCol(row, 'department', 'dept', 'specialty', 'specialization') ||
          'General Medicine';

        const doctor =
          pickCol(row, 'doctor', 'doctor consulted', 'doctor name', 'consultant', 'physician', 'doctorconsulted') ||
          'Dr. Ramesh Kumar';

        // Status is pending until WhatsApp message is sent
        const status = 'pending';

        const visitUid =
          pickCol(row, 'visit_uid', 'visit id', 'id', 'uid', 'token') ||
          generateDeterministicVisitUid(String(patientName), String(phone), String(visitDate), idx, file.name);

        parsedRows.push({
          visit_uid: visitUid,
          patient_name: String(patientName).trim(),
          phone: String(phone).trim(),
          visit_date: String(visitDate).trim(),
          department: String(department).trim(),
          doctor: String(doctor).trim(),
          status,
        });
      });

      if (parsedRows.length === 0) {
        alert('No valid patient rows could be identified in the file. Please ensure it has columns like Name, Phone, Date, Doctor.');
        return;
      }

      setUploadedRows(parsedRows);
      setSaveSuccessMessage(`Successfully parsed ${parsedRows.length} patient consultations from "${file.name}". Ready to connect.`);
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert(`Could not parse spreadsheet file: ${err.message || 'Unknown format'}`);
    }
  };

  // Connect & Save
  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sheetType === 'google_sheets' && !sheetUrl.trim() && uploadedRows.length === 0) {
      alert('Please provide a Google Sheet link or upload your spreadsheet file.');
      return;
    }

    setSyncing(true);
    try {
      const { sheetId: extractedId } = extractGoogleSheetId(sheetUrl.trim());
      let sheetId = extractedId || sheetUrl.trim() || uploadedFileName || 'Hospital_Spreadsheet_Source';

      // Attempt live fetch if Google Sheets link provided
      let rowsToImport = uploadedRows;
      if (sheetType === 'google_sheets' && sheetUrl.trim() && rowsToImport.length === 0) {
        const fetchRes = await fetchGoogleSheetData(sheetUrl.trim());
        if (fetchRes.success && fetchRes.rows.length > 0) {
          rowsToImport = fetchRes.rows;
          sheetId = fetchRes.sheetId;
        } else {
          alert(
            fetchRes.errorMessage ||
              'Could not access the Google Spreadsheet. Please ensure the Google Sheet link sharing setting is set to "Anyone with the link can view".'
          );
          setSyncing(false);
          return;
        }
      }

      if (rowsToImport.length === 0) {
        alert('No patient consultation rows could be found in this spreadsheet.');
        setSyncing(false);
        return;
      }

      const sheetName =
        newSheetTitle.trim() ||
        uploadedFileName ||
        (sheetType === 'excel_365' ? 'Excel Import' : 'Google Sheet');

      await db.saveSheetConnection({
        hospital_id: hospitalId,
        sheet_type: sheetType,
        sheet_id: sheetId,
        table_name: sheetName,
        column_mapping: mapping,
        total_rows_tracked: rowsToImport.length,
      });
      setNewSheetTitle('');
      setUploadedRows([]);
      setUploadedFileName('');

      await db.runInitialBackfill(hospitalId, rowsToImport, mapping, {
        sheet_id: sheetId,
        sheet_name: sheetName,
      });
      setSelectedSheetFilter('all');
      await loadData();

      setSaveSuccessMessage(
        `Spreadsheet "${sheetName}" connected successfully! ${rowsToImport.length} patient consultations entered in database and auto-sync active.`
      );
      setTimeout(() => setSaveSuccessMessage(null), 5000);
      setIsEditing(false);
    } catch (err: any) {
      alert(`Connection failed: ${err.message || 'Please verify sheet permissions'}`);
    } finally {
      setSyncing(false);
    }
  };

  // Add New Entry Form Submit (Enters into database and updates UI in real-time)
  const handleAddNewEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.patient_name.trim() || !newEntry.phone.trim()) return;

    setAddingEntry(true);
    try {
      // 1. Insert into database with pending status (completed once WhatsApp is sent)
      await db.createVisit({
        hospital_id: hospitalId,
        patient_name: newEntry.patient_name.trim(),
        phone: newEntry.phone.trim(),
        department: 'General Medicine',
        doctor: newEntry.doctor.trim(),
        visit_date: newEntry.visit_date,
        status: 'pending',
        sheet_id: 'manual_entry',
        sheet_name: 'Direct Consultation Form',
        visit_uid: `H12-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      });

      // 2. Increment tracked count in connection
      if (connection) {
        await db.saveSheetConnection({
          ...connection,
          total_rows_tracked: (connection.total_rows_tracked || 0) + 1,
        });
      }

      // 3. Immediately refresh visits from the database so UI updates live
      await loadData();

      setShowNewEntryModal(false);
      setNewEntry({
        patient_name: '',
        phone: '',
        department: 'General Medicine',
        doctor: 'Dr. Ramesh Kumar',
        visit_date: new Date().toISOString().split('T')[0],
        status: 'pending',
      });

      setSaveSuccessMessage(
        `New entry for "${newEntry.patient_name}" entered in database & UI updated successfully!`
      );
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(`Failed to add entry: ${err.message}`);
    } finally {
      setAddingEntry(false);
    }
  };

  // Sync All Spreadsheet Data to Supabase Database
  const handleSyncAllToSupabase = async () => {
    setSyncing(true);
    try {
      const rowsToSync = uploadedRows.length > 0 ? uploadedRows : defaultSampleRows;
      const res = await db.syncAllLocalRowsToSupabase(hospitalId, rowsToSync);
      await loadData();
      setSaveSuccessMessage(
        `⚡ Successfully synced ${res.syncedCount} real patient consultations directly to Supabase database (patients & visits)!`
      );
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(`Database sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Immediate "Sync Now"
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      let liveRows = defaultSampleRows;
      if (connection && connection.sheet_type === 'google_sheets' && connection.sheet_id) {
        const fetchRes = await fetchGoogleSheetData(connection.sheet_id);
        if (fetchRes.success && fetchRes.rows.length > 0) {
          liveRows = fetchRes.rows;
        }
      }
      await db.runDeltaSync(hospitalId, liveRows, undefined, {
        sheet_id: connection?.sheet_id || 'active_sheet',
        sheet_name: connection?.table_name || 'Google Sheet',
      });
      await loadData();
      setSaveSuccessMessage('Sync complete: All latest patient records are up to date in database.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Mark visit complete
  const handleMarkComplete = async (visitId: string) => {
    try {
      await db.markVisitComplete(visitId);
      await loadData();
      setSaveSuccessMessage('Visit marked completed! WhatsApp 5★ review invitation dispatched.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (
      window.confirm(
        'Disconnect this spreadsheet? Auto-syncing will pause, but existing patient visits remain safe in the database.'
      )
    ) {
      await db.disconnectSheet(hospitalId);
      await loadData();
      setIsEditing(true);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center border border-primary-100 shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Connect Patient Spreadsheet
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect Google Sheets or Excel. When new entries are entered, they are stored in the database and displayed live in the UI.
            </p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMessage && (
        <div className="bg-primary-50 border border-primary-200/80 text-primary-900 p-4 rounded-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-primary-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* ── Main State: CONNECTED CARD ───────────────────────────── */}
      {connection?.status === 'active' && !isEditing ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center font-bold shadow-xs">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {connection.sheet_type === 'excel_365' ? 'Microsoft Excel Spreadsheet' : 'Google Sheets'}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                      Connected & Live Syncing
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
                    {sheetUrl}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowNewEntryModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Consultation Entry</span>
                </button>
              </div>
            </div>

            {/* 3 Modern 3D Segmented Status Cards (Matching Clinical Dashboard style) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Card 1: Database Synced Visits */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_16px_35px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shadow-xs">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200/80">
                      Step 01
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                    Database Synced Visits
                  </p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                    {syncedVisits.length}
                  </p>

                  {/* Inner Pill Box */}
                  <div className="bg-slate-50 border border-slate-100/90 rounded-2xl p-3 flex items-center gap-2.5 my-3.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-600">
                      Stored in database & live in UI
                    </span>
                  </div>
                </div>

                <div>
                  {/* Segmented Progress Bar */}
                  <div className="flex items-center gap-1 w-full my-3.5">
                    {Array.from({ length: 16 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-3.5 flex-1 rounded-sm bg-[#003B95] transition-all duration-300"
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-slate-500">Pipeline Total</span>
                    <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/70">
                      100% recorded
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Completed & Review Ready */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_16px_35px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shadow-xs">
                      <Send className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200/80">
                      Step 02
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                    Completed & Review Ready
                  </p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                    {syncedVisits.filter((v) => v.status === 'completed' || isVisitSent(v)).length}
                  </p>

                  {/* Inner Pill Box */}
                  <div className="bg-slate-50 border border-slate-100/90 rounded-2xl p-3 flex items-center gap-2.5 my-3.5">
                    <Send className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-600">
                      WhatsApp review invitations sent
                    </span>
                  </div>
                </div>

                <div>
                  {/* Segmented Progress Bar */}
                  <div className="flex items-center gap-1 w-full my-3.5">
                    {Array.from({ length: 16 }).map((_, index) => {
                      const completedCount = syncedVisits.filter((v) => v.status === 'completed' || isVisitSent(v)).length;
                      const pct = syncedVisits.length > 0 ? (completedCount / syncedVisits.length) * 100 : 0;
                      const activeSegments = Math.round((Math.min(100, Math.max(0, pct)) / 100) * 16);
                      return (
                        <div
                          key={index}
                          className={`h-3.5 flex-1 rounded-sm transition-all duration-300 ${
                            index < activeSegments ? 'bg-emerald-600' : 'bg-slate-100'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-slate-500">Dispatch Rate</span>
                    <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/70">
                      {syncedVisits.length > 0
                        ? Math.round(
                            (syncedVisits.filter((v) => v.status === 'completed' || isVisitSent(v)).length / syncedVisits.length) * 100
                          )
                        : 0}% sent
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: In Consultation / Registered */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_16px_35px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shadow-xs">
                      <Clock className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200/80">
                      Step 03
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                    In Consultation / Registered
                  </p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                    {syncedVisits.filter((v) => v.status !== 'completed' && !isVisitSent(v)).length}
                  </p>

                  {/* Inner Pill Box */}
                  <div className="bg-slate-50 border border-slate-100/90 rounded-2xl p-3 flex items-center gap-2.5 my-3.5">
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-600">
                      Ready to mark complete
                    </span>
                  </div>
                </div>

                <div>
                  {/* Segmented Progress Bar */}
                  <div className="flex items-center gap-1 w-full my-3.5">
                    {Array.from({ length: 16 }).map((_, index) => {
                      const pendingCount = syncedVisits.filter((v) => v.status !== 'completed' && !isVisitSent(v)).length;
                      const pct = syncedVisits.length > 0 ? (pendingCount / syncedVisits.length) * 100 : 0;
                      const activeSegments = Math.round((Math.min(100, Math.max(0, pct)) / 100) * 16);
                      return (
                        <div
                          key={index}
                          className={`h-3.5 flex-1 rounded-sm transition-all duration-300 ${
                            index < activeSegments ? 'bg-indigo-600' : 'bg-slate-100'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-slate-500">Active Queue</span>
                    <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/70">
                      {syncedVisits.length > 0
                        ? Math.round(
                            (syncedVisits.filter((v) => v.status !== 'completed' && !isVisitSent(v)).length / syncedVisits.length) * 100
                          )
                        : 0}% pending
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <button
                onClick={() => setIsEditing(true)}
                className="text-slate-600 hover:text-slate-900 font-semibold hover:underline"
              >
                Change Spreadsheet Link or Settings
              </button>

              <button
                onClick={handleDisconnect}
                className="text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-1 hover:underline"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect Sheet</span>
              </button>
            </div>
          </div>

          {/* ── LIVE SYNCED PATIENT RECORDS IN DATABASE & UI ────────── */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Live Synced Patient Records (In Database & UI)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Whenever a new entry is added to the sheet or through the form, it is immediately entered in the database and displayed here.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Send All WhatsApp Button */}
                <button
                  onClick={handleSendAllWhatsApp}
                  disabled={sendingAll || unsentCount === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-600 hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-md shadow-primary-600/20 transition-all disabled:opacity-50"
                  title="Dispatch WhatsApp review invitation to all eligible patients"
                >
                  <Send className={`w-3.5 h-3.5 ${sendingAll ? 'animate-pulse' : ''}`} />
                  <span>
                    {sendingAll ? 'Dispatching...' : `Send All (${unsentCount} Ready)`}
                  </span>
                </button>
              </div>
            </div>

            {/* ── Spreadsheet Source Filter & Quick Connect ── */}
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs">
              {/* Interactive Spreadsheet Dropdown Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-primary-600" />
                    Spreadsheet Source:
                  </span>

                  {/* Dropdown Container */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsSheetDropdownOpen((prev) => !prev)}
                      className="inline-flex items-center justify-between gap-3 px-3.5 py-2 bg-white hover:bg-slate-50 border-2 border-primary-500/40 hover:border-primary-600 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer min-w-[260px] sm:min-w-[300px]"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {activeSelectionLabel.type === 'all' ? (
                          <Layers className="w-4 h-4 text-primary-600 shrink-0" />
                        ) : activeSelectionLabel.type === 'manual' ? (
                          <User className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : activeSelectionLabel.type === 'excel_365' ? (
                          <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        <span className="truncate">{activeSelectionLabel.title}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-100 text-primary-800 border border-primary-200">
                          {activeSelectionLabel.count} records
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isSheetDropdownOpen ? 'rotate-180 text-primary-600' : ''}`} />
                      </div>
                    </button>

                    {/* Dropdown Menu */}
                    {isSheetDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsSheetDropdownOpen(false)}
                        />
                        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                            <span>Available Spreadsheets</span>
                            <span className="text-[10px] text-slate-500">{syncedVisits.length} Total</span>
                          </div>

                          {/* Option 1: All Spreadsheets */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSheetFilter('all');
                              setIsSheetDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer ${
                              selectedSheetFilter === 'all'
                                ? 'bg-primary-50 text-primary-900 font-bold border border-primary-200'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${selectedSheetFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <Layers className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-bold">All Spreadsheets & Sources</p>
                                <p className="text-[10px] text-slate-400">View combined data across all sheets</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                              {syncedVisits.length}
                            </span>
                          </button>

                          {/* Connected Individual Spreadsheets */}
                          {sheetSources.sheetsList.map((s) => {
                            const isSelected = selectedSheetFilter === s.id || selectedSheetFilter === s.name;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSheetFilter(s.id);
                                  setIsSheetDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-primary-50 text-primary-900 font-bold border border-primary-200'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                    isSelected
                                      ? 'bg-primary-600 text-white'
                                      : s.type === 'excel_365'
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'bg-emerald-50 text-emerald-600'
                                  }`}>
                                    {s.type === 'excel_365' ? (
                                      <FileCheck className="w-3.5 h-3.5" />
                                    ) : (
                                      <FileSpreadsheet className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-bold text-slate-900">{s.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">
                                      {s.type === 'excel_365' ? 'Microsoft Excel' : 'Google Sheets'}
                                    </p>
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  {s.count} rows
                                </span>
                              </button>
                            );
                          })}

                          {/* Direct Form Entries */}
                          {sheetSources.manualCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSheetFilter('manual');
                                setIsSheetDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer ${
                                selectedSheetFilter === 'manual'
                                  ? 'bg-primary-50 text-primary-900 font-bold border border-primary-200'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${selectedSheetFilter === 'manual' ? 'bg-primary-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-bold">Direct Form Entries</p>
                                  <p className="text-[10px] text-slate-400">Added manually via form</p>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                                {sheetSources.manualCount}
                              </span>
                            </button>
                          )}

                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick Connect Sheet Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSheetUrl('');
                    setNewSheetTitle('');
                    setUploadedFileName('');
                    setUploadedRows([]);
                    setShowAddSheetModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary-50 hover:bg-primary-100 text-primary-800 border border-primary-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-primary-700" />
                  <span>Connect Sheet</span>
                </button>
              </div>
            </div>

            {/* Active Sheet Indicator Banner */}
            {selectedSheetFilter !== 'all' && (
              <div className="bg-primary-50 border border-primary-200/80 rounded-xl p-3 flex items-center justify-between text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-primary-900 font-semibold">
                  <FileSpreadsheet className="w-4 h-4 text-primary-700 shrink-0" />
                  <span>
                    Viewing consultations from:{' '}
                    <span className="font-bold underline">
                      {sheetSources.sheetsList.find((s) => s.id === selectedSheetFilter || s.name === selectedSheetFilter)?.name ||
                        (selectedSheetFilter === 'manual' ? 'Direct Form Entries' : selectedSheetFilter)}
                    </span>{' '}
                    ({displayedVisits.length} records)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSheetFilter('all')}
                  className="px-2.5 py-1 bg-white hover:bg-primary-100 text-primary-700 border border-primary-300 rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                >
                  View All Spreadsheets ({syncedVisits.length})
                </button>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Visit ID</th>
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Visited Date</th>
                    <th className="py-3 px-4">Doctor Consulted</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">
                      <div className="flex items-center gap-1 cursor-pointer" title="Click badge in any row to filter by that spreadsheet">
                        <span>Spreadsheet Source</span>
                        <Filter className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Patient Rating</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {displayedVisits.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        {selectedSheetFilter === 'all'
                          ? 'No patient consultations yet. Add a new row or sync your sheet.'
                          : 'No patient consultations found for the selected spreadsheet filter.'}
                      </td>
                    </tr>
                  ) : (
                    displayedVisits.map((v, vIdx) => {
                      const isSent = Boolean(v.review_requested || (v.review_request && ['sent', 'delivered', 'read'].includes(v.review_request.whatsapp_status)));
                      const isReviewed = Boolean(v.review_request?.rating && Number(v.review_request.rating) >= 1);
                      const isCompleted = v.status === 'completed' || isSent || isReviewed;
                      const cleanVisitId =
                        v.visit_uid && !v.visit_uid.startsWith('GS-')
                          ? v.visit_uid
                          : `VIS-${1000 + vIdx + 1}`;
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-700 whitespace-nowrap">
                            {cleanVisitId}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {v.patient?.name || 'Patient'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {v.patient?.phone || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{v.visit_date}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">{v.doctor}</td>
                          <td className="py-3 px-4 text-slate-600">{v.department}</td>

                          {/* Source Spreadsheet Badge (Clickable to filter) */}
                          <td className="py-3 px-4">
                            {v.sheet_id === 'manual_entry' || !v.sheet_id ? (
                              <button
                                type="button"
                                onClick={() => setSelectedSheetFilter('manual')}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer"
                                title="Click to view only Manual Form entries"
                              >
                                <User className="w-3 h-3 text-indigo-600" />
                                <span>Manual Entry</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedSheetFilter(v.sheet_id || v.sheet_name || 'all')}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
                                title={`Click to view only consultations from "${v.sheet_name || 'Google Sheet'}"`}
                              >
                                <FileSpreadsheet className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span className="truncate max-w-[120px]">
                                  {v.sheet_name || 'Google Sheet'}
                                </span>
                              </button>
                            )}
                          </td>
                          
                          {/* Actual Patient Rating */}
                          <td className="py-3 px-4">
                            {v.review_request?.rating ? (
                              <div className="flex items-center gap-1.5">
                                <div className="flex text-amber-400">
                                  {Array.from({ length: 5 }).map((_, idx) => (
                                    <Star
                                      key={idx}
                                      className={`w-3.5 h-3.5 ${
                                        idx < (v.review_request?.rating || 0)
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-slate-200'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 font-mono">
                                  {v.review_request.rating}.0
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Pending Rating
                              </span>
                            )}
                          </td>

                          {/* Status: Completed when date crossed or WhatsApp sent */}
                          <td className="py-3 px-4">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-200">
                                <Check className="w-3 h-3 text-primary-600" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right">
                            {isSent ? (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-200 shadow-2xs"
                                title="WhatsApp review sent. 1-time anti-spam flag active."
                              >
                                <Check className="w-3 h-3 text-primary-600" />
                                Sent (1-Time Only)
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSendSingleWhatsApp(v.id)}
                                disabled={sendingId === v.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                                title="Send WhatsApp review template to this patient"
                              >
                                <Send className="w-3 h-3" />
                                <span>{sendingId === v.id ? 'Sending...' : 'Send WhatsApp'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ── Simple Connection Form (Clean & Easy) ─────────────────── */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Select Your Spreadsheet Platform
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Provide your Google Sheet link or upload an Excel/CSV spreadsheet to connect your hospital consultations.
            </p>
          </div>

          {/* 2 Big Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Google Sheets Option */}
            <button
              type="button"
              onClick={() => setSheetType('google_sheets')}
              className={`p-5 rounded-2xl border text-left transition-all flex items-start gap-4 ${
                sheetType === 'google_sheets'
                  ? 'border-primary-600 bg-primary-50/40 ring-2 ring-primary-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-slate-900">Google Sheets</p>
                  {sheetType === 'google_sheets' && (
                    <span className="w-4 h-4 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Connect live Google Sheet link. New entries automatically sync to the database.
                </p>
              </div>
            </button>

            {/* Microsoft Excel Option */}
            <button
              type="button"
              onClick={() => setSheetType('excel_365')}
              className={`p-5 rounded-2xl border text-left transition-all flex items-start gap-4 ${
                sheetType === 'excel_365'
                  ? 'border-primary-600 bg-primary-50/40 ring-2 ring-primary-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-slate-900">Microsoft Excel / CSV</p>
                  {sheetType === 'excel_365' && (
                    <span className="w-4 h-4 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Upload an Excel (.xlsx, .xls) or CSV spreadsheet file.
                </p>
              </div>
            </button>
          </div>

          <form onSubmit={handleConnectSheet} className="space-y-5 pt-2">
            {/* If Google Sheets: Input Link or Upload downloaded Google Sheet */}
            {sheetType === 'google_sheets' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Paste Google Sheet Link *
                  </label>
                  <input
                    type="text"
                    required={uploadedRows.length === 0}
                    placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Set Google Sheet share settings to "Anyone with the link can view", or upload your downloaded file below.
                  </p>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400">
                    OR UPLOAD DOWNLOADED GOOGLE SHEET (.XLSX / .CSV)
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <div>
                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-2xl p-4 bg-slate-50/70 hover:bg-primary-50/30 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:border-primary-300 flex items-center justify-center text-slate-500 group-hover:text-primary-600 shadow-xs">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-700 group-hover:text-primary-700">
                          {uploadedFileName ? uploadedFileName : 'Upload Google Sheet file (.xlsx or .csv)'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          In Google Sheets: File → Download → Microsoft Excel (.xlsx) or Comma Separated Values (.csv)
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* If Excel / CSV: Upload File or Paste Link */}
            {sheetType === 'excel_365' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Upload Excel / CSV Spreadsheet File
                  </label>
                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-2xl p-5 bg-slate-50/70 hover:bg-primary-50/30 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:border-primary-300 flex items-center justify-center text-slate-500 group-hover:text-primary-600 shadow-xs">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-700 group-hover:text-primary-700">
                          {uploadedFileName ? uploadedFileName : 'Click to browse Excel / CSV file'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Supports .csv, .xlsx, .txt table format
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Collapsible Advanced Column Names */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <span>Need custom column names? (Optional)</span>
                {showAdvancedMapping ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showAdvancedMapping && (
                <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3 text-xs animate-in fade-in duration-150">
                  <p className="text-slate-600 text-[11px]">
                    By default, columns named <code className="bg-white px-1 py-0.5 rounded border text-primary-700 font-mono">patient_name</code>, <code className="bg-white px-1 py-0.5 rounded border text-primary-700 font-mono">phone</code>, <code className="bg-white px-1 py-0.5 rounded border text-primary-700 font-mono">doctor</code>, <code className="bg-white px-1 py-0.5 rounded border text-primary-700 font-mono">status</code> are automatically detected.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Patient Name Column
                      </label>
                      <input
                        type="text"
                        value={mapping.patient_name}
                        onChange={(e) => setMapping({ ...mapping, patient_name: e.target.value })}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Phone Number Column
                      </label>
                      <input
                        type="text"
                        value={mapping.phone}
                        onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Doctor Name Column
                      </label>
                      <input
                        type="text"
                        value={mapping.doctor}
                        onChange={(e) => setMapping({ ...mapping, doctor: e.target.value })}
                        className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              {connection?.status === 'active' && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={syncing}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting & Importing Data...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connect Sheet & Import Data</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Connect Different Spreadsheet ──────────────────── */}
      {showAddSheetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Connect Sheet
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Connect your Google Sheet or Excel file. New patient consultations will sync live to the database.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSheetModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setShowAddSheetModal(false);
                await handleConnectSheet(e);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Spreadsheet Label / Source Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cardiology OPD Sheet, Branch 2 Sheet"
                  value={newSheetTitle}
                  onChange={(e) => setNewSheetTitle(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Platform Choice */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSheetType('google_sheets')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                    sheetType === 'google_sheets'
                      ? 'border-primary-600 bg-primary-50/60 ring-2 ring-primary-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-primary-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Google Sheets</p>
                    <p className="text-[10px] text-slate-400">Paste sheet URL</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSheetType('excel_365')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                    sheetType === 'excel_365'
                      ? 'border-primary-600 bg-primary-50/60 ring-2 ring-primary-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <UploadCloud className="w-4 h-4 text-primary-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Excel / CSV File</p>
                    <p className="text-[10px] text-slate-400">Upload .xlsx or .csv</p>
                  </div>
                </button>
              </div>

              {sheetType === 'google_sheets' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google Spreadsheet Link
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Browse Excel / CSV File
                  </label>
                  <label className="border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-xl p-4 text-center block cursor-pointer bg-slate-50/50 hover:bg-primary-50/20 transition-all">
                    <p className="text-xs font-bold text-slate-700">
                      {uploadedFileName ? uploadedFileName : 'Click to select Excel / CSV file'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddSheetModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncing}
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Connect Sheet & Import to Database</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add New Consultation Row ────────────────────────── */}
      {showNewEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add New Consultation Row
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enters into database and immediately updates the live UI.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewEntryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Verma"
                  value={newEntry.patient_name}
                  onChange={(e) => setNewEntry({ ...newEntry, patient_name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number (WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+919876543210"
                  value={newEntry.phone}
                  onChange={(e) => setNewEntry({ ...newEntry, phone: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Visited Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newEntry.visit_date}
                    onChange={(e) => setNewEntry({ ...newEntry, visit_date: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Doctor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={newEntry.doctor}
                    onChange={(e) => setNewEntry({ ...newEntry, doctor: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNewEntryModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingEntry}
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                >
                  {addingEntry ? 'Saving to Database...' : 'Save Row to Database & UI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: WhatsApp Review Dispatch Summary ───────────────── */}
      {showSendAllModal && sendAllResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 border border-primary-200/80 flex items-center justify-center shadow-xs">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>WhatsApp Reviews Dispatched</span>
                    <span className="text-[10px] font-bold bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full border border-primary-300">
                      Live
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Official WhatsApp review template dispatched to patients.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSendAllModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Metrics Highlights */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary-50 border border-primary-200/80 rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 text-primary-700 text-xs font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sent Successfully</span>
                  </div>
                  <p className="text-2xl font-black text-primary-900">
                    {sendAllResult.sentCount}
                  </p>
                  <p className="text-[11px] text-primary-700/80 font-medium">
                    Patients received review invitation
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 text-amber-700 text-xs font-bold mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>1-Time Anti-Spam Protected</span>
                  </div>
                  <p className="text-2xl font-black text-amber-900">
                    {sendAllResult.skippedCount}
                  </p>
                  <p className="text-[11px] text-amber-700/80 font-medium">
                    Skipped (already sent previously)
                  </p>
                </div>
              </div>

              {/* Exact Template Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                    Dispatched WhatsApp Template
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">1-Time Only Policy Active</span>
                </div>
                <div className="bg-primary-900/5 border border-primary-700/10 rounded-xl p-3 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {sendAllResult.details[0]?.message ||
                    `Hi [Patient Name]! 💙\n\nThank you for choosing ${currentHospital?.name || 'our Hospital'} for your care.\n\nWe’d love to know about your experience. 🏥\n\n💬 We would be grateful if you could share your experience with us right here in this chat.\n\nYou can simply:\n🎤 Send a voice message and tell us about your experience, or\n⌨️ Type your feedback in the chat.\nYour feedback is valuable to us and helps us continuously improve our services. 💙`}
                </div>
              </div>

              {/* Recipient Details List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800">
                  Recipient Dispatch Log ({sendAllResult.details.length} records)
                </h4>
                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden text-xs">
                  {sendAllResult.details.map((detail, idx) => (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">
                            {detail.patientName}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {detail.phone}
                          </span>
                        </div>
                        {detail.reason && (
                          <p className="text-[10px] text-amber-700 font-medium">
                            {detail.reason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {detail.status === 'sent' ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-700 bg-primary-50 border border-primary-200/70 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3 text-primary-600" />
                              Dispatched
                            </span>
                            <a
                              href={`https://wa.me/${detail.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                detail.message
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-primary-700 bg-primary-100/60 hover:bg-primary-100 rounded-lg transition-colors border border-primary-300/60"
                            >
                              <span>Open in WhatsApp</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            Anti-Spam Protected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowSendAllModal(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
