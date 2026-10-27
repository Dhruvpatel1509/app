'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  PlusCircle,
  ArrowLeftRight,
  UserPlus,
  ArrowLeft,
  Calendar,
  Settings,
  Shield,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check,
  MoreVertical,
} from 'lucide-react';
import { formatCurrency, fromMinorUnits, toMinorUnits } from '@/lib/calculations';
import { getInitials, generateAvatarColor, cn } from '@/lib/utils';
import type { Group, GroupMember, Expense, Settlement } from '@/lib/types';
import { ExpenseDetailModal } from '@/components/expenses/expense-detail-modal';
import { createClient } from '@/lib/supabase/client';

interface GroupDetailClientProps {
  group: Group;
  members: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
  currentUserId: string;
  isAdmin: boolean;
}

export function GroupDetailClient({
  group,
  members,
  expenses: initialExpenses,
  settlements: initialSettlements,
  currentUserId,
  isAdmin,
}: GroupDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'members'>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [settlements, setSettlements] = useState<Settlement[]>(initialSettlements);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlePayerId, setSettlePayerId] = useState(currentUserId);
  const [settleRecipientId, setSettleRecipientId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);

  // Group financial calculations
  const totalExpensesMinor = expenses.reduce((sum, e) => sum + e.total_minor, 0);

  // Calculate net balance for each member in this group
  // Net balance = (total paid for group) - (total owed from splits) + (settlements received) - (settlements paid)
  const memberBalances: Record<string, number> = {};
  members.forEach((m) => {
    memberBalances[m.user_id] = 0;
  });

  expenses.forEach((e) => {
    if (memberBalances[e.paid_by] !== undefined) {
      memberBalances[e.paid_by] += e.total_minor;
    }
    e.splits?.forEach((s) => {
      if (memberBalances[s.user_id] !== undefined) {
        memberBalances[s.user_id] -= s.owed_amount_minor;
      }
    });
  });

  settlements.forEach((s) => {
    if (memberBalances[s.payer_id] !== undefined) {
      memberBalances[s.payer_id] += s.amount_minor;
    }
    if (memberBalances[s.recipient_id] !== undefined) {
      memberBalances[s.recipient_id] -= s.amount_minor;
    }
  });

  const currentUserBalance = memberBalances[currentUserId] || 0;

  // Handle inviting a user
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    setInviteLoading(true);
    setInviteError(null);

    const supabase = createClient();
    // 1. Find profile by username
    const { data: userToInvite, error: searchError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', inviteUsername.trim().toLowerCase())
      .single();

    if (searchError || !userToInvite) {
      setInviteError('User not found. Check the username.');
      setInviteLoading(false);
      return;
    }

    // 2. Check if already member
    if (members.some((m) => m.user_id === userToInvite.id)) {
      setInviteError('This user is already a member of this group.');
      setInviteLoading(false);
      return;
    }

    // 3. Add to group
    const { error: insertError } = await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: userToInvite.id,
        role: 'member',
      });

    setInviteLoading(false);
    if (insertError) {
      setInviteError(insertError.message);
    } else {
      setShowInviteModal(false);
      setInviteUsername('');
      router.refresh();
    }
  };

  // Handle recording a settlement
  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountMinor = toMinorUnits(settleAmount);
    if (amountMinor <= 0 || !settleRecipientId) return;

    setSettleLoading(true);
    const supabase = createClient();
    const { data: newSettlement, error } = await supabase
      .from('settlements')
      .insert({
        group_id: group.id,
        payer_id: settlePayerId,
        recipient_id: settleRecipientId,
        amount_minor: amountMinor,
        currency_code: group.currency_code,
        settlement_date: new Date().toISOString(),
        notes: settleNotes || null,
        created_by: currentUserId,
      })
      .select(`
        *,
        payer:profiles!settlements_payer_id_fkey(id, username, display_name, avatar_url),
        recipient:profiles!settlements_recipient_id_fkey(id, username, display_name, avatar_url)
      `)
      .single();

    setSettleLoading(false);
    if (error) {
      alert('Failed to record settlement: ' + error.message);
    } else {
      if (newSettlement) {
        setSettlements([newSettlement, ...settlements]);
      }
      setShowSettleModal(false);
      setSettleAmount('');
      setSettleNotes('');
      router.refresh();
    }
  };

  const copyInviteLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Top back navigation */}
      <div className="flex items-center gap-2">
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors bg-white px-2.5 py-1.5 rounded-lg border border-stone-200"
        >
          <ArrowLeft size={14} /> Back to Groups
        </Link>
      </div>

      {/* Group Header Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white font-bold text-xl">
                {group.name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                    {group.name}
                  </h1>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-700/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-600/40">
                      <Shield size={10} /> Admin
                    </span>
                  )}
                </div>
                {group.description && (
                  <p className="text-sm text-emerald-200 mt-0.5">{group.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-emerald-200/80 pt-1">
              <span className="flex items-center gap-1">
                <Users size={13} /> {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
              <span>•</span>
              <span>Currency: {group.currency_code}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/expenses/add?group_id=${group.id}`}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <PlusCircle size={16} /> Add Expense
            </Link>

            <button
              onClick={() => {
                // Find someone with a non-zero balance to settle with
                const other = members.find((m) => m.user_id !== currentUserId);
                if (other) setSettleRecipientId(other.user_id);
                setShowSettleModal(true);
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl border border-white/20 transition-all flex items-center gap-2"
            >
              <ArrowLeftRight size={16} /> Settle Up
            </button>

            <button
              onClick={() => setShowInviteModal(true)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-all"
              aria-label="Invite members"
            >
              <UserPlus size={18} />
            </button>
          </div>
        </div>

        {/* Quick balance banner inside header */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-emerald-300 font-medium">Your Group Balance</p>
            <p
              className={cn(
                'text-xl font-bold font-mono tracking-tight mt-0.5',
                currentUserBalance > 0
                  ? 'text-emerald-300'
                  : currentUserBalance < 0
                  ? 'text-red-300'
                  : 'text-stone-300'
              )}
            >
              {currentUserBalance > 0
                ? `+${formatCurrency(currentUserBalance, group.currency_code)}`
                : currentUserBalance < 0
                ? `-${formatCurrency(Math.abs(currentUserBalance), group.currency_code)}`
                : 'Settled up'}
            </p>
          </div>

          <div>
            <p className="text-xs text-emerald-300 font-medium">Total Group Spend</p>
            <p className="text-xl font-bold font-mono tracking-tight text-white mt-0.5">
              {formatCurrency(totalExpensesMinor, group.currency_code)}
            </p>
          </div>

          <div className="hidden md:block">
            <p className="text-xs text-emerald-300 font-medium">Expenses Logged</p>
            <p className="text-xl font-bold font-mono tracking-tight text-white mt-0.5">
              {expenses.length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab('expenses')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'expenses'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <CreditCard size={16} /> Expenses ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'balances'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <ArrowLeftRight size={16} /> Balances
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'members'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <Users size={16} /> Members ({members.length})
        </button>
      </div>

      {/* TAB CONTENT: Expenses */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {expenses.length === 0 ? (
            <div className="card p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800">No expenses in this group yet</h3>
                <p className="text-sm text-stone-500 mt-1">
                  Add the first shared expense to start tracking splits.
                </p>
              </div>
              <Link
                href={`/expenses/add?group_id=${group.id}`}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <PlusCircle size={16} /> Add First Expense
              </Link>
            </div>
          ) : (
            <div className="card divide-y divide-stone-100 overflow-hidden">
              {expenses.map((expense) => {
                const isPayer = expense.paid_by === currentUserId;
                const userSplit = expense.splits?.find((s) => s.user_id === currentUserId);
                const payerName = isPayer ? 'You' : expense.payer?.display_name || 'Member';

                return (
                  <div
                    key={expense.id}
                    onClick={() => setSelectedExpense(expense)}
                    className="p-4 flex items-center justify-between hover:bg-stone-50/80 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-100/70 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 transition-colors">
                        <CreditCard size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900 truncate">
                          {expense.description}
                        </p>
                        <p className="text-xs text-stone-500 flex items-center gap-2 mt-0.5">
                          <span>{payerName} paid {formatCurrency(expense.total_minor, expense.currency_code)}</span>
                          <span>•</span>
                          <span>
                            {new Date(expense.expense_date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isPayer ? (
                        <div>
                          <p className="text-xs font-medium text-stone-400">you lent</p>
                          <p className="font-semibold text-sm font-mono text-emerald-600">
                            +{formatCurrency(
                              expense.total_minor - (userSplit?.owed_amount_minor || 0),
                              expense.currency_code
                            )}
                          </p>
                        </div>
                      ) : userSplit ? (
                        <div>
                          <p className="text-xs font-medium text-stone-400">you borrowed</p>
                          <p className="font-semibold text-sm font-mono text-red-600">
                            -{formatCurrency(userSplit.owed_amount_minor, expense.currency_code)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400">not involved</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Settlements history section */}
          {settlements.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
                Settlement History
              </h3>
              <div className="card divide-y divide-stone-100 overflow-hidden">
                {settlements.map((s) => (
                  <div key={s.id} className="p-3.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={16} />
                      </div>
                      <div>
                        <p className="text-stone-800 font-medium">
                          <span className="font-semibold">
                            {s.payer_id === currentUserId ? 'You' : s.payer?.display_name || 'Member'}
                          </span>{' '}
                          paid{' '}
                          <span className="font-semibold">
                            {s.recipient_id === currentUserId ? 'You' : s.recipient?.display_name || 'Member'}
                          </span>
                        </p>
                        <p className="text-xs text-stone-400">
                          {new Date(s.settlement_date).toLocaleDateString()}
                          {s.notes ? ` • ${s.notes}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-stone-700">
                      {formatCurrency(s.amount_minor, s.currency_code)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Balances */}
      {activeTab === 'balances' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {members.map((member) => {
              const balance = memberBalances[member.user_id] || 0;
              const isCurrentUser = member.user_id === currentUserId;
              const avatarColor = member.profile?.id
                ? generateAvatarColor(member.profile.id)
                : '#059669';

              return (
                <div
                  key={member.user_id}
                  className="card p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials(member.profile?.display_name || 'Member')}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 truncate">
                        {member.profile?.display_name || 'Member'}{' '}
                        {isCurrentUser && <span className="text-xs text-emerald-600 font-normal">(You)</span>}
                      </p>
                      <p className="text-xs text-stone-500">@{member.profile?.username || 'user'}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={cn(
                        'text-sm font-bold font-mono',
                        balance > 0
                          ? 'text-emerald-600'
                          : balance < 0
                          ? 'text-red-600'
                          : 'text-stone-400'
                      )}
                    >
                      {balance > 0
                        ? `gets back ${formatCurrency(balance, group.currency_code)}`
                        : balance < 0
                        ? `owes ${formatCurrency(Math.abs(balance), group.currency_code)}`
                        : 'settled up'}
                    </p>
                    {!isCurrentUser && balance !== 0 && (
                      <button
                        onClick={() => {
                          if (balance < 0) {
                            // Current user receives from this member or pays them
                            setSettlePayerId(member.user_id);
                            setSettleRecipientId(currentUserId);
                            setSettleAmount(fromMinorUnits(Math.abs(balance)));
                          } else {
                            setSettlePayerId(currentUserId);
                            setSettleRecipientId(member.user_id);
                            setSettleAmount(fromMinorUnits(balance));
                          }
                          setShowSettleModal(true);
                        }}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold mt-1"
                      >
                        Settle balance →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Members */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-700">
              Group Members ({members.length})
            </h3>
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              <UserPlus size={14} /> Invite New Member
            </button>
          </div>

          <div className="card divide-y divide-stone-100 overflow-hidden">
            {members.map((member) => {
              const avatarColor = member.profile?.id
                ? generateAvatarColor(member.profile.id)
                : '#059669';

              return (
                <div
                  key={member.user_id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials(member.profile?.display_name || 'Member')}
                    </div>
                    <div>
                      <p className="font-semibold text-stone-900">
                        {member.profile?.display_name || 'Member'}{' '}
                        {member.user_id === currentUserId && (
                          <span className="text-xs text-emerald-600 font-normal">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-stone-400">@{member.profile?.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-full',
                        member.role === 'admin'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-100 text-stone-600'
                      )}
                    >
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          currentUserId={currentUserId}
          onClose={() => setSelectedExpense(null)}
          onDeleted={(id) => {
            setExpenses(expenses.filter((e) => e.id !== id));
            setSelectedExpense(null);
          }}
        />
      )}

      {/* Settle Up Modal */}
      {showSettleModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowSettleModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowLeftRight size={18} />
                </div>
                <h3 className="font-bold text-lg text-stone-900">Settle Balance</h3>
              </div>
              <button
                onClick={() => setShowSettleModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRecordSettlement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Who is paying?
                </label>
                <select
                  value={settlePayerId}
                  onChange={(e) => setSettlePayerId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user_id === currentUserId ? 'You' : m.profile?.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Who is receiving?
                </label>
                <select
                  value={settleRecipientId}
                  onChange={(e) => setSettleRecipientId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {members
                    .filter((m) => m.user_id !== settlePayerId)
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user_id === currentUserId ? 'You' : m.profile?.display_name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Amount ({group.currency_code})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-lg font-mono font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via Venmo"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleLoading || !settleAmount}
                  className="btn btn-primary flex-1"
                >
                  {settleLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <h3 className="font-bold text-lg text-stone-900">Invite to {group.name}</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Add by username */}
              <form onSubmit={handleInviteUser} className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                  Add by Username
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">@</span>
                    <input
                      type="text"
                      placeholder="username"
                      required
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={inviteLoading || !inviteUsername.trim()}
                    className="btn btn-primary text-xs shrink-0"
                  >
                    {inviteLoading ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
                {inviteError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle size={12} /> {inviteError}
                  </p>
                )}
              </form>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-stone-200 w-full" />
                <span className="bg-white px-3 text-xs text-stone-400 uppercase tracking-wider absolute">
                  or share link
                </span>
              </div>

              {/* Copy link */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Group Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.href : ''}
                    className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-600 font-mono truncate"
                  />
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="btn btn-secondary text-xs shrink-0 flex items-center gap-1.5"
                  >
                    {inviteCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {inviteCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
