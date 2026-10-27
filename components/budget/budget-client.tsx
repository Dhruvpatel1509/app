'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  Calendar,
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  X,
  PieChart as PieIcon,
  ShoppingBag,
  Utensils,
  Car,
  Plane,
  Home,
  Film,
  Zap,
  MoreHorizontal,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { formatCurrency, fromMinorUnits, toMinorUnits } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import type { Budget, Profile, ExpenseCategory } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

const CATEGORIES: Array<{ id: ExpenseCategory; label: string; icon: React.ElementType; color: string }> = [
  { id: 'dining', label: 'Dining', icon: Utensils, color: '#059669' },
  { id: 'groceries', label: 'Groceries', icon: ShoppingBag, color: '#10b981' },
  { id: 'transport', label: 'Transport', icon: Car, color: '#0284c7' },
  { id: 'travel', label: 'Travel', icon: Plane, color: '#6366f1' },
  { id: 'household', label: 'Household', icon: Home, color: '#8b5cf6' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#ec4899' },
  { id: 'entertainment', label: 'Entertainment', icon: Film, color: '#f59e0b' },
  { id: 'bills', label: 'Bills', icon: Zap, color: '#ef4444' },
  { id: 'other', label: 'Other', icon: MoreHorizontal, color: '#78716c' },
];

interface BudgetClientProps {
  currentUserId: string;
  userProfile: Profile | null;
  budgets: Budget[];
  userSplits: any[];
}

export function BudgetClient({
  currentUserId,
  userProfile,
  budgets: initialBudgets,
  userSplits,
}: BudgetClientProps) {
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);

  // Month selector (defaults to current month: YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Set Budget Modal State
  const [showSetModal, setShowSetModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState<ExpenseCategory>('dining');
  const [budgetAmountStr, setBudgetAmountStr] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  const currencyCode = userProfile?.preferred_currency || 'USD';

  // Calculate personal spending for selected month by category
  // Uses personal_spending_minor so group dinners only count the user's portion!
  const categorySpending = useMemo(() => {
    const spendingMap: Record<string, number> = {};
    CATEGORIES.forEach((c) => {
      spendingMap[c.id] = 0;
    });

    userSplits.forEach((s) => {
      if (s.expense && !s.expense.is_deleted && s.expense.expense_date) {
        const expenseMonth = s.expense.expense_date.slice(0, 7);
        if (expenseMonth === selectedMonth) {
          const cat = s.expense.category || 'other';
          const amt = s.personal_spending_minor || s.owed_amount_minor || 0;
          spendingMap[cat] = (spendingMap[cat] || 0) + amt;
        }
      }
    });

    return spendingMap;
  }, [userSplits, selectedMonth]);

  // Merge budgets and spending per category
  const categoryBudgetData = useMemo(() => {
    return CATEGORIES.map((cat) => {
      // Find budget for this category for this month (or general budget)
      const b = budgets.find((item) => item.category_name.toLowerCase() === cat.id);
      const budgetMinor = b ? b.amount_minor : 0;
      const spentMinor = categorySpending[cat.id] || 0;
      const remainingMinor = budgetMinor - spentMinor;
      const percentage = budgetMinor > 0 ? Math.round((spentMinor / budgetMinor) * 100) : 0;

      return {
        ...cat,
        budgetMinor,
        spentMinor,
        remainingMinor,
        percentage,
        hasBudget: budgetMinor > 0,
      };
    });
  }, [budgets, categorySpending]);

  // Overall Totals
  const totalBudgetedMinor = categoryBudgetData.reduce((sum, c) => sum + c.budgetMinor, 0);
  const totalSpentMinor = categoryBudgetData.reduce((sum, c) => sum + c.spentMinor, 0);
  const totalRemainingMinor = totalBudgetedMinor - totalSpentMinor;
  const overallPercentage =
    totalBudgetedMinor > 0 ? Math.round((totalSpentMinor / totalBudgetedMinor) * 100) : 0;

  // Chart data for spending by category
  const chartData = useMemo(() => {
    return categoryBudgetData
      .filter((c) => c.spentMinor > 0 || c.hasBudget)
      .map((c) => ({
        name: c.label,
        Spent: Number((c.spentMinor / 100).toFixed(2)),
        Budget: Number((c.budgetMinor / 100).toFixed(2)),
        color: c.color,
      }));
  }, [categoryBudgetData]);

  // Handle saving a budget
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountMinor = toMinorUnits(budgetAmountStr);
    if (amountMinor <= 0) return;

    setSavingBudget(true);
    const supabase = createClient();
    const budgetMonthDate = `${selectedMonth}-01`;

    // Upsert budget
    const { data: updated, error } = await supabase
      .from('budgets')
      .upsert(
        {
          user_id: currentUserId,
          category_name: targetCategory,
          budget_month: budgetMonthDate,
          amount_minor: amountMinor,
          currency_code: currencyCode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, category_name, budget_month' }
      )
      .select()
      .single();

    setSavingBudget(false);
    if (error) {
      alert('Failed to save budget: ' + error.message);
    } else {
      if (updated) {
        setBudgets((prev) => {
          const filtered = prev.filter(
            (b) => !(b.category_name.toLowerCase() === targetCategory && b.budget_month === budgetMonthDate)
          );
          return [...filtered, updated];
        });
      }
      setShowSetModal(false);
      setBudgetAmountStr('');
      router.refresh();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">My Budget</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Track your personal spending and stay on budget across all categories
          </p>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-stone-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Overview Banner Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-l-emerald-600">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Total Monthly Spend
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight text-stone-900 mt-1">
            {formatCurrency(totalSpentMinor, currencyCode)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Your personal share of all expenses
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-teal-600">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Total Budget Limit
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight text-stone-900 mt-1">
            {formatCurrency(totalBudgetedMinor, currencyCode)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Set across {categoryBudgetData.filter((c) => c.hasBudget).length} categories
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-stone-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Budget Remaining
          </p>
          <p
            className={cn(
              'text-2xl font-bold font-mono tracking-tight mt-1',
              totalRemainingMinor < 0
                ? 'text-red-600'
                : totalRemainingMinor > 0
                ? 'text-emerald-600'
                : 'text-stone-700'
            )}
          >
            {formatCurrency(totalRemainingMinor, currencyCode)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {overallPercentage}% of total budget used
          </p>
        </div>
      </div>

      {/* Spending Breakdown Chart */}
      {chartData.length > 0 && (
        <div className="card p-6 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            Category Spending vs Budget ({selectedMonth})
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`]}
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e7e5e4',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="Spent" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Budget" fill="#d1fae5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Budget Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-600">
            Category Budgets
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categoryBudgetData.map((cat) => {
            const Icon = cat.icon;
            const isOverBudget = cat.hasBudget && cat.spentMinor > cat.budgetMinor;
            const isNearBudget = cat.hasBudget && !isOverBudget && cat.percentage >= 80;

            return (
              <div
                key={cat.id}
                className="card p-5 space-y-3 hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: cat.color }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-900 text-sm">{cat.label}</h3>
                      <p className="text-xs text-stone-400">
                        {cat.hasBudget
                          ? `Limit: ${formatCurrency(cat.budgetMinor, currencyCode)}`
                          : 'No budget set'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTargetCategory(cat.id);
                      setBudgetAmountStr(cat.hasBudget ? fromMinorUnits(cat.budgetMinor) : '');
                      setShowSetModal(true);
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                  >
                    {cat.hasBudget ? 'Edit Limit' : 'Set Limit'}
                  </button>
                </div>

                {/* Progress bar */}
                {cat.hasBudget ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="font-mono font-semibold text-stone-900">
                        {formatCurrency(cat.spentMinor, currencyCode)} spent
                      </span>
                      <span
                        className={cn(
                          'font-mono text-xs font-bold',
                          isOverBudget
                            ? 'text-red-600'
                            : isNearBudget
                            ? 'text-amber-600'
                            : 'text-stone-500'
                        )}
                      >
                        {cat.percentage}%
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          isOverBudget
                            ? 'bg-red-500'
                            : isNearBudget
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        )}
                        style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-stone-400">
                      <span>
                        {isOverBudget
                          ? `Over by ${formatCurrency(Math.abs(cat.remainingMinor), currencyCode)}`
                          : `${formatCurrency(cat.remainingMinor, currencyCode)} remaining`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-stone-500 flex justify-between items-center pt-1 border-t border-stone-100">
                    <span>Spent this month:</span>
                    <span className="font-mono font-semibold text-stone-800">
                      {formatCurrency(cat.spentMinor, currencyCode)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Set Budget Modal */}
      {showSetModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowSetModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Wallet size={18} />
                </div>
                <h3 className="font-bold text-lg text-stone-900">
                  Set Budget for {CATEGORIES.find((c) => c.id === targetCategory)?.label}
                </h3>
              </div>
              <button
                onClick={() => setShowSetModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Category
                </label>
                <select
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 capitalize"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Monthly Limit ({currencyCode})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="e.g. 500"
                    value={budgetAmountStr}
                    onChange={(e) => setBudgetAmountStr(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-lg font-mono font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSetModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBudget || !budgetAmountStr}
                  className="btn btn-primary flex-1"
                >
                  {savingBudget ? 'Saving...' : 'Save Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
