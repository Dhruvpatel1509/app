'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Coins,
  Shield,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Users,
  CreditCard,
  ArrowLeftRight,
  FolderKanban,
} from 'lucide-react';
import { getInitials, generateAvatarColor, cn } from '@/lib/utils';
import type { Profile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'CAD', name: 'Canadian Dollar (C$)' },
  { code: 'AUD', name: 'Australian Dollar (A$)' },
  { code: 'JPY', name: 'Japanese Yen (¥)' },
  { code: 'INR', name: 'Indian Rupee (₹)' },
  { code: 'CHF', name: 'Swiss Franc (CHF)' },
];

interface ProfileClientProps {
  profile: Profile | null;
  email: string;
  stats: {
    expenses: number;
    groups: number;
    friends: number;
    settlements: number;
  };
}

export function ProfileClient({
  profile,
  email,
  stats,
}: ProfileClientProps) {
  const router = useRouter();
  const { signOut } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [preferredCurrency, setPreferredCurrency] = useState(
    profile?.preferred_currency || 'USD'
  );
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const avatarColor = profile ? generateAvatarColor(profile.id) : '#059669';

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        preferred_currency: preferredCurrency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          Profile & Settings
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Manage your account preferences, default currency, and profile details
        </p>
      </div>

      {/* Profile Overview Banner */}
      <div className="card p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold border-2 border-white/20 shadow-md shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {getInitials(profile?.display_name || 'User')}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {profile?.display_name}
            </h2>
            <p className="text-emerald-200 text-sm">@{profile?.username}</p>
            <p className="text-emerald-300/80 text-xs mt-1 flex items-center gap-1.5">
              <Mail size={12} /> {email}
            </p>
          </div>
        </div>

        <button
          onClick={() => signOut()}
          className="self-start md:self-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-red-200 hover:text-white rounded-xl text-xs font-semibold border border-white/20 transition-colors flex items-center gap-2"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <div className="card p-4 space-y-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-1">
            <CreditCard size={16} />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900">{stats.expenses}</p>
          <p className="text-xs text-stone-400">Expenses Logged</p>
        </div>

        <div className="card p-4 space-y-1">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-1">
            <FolderKanban size={16} />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900">{stats.groups}</p>
          <p className="text-xs text-stone-400">Active Groups</p>
        </div>

        <div className="card p-4 space-y-1">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-1">
            <Users size={16} />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900">{stats.friends}</p>
          <p className="text-xs text-stone-400">Friends</p>
        </div>

        <div className="card p-4 space-y-1">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-1">
            <ArrowLeftRight size={16} />
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900">{stats.settlements}</p>
          <p className="text-xs text-stone-400">Settlements</p>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="card p-6 md:p-8 space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-600 border-b border-stone-100 pb-3">
          Account Settings
        </h2>

        <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-stone-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Username
            </label>
            <input
              type="text"
              disabled
              value={`@${profile?.username || ''}`}
              className="w-full px-4 py-2.5 bg-stone-100 border border-stone-200 rounded-xl text-sm text-stone-500 cursor-not-allowed font-mono"
            />
            <p className="text-[11px] text-stone-400 mt-1">Username cannot be changed.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
              Preferred Currency
            </label>
            <div className="relative">
              <Coins size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <select
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-stone-900"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary px-6 py-2.5 text-sm font-semibold"
            >
              {saving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
