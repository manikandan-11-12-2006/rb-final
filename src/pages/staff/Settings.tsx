import React, { useState, useEffect } from 'react';
import {
  Building2,
  Star,
  MessageSquare,
  Info,
  CheckCircle,
  Upload,
  Trash2,
  Globe,
  Mail,
  Camera,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ToastContainer } from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/db';

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
        <span className="p-2 bg-primary-50 rounded-lg text-primary-600">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Integration status row
// ---------------------------------------------------------------------------
function IntegrationRow({
  name,
  description,
  status,
}: {
  name: string;
  description: string;
  status: 'connected' | 'pending' | 'not_connected';
}) {
  const variant =
    status === 'connected' ? 'success' : status === 'pending' ? 'warning' : 'neutral';
  const label =
    status === 'connected' ? 'Connected' : status === 'pending' ? 'Integration pending' : 'Not connected';

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-800">{name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <Badge variant={variant} dot>{label}</Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Settings() {
  const { toasts, addToast, removeToast } = useToast();
  const { currentHospital, currentUser, refreshHospitals } = useAuth();

  const [clinicName, setClinicName] = useState(currentHospital?.name || '');
  const [adminEmail, setAdminEmail] = useState(
    currentUser?.email || currentHospital?.admin_email || ''
  );
  const [website, setWebsite] = useState(
    currentHospital?.website || currentHospital?.subdomain || ''
  );
  const [phone, setPhone] = useState(currentHospital?.phone || '');
  const [logo, setLogo] = useState(currentHospital?.logo || '');
  const [reviewUrl, setReviewUrl] = useState(
    currentHospital?.google_review_url || currentHospital?.google_place_id || ''
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentHospital) {
      setClinicName(currentHospital.name || '');
      setWebsite(currentHospital.website || currentHospital.subdomain || '');
      setPhone(currentHospital.phone || '');
      setLogo(currentHospital.logo || '');
      setReviewUrl(
        currentHospital.google_review_url || currentHospital.google_place_id || ''
      );
    }
    if (currentUser) {
      setAdminEmail(currentUser.email || '');
    }
  }, [currentHospital, currentUser]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        addToast('Logo image must be smaller than 2 MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setLogo(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (currentHospital?.id) {
        await db.updateHospital(currentHospital.id, {
          name: clinicName.trim(),
          website: website.trim(),
          phone: phone.trim(),
          logo: logo.trim() || undefined,
          google_place_id: reviewUrl.trim(),
          google_review_url: reviewUrl.trim(),
        });
        await refreshHospitals();
      }
      addToast('Settings saved successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure your clinic details and integration endpoints.
        </p>
      </div>

      {/* Clinic Information */}
      <Section
        icon={<Building2 className="h-4 w-4" />}
        title="Clinic Information"
        subtitle="Displayed across the patient-facing experience"
      >
        <div className="space-y-4">
          <Input
            label="Clinic Name"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="Hospital / Clinic Name"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Hospital Official Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={adminEmail}
                readOnly
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-600 font-mono cursor-not-allowed"
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Account Email
              </span>
            </div>
          </div>

          <Input
            label="Official Website URL"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourhospital.com"
            hint="Official website registered during onboarding."
          />

          <Input
            label="Clinic Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            hint="Displayed in patient communications."
          />

          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1.5">Clinic Logo</p>
            {logo ? (
              <div className="flex items-center gap-4 p-4 border border-slate-200 rounded-2xl bg-slate-50/60">
                <img
                  src={logo}
                  alt="Clinic Logo"
                  className="h-16 w-16 object-contain rounded-xl border border-slate-200 bg-white p-1 shadow-xs"
                />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-100 transition-colors shadow-xs">
                      <Camera className="w-3.5 h-3.5 text-primary-600" />
                      <span>Change Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setLogo('')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    PNG, SVG, or JPG image saved directly to your clinic profile.
                  </p>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-2xl p-6 text-center block cursor-pointer bg-slate-50/40 hover:bg-primary-50/20 transition-all">
                <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  Click to upload clinic logo
                </p>
                <p className="text-[10px] text-slate-400 mt-1">PNG, JPG or SVG, max 2 MB</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </Section>

      {/* Google Review */}
      <Section
        icon={<Star className="h-4 w-4" />}
        title="Google Review"
        subtitle="Where patients are redirected after positive feedback"
      >
        <Input
          label="Google Review URL"
          value={reviewUrl}
          onChange={(e) => setReviewUrl(e.target.value)}
          placeholder="https://search.google.com/local/writereview?placeid=…"
          hint="Google review link entered during onboarding. High-rating patients are redirected here."
        />
        <div className="mt-3 flex items-start gap-2 bg-primary-50 border border-primary-200 rounded-xl px-3 py-2.5">
          <Info className="h-4 w-4 text-primary-600 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-primary-800">
            Patients who rate 4 or 5 stars will be directly invited to copy their review and publish it to this Google review URL.
          </p>
        </div>
      </Section>

      {/* Messaging */}
      <Section
        icon={<MessageSquare className="h-4 w-4" />}
        title="Messaging"
        subtitle="WhatsApp Business API configuration"
      >
        <div className="space-y-1">
          <IntegrationRow
            name="WhatsApp Business API"
            description="Meta Cloud API / Interakt / AiSensy"
            status="not_connected"
          />
          <div className="pt-2">
            <Input
              label="Sender Number"
              type="tel"
              placeholder="+91 99999 00000"
              disabled
              hint="Configure after WhatsApp Business API is connected."
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          WhatsApp integration is scheduled for a future phase. The frontend is structured to receive patient feedback via backend webhook once connected.
        </p>
      </Section>


      {/* Save */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          icon={saving ? undefined : <CheckCircle className="h-4 w-4" />}
          loading={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
