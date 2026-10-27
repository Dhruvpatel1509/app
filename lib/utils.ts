// ============================================================
// Cashual — Utility Functions
// ============================================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// Date formatting
// ============================================================
export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
}

export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function getMonthKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM');
}

export function getFirstOfMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

// ============================================================
// Avatar utilities
// ============================================================
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateAvatarColor(userId: string): string {
  const colors = [
    '#059669', // emerald-600
    '#0d9488', // teal-600
    '#0284c7', // sky-600
    '#7c3aed', // violet-600
    '#db2777', // pink-600
    '#dc2626', // red-600
    '#d97706', // amber-600
    '#16a34a', // green-600
  ];
  // Deterministic color from user id
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ============================================================
// Validation helpers
// ============================================================
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,30}$/.test(username);
}

export function isValidAmount(amount: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(amount) && parseFloat(amount) > 0;
}

// ============================================================
// Array utilities
// ============================================================
export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const group = String(item[key]);
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

export function uniqueBy<T>(items: T[], key: keyof T): T[] {
  const seen = new Set();
  return items.filter((item) => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

// ============================================================
// Currency constants
// ============================================================
export const SUPPORTED_CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
] as const;

export function getCurrencySymbol(code: string = 'EUR'): string {
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  return found ? found.symbol : '€';
}

export const EXPENSE_CATEGORIES = [
  { value: 'groceries', label: 'Groceries', icon: 'ShoppingCart' },
  { value: 'dining', label: 'Dining', icon: 'UtensilsCrossed' },
  { value: 'transport', label: 'Transport', icon: 'Car' },
  { value: 'travel', label: 'Travel', icon: 'Plane' },
  { value: 'household', label: 'Household', icon: 'Home' },
  { value: 'shopping', label: 'Shopping', icon: 'ShoppingBag' },
  { value: 'entertainment', label: 'Entertainment', icon: 'Tv' },
  { value: 'bills', label: 'Bills', icon: 'Receipt' },
  { value: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const;
