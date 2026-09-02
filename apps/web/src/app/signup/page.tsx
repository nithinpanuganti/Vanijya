'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useLanguage } from '../../lib/language-context';
import { useToast } from '../../components/ui/toast';
import { PhotoCapture } from '../../components/common/photo-capture';
import { LocationCapture } from '../../components/common/location-capture';
import {
  Sprout,
  Building2,
  UserPlus,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Clock,
  Lock,
  Phone,
  Mail,
  MapPin,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Camera,
  Navigation,
} from 'lucide-react';

type AccountPersona = 'FARMER' | 'BUYER';

export default function UnifiedSignupPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  // Workflow Steps: 'SELECT_PERSONA' -> 'FILL_FORM' -> 'SUBMITTED'
  const [step, setStep] = useState<'SELECT_PERSONA' | 'FILL_FORM' | 'SUBMITTED'>('SELECT_PERSONA');
  const [persona, setPersona] = useState<AccountPersona>('FARMER');

  // Common Identity Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('Nashik');
  const [location, setLocation] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(language);

  // Photo and Geolocation State
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [geoCoordinates, setGeoCoordinates] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);

  // Farmer Specific Fields
  const [village, setVillage] = useState('');
  const [primaryCrop, setPrimaryCrop] = useState('Tomato');
  const [farmSize, setFarmSize] = useState('5.0');
  const [kccNumber, setKccNumber] = useState('');
  const [apmcLicense, setApmcLicense] = useState('');

  // Buyer Specific Fields
  const [organization, setOrganization] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [businessType, setBusinessType] = useState('Wholesale Trader / Processor');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [gstin, setGstin] = useState('');
  const [fssai, setFssai] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null);

  // Password Strength Evaluation
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

  const rulesPassed = [hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  let strengthLabel = t.passwordStrengthWeak;
  let strengthColor = 'bg-rose-500';
  let strengthPercent = 20;

  if (rulesPassed >= 5) {
    strengthLabel = t.passwordStrengthStrong;
    strengthColor = 'bg-emerald-500';
    strengthPercent = 100;
  } else if (rulesPassed >= 4) {
    strengthLabel = t.passwordStrengthMedium;
    strengthColor = 'bg-amber-500';
    strengthPercent = 80;
  } else if (rulesPassed >= 3) {
    strengthLabel = t.passwordStrengthMedium;
    strengthColor = 'bg-amber-400';
    strengthPercent = 60;
  } else if (rulesPassed >= 2) {
    strengthLabel = t.passwordStrengthWeak;
    strengthColor = 'bg-rose-400';
    strengthPercent = 40;
  }

  const isPasswordValid = rulesPassed >= 5;
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isPasswordValid) {
      setErrorMessage(t.passwordRuleNotice);
      showToast(t.passwordRuleNotice, 'error');
      return;
    }

    if (!doPasswordsMatch) {
      setErrorMessage(t.passwordMatchError);
      showToast(t.passwordMatchError, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        role: persona,
        name: persona === 'BUYER' && organization ? `${organization} (${contactPerson || name})` : name,
        phone: phone.trim(),
        email: email.trim() || undefined,
        password,
        state,
        district,
        location,
        preferredLanguage,
      };

      if (photoBase64) {
        payload.profilePhotoBase64 = photoBase64;
      }

      if (geoCoordinates) {
        payload.latitude = geoCoordinates.latitude;
        payload.longitude = geoCoordinates.longitude;
      }

      if (persona === 'FARMER') {
        payload.name = name;
        payload.village = village;
        payload.primaryCrop = primaryCrop;
        payload.farmSize = parseFloat(farmSize) || undefined;
        payload.kccNumber = kccNumber || undefined;
        payload.apmcLicense = apmcLicense || undefined;
      } else {
        payload.organization = organization;
        payload.contactPerson = contactPerson || name;
        payload.businessType = businessType;
        payload.warehouseLocation = warehouseLocation;
        payload.gstin = gstin || undefined;
        payload.fssai = fssai || undefined;
      }

      const res = await api.post<any>('/auth/register', payload);

      setRegisteredUserId(res.userId || 'usr-reg-new');
      setStep('SUBMITTED');
      showToast(t.registrationSubmittedTitle, 'success');
    } catch (err: any) {
      const msg = err.message || t.errServerError;
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-amber-800 font-bold hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> {t.navHome}
        </Link>
        <Link href="/login" className="text-xs font-bold text-slate-600 hover:text-slate-900">
          Already have an account? <span className="text-amber-900 font-black hover:underline">{t.navLogin}</span>
        </Link>
      </div>

      {/* STEP 1: Persona Selection */}
      {step === 'SELECT_PERSONA' && (
        <div className="bg-white p-6 md:p-10 rounded-3xl border border-amber-200 shadow-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-amber-500/25">
              <UserPlus className="w-7 h-7" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              {t.signupTitle}
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-md mx-auto">
              {t.signupSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Farmer Card */}
            <div
              onClick={() => setPersona('FARMER')}
              className={`p-6 rounded-3xl border-2 transition cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4 ${
                persona === 'FARMER'
                  ? 'border-amber-500 bg-amber-50/70 shadow-md ring-2 ring-amber-400/50'
                  : 'border-slate-200 hover:border-amber-300 bg-white'
              }`}
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-200/70 text-amber-950 flex items-center justify-center font-black">
                  <Sprout className="w-6 h-6 text-amber-800" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">🌾 {t.roleFarmer}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t.accountTypeFarmerDesc}
                  </p>
                </div>
                <div className="space-y-1.5 text-[11px] font-bold text-slate-700">
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> List crop lots & receive direct bids
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Guaranteed direct payment to bank
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mandi benchmark arbitrage alerts
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <span className={`inline-block w-full text-center py-2 px-3 rounded-xl text-xs font-black transition ${
                  persona === 'FARMER' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}>
                  {persona === 'FARMER' ? '✓ Selected' : 'Select Farmer Account'}
                </span>
              </div>
            </div>

            {/* Buyer Card */}
            <div
              onClick={() => setPersona('BUYER')}
              className={`p-6 rounded-3xl border-2 transition cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4 ${
                persona === 'BUYER'
                  ? 'border-amber-500 bg-amber-50/70 shadow-md ring-2 ring-amber-400/50'
                  : 'border-slate-200 hover:border-amber-300 bg-white'
              }`}
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-200/70 text-amber-950 flex items-center justify-center font-black">
                  <Building2 className="w-6 h-6 text-amber-800" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">🏢 {t.roleBuyer}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t.accountTypeBuyerDesc}
                  </p>
                </div>
                <div className="space-y-1.5 text-[11px] font-bold text-slate-700">
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Source bulk farm-gate lots
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified farmer identity & origin
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Digital purchase contracts & settlement
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <span className={`inline-block w-full text-center py-2 px-3 rounded-xl text-xs font-black transition ${
                  persona === 'BUYER' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}>
                  {persona === 'BUYER' ? '✓ Selected' : 'Select Buyer Account'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-amber-100">
            <span className="text-xs text-slate-500">
              * Administrator accounts are government-authorized and cannot be self-registered.
            </span>
            <button
              type="button"
              onClick={() => setStep('FILL_FORM')}
              className="py-3 px-6 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-2xl shadow-md shadow-amber-500/20 transition flex items-center gap-2 active:scale-95"
            >
              Continue to Application Details <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Application Form */}
      {step === 'FILL_FORM' && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-amber-200 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-amber-100 pb-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                Step 2 of 2
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                {persona === 'FARMER' ? '🌾 Farmer Registration Form' : '🏢 Wholesale Buyer Registration Form'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setStep('SELECT_PERSONA')}
              className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1"
            >
              Change Persona
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="space-y-6">
            {/* Section 1: Identity & Contact */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5 border-b border-amber-100 pb-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                1. Basic Identity Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={persona === 'FARMER' ? 'e.g. Ramesh Patel' : 'e.g. Praveen Kumar'}
                    className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile number"
                    className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address {persona === 'BUYER' ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="email"
                    required={persona === 'BUYER'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={persona === 'BUYER' ? 'procurement@company.com' : 'name@example.com (optional)'}
                    className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Profile Photo Capture */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5 border-b border-amber-100 pb-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-700" />
                2. Profile Photo / Identity Snapshot
              </h3>
              <PhotoCapture
                onPhotoSelected={(base64: string | null) => setPhotoBase64(base64)}
              />
            </div>

            {/* Section 3: Geolocation Coordinates & Regional Address */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5 border-b border-amber-100 pb-1.5">
                <Navigation className="w-3.5 h-3.5 text-amber-700" />
                3. Geographic Location & Coordinates
              </h3>

              <LocationCapture
                onLocationCaptured={(coords) => setGeoCoordinates(coords)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.stateLabel} *</label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.districtLabel} *</label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Nashik"
                    className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dispatch / Receiving Location *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={persona === 'FARMER' ? 'e.g. Pimpalgaon Farm Gate, Niphad Taluka, Nashik' : 'e.g. Sector 19, Vashi Wholesale APMC Market, Navi Mumbai'}
                    className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Operational Credentials */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5 border-b border-amber-100 pb-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                4. Operational Credentials & KYC
              </h3>

              {persona === 'FARMER' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.primaryCropLabel} *</label>
                    <input
                      type="text"
                      required
                      value={primaryCrop}
                      onChange={(e) => setPrimaryCrop(e.target.value)}
                      placeholder="e.g. Tomato, Onion, Wheat, Rice"
                      className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.farmSizeLabel} *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={farmSize}
                      onChange={(e) => setFarmSize(e.target.value)}
                      placeholder="e.g. 5.0"
                      className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.villageLabel} (Optional)</label>
                    <input
                      type="text"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="e.g. Pimpalgaon Baswant"
                      className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.kccOptionalLabel}</label>
                    <input
                      type="text"
                      value={kccNumber}
                      onChange={(e) => setKccNumber(e.target.value)}
                      placeholder="e.g. KCC-MAH-992144"
                      className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Organization / Company Name *</label>
                    <input
                      type="text"
                      required
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. FreshCart Agro Limited"
                      className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.businessTypeLabel} *</label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="Wholesale Trader / Processor">Wholesale Trader / Processor</option>
                      <option value="Modern Retail Chain">Modern Retail Chain</option>
                      <option value="Agri-Exporter">Agri-Exporter</option>
                      <option value="Food Processing Enterprise">Food Processing Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.gstinOptionalLabel}</label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      placeholder="e.g. 27AABCU9603R1ZM"
                      className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.fssaiOptionalLabel}</label>
                    <input
                      type="text"
                      value={fssai}
                      onChange={(e) => setFssai(e.target.value)}
                      placeholder="e.g. 10019022009876"
                      className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Password Security */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5 border-b border-amber-100 pb-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                5. Account Security Credentials
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.passwordLabel} *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 chars, 1 Upper, 1 Lower, 1 Symbol"
                      className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.confirmPasswordLabel} *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password Strength Meter */}
              {password.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-600">Password Strength:</span>
                    <span className={rulesPassed >= 5 ? 'text-emerald-700' : rulesPassed >= 3 ? 'text-amber-700' : 'text-rose-700'}>
                      {strengthLabel}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor} transition-all duration-300`} style={{ width: `${strengthPercent}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmitting || !isPasswordValid || !doPasswordsMatch}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-slate-950" />
                    Submit Application for Admin Verification
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3: Confirmation Screen */}
      {step === 'SUBMITTED' && (
        <div className="bg-white p-8 md:p-12 rounded-3xl border border-amber-200 shadow-xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50">
            <Clock className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 py-1 px-3.5 bg-amber-100 text-amber-900 text-xs font-black rounded-full uppercase tracking-wider">
              Status: PENDING_APPROVAL
            </span>
            <h2 className="text-2xl font-black text-slate-900">{t.registrationSubmittedTitle}</h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {t.pendingApprovalDesc}
            </p>
          </div>

          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 text-left text-xs space-y-2 max-w-md mx-auto">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              Application Reference Details
            </div>
            <div className="text-[11px] text-slate-600 space-y-1 font-mono">
              <div>Applicant: <strong className="font-sans text-slate-900">{name}</strong></div>
              <div>Account Persona: <strong className="font-sans text-slate-900">{persona}</strong></div>
              <div>Mobile Identifier: <strong className="font-sans text-slate-900">{phone}</strong></div>
              <div>Regional Jurisdiction: <strong className="font-sans text-slate-900">{district}, {state}</strong></div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="py-3 px-6 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-2xl shadow-md transition text-center"
            >
              Return to Login Portal
            </Link>
            <Link
              href="/"
              className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl transition text-center"
            >
              {t.navHome}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
