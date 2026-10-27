'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  PlusCircle,
  Camera,
  Wallet,
  ArrowLeftRight,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { cn, getInitials, generateAvatarColor } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/friends', label: 'Friends', icon: UserPlus },
  { href: '/expenses/add', label: 'Add Expense', icon: PlusCircle },
  { href: '/receipts/scan', label: 'Receipt Scanner', icon: Camera },
  { href: '/budget', label: 'My Budget', icon: Wallet },
  { href: '/balances', label: 'Balances', icon: ArrowLeftRight },
  { href: '/profile', label: 'Profile & Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const avatarColor = profile
    ? generateAvatarColor(profile.id)
    : '#059669';

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-emerald-800">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Cashual</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn('sidebar-nav-item', isActive && 'active')}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 pb-4 border-t border-emerald-800 pt-3">
        {profile && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {getInitials(profile.display_name)}
            </div>
            <div className="min-w-0">
              <p className="text-emerald-100 text-sm font-medium truncate">
                {profile.display_name}
              </p>
              <p className="text-emerald-400 text-xs truncate">@{profile.username}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="sidebar-nav-item w-full text-red-300 hover:text-red-200"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar hidden md:flex flex-col">
        <NavContent />
      </aside>

      {/* Mobile Menu Button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-emerald-800 text-white rounded-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'md:hidden sidebar flex flex-col transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ zIndex: 45 }}
      >
        <NavContent />
      </aside>
    </>
  );
}

// ============================================================
// Mobile Bottom Navigation
// ============================================================
const BOTTOM_NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/expenses/add', label: 'Add', icon: PlusCircle, primary: true },
  { href: '/budget', label: 'Budget', icon: Wallet },
  { href: '/balances', label: 'More', icon: ArrowLeftRight },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-200 px-2 pb-safe">
      <div className="flex items-center justify-around h-16">
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          if (item.primary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center"
                aria-label={item.label}
              >
                <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200 -mt-6">
                  <Icon size={22} className="text-white" />
                </div>
                <span className="text-xs font-medium text-emerald-600 mt-0.5">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-lg transition-colors',
                isActive ? 'text-emerald-600' : 'text-stone-400'
              )}
              aria-label={item.label}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
