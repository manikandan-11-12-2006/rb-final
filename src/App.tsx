import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Auth / landing
import Login from './pages/auth/Login';

// Super Admin
import SuperAdminPanel from './pages/admin/SuperAdminPanel';

// Hospital & Staff Dashboard
import HospitalDashboard from './pages/staff/HospitalDashboard';
import AutomationDesk from './pages/desk/AutomationDesk';

// Staff ERP
import { StaffLayout } from './layouts/StaffLayout';
import FeedbackList from './pages/staff/FeedbackList';
import FeedbackDetail from './pages/staff/FeedbackDetail';
import Settings from './pages/staff/Settings';

// Standalone Feedback Module Directory (src/feedback/)
import FeedbackInterface from './feedback';

// Public Patient Review Flow (Step 13)
import PublicReviewPage from './pages/review/PublicReviewPage';
import { PatientLayout } from './layouts/PatientLayout';
import PatientFeedback from './pages/patient/PatientFeedback';
import FeedbackCompleted from './pages/patient/FeedbackCompleted';

// Sheet Sync Hub (Part A & B)
import SheetSyncHub from './pages/staff/SheetSyncHub';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Landing & Role Authentication (Step 3) ───────────────── */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* ── Dedicated Feedback Interface (Separated Folder) ───────── */}
          <Route path="/feedback-interface" element={<FeedbackInterface />} />
          <Route path="/feedback-interface/:token" element={<FeedbackInterface />} />
          <Route path="/feedback" element={<FeedbackInterface />} />

          {/* ── Public Patient Review Page ───────────────────────────── */}
          <Route path="/review" element={<FeedbackInterface />} />
          <Route path="/r/:token" element={<FeedbackInterface />} />

          {/* ── Automation Desk ──────────────────────────────────────── */}
          <Route path="/desk" element={<AutomationDesk />} />

          {/* ── Multi-Hospital Staff & Admin ERP ─────────────────────── */}
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<HospitalDashboard />} />
            <Route path="sheet-sync" element={<SheetSyncHub />} />
            <Route path="super-admin" element={<SuperAdminPanel />} />
            <Route path="feedback" element={<FeedbackList />} />
            <Route path="feedback/:id" element={<FeedbackDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* ── Legacy Patient feedback flow ──────────────────────────── */}
          <Route path="/patient" element={<PatientLayout />}>
            <Route path="feedback" element={<FeedbackInterface />} />
            <Route path="review/:id" element={<FeedbackInterface />} />
            <Route path="completed/:id" element={<FeedbackCompleted />} />
          </Route>

          {/* ── Catch-all ────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
