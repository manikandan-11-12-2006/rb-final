import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  Users,
  CheckCircle,
  AlertCircle,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Star,
  RefreshCw,
  Globe,
  Mail,
  Send,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { db } from '../../services/db';
import { Hospital, SheetType } from '../../types/database';

interface HospitalReviewMetrics {
  visits: number;
  completed: number;
  reviews: number;
  avgRating: number;
  positiveCount: number;
  negativeCount: number;
}

export default function SuperAdminPanel() {
  const { isSuperAdmin, hospitals, switchHospital, refreshHospitals } = useAuth();
  const navigate = useNavigate();

  if (!isSuperAdmin) {
    return <Navigate to="/staff" replace />;
  }
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allRegisteredHospitals, setAllRegisteredHospitals] = useState<Hospital[]>([]);
  const [hospitalStats, setHospitalStats] = useState<Record<string, HospitalReviewMetrics>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    google_place_id: '',
    sheet_id: '',
    sheet_type: 'google_sheets' as SheetType,
    logo: '',
    whatsapp_template_name: 'patient_review_v1',
    admin_name: '',
    admin_email: '',
  });
  const [saving, setSaving] = useState(false);

  // Load all registered hospitals and their review system metrics
  const loadStats = async () => {
    setRefreshing(true);
    try {
      const list = await db.getHospitals();
      setAllRegisteredHospitals(list);

      const stats: Record<string, HospitalReviewMetrics> = {};
      for (const h of list) {
        const visits = await db.getVisits(h.id);
        const reviews = visits
          .map((v) => v.review_request?.rating)
          .filter((r): r is number => typeof r === 'number');
        const avg = reviews.length > 0 ? reviews.reduce((a, b) => a + b, 0) / reviews.length : 0;
        const positiveCount = reviews.filter((r) => r >= 4).length;
        const negativeCount = reviews.filter((r) => r < 4).length;
        const completed = visits.filter((v) => v.status === 'completed' || v.patient?.review_sent).length;

        stats[h.id] = {
          visits: visits.length,
          completed,
          reviews: reviews.length,
          avgRating: Number(avg.toFixed(1)),
          positiveCount,
          negativeCount,
        };
      }
      setHospitalStats(stats);
    } catch (err) {
      console.error('Failed to load hospital review overview:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [hospitals]);

  const handleCreateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.subdomain.trim()) return;

    setSaving(true);
    try {
      await db.createHospital(
        {
          name: formData.name.trim(),
          subdomain: formData.subdomain.trim().toLowerCase(),
          google_place_id: formData.google_place_id.trim() || 'ChIJN1t_tDeuEmsRUsoyG83frY4',
          sheet_id: formData.sheet_id.trim() || 'demo_sheet_id',
          sheet_type: formData.sheet_type,
          logo: formData.logo.trim() || 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=128&q=80',
          whatsapp_template_name: formData.whatsapp_template_name || 'patient_review_v1',
        },
        formData.admin_email
          ? {
              name: formData.admin_name || `${formData.name} Admin`,
              email: formData.admin_email.trim(),
            }
          : undefined
      );

      await refreshHospitals();
      setShowAddModal(false);
      setFormData({
        name: '',
        subdomain: '',
        google_place_id: '',
        sheet_id: '',
        sheet_type: 'google_sheets',
        logo: '',
        whatsapp_template_name: 'patient_review_v1',
        admin_name: '',
        admin_email: '',
      });
    } catch (err) {
      console.error('Failed to create hospital:', err);
    } finally {
      setSaving(false);
    }
  };

  const filteredHospitals = allRegisteredHospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.website && h.website.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (h.admin_email && h.admin_email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalNetworkVisits = Object.values(hospitalStats).reduce((acc, curr) => acc + curr.visits, 0);
  const totalNetworkCompleted = Object.values(hospitalStats).reduce((acc, curr) => acc + curr.completed, 0);
  const totalNetworkReviews = Object.values(hospitalStats).reduce((acc, curr) => acc + curr.reviews, 0);
  const totalNetworkPositive = Object.values(hospitalStats).reduce((acc, curr) => acc + curr.positiveCount, 0);
  const totalNetworkNegative = Object.values(hospitalStats).reduce((acc, curr) => acc + curr.negativeCount, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-900 text-blue-400 rounded-xl shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Super Admin Multi-Hospital Controller
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global overview of all registered partner hospitals, automated WhatsApp review pipelines, and Google 5-star growth metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadStats}
            disabled={refreshing}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            title="Refresh Hospital Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 hover:from-slate-800 hover:to-blue-900 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4 text-blue-300" />
            Add New Hospital
          </button>
        </div>
      </div>

      {/* Global Stat Cards: Review System Network Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Registered Hospitals
          </p>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {allRegisteredHospitals.length}
          </p>
          <p className="text-xs text-blue-700 font-medium mt-1">
            Multi-Tenant Isolation Active
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Patient Consultations
          </p>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {totalNetworkVisits}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {totalNetworkCompleted} WhatsApp review invitations dispatched
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Patient Reviews Received
          </p>
          <p className="text-2xl font-black text-primary-600 mt-2">
            {totalNetworkReviews}
          </p>
          <p className="text-xs text-primary-700 font-semibold mt-1">
            {totalNetworkPositive} 5★ Google reviews generated
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Private Care Intercepts
          </p>
          <p className="text-2xl font-black text-amber-600 mt-2">
            {totalNetworkNegative}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Negative feedback (&lt;3★) kept private for hospital care
          </p>
        </div>
      </div>

      {/* Hospital List Table with Complete Review System Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">
              Registered Hospitals Review System Overview
            </h2>
            <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
              {filteredHospitals.length} Hospitals
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by hospital, website, or admin..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Hospital Profile & Contact</th>
                <th className="px-4 py-3.5">Review Integration Setup</th>
                <th className="px-4 py-3.5">Consultations</th>
                <th className="px-4 py-3.5">Reviews & Actual Rating</th>
                <th className="px-4 py-3.5">Pipeline Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHospitals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                    No registered hospitals match your search.
                  </td>
                </tr>
              ) : (
                filteredHospitals.map((h) => {
                  const stat = hospitalStats[h.id] || {
                    visits: 0,
                    completed: 0,
                    reviews: 0,
                    avgRating: 0,
                    positiveCount: 0,
                    negativeCount: 0,
                  };
                  return (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* 1. Hospital Profile & Contact */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          {h.logo ? (
                            <img
                              src={h.logo}
                              alt={h.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                              {h.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{h.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {h.subdomain}.rescuebridge.com
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {h.website && (
                                <a
                                  href={h.website.startsWith('http') ? h.website : `https://${h.website}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                                >
                                  <Globe className="w-3 h-3" />
                                  <span>{h.website.replace(/^https?:\/\//, '')}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                              {h.admin_email && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{h.admin_email}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Review Integration Setup */}
                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-primary-600" />
                            <span>
                              {h.sheet_type === 'google_sheets' ? 'Google Sheets' : 'Microsoft Excel'}
                            </span>
                          </div>
                          {h.google_review_url ? (
                            <div>
                              <a
                                href={h.google_review_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Google Review Link</span>
                              </a>
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                              Place ID: {h.google_place_id || 'Configured'}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Send className="w-3 h-3 text-primary-600" />
                            <span>WhatsApp: 1-Time delivery</span>
                          </p>
                        </div>
                      </td>

                      {/* 3. Consultations */}
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900 text-xs">
                          {stat.visits} Total Visits
                        </p>
                        <p className="text-[11px] text-primary-700 font-semibold mt-0.5">
                          {stat.completed} Dispatched
                        </p>
                        {stat.visits - stat.completed > 0 && (
                          <p className="text-[10px] text-amber-600 mt-0.5">
                            {stat.visits - stat.completed} Pending Review
                          </p>
                        )}
                      </td>

                      {/* 4. Reviews & Actual Rating */}
                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3.5 h-3.5 ${
                                    star <= Math.round(stat.avgRating)
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="font-extrabold text-slate-900 text-xs">
                              {stat.avgRating > 0 ? stat.avgRating : '—'}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              ({stat.reviews} reviews)
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1 text-[10px]">
                            {stat.positiveCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 font-semibold">
                                {stat.positiveCount} 4-5★ Google
                              </span>
                            )}
                            {stat.negativeCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                {stat.negativeCount} Private Alerts
                              </span>
                            )}
                            {stat.reviews === 0 && (
                              <span className="text-slate-400">Awaiting ratings</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Pipeline Status */}
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                          <span>Active Live Sync</span>
                        </span>
                      </td>

                      {/* 6. Action */}
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={async () => {
                            await switchHospital(h.id);
                            navigate('/staff');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
                        >
                          <span>Manage Dashboard</span>
                          <ArrowRight className="w-3.5 h-3.5" />
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

      {/* Add New Hospital Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Onboard New Hospital</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-tenant isolation with dedicated Place ID and automated sheet sync.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHospital} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Official Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Care Multi-Specialty Hospital"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subdomain Slug *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. metrocare"
                    value={formData.subdomain}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      })
                    }
                    className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sheet Type
                  </label>
                  <select
                    value={formData.sheet_type}
                    onChange={(e) =>
                      setFormData({ ...formData, sheet_type: e.target.value as SheetType })
                    }
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
                  >
                    <option value="google_sheets">Google Sheets</option>
                    <option value="excel_365">Excel 365 / OneDrive</option>
                    <option value="manual">Manual Entry Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Maps Place ID (for 5-Star Reviews)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
                  value={formData.google_place_id}
                  onChange={(e) => setFormData({ ...formData, google_place_id: e.target.value })}
                  className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Logo URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* First Hospital Admin Creation */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary-600" />
                  First Hospital Admin Login (Step 4)
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Admin Full Name"
                    value={formData.admin_name}
                    onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="admin@hospital.com"
                    value={formData.admin_email}
                    onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  {saving ? 'Creating Hospital...' : 'Complete Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
