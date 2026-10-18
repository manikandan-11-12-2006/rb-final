import React, { useState } from 'react';
import { TambaramLogo } from '../components/TambaramLogo';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Settings as SettingsIcon,
  Menu,
  X,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Building2,
  ExternalLink,
  FileSpreadsheet,
  BadgeCheck,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function StaffLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const navigate = useNavigate();
  const {
    currentUser,
    currentHospital,
    role,
    isSuperAdmin,
    logout,
  } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Navigation items strictly tailored to the authenticated role
  const mainNavItems = [
    ...(isSuperAdmin
      ? [{ to: '/staff/super-admin', label: 'Super Admin Network', icon: ShieldCheck }]
      : []),
    {
      to: '/staff',
      label: 'Clinic Dashboard',
      icon: LayoutDashboard,
      end: true,
    },
    { to: '/staff/feedback', label: 'Reviews & Feedback', icon: MessageSquare },
  ];

  const automationNavItems = [
    { to: '/staff/sheet-sync', label: 'Spreadsheet Sync', icon: FileSpreadsheet },
  ];

  const handleCopyReviewLink = () => {
    const link = `${window.location.origin}/review?token=44444444-4444-4444-4444-444444444441`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-30 w-64 h-full bg-white border-r border-slate-200 flex flex-col shadow-sm shrink-0',
          'transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:static lg:translate-x-0',
        ].join(' ')}
        aria-label="Navigation"
      >
        {/* Hospital Branding Header */}
        <div className="flex items-center gap-3 px-5 h-20 border-b border-slate-100 shrink-0">
          {currentHospital?.logo && !isSuperAdmin && !currentHospital.logo.includes('photo-1586773860418-d37222d8fce3') ? (
            <img
              src={currentHospital.logo}
              alt={currentHospital.name}
              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              {currentHospital?.name ? currentHospital.name.charAt(0).toUpperCase() : <TambaramLogo className="w-6 h-6" />}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                {isSuperAdmin
                  ? 'RescueBridge Global'
                  : currentHospital?.name || 'Hospital Portal'}
              </p>
              {!isSuperAdmin && (
                <span title="Verified Clinic">
                  <BadgeCheck className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-none mt-1 truncate">
              {isSuperAdmin
                ? 'Super Admin Network'
                : `${currentHospital?.subdomain || 'portal'}.rescuebridge.com`}
            </p>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-slate-900 p-1"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {/* Main Navigation */}
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Overview & Care
            </p>
            <nav className="space-y-1">
              {mainNavItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => [
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all',
                    isActive
                      ? 'bg-primary-50 text-primary-800 font-bold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
                  ].join(' ')}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? 'text-primary-600' : 'text-slate-400'
                        }`}
                        aria-hidden
                      />
                      <span>{label}</span>
                      {isActive && (
                        <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary-600" aria-hidden />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Automations */}
          {automationNavItems.length > 0 && (
            <div>
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Automations & Sync
              </p>
              <nav className="space-y-1">
                {automationNavItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => [
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all',
                      isActive
                        ? 'bg-primary-50 text-primary-800 font-bold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
                    ].join(' ')}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive ? 'text-primary-600' : 'text-slate-400'
                          }`}
                          aria-hidden
                        />
                        <span>{label}</span>
                        {isActive && (
                          <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary-600" aria-hidden />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
          )}

          {/* Settings for Admins */}
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Preferences
            </p>
              <NavLink
                to="/staff/settings"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => [
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-primary-50 text-primary-800 font-bold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
                ].join(' ')}
              >
                {({ isActive }) => (
                  <>
                    <SettingsIcon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive ? 'text-primary-600' : 'text-slate-400'
                      }`}
                      aria-hidden
                    />
                    <span>Hospital Settings</span>
                  </>
                )}
              </NavLink>
            </div>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-500 capitalize truncate">
                {role === 'super_admin'
                  ? 'Super Administrator'
                  : role === 'hospital_admin'
                  ? 'Hospital Administrator'
                  : 'Front Desk Staff'}
              </p>
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main Content Area                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-slate-400 hover:text-slate-900 p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>

            {/* Breadcrumb / Status Badge */}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 border border-primary-200/60">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                WhatsApp Cloud Automation Active
              </span>
            </div>
          </div>

          {/* Quick Actions & User Bar */}
          <div className="flex items-center gap-3">

            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">
                {currentUser?.email}
              </p>
            </div>

            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 text-xs font-semibold rounded-lg transition-all"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content View */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
