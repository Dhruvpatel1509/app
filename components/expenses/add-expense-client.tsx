'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  PlusCircle,
  Tag,
  Users,
  Check,
  AlertCircle,
  Percent,
  Divide,
  Sliders,
  DollarSign,
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
  toMinorUnits,
  fromMinorUnits,
  formatCurrency,
  calculateSplit,
} from '@/lib/calculations';
import { getInitials, generateAvatarColor, cn } from '@/lib/utils';
import type { Profile, SplitMethod, ExpenseCategory } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

const CATEGORIES: Array<{ id: ExpenseCategory; label: string; icon: React.ElementType }> = [
  { id: 'dining', label: 'Dining', icon: Utensils },
  { id: 'groceries', label: 'Groceries', icon: ShoppingBag },
  { id: 'transport', label: 'Transport', icon: Car },
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'household', label: 'Household', icon: Home },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'entertainment', label: 'Entertainment', icon: Film },
  { id: 'bills', label: 'Bills', icon: Zap },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

interface AddExpenseClientProps {
  currentUserId: string;
  userProfile: Profile | null;
  groups: any[];
  friends: Profile[];
  initialGroupId?: string;
  initialFriendId?: string;
}

export function AddExpenseClient({
  currentUserId,
  userProfile,
  groups,
  friends,
  initialGroupId,
  initialFriendId,
}: AddExpenseClientProps) {
  const router = useRouter();

  // Form Fields
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currencyCode] = useState('EUR');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ExpenseCategory>('dining');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || '');
  const [paidByUserId, setPaidByUserId] = useState<string>(currentUserId);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Split state
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');

  // Candidate participants pool
  const candidatePool = useMemo(() => {
    const list: Profile[] = [];
    if (userProfile) list.push(userProfile);

    if (selectedGroupId) {
      const grp = groups.find((g) => g.id === selectedGroupId);
      if (grp?.members) {
        grp.members.forEach((m: any) => {
          if (m.profile && !list.some((p) => p.id === m.profile.id)) {
            list.push(m.profile);
          }
        });
      }
    } else {
      friends.forEach((f) => {
        if (!list.some((p) => p.id === f.id)) {
          list.push(f);
        }
      });
    }
    return list;
  }, [userProfile, selectedGroupId, groups, friends]);

  // Selected participant IDs
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() => {
    if (initialGroupId) {
      const grp = groups.find((g) => g.id === initialGroupId);
      if (grp?.members) return grp.members.map((m: any) => m.user_id);
    }
    if (initialFriendId) {
      return [currentUserId, initialFriendId];
    }
    return [currentUserId];
  });

  // When group selection changes, auto-select members of that group
  useEffect(() => {
    if (selectedGroupId) {
      const grp = groups.find((g) => g.id === selectedGroupId);
      if (grp?.members) {
        setSelectedUserIds(grp.members.map((m: any) => m.user_id));
      }
    }
  }, [selectedGroupId, groups]);

  // Exact / Percentage / Shares / Adjustment inputs
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({});
  const [percentageInputs, setPercentageInputs] = useState<Record<string, string>>({});
  const [sharesInputs, setSharesInputs] = useState<Record<string, string>>({});
  const [adjustmentInputs, setAdjustmentInputs] = useState<Record<string, string>>({});

  const totalMinor = toMinorUnits(amountStr);

  // Calculate split details using pure calculations engine
  const calculated = useMemo(() => {
    if (totalMinor <= 0 || selectedUserIds.length === 0) {
      return { allocations: [], total_allocated_minor: 0, rounding_remainder_minor: 0, is_valid: false, errors: [] };
    }

    const participants = selectedUserIds.map((uid) => {
      return {
        user_id: uid,
        exact_minor: toMinorUnits(exactInputs[uid] || '0'),
        percentage: parseFloat(percentageInputs[uid] || '0'),
        shares: parseInt(sharesInputs[uid] || '1', 10) || 1,
        adjustment_minor: toMinorUnits(adjustmentInputs[uid] || '0'),
      };
    });

    return calculateSplit({
      method: splitMethod,
      total_minor: totalMinor,
      participants,
    });
  }, [totalMinor, selectedUserIds, splitMethod, exactInputs, percentageInputs, sharesInputs, adjustmentInputs]);

  // Toggle participant selection
  const toggleParticipant = (uid: string) => {
    if (selectedUserIds.includes(uid)) {
      if (selectedUserIds.length <= 1) return; // Keep at least one
      setSelectedUserIds(selectedUserIds.filter((id) => id !== uid));
    } else {
      setSelectedUserIds([...selectedUserIds, uid]);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (totalMinor <= 0) {
      setErrorMessage('Please enter an amount greater than 0.');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Please enter an expense description.');
      return;
    }
    if (selectedUserIds.length === 0) {
      setErrorMessage('Select at least one participant.');
      return;
    }
    if (!calculated.is_valid) {
      setErrorMessage(calculated.errors[0] || 'Split calculations do not balance the total amount.');
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      // 1. Insert expense
      const { data: newExpense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          description: description.trim(),
          group_id: selectedGroupId || null,
          paid_by: paidByUserId,
          created_by: currentUserId,
          currency_code: currencyCode,
          category,
          split_method: splitMethod,
          subtotal_minor: totalMinor,
          tax_minor: 0,
          tip_minor: 0,
          discount_minor: 0,
          total_minor: totalMinor,
          expense_date: date,
          notes: notes.trim() || null,
          is_deleted: false,
        })
        .select()
        .single();

      if (expenseError || !newExpense) {
        throw new Error(expenseError?.message || 'Failed to create expense record.');
      }

      // 2. Insert participants
      const participantRows = selectedUserIds.map((uid) => ({
        expense_id: newExpense.id,
        user_id: uid,
      }));

      const { error: partError } = await supabase
        .from('expense_participants')
        .insert(participantRows);

      if (partError) {
        throw new Error(partError.message);
      }

      // 3. Insert splits
      const splitRows = calculated.allocations.map((alloc) => ({
        expense_id: newExpense.id,
        user_id: alloc.user_id,
        owed_amount_minor: alloc.owed_amount_minor,
        personal_spending_minor: alloc.personal_spending_minor,
        split_metadata: {
          method: splitMethod,
        },
      }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitRows);

      if (splitsError) {
        throw new Error(splitsError.message);
      }

      // Done! Redirect
      if (selectedGroupId) {
        router.push(`/groups/${selectedGroupId}`);
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while saving the expense.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Top Back Nav */}
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors bg-white px-2.5 py-1.5 rounded-lg border border-stone-200"
        >
          <ArrowLeft size={14} /> Back
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Add Expense</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Log a new shared expense and split it fairly
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Core Details */}
        <div className="card p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-600 border-b border-stone-100 pb-3">
            Expense Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Description
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dinner with team, Groceries, Flight tickets"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-stone-900"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Total Amount
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">
                  €
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-lg font-mono font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Date
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Group */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Group (Optional)
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">No Group (Personal / Friends)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Paid By */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                Paid By
              </label>
              <select
                value={paidByUserId}
                onChange={(e) => setPaidByUserId(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {candidatePool
                  .filter((p) => selectedUserIds.includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === currentUserId ? 'You' : p.display_name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all',
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                        : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200'
                    )}
                  >
                    <Icon size={14} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 2: Participants */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-600">
                Split With Whom?
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                {selectedUserIds.length} participant{selectedUserIds.length === 1 ? '' : 's'} selected
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {candidatePool.map((p) => {
              const isSelected = selectedUserIds.includes(p.id);
              const isCurrentUser = p.id === currentUserId;
              const avatarColor = generateAvatarColor(p.id);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleParticipant(p.id)}
                  className={cn(
                    'p-1.5 pr-3 rounded-full flex items-center gap-2 border text-xs font-medium transition-all',
                    isSelected
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm'
                      : 'bg-white border-stone-200 text-stone-400 opacity-60 hover:opacity-100'
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {getInitials(p.display_name)}
                  </div>
                  <span>{isCurrentUser ? 'You' : p.display_name}</span>
                  {isSelected && <Check size={12} className="text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: Split Methods & Allocations */}
        <div className="card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-600">
              Split Method
            </h2>

            {/* Split Method Tabs */}
            <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSplitMethod('equal')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all',
                  splitMethod === 'equal'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                )}
              >
                Equal (=)
              </button>
              <button
                type="button"
                onClick={() => setSplitMethod('exact')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all',
                  splitMethod === 'exact'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                )}
              >
                Exact (€)
              </button>
              <button
                type="button"
                onClick={() => setSplitMethod('percentage')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all',
                  splitMethod === 'percentage'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                )}
              >
                Percent (%)
              </button>
              <button
                type="button"
                onClick={() => setSplitMethod('shares')}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all',
                  splitMethod === 'shares'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                )}
              >
                Shares (2:1)
              </button>
            </div>
          </div>

          {/* Allocation input rows */}
          <div className="space-y-3">
            {selectedUserIds.map((uid) => {
              const participant = candidatePool.find((p) => p.id === uid);
              const name = uid === currentUserId ? 'You' : participant?.display_name || 'Member';
              const alloc = calculated.allocations.find((a) => a.user_id === uid);

              return (
                <div
                  key={uid}
                  className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ backgroundColor: generateAvatarColor(uid) }}
                    >
                      {getInitials(name)}
                    </div>
                    <span className="text-sm font-semibold text-stone-800 truncate">
                      {name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Method specific inputs */}
                    {splitMethod === 'exact' && (
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">
                          €
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={exactInputs[uid] || ''}
                          onChange={(e) =>
                            setExactInputs({ ...exactInputs, [uid]: e.target.value })
                          }
                          className="w-full pl-6 pr-2 py-1 bg-white border border-stone-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    )}

                    {splitMethod === 'percentage' && (
                      <div className="relative w-24">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={percentageInputs[uid] || ''}
                          onChange={(e) =>
                            setPercentageInputs({ ...percentageInputs, [uid]: e.target.value })
                          }
                          className="w-full pl-2 pr-6 py-1 bg-white border border-stone-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">
                          %
                        </span>
                      </div>
                    )}

                    {splitMethod === 'shares' && (
                      <div className="relative w-20">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="1"
                          value={sharesInputs[uid] || '1'}
                          onChange={(e) =>
                            setSharesInputs({ ...sharesInputs, [uid]: e.target.value })
                          }
                          className="w-full px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center"
                        />
                      </div>
                    )}

                    {/* Calculated Share Result */}
                    <div className="text-right min-w-[70px]">
                      <span className="font-mono text-sm font-bold text-stone-900">
                        {alloc ? formatCurrency(alloc.owed_amount_minor, currencyCode) : formatCurrency(0)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Validation Feedback & Remainder Info */}
          {totalMinor > 0 && (
            <div className="pt-2">
              {!calculated.is_valid ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{calculated.errors[0]}</span>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Check size={14} className="text-emerald-600" />
                    Split is perfectly balanced
                  </span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(calculated.total_allocated_minor, currencyCode)} / {formatCurrency(totalMinor, currencyCode)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 4: Notes */}
        <div className="card p-6 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
            Notes (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="Add any extra details, receipts references, or memo..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="btn btn-secondary px-6"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !calculated.is_valid}
            className="btn btn-primary flex-1 py-3 text-base font-semibold shadow-lg shadow-emerald-700/20"
          >
            {submitting ? 'Saving Expense...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
