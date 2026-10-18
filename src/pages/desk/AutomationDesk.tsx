import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileSpreadsheet, Send, CheckCircle2, XCircle, Clock,
  Download, RefreshCw, ChevronLeft, Users, MessageSquare,
  AlertTriangle, Filter, Search, Loader2, Play, SkipForward,
  Building2, Star, Brain, Zap, Info,
} from 'lucide-react';
import { parsePatientFile, getSampleCSV, sendWhatsAppMessage } from '../../services/excelService';
import { getFeedbackFormUrl } from '../../services/db';
import { fetchGoogleSheetData } from '../../services/googleSheetsService';
import type { PatientRow, SendStatus, HospitalConfig } from '../../types/patient';
import { formatDate } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: SendStatus }) {
  const map: Record<SendStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    pending:  { label: 'Pending',  cls: 'bg-slate-100 text-slate-600 border-slate-200',       icon: <Clock className="h-3 w-3" /> },
    sending:  { label: 'Sending…', cls: 'bg-blue-50 text-blue-600 border-blue-200',           icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    sent:     { label: 'Sent',     cls: 'bg-primary-50 text-primary-700 border-primary-200',  icon: <CheckCircle2 className="h-3 w-3" /> },
    failed:   { label: 'Failed',   cls: 'bg-red-50 text-red-600 border-red-200',              icon: <XCircle className="h-3 w-3" /> },
    skipped:  { label: 'Skipped',  cls: 'bg-amber-50 text-amber-600 border-amber-200',        icon: <SkipForward className="h-3 w-3" /> },
  };
  const { label, cls, icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {icon}{label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Upload zone
// ---------------------------------------------------------------------------
function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  const downloadSample = () => {
    const blob = new Blob([getSampleCSV()], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'reviewbridge_sample_patients.csv';
    a.click();
  };

  return (
    <div className="flex flex-col items-center">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => ref.current?.click()}
        className={`w-full max-w-xl border-2 border-dashed rounded-2xl px-8 py-12 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
          drag ? 'border-primary-400 bg-primary-50' : 'border-surface-border bg-surface-subtle hover:border-primary-300 hover:bg-primary-50/40'
        }`}
        role="button"
        tabIndex={0}
        aria-label="Upload patient Excel or CSV file"
        onKeyDown={(e) => e.key === 'Enter' && ref.current?.click()}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${drag ? 'bg-primary-100' : 'bg-white border border-surface-border'}`}>
          <FileSpreadsheet className={`h-7 w-7 ${drag ? 'text-primary-600' : 'text-ink-muted'}`} aria-hidden />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink-DEFAULT">
            Drop your patient file here, or <span className="text-primary-600">click to browse</span>
          </p>
          <p className="text-xs text-ink-subtle mt-1">Supports .xlsx, .xls and .csv files</p>
        </div>
        <input
          ref={ref}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>

      {/* Required columns hint */}
      <div className="mt-4 max-w-xl w-full bg-white border border-surface-border rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-ink-soft mb-1.5 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-primary-600" aria-hidden />
          Required columns in your Excel / CSV
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['Name', 'Phone', 'Visit Date', 'Visit ID'].map((c) => (
            <span key={c} className="px-2 py-0.5 bg-surface-raised rounded text-[11px] font-mono text-ink-muted border border-surface-border">{c}</span>
          ))}
          <span className="px-2 py-0.5 bg-surface-subtle rounded text-[11px] font-mono text-ink-subtle border border-dashed border-surface-border">Doctor (optional)</span>
          <span className="px-2 py-0.5 bg-surface-subtle rounded text-[11px] font-mono text-ink-subtle border border-dashed border-surface-border">Department (optional)</span>
        </div>
      </div>

      <button
        onClick={downloadSample}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 underline underline-offset-2"
      >
        <Download className="h-3.5 w-3.5" aria-hidden /> Download sample CSV template
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat pill
// ---------------------------------------------------------------------------
function StatPill({ label, value, color = 'slate' }: { label: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    slate:   'bg-slate-100 text-slate-700',
    green:   'bg-primary-50 text-primary-700',
    red:     'bg-red-50 text-red-700',
    amber:   'bg-amber-50 text-amber-700',
    blue:    'bg-blue-50 text-blue-700',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${colors[color] ?? colors.slate}`}>
      <span className="text-base font-bold">{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AutomationDesk() {
  const navigate = useNavigate();

  // Hospital config from sessionStorage (set by login page)
  const [config] = useState<HospitalConfig>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('rb_hospital') ?? '{}');
    } catch { return {}; }
  });

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<SendStatus | 'all'>('all');
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [googleSheetLink, setGoogleSheetLink] = useState('');
  const [connectingSheet, setConnectingSheet] = useState(false);

  // Redirect to setup if no config
  useEffect(() => {
    if (!config.hospitalName) navigate('/');
  }, [config, navigate]);

  // ---------------------------------------------------------------------------
  // Google Sheet URL handling
  // ---------------------------------------------------------------------------
  const handleConnectGoogleSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleSheetLink.trim()) return;
    setParseError('');
    setConnectingSheet(true);
    try {
      const res = await fetchGoogleSheetData(googleSheetLink.trim());
      if (res.success && res.rows.length > 0) {
        const rows: PatientRow[] = res.rows.map((r) => ({
          id: r.visit_uid || `pat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: r.patient_name,
          phone: r.phone,
          maskedPhone: r.phone.replace(/\D/g, '').length > 6 ? r.phone.slice(0, -6).replace(/\d/g, '*') + r.phone.slice(-4) : r.phone,
          visitDate: r.visit_date,
          visitId: r.visit_uid,
          doctor: r.doctor,
          department: r.department,
          sendStatus: 'pending',
        }));
        setPatients(rows);
        setSelectedIds(new Set(rows.map((r) => r.id)));
        setFileName(res.sheetTitle || 'Google Spreadsheet');
      } else {
        setParseError(res.errorMessage || 'Could not fetch data from Google Spreadsheet link. Please ensure sheet is shared.');
      }
    } catch (err: any) {
      setParseError(`Google Sheets connection error: ${err.message}`);
    } finally {
      setConnectingSheet(false);
    }
  };

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------
  const handleFile = useCallback(async (file: File) => {
    setParseError('');
    setParsing(true);
    setFileName(file.name);
    try {
      const rows = await parsePatientFile(file);
      setPatients(rows);
      setSelectedIds(new Set(rows.map((r) => r.id)));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Failed to parse file.');
    } finally {
      setParsing(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Sending logic
  // ---------------------------------------------------------------------------
  const sendOne = useCallback(async (id: string) => {
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, sendStatus: 'sending' } : p))
    );
    const patient = patients.find((p) => p.id === id);
    if (!patient) return;

    const feedbackUrl = getFeedbackFormUrl(patient.id, patient.name, config.hospitalName, patient.phone);
    const result = await sendWhatsAppMessage(patient, config.hospitalName, feedbackUrl);

    setPatients((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, sendStatus: result.success ? 'sent' : 'failed', sentAt: new Date().toISOString() }
          : p
      )
    );
  }, [patients, config.hospitalName]);

  const sendAll = useCallback(async () => {
    const toSend = patients.filter(
      (p) => selectedIds.has(p.id) && (p.sendStatus === 'pending' || p.sendStatus === 'failed')
    );
    if (toSend.length === 0) return;
    setIsSendingAll(true);
    for (const p of toSend) {
      await sendOne(p.id);
    }
    setIsSendingAll(false);
  }, [patients, selectedIds, sendOne]);

  const reset = () => {
    setPatients([]);
    setFileName('');
    setParseError('');
    setSelectedIds(new Set());
    setSearch('');
    setFilterStatus('all');
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const stats = {
    total:   patients.length,
    pending: patients.filter((p) => p.sendStatus === 'pending').length,
    sent:    patients.filter((p) => p.sendStatus === 'sent').length,
    failed:  patients.filter((p) => p.sendStatus === 'failed').length,
    sending: patients.filter((p) => p.sendStatus === 'sending').length,
  };

  const filtered = patients.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.visitId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.sendStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds(
      selectedIds.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id))
    );

  const pendingSelected = filtered.filter(
    (p) => selectedIds.has(p.id) && (p.sendStatus === 'pending' || p.sendStatus === 'failed')
  ).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col">

      {/* Top nav */}
      <header className="h-14 bg-white border-b border-surface-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink-DEFAULT transition-colors"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Setup
          </button>
          <span className="text-surface-border">|</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-ink-DEFAULT flex items-center justify-center">
              <Brain className="h-3.5 w-3.5 text-white" aria-hidden />
            </div>
            <span className="text-sm font-bold text-ink-DEFAULT">ReviewBridge</span>
          </div>
          {config.hospitalName && (
            <>
              <span className="text-surface-border">›</span>
              <span className="text-sm font-medium text-primary-700 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                {config.hospitalName}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-primary-700 bg-primary-50 border border-primary-200 px-2.5 py-1 rounded-full font-medium">
            <Zap className="h-3 w-3" aria-hidden /> Automation Desk
          </span>
          <button
            onClick={() => navigate('/staff')}
            className="text-xs font-medium text-ink-muted hover:text-ink-DEFAULT border border-surface-border rounded-lg px-3 py-1.5 transition-colors"
          >
            Staff Dashboard →
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-ink-DEFAULT">Patient Review Automation Desk</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Upload your patient list, review, and dispatch WhatsApp feedback requests in bulk.
          </p>
        </div>

        {/* Upload state */}
        {patients.length === 0 ? (
          <div className="bg-white border border-surface-border rounded-2xl shadow-card p-8">

            {/* Step header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white text-xs font-bold">2</div>
                <div>
                  <p className="text-base font-bold text-ink-DEFAULT">Upload Patient List</p>
                  <p className="text-xs text-ink-subtle">Excel (.xlsx) or CSV with patient visit data</p>
                </div>
              </div>
              {config.hospitalName && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-muted bg-surface-raised border border-surface-border px-3 py-1.5 rounded-lg">
                  <Star className="h-3 w-3 text-yellow-500" aria-hidden />
                  {config.hospitalName}
                </div>
              )}
            </div>

            {/* Google Sheets Link Input Box */}
            <div className="mb-6 p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 border border-blue-200 rounded-2xl">
              <form onSubmit={handleConnectGoogleSheet} className="space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="gsLink" className="flex items-center gap-2 text-xs font-bold text-[#003B95] uppercase tracking-wider">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Connect Google Spreadsheet Link</span>
                  </label>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                    Instant Live Sync
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="gsLink"
                    type="url"
                    value={googleSheetLink}
                    onChange={(e) => setGoogleSheetLink(e.target.value)}
                    placeholder="Paste Google Sheets link (e.g. https://docs.google.com/spreadsheets/d/...)"
                    className="flex-1 bg-white border border-blue-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#003B95] shadow-xs"
                  />
                  <button
                    type="submit"
                    disabled={connectingSheet || !googleSheetLink.trim()}
                    className="inline-flex items-center justify-center gap-2 bg-[#003B95] hover:bg-[#002b6e] text-white font-bold px-6 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {connectingSheet ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Connect Sheet</span>
                        <Zap className="w-3.5 h-3.5 text-cyan-300" />
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600">
                  Ensure the Google Sheet link sharing setting is set to <em>"Anyone with the link can view"</em>.
                </p>
              </form>
            </div>

            <div className="relative flex py-2 items-center mb-6">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-xs font-bold text-slate-400 uppercase tracking-wider">or upload file</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {parsing ? (
              <div className="flex flex-col items-center py-12 gap-3">
                <Loader2 className="h-8 w-8 text-primary-600 animate-spin" aria-hidden />
                <p className="text-sm text-ink-muted">Parsing <span className="font-medium">{fileName}</span>…</p>
              </div>
            ) : (
              <UploadZone onFile={handleFile} />
            )}

            {parseError && (
              <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" aria-hidden />
                <p className="text-sm text-red-700">{parseError}</p>
              </div>
            )}
          </div>

        ) : (
          /* ---------------------------------------------------------------- */
          /* Patient table view                                               */
          /* ---------------------------------------------------------------- */
          <div className="space-y-4">

            {/* Stats bar */}
            <div className="bg-white border border-surface-border rounded-xl shadow-card px-4 py-3 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <StatPill label="Total"   value={stats.total}   color="slate" />
                <StatPill label="Pending" value={stats.pending} color="slate" />
                <StatPill label="Sent"    value={stats.sent}    color="green" />
                {stats.failed > 0 && <StatPill label="Failed" value={stats.failed} color="red" />}
                {stats.sending > 0 && <StatPill label="Sending" value={stats.sending} color="blue" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-subtle">{fileName}</span>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink-DEFAULT border border-surface-border rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden /> Replace file
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="bg-white border border-surface-border rounded-xl shadow-card px-4 py-3 flex items-center justify-between flex-wrap gap-3">
              {/* Search + filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-subtle" aria-hidden />
                  <input
                    type="text"
                    placeholder="Search patient or visit ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-surface-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-52"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-ink-subtle" aria-hidden />
                  {(['all', 'pending', 'sent', 'failed', 'skipped'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                        filterStatus === s
                          ? 'bg-ink-DEFAULT text-white'
                          : 'bg-surface-raised text-ink-muted hover:bg-surface-border'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Send button */}
              <button
                onClick={sendAll}
                disabled={isSendingAll || pendingSelected === 0}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  pendingSelected > 0 && !isSendingAll
                    ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-card'
                    : 'bg-surface-border text-ink-subtle cursor-not-allowed'
                }`}
              >
                {isSendingAll ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…</>
                ) : (
                  <><Play className="h-4 w-4" aria-hidden /> Send to {pendingSelected} Patient{pendingSelected !== 1 ? 's' : ''}</>
                )}
              </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-surface-border rounded-xl shadow-card overflow-hidden">
              {/* Desktop header */}
              <div className="hidden lg:grid grid-cols-[auto_2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 bg-surface-subtle border-b border-surface-border text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="rounded accent-primary-600"
                  aria-label="Select all"
                />
                <span>Patient</span>
                <span>Phone</span>
                <span>Visit Date</span>
                <span>Visit ID</span>
                <span>Doctor</span>
                <span>Status</span>
                <span>Action</span>
              </div>

              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="h-8 w-8 text-ink-subtle mx-auto mb-2" aria-hidden />
                  <p className="text-sm text-ink-muted">No patients match your filters.</p>
                </div>
              ) : (
                <ul className="divide-y divide-surface-border">
                  {filtered.map((p) => (
                    <li key={p.id}>
                      {/* Desktop row */}
                      <div className="hidden lg:grid grid-cols-[auto_2fr_1.5fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center px-4 py-3 hover:bg-surface-subtle transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="rounded accent-primary-600"
                          aria-label={`Select ${p.name}`}
                        />
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {p.name.charAt(0)}
                          </div>
                          <p className="text-sm font-medium text-ink-DEFAULT truncate">{p.name}</p>
                        </div>
                        <p className="text-sm text-ink-muted font-mono">{p.maskedPhone}</p>
                        <p className="text-sm text-ink-muted">{formatDate(p.visitDate)}</p>
                        <p className="text-xs text-ink-subtle font-mono">{p.visitId}</p>
                        <p className="text-xs text-ink-muted truncate">{p.doctor ?? '—'}</p>
                        <StatusBadge status={p.sendStatus} />
                        <button
                          onClick={() => sendOne(p.id)}
                          disabled={p.sendStatus === 'sending' || p.sendStatus === 'sent' || isSendingAll}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            p.sendStatus === 'sent'
                              ? 'bg-surface-raised text-ink-subtle cursor-not-allowed'
                              : p.sendStatus === 'sending'
                              ? 'bg-blue-50 text-blue-600 cursor-wait'
                              : 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200'
                          }`}
                          aria-label={`Send to ${p.name}`}
                        >
                          {p.sendStatus === 'sending' ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          ) : p.sendStatus === 'sent' ? (
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                          ) : (
                            <Send className="h-3 w-3" aria-hidden />
                          )}
                          {p.sendStatus === 'sent' ? 'Sent' : 'Send'}
                        </button>
                      </div>

                      {/* Mobile card */}
                      <div className="lg:hidden px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={() => toggleSelect(p.id)}
                              className="rounded accent-primary-600"
                              aria-label={`Select ${p.name}`}
                            />
                            <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-ink-DEFAULT">{p.name}</p>
                              <p className="text-xs text-ink-subtle font-mono">{p.maskedPhone}</p>
                            </div>
                          </div>
                          <StatusBadge status={p.sendStatus} />
                        </div>
                        <div className="flex items-center justify-between pl-12">
                          <p className="text-xs text-ink-subtle">{formatDate(p.visitDate)} · {p.visitId}</p>
                          <button
                            onClick={() => sendOne(p.id)}
                            disabled={p.sendStatus === 'sending' || p.sendStatus === 'sent' || isSendingAll}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send className="h-3 w-3" aria-hidden /> Send
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Footer */}
              <div className="px-4 py-2.5 bg-surface-subtle border-t border-surface-border flex items-center justify-between">
                <p className="text-xs text-ink-subtle">{filtered.length} of {patients.length} patients shown</p>
                {stats.sent > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-primary-700 font-medium">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                    {stats.sent} WhatsApp message{stats.sent !== 1 ? 's' : ''} dispatched
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp integration notice */}
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Demo mode:</span> Messages are simulated. Connect
                your WhatsApp Business API (Interakt / AiSensy) in Settings to send real messages.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
