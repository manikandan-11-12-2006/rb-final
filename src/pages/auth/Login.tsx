import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Brain,
  Lock,
  Building2,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Database,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Zap,
  Globe,
  Image as ImageIcon,
  Mail,
  CheckCircle2,
  UploadCloud,
  X,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';
import { Hospital } from '../../types/database';

export default function Login() {
  const navigate = useNavigate();
  const { currentUser, isSuperAdmin, login, switchUserRole, refreshHospitals } = useAuth();

  // Navigation mode:
  // 'selection' -> First screen matching Image 1 with the role cards
  // 'admin' | 'hospital' -> Second screen matching Image 2 with the login form
  // 'onboard' -> Onboard new hospital tab
  const [selectedRole, setSelectedRole] = useState<'selection' | 'admin' | 'hospital'>('selection');
  const [activeTab, setActiveTab] = useState<'signin' | 'onboard'>('signin');

  const [availableHospitals, setAvailableHospitals] = useState<Hospital[]>([]);
  const [hospitalNameInput, setHospitalNameInput] = useState<string>('');

  // Form inputs (Empty by default - no dummy values)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin Login specific inputs (Email ID, Create Password, Re-enter Password)
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [adminConfirmBlurred, setAdminConfirmBlurred] = useState(false);

  // Admin password matching status
  const adminPasswordsMatch = Boolean(
    adminPassword &&
    adminConfirmPassword &&
    adminPassword === adminConfirmPassword
  );

  const showAdminMismatch = Boolean(
    adminConfirmPassword &&
    adminPassword !== adminConfirmPassword &&
    (adminConfirmBlurred || adminConfirmPassword.length >= adminPassword.length)
  );

  const showAdminSkipped = Boolean(
    adminConfirmBlurred &&
    !adminConfirmPassword &&
    adminPassword
  );

  // Onboarding Form
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminConfirmPassword, setNewAdminConfirmPassword] = useState('');
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newSubdomain, setNewSubdomain] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [logoFileName, setLogoFileName] = useState('');
  const [newGoogleReviewUrl, setNewGoogleReviewUrl] = useState('');
  const [onboardLoading, setOnboardLoading] = useState(false);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image file is too large. Please select an image under 10MB.');
        return;
      }
      setLogoFileName(file.name);
      setError(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result;
        if (typeof src !== 'string') return;

        // Automatically compress and resize client-side to ensure lightweight storage
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setNewLogoUrl(compressedDataUrl);
          } else {
            setNewLogoUrl(src);
          }
        };
        img.onerror = () => {
          setNewLogoUrl(src);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  };

  const [confirmPasswordBlurred, setConfirmPasswordBlurred] = useState(false);

  // Real-time password matching status
  const passwordsMatch = Boolean(
    newAdminPassword &&
    newAdminConfirmPassword &&
    newAdminPassword === newAdminConfirmPassword
  );

  // Show mismatch only after full length entered or after moving to the next field
  const showMismatchError = Boolean(
    newAdminConfirmPassword &&
    newAdminPassword !== newAdminConfirmPassword &&
    (confirmPasswordBlurred || newAdminConfirmPassword.length >= newAdminPassword.length)
  );

  // Show skipped warning if user skips the confirm password field
  const showSkippedWarning = Boolean(
    confirmPasswordBlurred &&
    !newAdminConfirmPassword &&
    newAdminPassword
  );

  const handleHospitalNameChange = (val: string) => {
    setNewHospitalName(val);
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    setNewSubdomain(slug);
  };

  // Load hospitals for validation
  useEffect(() => {
    async function load() {
      const list = await db.getHospitals();
      setAvailableHospitals(list);
    }
    load();
  }, []);

  // Reset fields when role changes (no dummy values)
  useEffect(() => {
    setError(null);
    setEmail('');
    setPassword('');
    setAdminEmail('');
    setAdminPassword('');
    setAdminConfirmPassword('');
    setAdminConfirmBlurred(false);
    setHospitalNameInput('');
  }, [selectedRole]);

  // If already authenticated, redirect straight to their dashboard
  if (currentUser) {
    if (isSuperAdmin) {
      return <Navigate to="/staff/super-admin" replace />;
    }
    return <Navigate to="/staff" replace />;
  }

  // Handle Login Submit - Simply verify email and password
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim();
      const ok = await login(cleanEmail, password);

      if (!ok) {
        const allUsers = await db.getUsers();
        const userExists = allUsers.find(
          (u) => u.email.toLowerCase() === cleanEmail.toLowerCase()
        );
        if (userExists) {
          setError('Incorrect password. Please verify and try again.');
        } else {
          setError(`No account found for "${cleanEmail}". Please check your email or onboard your hospital.`);
        }
        setLoading(false);
        return;
      }

      // Login success: route based on user role
      const allUsers = await db.getUsers();
      const matched = allUsers.find((u) => u.email.toLowerCase() === cleanEmail.toLowerCase());
      if (matched?.role === 'super_admin') {
        navigate('/staff/super-admin');
      } else {
        navigate('/staff');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Login Submit (Admin Email ID, Create Password, Re-enter Password)
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = adminEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your Admin Email ID.');
      return;
    }
    if (!adminPassword || adminPassword.length < 6) {
      setError('Create password must be at least 6 characters long.');
      return;
    }
    if (adminPassword !== adminConfirmPassword) {
      setError('Passwords do not match. Please re-enter the same password.');
      return;
    }

    setLoading(true);
    try {
      // 1. Check or upsert super_admin user credentials in database
      await db.createUser({
        hospital_id: null,
        name: 'Super Admin',
        email: cleanEmail,
        password_hash: adminPassword,
        role: 'super_admin',
      });

      // 2. Authenticate session
      const ok = await login(cleanEmail, adminPassword);
      if (ok) {
        navigate('/staff/super-admin');
      } else {
        setError('Failed to authenticate admin session. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle Onboarding Submit
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = newAdminEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter the hospital official email.');
      return;
    }
    if (!newAdminPassword) {
      setError('Please create a password for your hospital admin account.');
      return;
    }
    if (newAdminPassword.length < 6) {
      setError('Create password must be at least 6 characters long.');
      return;
    }
    if (!newAdminConfirmPassword) {
      setError('Please re-enter your password to confirm.');
      return;
    }
    if (newAdminPassword !== newAdminConfirmPassword) {
      setError('Passwords do not match. Please re-enter the same password to confirm.');
      return;
    }
    if (!newHospitalName.trim()) {
      setError('Please enter the hospital name.');
      return;
    }

    let cleanWebsite = newWebsite.trim();
    if (cleanWebsite && !cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
      cleanWebsite = 'https://' + cleanWebsite;
    }

    let cleanReviewUrl = newGoogleReviewUrl.trim();
    if (cleanReviewUrl && !cleanReviewUrl.startsWith('http://') && !cleanReviewUrl.startsWith('https://')) {
      cleanReviewUrl = 'https://' + cleanReviewUrl;
    }
    if (!cleanReviewUrl) {
      cleanReviewUrl = 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4';
    }

    const cleanSubdomain =
      newSubdomain.trim().toLowerCase() ||
      newHospitalName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') ||
      'hospital';

    setOnboardLoading(true);

    try {
      // 1. Create Hospital in database (generates unique hospital ID & unique subdomain)
      const createdHospital = await db.createHospital({
        name: newHospitalName.trim(),
        subdomain: cleanSubdomain,
        website: cleanWebsite || undefined,
        logo: newLogoUrl.trim() || undefined,
        google_place_id: cleanReviewUrl,
        sheet_id: 'sheet_' + cleanSubdomain,
        sheet_type: 'google_sheets',
        whatsapp_template_name: 'patient_review_v1',
      });

      // 2. Create or link the Hospital Administrator user account with password
      await db.createUser({
        hospital_id: createdHospital.id,
        name: `${createdHospital.name} Admin`,
        email: cleanEmail,
        password_hash: newAdminPassword,
        role: 'hospital_admin',
      });

      // 3. Refresh hospitals list in AuthContext so the new hospital is instantly loaded
      await refreshHospitals();

      // 4. Immediately log in with the newly created credentials
      const ok = await login(cleanEmail, newAdminPassword);
      if (ok) {
        navigate('/staff');
      } else {
        await switchUserRole('hospital_admin', createdHospital.id);
        navigate('/staff');
      }
    } catch (err: any) {
      console.error('Onboarding failure:', err);
      setError(err.message || 'Failed to onboard hospital');
    } finally {
      setOnboardLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.12),rgba(255,255,255,0))] relative overflow-x-hidden flex flex-col justify-between">
      {/* ── Ambient Background Lighting Effects ── */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-20 right-1/4 w-96 h-96 bg-primary-400/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-10 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/70 flex items-center justify-between px-6 shrink-0 shadow-xs z-10 sticky top-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Brain className="h-4 w-4 text-primary-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-none">RescueBridge</p>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">
              Multi-Hospital Review Infrastructure
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200/80 shadow-xs">
            <Database className="h-3 w-3" />
            Strict Multi-Tenant Isolation
          </div>

          <button
            onClick={() => navigate('/desk')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs active:translate-y-0.5"
          >
            <Zap className="h-3 w-3 text-primary-400" />
            Automation Desk
          </button>
        </div>
      </header>

      {/* ── Main Hero & Content Area ───────────────────────────────── */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 my-auto z-10">
        {/* Title Header (Positive theme matching Image 2) */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 bg-primary-50 border border-primary-200 text-primary-700 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full mb-3.5 shadow-xs">
            <Zap className="w-3.5 h-3.5 text-primary-600" />
            Centralised Multi-Hospital Review Platform
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Automate 5★ Patient Reviews <br />
            <span className="bg-gradient-to-r from-primary-600 to-primary-600 bg-clip-text text-transparent">
              for Any Hospital via WhatsApp
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-500 max-w-2xl mx-auto mt-3 leading-relaxed">
            RescueBridge is a centralised infrastructure hub. Select your hospital portal below to manage automated patient reviews, WhatsApp dispatches, and 5-star Google Maps growth.
          </p>
        </div>

        {/* Tab Selector (Sign In vs Onboard) */}
        {selectedRole === 'selection' && (
          <div className="flex justify-center mb-10">
            <div className="bg-slate-200/70 p-1.5 rounded-2xl inline-flex gap-1.5 shadow-inner backdrop-blur-xs">
              <button
                type="button"
                onClick={() => setActiveTab('signin')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'signin'
                    ? 'bg-white text-slate-900 shadow-md shadow-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In with Account Role
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('onboard')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'onboard'
                    ? 'bg-white text-slate-900 shadow-md shadow-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Onboard New Hospital
              </button>
            </div>
          </div>
        )}

        {/* ── View 1: 2 Role Cards with Purely White Outer Layer & Distinct Colors ───── */}
        {selectedRole === 'selection' && activeTab === 'signin' && (
          <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6 lg:gap-8 items-stretch">
            {/* 1. Admin Login Card (Royal Blue) */}
            <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                {/* Royal Blue Icon */}
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-5 shadow-sm shadow-blue-600/20">
                  <ShieldCheck className="w-7 h-7" />
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Admin Login</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                    Network
                  </span>
                </div>

                <p className="text-xs font-bold text-blue-700 mt-1">
                  Platform Controller (All Hospitals)
                </p>

                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  Super admin portal with global access. Manages all partner hospitals, sheet sync pipelines, and global review automations.
                </p>
              </div>

              {/* Royal Blue Button */}
              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                className="mt-7 w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 transition-all"
              >
                <span>Enter as Admin</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Hospital Login Card (Emerald Green) */}
            <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                {/* Emerald Green Icon */}
                <div className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center mb-5 shadow-sm shadow-primary-600/20">
                  <Building2 className="w-7 h-7" />
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Hospital Login</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-800 border border-primary-200/80 shadow-xs">
                    ★ Primary
                  </span>
                </div>

                <p className="text-xs font-bold text-primary-700 mt-1">
                  Handles Their Hospital Only
                </p>

                <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                  Hospital management portal. View and handle review funnels, WhatsApp dispatches, and private low-rating alerts for your clinic only.
                </p>
              </div>

              {/* Emerald Green Button */}
              <button
                type="button"
                onClick={() => setSelectedRole('hospital')}
                className="mt-7 w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-primary-600/20 transition-all"
              >
                <span>Enter as Hospital Admin</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── View 2: Login Box for Selected Role (Matching Professional Theme) */}
        {selectedRole !== 'selection' && (
          <div className="max-w-md mx-auto w-full animate-slide-up">
            {/* Back Button */}
            <button
              type="button"
              onClick={() => setSelectedRole('selection')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 mb-4 transition-colors p-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Role Selection
            </button>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
              {/* Card Header */}
              <div className="p-6 sm:p-7 border-b border-slate-100 flex items-start gap-3.5">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    selectedRole === 'admin'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-primary-50 text-primary-700'
                  }`}
                >
                  {selectedRole === 'admin' && <ShieldCheck className="w-6 h-6" />}
                  {selectedRole === 'hospital' && <Building2 className="w-6 h-6" />}
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {selectedRole === 'admin' && 'Admin Login (All Hospitals Overview & Control)'}
                    {selectedRole === 'hospital' && 'Hospital Login (Single Hospital Isolated)'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {selectedRole === 'admin' &&
                      'Super admin global portal. Enter your Admin Email ID and password to access the review system overview for all registered hospitals.'}
                    {selectedRole === 'hospital' &&
                      'Manage reviews and automations in your hospital only. Other hospital details are completely hidden.'}
                  </p>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-6 sm:p-7">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* ── ADMIN LOGIN FORM: Email ID, Create Password, Re-enter Password ── */}
                {selectedRole === 'admin' ? (
                  <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Admin Email ID *
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="admin@hospital.com"
                          className="w-full text-xs rounded-xl border border-slate-300 p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Create Password *
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          placeholder="Enter your admin password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Minimum 6 characters</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Re-enter Password *
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          placeholder="Re-enter password to confirm"
                          value={adminConfirmPassword}
                          onChange={(e) => setAdminConfirmPassword(e.target.value)}
                          onBlur={() => setAdminConfirmBlurred(true)}
                          className={`w-full text-xs rounded-xl border p-3 pr-10 focus:outline-none transition-all ${
                            adminPasswordsMatch
                              ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/20'
                              : showAdminMismatch
                              ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20'
                              : 'border-slate-300 focus:ring-2 focus:ring-blue-600'
                          }`}
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* Real-time Match Feedback */}
                      {adminPasswordsMatch && (
                        <p className="text-[11px] text-primary-600 font-semibold mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Passwords match
                        </p>
                      )}
                      {showAdminMismatch && (
                        <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Passwords do not match. Please re-enter the same password.
                        </p>
                      )}
                      {showAdminSkipped && (
                        <p className="text-[11px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Please re-enter your password to confirm.
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        !adminEmail.trim() ||
                        !adminPassword.trim() ||
                        adminPassword.length < 6 ||
                        adminPassword !== adminConfirmPassword
                      }
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        'Signing in...'
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Enter Admin Global Controller</span>
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Hospital Admin Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@hospital.com"
                        className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Password *
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full text-xs rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !email.trim() || !password.trim()}
                      className="w-full py-3.5 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                    >
                      {loading ? (
                        'Signing in...'
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Sign In to Hospital Portal</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── View 3: Onboard New Hospital Tab ───────────────────────── */}
        {selectedRole === 'selection' && activeTab === 'onboard' && (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-xl mx-auto animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-primary-600" />
              <h2 className="text-base font-bold text-slate-900">
                Register New Partner Hospital
              </h2>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              {/* 1. Official Admin Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Official Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. admin@apollohospital.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  This will be your administrative login email when you sign in.
                </p>
              </div>

              {/* 2. Create Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Create Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Enter password (minimum 6 characters)"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* 3. Re-enter Password (in next line) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Re-enter Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Re-enter your password to confirm"
                    value={newAdminConfirmPassword}
                    onChange={(e) => setNewAdminConfirmPassword(e.target.value)}
                    onBlur={() => setConfirmPasswordBlurred(true)}
                    className={`w-full text-xs rounded-xl border pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 ${
                      showMismatchError || showSkippedWarning
                        ? 'border-red-300 focus:ring-red-500'
                        : passwordsMatch
                        ? 'border-primary-400 focus:ring-primary-500'
                        : 'border-slate-300 focus:ring-primary-500'
                    }`}
                  />
                </div>
                {passwordsMatch && (
                  <p className="text-[11px] text-primary-600 font-medium mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary-600" />
                    Passwords match
                  </p>
                )}
                {showMismatchError && (
                  <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    Passwords do not match
                  </p>
                )}
                {showSkippedWarning && (
                  <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    Please re-enter your password to confirm
                  </p>
                )}
              </div>

              {/* 4. Hospital Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apollo Hospital, Chennai"
                  value={newHospitalName}
                  onChange={(e) => handleHospitalNameChange(e.target.value)}
                  onFocus={() => {
                    if (newAdminPassword && !newAdminConfirmPassword) {
                      setConfirmPasswordBlurred(true);
                    }
                  }}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 5. Hospital Official Website */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Hospital Website URL
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="https://www.apollohospitals.com"
                    value={newWebsite}
                    onChange={(e) => setNewWebsite(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* 6. Google Review URL (Corrected: not Google Maps URL) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Google Review URL *
                  </label>
                  <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    Direct Review Link (Not Google Maps link)
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="https://search.google.com/local/writereview?placeid=... or https://g.page/r/.../review"
                  value={newGoogleReviewUrl}
                  onChange={(e) => setNewGoogleReviewUrl(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Patients receiving WhatsApp messages will be directed to this link to leave a 5-star review.
                </p>
              </div>

              {/* 7. Hospital Logo Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital Logo (Upload Image)
                </label>
                <div className="space-y-3">
                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-2xl p-4 bg-slate-50/70 hover:bg-primary-50/30 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 group-hover:border-primary-300 flex items-center justify-center text-slate-500 group-hover:text-primary-600 shadow-xs">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-700 group-hover:text-primary-700">
                          {logoFileName ? logoFileName : 'Click or browse to upload hospital logo image'}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          PNG, JPG, SVG, WEBP (Max 10MB)
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                  </label>

                  {newLogoUrl && (
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden bg-white p-1 flex items-center justify-center shadow-xs">
                          <img
                            src={newLogoUrl}
                            alt="Uploaded Logo preview"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {logoFileName || 'Hospital Logo'}
                          </p>
                          <p className="text-[10px] text-primary-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Image uploaded successfully
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewLogoUrl('');
                          setLogoFileName('');
                        }}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
                        title="Remove uploaded logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={onboardLoading}
                className="w-full mt-4 py-3.5 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {onboardLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registering Hospital & Logging in...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span>Create Hospital & Log In</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200">
        RescueBridge Multi-Hospital Architecture • Admin Manages All • Hospitals Handle Only Their Own
      </footer>
    </div>
  );
}
