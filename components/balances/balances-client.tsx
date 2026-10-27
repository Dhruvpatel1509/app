'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  History,
  CheckCircle2,
  X,
  AlertCircle,
  Users,
  ArrowRight,
  CreditCard,
} from 'lucide-react';
import {
  formatCurrency,
  fromMinorUnits,
  toMinorUnits,
  simplifyDebts,
  DebtTransaction,
} from '@/lib/calculations';
import { getInitials, generateAvatarColor, cn } from '@/lib/utils';
import type { Profile, Settlement } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface BalancesClientProps {
  currentUserId: string;
  userProfile: Profile | null;
  expensesPaid: any[];
  userSplits: any[];
  settlements: Settlement[];
  allProfiles: Profile[];
}

export function BalancesClient({
  currentUserId,
  userProfile,
  expensesPaid,
  userSplits,
  settlements: initialSettlements,
  allProfiles,
}: BalancesClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'balances' | 'simplified' | 'history'>('balances');
  const [settlements, setSettlements] = useState<Settlement[]>(initialSettlements);

  // Settle modal
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [targetUser, setTargetUser] = useState<Profile | null>(null);
  const [settlePayerId, setSettlePayerId] = useState(currentUserId);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);

  const currencyCode = userProfile?.preferred_currency || 'USD';

  // 1. Calculate net balances with each counterpart
  // Net balance > 0: they owe user. Net balance < 0: user owes them.
  const balancesMap: Record<string, number> = {};

  // Money owed to user by others (from expenses user paid)
  expensesPaid.forEach((e) => {
    e.splits?.forEach((s: any) => {
      if (s.user_id !== currentUserId) {
        balancesMap[s.user_id] = (balancesMap[s.user_id] || 0) + s.owed_amount_minor;
      }
    });
  });

  // Money user owes to others
  userSplits.forEach((s) => {
    if (s.expense && !s.expense.is_deleted && s.expense.paid_by !== currentUserId) {
      const payerId = s.expense.paid_by;
      balancesMap[payerId] = (balancesMap[payerId] || 0) - s.owed_amount_minor;
    }
  });

  // Settlements adjustments
  settlements.forEach((st) => {
    if (st.payer_id === currentUserId) {
      balancesMap[st.recipient_id] = (balancesMap[st.recipient_id] || 0) + st.amount_minor;
    } else if (st.recipient_id === currentUserId) {
      balancesMap[st.payer_id] = (balancesMap[st.payer_id] || 0) - st.amount_minor;
    }
  });

  // Convert to array of entries
  const balanceEntries = useMemo(() => {
    return Object.entries(balancesMap)
      .map(([userId, netMinor]) => {
        const profile = allProfiles.find((p) => p.id === userId);
        return {
          userId,
          profile: profile || {
            id: userId,
            username: 'user',
            display_name: 'Member',
            avatar_url: null,
            preferred_currency: currencyCode,
            created_at: '',
            updated_at: '',
          },
          netMinor,
        };
      })
      .filter((entry) => entry.netMinor !== 0);
  }, [balancesMap, allProfiles, currencyCode]);

  // Totals
  const totalYouAreOwed = balanceEntries
    .filter((e) => e.netMinor > 0)
    .reduce((sum, e) => sum + e.netMinor, 0);

  const totalYouOwe = balanceEntries
    .filter((e) => e.netMinor < 0)
    .reduce((sum, e) => sum + Math.abs(e.netMinor), 0);

  const netBalance = totalYouAreOwed - totalYouOwe;

  // Debt simplification:
  // Build net vector across all participants
  const simplifiedTransactions = useMemo(() => {
    const netVector: Record<string, number> = {};
    balanceEntries.forEach((b) => {
      netVector[b.userId] = b.netMinor;
    });
    netVector[currentUserId] = netBalance;

    return simplifyDebts(netVector, currencyCode);
  }, [balanceEntries, currentUserId, netBalance, currencyCode]) as DebtTransaction[];

  // Settle submission
  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    const amountMinor = toMinorUnits(settleAmount);
    if (amountMinor <= 0) return;

    setSettleLoading(true);
    const supabase = createClient();
    const recipientId =
      settlePayerId === currentUserId ? targetUser.id : currentUserId;

    const { data: newSettlement, error } = await supabase
      .from('settlements')
      .insert({
        payer_id: settlePayerId,
        recipient_id: recipientId,
        amount_minor: amountMinor,
        currency_code: currencyCode,
        settlement_date: new Date().toISOString(),
        notes: settleNotes || null,
        created_by: currentUserId,
      })
      .select(`
        *,
        payer:profiles!settlements_payer_id_fkey(id, username, display_name, avatar_url),
        recipient:profiles!settlements_recipient_id_fkey(id, username, display_name, avatar_url),
        group:groups(id, name)
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

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Balances</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Review who owes whom and simplify group debts
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-600" /> You Are Owed
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight text-emerald-600 mt-1">
            +{formatCurrency(totalYouAreOwed, currencyCode)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            From {balanceEntries.filter((e) => e.netMinor > 0).length} people
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
            <TrendingDown size={14} className="text-red-600" /> You Owe
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight text-red-600 mt-1">
            -{formatCurrency(totalYouOwe, currencyCode)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            To {balanceEntries.filter((e) => e.netMinor < 0).length} people
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-stone-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Total Net Balance
          </p>
          <p
            className={cn(
              'text-2xl font-bold font-mono tracking-tight mt-1',
              netBalance > 0
                ? 'text-emerald-600'
                : netBalance < 0
                ? 'text-red-600'
                : 'text-stone-700'
            )}
          >
            {netBalance > 0 ? '+' : ''}
            {formatCurrency(netBalance, currencyCode)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {netBalance > 0 ? 'Overall positive' : netBalance < 0 ? 'Overall debt' : 'Even'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab('balances')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'balances'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <ArrowLeftRight size={16} /> Individual Balances ({balanceEntries.length})
        </button>
        <button
          onClick={() => setActiveTab('simplified')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'simplified'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <Sparkles size={16} className="text-emerald-600" /> Simplified Debts
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'history'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <History size={16} /> Settlements Log ({settlements.length})
        </button>
      </div>

      {/* TAB 1: Individual Balances */}
      {activeTab === 'balances' && (
        <div className="space-y-4">
          {balanceEntries.length === 0 ? (
            <div className="card p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="font-semibold text-stone-800">You are completely settled up!</h3>
              <p className="text-sm text-stone-500 max-w-sm mx-auto">
                No outstanding balances with any friends or groups.
              </p>
            </div>
          ) : (
            <div className="card divide-y divide-stone-100 overflow-hidden">
              {balanceEntries.map((entry) => {
                const avatarColor = generateAvatarColor(entry.profile.id);
                const isOwed = entry.netMinor > 0;

                return (
                  <div
                    key={entry.userId}
                    className="p-4 flex items-center justify-between hover:bg-stone-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-sm"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {getInitials(entry.profile.display_name)}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-900">
                          {entry.profile.display_name}
                        </p>
                        <p className="text-xs text-stone-400">@{entry.profile.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p
                          className={cn(
                            'text-sm font-bold font-mono',
                            isOwed ? 'text-emerald-600' : 'text-red-600'
                          )}
                        >
                          {isOwed
                            ? `owes you ${formatCurrency(entry.netMinor, currencyCode)}`
                            : `you owe ${formatCurrency(Math.abs(entry.netMinor), currencyCode)}`}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setTargetUser(entry.profile);
                          if (!isOwed) {
                            setSettlePayerId(currentUserId);
                            setSettleAmount(fromMinorUnits(Math.abs(entry.netMinor)));
                          } else {
                            setSettlePayerId(entry.profile.id);
                            setSettleAmount(fromMinorUnits(entry.netMinor));
                          }
                          setShowSettleModal(true);
                        }}
                        className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        <ArrowLeftRight size={13} /> Settle
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Simplified Debts */}
      {activeTab === 'simplified' && (
        <div className="space-y-4">
          <div className="card p-5 bg-gradient-to-r from-emerald-950 to-teal-950 text-white space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <Sparkles size={16} /> Intelligent Debt Simplification
            </div>
            <p className="text-xs text-emerald-100/80 leading-relaxed">
              Our graph-reduction algorithm minimizes the total number of transactions needed so everyone is settled up with the fewest possible payments.
            </p>
          </div>

          {simplifiedTransactions.length === 0 ? (
            <div className="card p-12 text-center text-stone-500 text-sm">
              No debts to simplify!
            </div>
          ) : (
            <div className="card divide-y divide-stone-100 overflow-hidden">
              {simplifiedTransactions.map((tx, idx) => {
                const fromUser = allProfiles.find((p) => p.id === tx.from) || {
                  id: tx.from,
                  display_name: tx.from === currentUserId ? 'You' : 'Member',
                };
                const toUser = allProfiles.find((p) => p.id === tx.to) || {
                  id: tx.to,
                  display_name: tx.to === currentUserId ? 'You' : 'Member',
                };

                const isYouPaying = tx.from === currentUserId;
                const isYouReceiving = tx.to === currentUserId;

                return (
                  <div
                    key={idx}
                    className="p-4 flex items-center justify-between hover:bg-stone-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                        <span className={cn(isYouPaying ? 'text-emerald-700 font-bold' : '')}>
                          {isYouPaying ? 'You' : fromUser.display_name}
                        </span>
                        <ArrowRight size={16} className="text-stone-400" />
                        <span className={cn(isYouReceiving ? 'text-emerald-700 font-bold' : '')}>
                          {isYouReceiving ? 'You' : toUser.display_name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-stone-900">
                        {formatCurrency(tx.amount_minor, currencyCode)}
                      </span>

                      {(isYouPaying || isYouReceiving) && (
                        <button
                          onClick={() => {
                            const other = isYouPaying ? toUser : fromUser;
                            setTargetUser(other as Profile);
                            setSettlePayerId(tx.from);
                            setSettleAmount(fromMinorUnits(tx.amount_minor));
                            setShowSettleModal(true);
                          }}
                          className="btn btn-secondary text-xs px-3 py-1"
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Settlements History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {settlements.length === 0 ? (
            <div className="card p-12 text-center text-stone-500 text-sm">
              No settlements logged yet.
            </div>
          ) : (
            <div className="card divide-y divide-stone-100 overflow-hidden">
              {settlements.map((s) => {
                const isPayer = s.payer_id === currentUserId;
                const isRecipient = s.recipient_id === currentUserId;

                return (
                  <div key={s.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">
                          {isPayer ? 'You' : s.payer?.display_name || 'Member'} paid{' '}
                          {isRecipient ? 'You' : s.recipient?.display_name || 'Member'}
                        </p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {new Date(s.settlement_date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {s.group ? ` • Group: ${s.group.name}` : ''}
                          {s.notes ? ` • "${s.notes}"` : ''}
                        </p>
                      </div>
                    </div>

                    <span className="font-mono font-bold text-sm text-stone-800">
                      {formatCurrency(s.amount_minor, s.currency_code)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Settle Up Modal */}
      {showSettleModal && targetUser && (
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
                <h3 className="font-bold text-lg text-stone-900">
                  Settle with {targetUser.display_name}
                </h3>
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
                  Payment Direction
                </label>
                <select
                  value={settlePayerId}
                  onChange={(e) => setSettlePayerId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={currentUserId}>You paid {targetUser.display_name}</option>
                  <option value={targetUser.id}>{targetUser.display_name} paid you</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Amount ({currencyCode})
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
                  placeholder="e.g. Cash, PayPal, Venmo"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
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
    </div>
  );
}
