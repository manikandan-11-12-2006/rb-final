import React, { useState, useEffect } from 'react';
import { TambaramLogo } from '../../components/TambaramLogo';
import {
  Users,
  CheckCircle2,
  Send,
  Star,
  AlertTriangle,
  Plus,
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  ExternalLink,
  Copy,
  Check,
  Building2,
  RefreshCw,
  Phone,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db, isDateCrossed, getFeedbackFormUrl } from '../../services/db';
import { Visit, Hospital, SheetType, ReviewRequest } from '../../types/database';

export default function HospitalDashboard() {
  const navigate = useNavigate();
  const {
    currentUser,
    currentHospital,
    selectedHospitalId,
    hospitals,
    switchHospital,
    isSuperAdmin,
    isHospitalAdmin,
    isStaff,
  } = useAuth();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [clearingVisits, setClearingVisits] = useState(false);

  // Manual Visit Form State
  const [visitForm, setVisitForm] = useState({
    patient_name: '',
    phone: '',
    department: 'General Medicine',
    doctor: 'Dr. Ramesh Kumar',
    whatsapp_consent: true,
  });
  const [savingVisit, setSavingVisit] = useState(false);

  // Sheet Sync Form State
  const [syncJson, setSyncJson] = useState(`[
  {
    "sheet_row_id": "IMP-8819-15",
    "patient_name": "Ganesh B",
    "phone": "+919876543224",
    "department": "General Medicine",
    "doctor": "Dr. Rajesh",
    "visit_date": "15-09-2026",
    "status": "registered"
  },
  {
    "sheet_row_id": "IMP-8819-14",
    "patient_name": "Swetha M",
    "phone": "+919876543223",
    "department": "General Medicine",
    "doctor": "Dr. Divya",
    "visit_date": "14-09-2026",
    "status": "completed"
  }
]`);
  const [syncApiKey, setSyncApiKey] = useState('rb_live_secret_key_123');
  const [syncResult, setSyncResult] = useState<{
    accepted: number;
    rejected: number;
    errors: string[];
  } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Fetch Visits
  const loadVisits = async () => {
    setRefreshing(true);
    try {
      const activeHospitalId =
        !isSuperAdmin && currentUser?.hospital_id
          ? currentUser.hospital_id
          : selectedHospitalId !== 'all'
          ? selectedHospitalId
          : null;

      const [data, reviewsData] = await Promise.all([
        db.getVisits(activeHospitalId, {
          department: selectedDept,
          status: selectedStatus,
          date: dateFilter,
        }),
        db.getReviews(activeHospitalId || undefined),
      ]);
      setVisits(data);
      setReviews(reviewsData || []);
    } catch (err) {
      console.error('Error fetching visits:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVisits();

    const handleFocus = () => {
      loadVisits();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleFocus);
    const interval = setInterval(loadVisits, 10000); // 10s auto-refresh for real-time sync

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleFocus);
      clearInterval(interval);
    };
  }, [selectedHospitalId, selectedDept, selectedStatus, dateFilter]);

  // Handle Mark Complete & WhatsApp Dispatch
  const handleMarkComplete = async (visitId: string) => {
    try {
      const updatedVisit = visits.find((v) => v.id === visitId);
      await db.markVisitComplete(visitId);
      await loadVisits();

      if (updatedVisit?.patient?.phone) {
        const digits = updatedVisit.patient.phone.replace(/\D/g, '');
        if (digits) {
          const hospName = currentHospital?.name || 'ABC Healthcare';
          const feedbackUrl = getFeedbackFormUrl(updatedVisit.token, updatedVisit.patient?.name, hospName, updatedVisit.patient.phone);
          const msg =
            `Thank you for visiting ${hospName}!\n\n` +
            `We hope you had a great experience. Please click the feedback form link below to share your valuable feedback:\n\n` +
            `${feedbackUrl}\n\n` +
            `Your feedback helps us serve you better. Thank you!`;
          
          window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (err) {
      console.error('Failed to mark complete:', err);
    }
  };

  // Handle Manual Visit Submit
  const handleAddVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitForm.patient_name || !visitForm.phone) return;

    const targetHospitalId =
      currentHospital?.id ||
      (currentUser?.hospital_id ? currentUser.hospital_id : hospitals[0]?.id);

    if (!targetHospitalId) return;

    setSavingVisit(true);
    try {
      await db.createVisit({
        hospital_id: targetHospitalId,
        patient_name: visitForm.patient_name,
        phone: visitForm.phone.startsWith('+') ? visitForm.phone : `+91${visitForm.phone}`,
        department: visitForm.department,
        doctor: visitForm.doctor,
        whatsapp_consent: visitForm.whatsapp_consent,
      });

      setShowAddModal(false);
      setVisitForm({
        patient_name: '',
        phone: '',
        department: 'General Medicine',
        doctor: 'Dr. Ramesh Kumar',
        whatsapp_consent: true,
      });
      await loadVisits();
    } catch (err) {
      console.error('Failed to add visit:', err);
    } finally {
      setSavingVisit(false);
    }
  };

  // Handle Sheet Sync Run
  const handleRunSheetSync = async () => {
    const targetHospitalId =
      currentHospital?.id || (currentUser?.hospital_id ? currentUser.hospital_id : hospitals[0]?.id);
    if (!targetHospitalId) return;

    setSyncing(true);
    try {
      const parsed = JSON.parse(syncJson);
      const res = await db.syncSheetRows(targetHospitalId, parsed, syncApiKey);
      setSyncResult(res);
      await loadVisits();
    } catch (err: any) {
      setSyncResult({
        accepted: 0,
        rejected: 0,
        errors: [err.message || 'Invalid JSON format or sync error'],
      });
    } finally {
      setSyncing(false);
    }
  };

  // Handle Clear All Consultations
  const handleClearAllVisits = async () => {
    if (!window.confirm('Are you sure you want to clear all consultations and visits for this clinic? This cannot be undone.')) {
      return;
    }
    setClearingVisits(true);
    try {
      const activeHospitalId =
        !isSuperAdmin && currentUser?.hospital_id
          ? currentUser.hospital_id
          : selectedHospitalId !== 'all'
          ? selectedHospitalId
          : undefined;

      await db.deleteAllVisits(activeHospitalId);
      await loadVisits();
    } catch (err) {
      console.error('Failed to clear visits:', err);
    } finally {
      setClearingVisits(false);
    }
  };

  // Handle Delete Single Consultation
  const handleDeleteVisit = async (visitId: string) => {
    if (!window.confirm('Are you sure you want to delete this consultation?')) {
      return;
    }
    try {
      await db.deleteVisit(visitId);
      await loadVisits();
    } catch (err) {
      console.error('Failed to delete visit:', err);
    }
  };

  // Download Standard Template CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      'patient_name,phone,visit_date,department,doctor,status\n' +
      'Kavitha Sundaram,+919876543210,2026-09-28,Cardiology,Dr. Ramesh Kumar,registered\n' +
      'Arun Kumar,+919845012345,2026-09-28,General Medicine,Dr. S. Anita,completed\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RescueBridge_Sheet_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered list
  const filteredVisits = visits.filter((v) => {
    const query = searchQuery.toLowerCase();
    const patientName = v.patient?.name?.toLowerCase() || '';
    const phone = v.patient?.phone || '';
    const doc = v.doctor.toLowerCase();
    const dept = v.department.toLowerCase();
    const matchesSearch = patientName.includes(query) || phone.includes(query) || doc.includes(query) || dept.includes(query);

    const matchesDept = selectedDept === 'all' || v.department.toLowerCase() === selectedDept.toLowerCase();

    let matchesReviewStatus = true;
    if (selectedStatus === 'rated') {
      matchesReviewStatus = Boolean(v.review_request?.rating);
    } else if (selectedStatus === 'google_completed') {
      matchesReviewStatus = Boolean(v.review_request?.rating && v.review_request.rating >= 4);
    } else if (selectedStatus === 'pending_review') {
      matchesReviewStatus = !v.review_request?.rating;
    } else if (selectedStatus === 'message_sent') {
      matchesReviewStatus = Boolean(v.review_request && ['sent', 'delivered', 'read'].includes(v.review_request.whatsapp_status));
    }

    const matchesDate = !dateFilter || v.visit_date === dateFilter;

    return matchesSearch && matchesDept && matchesReviewStatus && matchesDate;
  });

  // Funnel Metrics
  const completedCount = visits.filter((v) => v.status === 'completed').length;

  // Step 2: WhatsApp Sent — capped at total consultations
  const messagesSentCountRaw = visits.filter(
    (v) => v.review_request && ['sent', 'delivered', 'read'].includes(v.review_request.whatsapp_status)
  ).length;
  const messagesSentCount = Math.min(messagesSentCountRaw, completedCount);

  // Step 3: Google Reviews
  const validReviews = (reviews || []).filter(
    (r) => typeof r.rating === 'number' && r.rating > 0
  );
  const visitRatings = visits
    .map((v) => v.review_request?.rating)
    .filter((r): r is number => typeof r === 'number' && r > 0);

  const reviewsReceived = validReviews.length > 0 ? validReviews.length : visitRatings.length;
  const allRatings = validReviews.length > 0 ? validReviews.map((r) => r.rating!) : visitRatings;

  const avgRating =
    allRatings.length > 0
      ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Executive Hospital Header ─────────────────────────────── */}
      <div className="bg-gradient-to-r from-white via-slate-50/70 to-blue-50/30 p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-center gap-4">
          {currentHospital?.logo && !currentHospital.logo.includes('photo-1586773860418-d37222d8fce3') ? (
            <img
              src={currentHospital.logo}
              alt={currentHospital.name}
              className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#003B95] via-blue-700 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-blue-900/20 shrink-0 tracking-wider">
              {currentHospital?.name ? currentHospital.name.charAt(0).toUpperCase() : <TambaramLogo className="w-8 h-8" />}
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {isSuperAdmin && selectedHospitalId === 'all'
                  ? 'All Partner Hospitals Network'
                  : currentHospital?.name || 'Clinic Management Portal'}
              </h1>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200/80 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                {currentUser?.role === 'super_admin'
                  ? 'Super Administrator'
                  : currentUser?.role === 'hospital_admin'
                  ? 'Clinic Administrator'
                  : 'Front Desk Operations'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
              {currentHospital && (
                <span className="font-semibold text-slate-700 font-mono">
                  {currentHospital.subdomain}.rescuebridge.com
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Switcher */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 text-xs shadow-xs">
            <span className="text-slate-500 font-semibold">View Clinic:</span>
            <select
              value={selectedHospitalId}
              onChange={(e) => switchHospital(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500 text-xs cursor-pointer"
            >
              <option value="all">All Clinics Combined</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.subdomain})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Review Funnel Overview (Clean 3D Segmented Cards) ────────── */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Patient Review & WhatsApp Automation Funnel
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time patient progression from completed consultation to verified Google Maps 5★ reviews.
            </p>
          </div>

          <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-200/80 px-4 py-2.5 rounded-2xl shadow-xs shrink-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                allRatings.length > 0
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              <Star
                className={`w-5 h-5 ${
                  allRatings.length > 0 ? 'fill-white text-white' : 'fill-slate-300 text-slate-300'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black text-slate-900 tracking-tight">{avgRating}</span>
                <span className="text-xs text-slate-500 font-bold">/ 5.0</span>
                <div className="flex items-center ml-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${
                        allRatings.length > 0 && i < Math.round(Number(avgRating))
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-100 text-slate-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-600 font-bold leading-none mt-0.5">
                {reviewsReceived} Google Reviews Verified
              </p>
            </div>
          </div>
        </div>

        {/* Funnel 3 3D Segmented Cards (Clean light palette) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Completed Consultations */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_16px_35px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200/80">
                  Step 01
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                Consultations Done
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                {completedCount}
              </p>

              {/* Inner Pill Box */}
              <div className="bg-slate-50 border border-slate-100/90 rounded-2xl p-3 flex items-center gap-2.5 my-3.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-semibold text-slate-600">
                  Finished visits ready for review
                </span>
              </div>
            </div>

            <div>
              {/* Segmented Progress Bar */}
              <div className="flex items-center gap-1 w-full my-3.5">
                {Array.from({ length: 16 }).map((_, index) => (
                  <div
                    key={index}
                    className={`h-3.5 flex-1 rounded-sm transition-all duration-300 ${
                      completedCount > 0 ? 'bg-[#003B95]' : 'bg-slate-100'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-bold text-slate-500">Pipeline Total</span>
                <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/70">
                  {completedCount > 0 ? '100% recorded' : '0 recorded'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: WhatsApp Dispatched */}
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
                WhatsApp Sent
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                {messagesSentCount}
              </p>

              {/* Inner Pill Box */}
              <div className="bg-slate-50 border border-slate-100/90 rounded-2xl p-3 flex items-center gap-2.5 my-3.5">
                <Send className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold text-slate-600">
                  Delivered via WhatsApp API
                </span>
              </div>
            </div>

            <div>
              {/* Segmented Progress Bar */}
              <div className="flex items-center gap-1 w-full my-3.5">
                {Array.from({ length: 16 }).map((_, index) => {
                  const pct = completedCount > 0 ? (messagesSentCount / completedCount) * 100 : 0;
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
                  {completedCount > 0 ? Math.round((messagesSentCount / completedCount) * 100) : 0}% sent
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Google 5★ Verified Reviews */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_10px_25px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_16px_35px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/80 shadow-xs">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200/80">
                  Step 03
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                Google 5★ Reviews
              </p>
              <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                {reviewsReceived}
              </p>

              {/* Inner Pill Box */}
              <div className="bg-slate-50 border border-slate-100/90 rounded-2xl p-3 flex items-center gap-2.5 my-3.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-600">
                  Published to Google Maps
                </span>
              </div>
            </div>

            <div>
              {/* Segmented Progress Bar */}
              <div className="flex items-center gap-1 w-full my-3.5">
                {Array.from({ length: 16 }).map((_, index) => {
                  const pct = completedCount > 0 ? (reviewsReceived / completedCount) * 100 : 0;
                  const activeSegments = Math.round((Math.min(100, Math.max(0, pct)) / 100) * 16);
                  return (
                    <div
                      key={index}
                      className={`h-3.5 flex-1 rounded-sm transition-all duration-300 ${
                        index < activeSegments ? 'bg-amber-500' : 'bg-slate-100'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-bold text-slate-500">5★ Conversion</span>
                <span className="font-extrabold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80">
                  {completedCount > 0 ? Math.round((reviewsReceived / completedCount) * 100) : 0}% converted
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Patient Consultations & Records Table ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filters & Search Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900">Patient Consultations & Visits</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-semibold">
              {filteredVisits.length} Records
            </span>
            {visits.length > 0 && (
              <button
                onClick={handleClearAllVisits}
                disabled={clearingVisits}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 rounded-xl transition-all shadow-2xs cursor-pointer ml-1"
                title="Clear all visits and consultations"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                {clearingVisits ? 'Clearing...' : 'Clear All Consultations'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient, doctor, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 w-52"
              />
            </div>

            {/* Department */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 py-1.5 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            >
              <option value="all">All Specialties</option>
              <option value="Cardiology">Cardiology</option>
              <option value="General Medicine">General Medicine</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Gynecology">Gynecology</option>
              <option value="Dentistry">Dentistry</option>
            </select>

            {/* Review Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 py-1.5 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            >
              <option value="all">All Review Statuses</option>
              <option value="rated">Review Received (Rated)</option>
              <option value="google_completed">Google 4★ & 5★ Reviews</option>
              <option value="pending_review">Pending Patient Review</option>
              <option value="message_sent">Feedback Message Sent</option>
            </select>

            {/* Date */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 py-1.5 px-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-3.5">Patient Details</th>
                <th className="px-5 py-3.5">Specialty & Doctor</th>
                <th className="px-4 py-3.5">Visit Date</th>
                <th className="px-4 py-3.5">Feedback Message Status</th>
                <th className="px-4 py-3.5">Patient Review Status</th>
                <th className="px-6 py-3.5 text-right">Rating Given</th>
                <th className="px-4 py-3.5 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No consultations found matching your current filters.
                  </td>
                </tr>
              ) : (
                filteredVisits.map((v) => {
                  const rating = (typeof v.review_request?.rating === 'number' && v.review_request.rating >= 1)
                    ? v.review_request.rating
                    : (typeof v.patient?.rating === 'number' && v.patient.rating >= 1)
                    ? v.patient.rating
                    : (typeof (v as any).rating === 'number' && (v as any).rating >= 1)
                    ? (v as any).rating
                    : null;
                  const isReviewed = typeof rating === 'number' && rating >= 1;
                  const isPositiveGoogle = isReviewed && rating >= 4;
                  const isNeutral = isReviewed && rating === 3;
                  const isNegative = isReviewed && rating <= 2;

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Patient Details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-primary-100 text-primary-800 border border-primary-200/80 font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {v.patient?.name ? v.patient.name.charAt(0).toUpperCase() : 'P'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs tracking-tight group-hover:text-primary-700 transition-colors">
                              {v.patient?.name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{v.patient?.phone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Doctor & Dept */}
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900 text-xs">{v.doctor}</p>
                        <span className="inline-block mt-0.5 text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
                          {v.department}
                        </span>
                      </td>

                      {/* Visit Date */}
                      <td className="px-4 py-4 text-slate-600 font-mono text-[11px]">
                        {v.visit_date}
                      </td>

                      {/* Feedback Message Sent Status */}
                      <td className="px-4 py-4">
                        {isReviewed || v.review_request ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-2xs ${
                              (isReviewed || v.review_request?.whatsapp_status === 'read')
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : v.review_request?.whatsapp_status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            <Send className="w-3 h-3" />
                            {isReviewed ? 'READ' : (v.review_request?.whatsapp_status || 'SENT')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-slate-500 bg-slate-100 text-[10px] font-semibold border border-slate-200/70">
                            {v.status === 'completed' || isDateCrossed(v.visit_date)
                              ? 'Ready to Dispatch'
                              : 'Not Sent'}
                          </span>
                        )}
                      </td>

                      {/* Patient Review Status */}
                      <td className="px-4 py-4">
                        {isReviewed ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs ${
                              isPositiveGoogle
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/90'
                                : isNeutral
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200/90'
                                : 'bg-rose-50 text-rose-800 border border-rose-200/90'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                isPositiveGoogle
                                  ? 'text-emerald-600'
                                  : isNeutral
                                  ? 'text-indigo-600'
                                  : 'text-rose-600'
                              }`}
                            />
                            <span>Review Completed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200/60">
                            <span>Pending Review</span>
                          </span>
                        )}
                      </td>

                      {/* Rating Given (1 to 5 Stars with Google Review Badge) */}
                      <td className="px-6 py-4 text-right">
                        {isReviewed ? (
                          <div className="inline-flex items-center gap-2 justify-end">
                            {isPositiveGoogle ? (
                              <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200/90 px-3 py-1 rounded-full shadow-2xs">
                                <div className="flex items-center text-amber-500">
                                  {[...Array(rating)].map((_, i) => (
                                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  ))}
                                </div>
                                <span className="font-extrabold text-xs text-amber-950">
                                  {rating}.0
                                </span>
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                                  Google Review
                                </span>
                              </div>
                            ) : isNeutral ? (
                              <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full shadow-2xs">
                                <div className="flex items-center text-amber-500">
                                  {[...Array(3)].map((_, i) => (
                                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-500" />
                                  ))}
                                </div>
                                <span className="font-extrabold text-xs text-slate-900">
                                  3.0
                                </span>
                                <span className="text-[10px] font-bold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded-md">
                                  Neutral Feedback
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200/80 px-3 py-1 rounded-full shadow-2xs">
                                <div className="flex items-center text-rose-500">
                                  {[...Array(rating)].map((_, i) => (
                                    <Star key={i} className="w-3 h-3 fill-rose-400 text-rose-500" />
                                  ))}
                                </div>
                                <span className="font-extrabold text-xs text-rose-950">
                                  {rating}.0
                                </span>
                                <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                                  Apology Dispatched
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">—</span>
                        )}
                      </td>

                      {/* Delete Action */}
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => handleDeleteVisit(v.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete this consultation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Register New Patient Consultation ─────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Register New Patient Visit
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct entry for walk-in or offline consultations.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVisitSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananya Sen"
                  value={visitForm.patient_name}
                  onChange={(e) => setVisitForm({ ...visitForm, patient_name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Patient WhatsApp Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={visitForm.phone}
                  onChange={(e) => setVisitForm({ ...visitForm, phone: e.target.value })}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Medical Specialty
                  </label>
                  <select
                    value={visitForm.department}
                    onChange={(e) => setVisitForm({ ...visitForm, department: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium"
                  >
                    <option value="Cardiology">Cardiology</option>
                    <option value="General Medicine">General Medicine</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Gynecology">Gynecology</option>
                    <option value="Dentistry">Dentistry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Consulting Doctor
                  </label>
                  <input
                    type="text"
                    required
                    value={visitForm.doctor}
                    onChange={(e) => setVisitForm({ ...visitForm, doctor: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  id="consent"
                  checked={visitForm.whatsapp_consent}
                  onChange={(e) =>
                    setVisitForm({ ...visitForm, whatsapp_consent: e.target.checked })
                  }
                  className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="consent" className="text-xs text-slate-600 leading-snug cursor-pointer">
                  Patient gave consent to receive WhatsApp review invitations upon consultation completion.
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVisit}
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  {savingVisit ? 'Registering...' : 'Save & Register Consultation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Sheet Sync & Webhook Pipeline ──────────────────────── */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Spreadsheet Sync & Automation Webhook
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Accepts live patient rows from Google Sheets, Microsoft 365, or Make.com webhooks.
                </p>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Clinic API Authorization Key
                </label>
                <input
                  type="text"
                  value={syncApiKey}
                  onChange={(e) => setSyncApiKey(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 bg-slate-50 text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Incoming Rows JSON (Automated Payload)
                </label>
                <textarea
                  rows={7}
                  value={syncJson}
                  onChange={(e) => setSyncJson(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {syncResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    syncResult.rejected > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-primary-50 border-primary-200 text-primary-900'
                  }`}
                >
                  <p className="font-bold">
                    Sync Execution: {syncResult.accepted} Added/Updated, {syncResult.rejected} Skipped
                  </p>
                  {syncResult.errors.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 pt-1 text-[11px]">
                      {syncResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV Template</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSyncModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleRunSheetSync}
                    disabled={syncing}
                    className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                  >
                    {syncing ? 'Syncing...' : 'Execute Live Sync Test'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
