'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Camera, Users, UserPlus, ArrowLeftRight } from 'lucide-react';
import { formatCurrency, fromMinorUnits } from '@/lib/calculations';
import { calculateNetBalances, calculatePersonalSpending } from '@/lib/calculations';
import { formatDate, formatRelativeDate, cn, getInitials, generateAvatarColor } from '@/lib/utils';
import { MonthlySpendingChart } from '@/components/dashboard/monthly-spending-chart';
import { CategoryBreakdown } from '@/components/dashboard/category-breakdown';
import { ExpenseDetailModal } from '@/components/expenses/expense-detail-modal';
import type { Expense, Settlement } from '@/lib/types';

interface DashboardData {
  expenseSplits: any[];
  settlements: any[];
  recentExpenses: any[];
  groupMemberships: any[];
  budgets: any[];
}

interface DashboardClientProps {
  userId: string;
  data: DashboardData;
}

export function DashboardClient({ userId, data }: DashboardClientProps) {
  const { expenseSplits, settlements, recentExpenses, groupMemberships, budgets } = data;
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Calculate balances
  const balanceEntries = calculateNetBalances(
    userId,
    expenseSplits
      .filter((s) => !s.expense?.is_deleted)
      .map((s) => ({
        expense_id: s.expense_id,
        user_id: s.user_id,
        owed_amount_minor: s.owed_amount_minor,
        expense: {
          paid_by: s.expense?.paid_by,
          currency_code: s.expense?.currency_code ?? 'USD',
        },
      })),
    settlements.map((s) => ({
      payer_id: s.payer_id,
      recipient_id: s.recipient_id,
      amount_minor: s.amount_minor,
      currency_code: s.currency_code,
    }))
  );

  const youOweMinor = balanceEntries
    .filter((b) => b.net_minor < 0)
    .reduce((acc, b) => acc + Math.abs(b.net_minor), 0);

  const youAreOwedMinor = balanceEntries
    .filter((b) => b.net_minor > 0)
    .reduce((acc, b) => acc + b.net_minor, 0);

  const netBalance = youAreOwedMinor - youOweMinor;

  // Personal spending this month
  const now = new Date();
  const thisMonthSplits = expenseSplits.filter((s) => {
    if (!s.expense?.expense_date || s.expense?.is_deleted) return false;
    const d = new Date(s.expense.expense_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const personalSpending = calculatePersonalSpending(thisMonthSplits.map((s) => ({
    personal_spending_minor: s.personal_spending_minor,
  })));

  // Category spending
  const categoryMap: Record<string, number> = {};
  expenseSplits.forEach((s) => {
    if (s.expense?.is_deleted) return;
    const d = new Date(s.expense?.expense_date ?? '');
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
    const cat = s.expense?.category ?? 'other';
    categoryMap[cat] = (categoryMap[cat] ?? 0) + s.personal_spending_minor;
  });
  const categoryData = Object.entries(categoryMap).map(([name, amount]) => ({ name, amount }));
  const totalCatSpend = categoryData.reduce((a, b) => a + b.amount, 0);

  // Monthly chart data (last 6 months)
  const monthlyMap: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = 0;
  }
  expenseSplits.forEach((s) => {
    if (s.expense?.is_deleted) return;
    const d = new Date(s.expense?.expense_date ?? '');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key in monthlyMap) {
      monthlyMap[key] = (monthlyMap[key] ?? 0) + s.personal_spending_minor;
    }
  });
  const monthlyData = Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));

  const isEmpty = recentExpenses.length === 0 && settlements.length === 0;

  return (
    <div className="space-y-6 fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-heading-1 text-stone-900">Dashboard</h1>
        <p className="text-stone-500 text-sm mt-0.5">Your financial overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="You Owe"
          amount={youOweMinor}
          type="negative"
          description="To others"
        />
        <SummaryCard
          label="You're Owed"
          amount={youAreOwedMinor}
          type="positive"
          description="From others"
        />
        <SummaryCard
          label="Net Balance"
          amount={netBalance}
          type={netBalance >= 0 ? 'positive' : 'negative'}
          description="Overall position"
        />
        <SummaryCard
          label="Spending"
          amount={personalSpending}
          type="neutral"
          description="This month"
        />
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column: transactions */}
          <div className="lg:col-span-2 space-y-6">
            <RecentExpenses
              expenses={recentExpenses}
              userId={userId}
              onSelectExpense={setSelectedExpense}
            />
            <RecentSettlements settlements={settlements} userId={userId} />
          </div>

          {/* Right column: charts */}
          <div className="space-y-6">
            <MonthlySpendingChart data={monthlyData} />
            <CategoryBreakdown data={categoryData} totalMinor={totalCatSpend} />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          currentUserId={userId}
          onClose={() => setSelectedExpense(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Summary Card
// ============================================================
function SummaryCard({
  label,
  amount,
  type,
  description,
}: {
  label: string;
  amount: number;
  type: 'positive' | 'negative' | 'neutral';
  description: string;
}) {
  const amountClass =
    type === 'positive'
      ? 'amount-positive'
      : type === 'negative'
      ? 'amount-negative'
      : 'amount-neutral';

  return (
    <div className="stat-card">
      <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', amountClass)}>
        {formatCurrency(amount)}
      </p>
      <p className="text-xs text-stone-400">{description}</p>
    </div>
  );
}

// ============================================================
// Recent Expenses
// ============================================================
function RecentExpenses({
  expenses,
  userId,
  onSelectExpense,
}: {
  expenses: any[];
  userId: string;
  onSelectExpense?: (e: Expense) => void;
}) {
  if (expenses.length === 0) return null;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <h2 className="font-semibold text-stone-900">Recent Expenses</h2>
        <Link href="/balances" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
          View all
        </Link>
      </div>
      <div className="divide-y divide-stone-50">
        {expenses.slice(0, 6).map((expense) => {
          const myShare = expense.splits?.find((s: any) => s.user_id === userId);
          const isPayer = expense.paid_by === userId;

          return (
            <div
              key={expense.id}
              onClick={() => onSelectExpense?.(expense)}
              className="px-5 py-3.5 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <span className="text-emerald-600 text-xs font-bold">
                      {expense.description?.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900 text-sm truncate">{expense.description}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {expense.group?.name ? `${expense.group.name} · ` : ''}
                      {formatDate(expense.expense_date)}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-stone-900">
                    {formatCurrency(expense.total_minor)}
                  </p>
                  {myShare && (
                    <p className={cn('text-xs mt-0.5', isPayer ? 'text-emerald-600' : 'text-red-500')}>
                      {isPayer ? 'You paid' : `You owe ${formatCurrency(myShare.owed_amount_minor)}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Recent Settlements
// ============================================================
function RecentSettlements({ settlements, userId }: { settlements: any[]; userId: string }) {
  if (settlements.length === 0) return null;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h2 className="font-semibold text-stone-900">Recent Settlements</h2>
      </div>
      <div className="divide-y divide-stone-50">
        {settlements.slice(0, 4).map((s) => {
          const isPayee = s.recipient_id === userId;
          const person = isPayee ? s.payer : s.recipient;
          const color = generateAvatarColor(person?.id ?? '');

          return (
            <div key={s.id} className="px-5 py-3.5 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: color }}
              >
                {getInitials(person?.display_name ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900">
                  {isPayee ? `${person?.display_name} paid you` : `You paid ${person?.display_name}`}
                </p>
                <p className="text-xs text-stone-400">{formatDate(s.settlement_date)}</p>
              </div>
              <p className={cn('text-sm font-semibold', isPayee ? 'amount-positive' : 'amount-negative')}>
                {isPayee ? '+' : '-'}{formatCurrency(s.amount_minor)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Quick Actions
// ============================================================
function QuickActions() {
  const actions = [
    { href: '/expenses/add', label: 'Add Expense', icon: PlusCircle, color: 'bg-emerald-600 text-white' },
    { href: '/receipts/scan', label: 'Scan Receipt', icon: Camera, color: 'bg-teal-600 text-white' },
    { href: '/groups?create=1', label: 'Create Group', icon: Users, color: 'bg-sky-600 text-white' },
    { href: '/friends?add=1', label: 'Add Friend', icon: UserPlus, color: 'bg-violet-600 text-white' },
    { href: '/balances?settle=1', label: 'Settle Up', icon: ArrowLeftRight, color: 'bg-amber-600 text-white' },
  ];

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-stone-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-stone-50 transition-colors group"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', action.color)}>
                <Icon size={18} />
              </div>
              <span className="text-xs font-medium text-stone-600 text-center group-hover:text-stone-900 transition-colors">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Empty state
// ============================================================
function EmptyState() {
  return (
    <div className="card p-10 text-center">
      <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <PlusCircle size={28} className="text-emerald-600" />
      </div>
      <h2 className="text-lg font-semibold text-stone-900 mb-2">Welcome to Cashual!</h2>
      <p className="text-stone-500 text-sm mb-6 max-w-sm mx-auto">
        Start by adding your first expense, scanning a receipt, or creating a group with friends.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/expenses/add" className="btn-primary text-sm px-5 py-2.5">
          <PlusCircle size={15} />
          Add Expense
        </Link>
        <Link href="/receipts/scan" className="btn-secondary text-sm px-5 py-2.5">
          <Camera size={15} />
          Scan Receipt
        </Link>
        <Link href="/groups?create=1" className="btn-secondary text-sm px-5 py-2.5">
          <Users size={15} />
          Create Group
        </Link>
      </div>
    </div>
  );
}
