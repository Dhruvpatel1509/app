'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Users,
  Search,
  PlusCircle,
  ArrowLeftRight,
  Check,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency, fromMinorUnits, toMinorUnits } from '@/lib/calculations';
import { getInitials, generateAvatarColor, cn } from '@/lib/utils';
import type { Friendship, Profile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface FriendsClientProps {
  friendships: any[];
  userSplits: any[];
  expensesPaidByUser: any[];
  settlements: any[];
  currentUserId: string;
  userCurrency: string;
}

export function FriendsClient({
  friendships: initialFriendships,
  userSplits,
  expensesPaidByUser,
  settlements,
  currentUserId,
  userCurrency,
}: FriendsClientProps) {
  const router = useRouter();
  const [friendships, setFriendships] = useState(initialFriendships);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settlePayerId, setSettlePayerId] = useState(currentUserId);
  const [settleLoading, setSettleLoading] = useState(false);

  // Compute friend balances
  // Balance with friend F:
  // (Expenses user paid where F has split) - (Expenses F paid where user has split) + (Settlements received from F) - (Settlements paid to F)
  const friendBalances: Record<string, number> = {};

  // 1. Where user paid and friend owes user:
  expensesPaidByUser.forEach((e: any) => {
    e.splits?.forEach((s: any) => {
      if (s.user_id !== currentUserId) {
        friendBalances[s.user_id] = (friendBalances[s.user_id] || 0) + s.owed_amount_minor;
      }
    });
  });

  // 2. Where user owed someone:
  userSplits.forEach((s: any) => {
    if (s.expense && !s.expense.is_deleted && s.expense.paid_by !== currentUserId) {
      const payerId = s.expense.paid_by;
      friendBalances[payerId] = (friendBalances[payerId] || 0) - s.owed_amount_minor;
    }
  });

  // 3. Settlements adjustment:
  settlements.forEach((st: any) => {
    if (st.payer_id === currentUserId) {
      // User paid friend -> reduces what user owes (adds to net balance)
      friendBalances[st.recipient_id] = (friendBalances[st.recipient_id] || 0) + st.amount_minor;
    } else if (st.recipient_id === currentUserId) {
      // Friend paid user -> reduces what friend owes
      friendBalances[st.payer_id] = (friendBalances[st.payer_id] || 0) - st.amount_minor;
    }
  });

  // Segregate friendships
  const acceptedFriends = friendships
    .filter((f) => f.status === 'accepted')
    .map((f) => {
      const isRequester = f.requester_id === currentUserId;
      const friendProfile: Profile = isRequester ? f.addressee : f.requester;
      const net = friendBalances[friendProfile?.id] || 0;
      return {
        ...friendProfile,
        friendshipId: f.id,
        netBalanceMinor: net,
      };
    })
    .filter((f) => f.id);

  const pendingIncoming = friendships.filter(
    (f) => f.status === 'pending' && f.addressee_id === currentUserId
  );

  const pendingOutgoing = friendships.filter(
    (f) => f.status === 'pending' && f.requester_id === currentUserId
  );

  // Totals
  const totalYouAreOwed = acceptedFriends
    .filter((f) => f.netBalanceMinor > 0)
    .reduce((sum, f) => sum + f.netBalanceMinor, 0);

  const totalYouOwe = acceptedFriends
    .filter((f) => f.netBalanceMinor < 0)
    .reduce((sum, f) => sum + Math.abs(f.netBalanceMinor), 0);

  // Filtered friends
  const filteredFriends = acceptedFriends.filter(
    (f) =>
      f.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleAcceptFriend = async (friendshipId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);

    if (!error) {
      setFriendships(
        friendships.map((f) =>
          f.id === friendshipId ? { ...f, status: 'accepted' } : f
        )
      );
      router.refresh();
    }
  };

  const handleDeclineFriend = async (friendshipId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);

    if (!error) {
      setFriendships(friendships.filter((f) => f.id !== friendshipId));
      router.refresh();
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername.trim()) return;
    setAddLoading(true);
    setAddError(null);
    setAddSuccess(false);

    const supabase = createClient();

    // 1. Find profile
    const { data: targetUser, error: searchError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', addUsername.trim().toLowerCase())
      .single();

    if (searchError || !targetUser) {
      setAddError('User not found. Check the username.');
      setAddLoading(false);
      return;
    }

    if (targetUser.id === currentUserId) {
      setAddError('You cannot add yourself as a friend.');
      setAddLoading(false);
      return;
    }

    // 2. Check if friendship already exists
    const existing = friendships.find(
      (f) =>
        (f.requester_id === targetUser.id && f.addressee_id === currentUserId) ||
        (f.requester_id === currentUserId && f.addressee_id === targetUser.id)
    );

    if (existing) {
      setAddError(`Friendship already exists (Status: ${existing.status}).`);
      setAddLoading(false);
      return;
    }

    // 3. Insert friendship request
    const { error: insertError } = await supabase.from('friendships').insert({
      requester_id: currentUserId,
      addressee_id: targetUser.id,
      status: 'pending',
    });

    setAddLoading(false);
    if (insertError) {
      setAddError(insertError.message);
    } else {
      setAddSuccess(true);
      setTimeout(() => {
        setShowAddModal(false);
        setAddUsername('');
        setAddSuccess(false);
        router.refresh();
      }, 1200);
    }
  };

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend) return;
    const amountMinor = toMinorUnits(settleAmount);
    if (amountMinor <= 0) return;

    setSettleLoading(true);
    const supabase = createClient();
    const recipientId =
      settlePayerId === currentUserId ? selectedFriend.id : currentUserId;

    const { error } = await supabase.from('settlements').insert({
      payer_id: settlePayerId,
      recipient_id: recipientId,
      amount_minor: amountMinor,
      currency_code: userCurrency,
      settlement_date: new Date().toISOString(),
      notes: settleNotes || null,
      created_by: currentUserId,
    });

    setSettleLoading(false);
    if (error) {
      alert('Failed to record settlement: ' + error.message);
    } else {
      setShowSettleModal(false);
      setSettleAmount('');
      setSettleNotes('');
      router.refresh();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Friends</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Manage your friends, track balances, and settle debts
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <UserPlus size={16} /> Add Friend
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Friends Owe You
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight text-emerald-600 mt-1">
            +{formatCurrency(totalYouAreOwed, userCurrency)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Across {acceptedFriends.filter((f) => f.netBalanceMinor > 0).length} friends
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            You Owe Friends
          </p>
          <p className="text-2xl font-bold font-mono tracking-tight text-red-600 mt-1">
            -{formatCurrency(totalYouOwe, userCurrency)}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            Across {acceptedFriends.filter((f) => f.netBalanceMinor < 0).length} friends
          </p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2',
            activeTab === 'all'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <Users size={16} /> All Friends ({acceptedFriends.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={cn(
            'px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-2 relative',
            activeTab === 'pending'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          )}
        >
          <Clock size={16} /> Requests
          {pendingIncoming.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
              {pendingIncoming.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB: All Friends */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {acceptedFriends.length > 0 && (
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                type="text"
                placeholder="Search friends by name or @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              />
            </div>
          )}

          {acceptedFriends.length === 0 ? (
            <div className="card p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800">No friends added yet</h3>
                <p className="text-sm text-stone-500 mt-1 max-w-sm mx-auto">
                  Add friends to split meals, trips, rent, and share expenses easily.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <UserPlus size={16} /> Add Your First Friend
              </button>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="card p-8 text-center text-stone-500 text-sm">
              No friends match &quot;{searchQuery}&quot;
            </div>
          ) : (
            <div className="card divide-y divide-stone-100 overflow-hidden">
              {filteredFriends.map((friend) => {
                const avatarColor = generateAvatarColor(friend.id);
                const hasBalance = friend.netBalanceMinor !== 0;

                return (
                  <div
                    key={friend.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-sm"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {getInitials(friend.display_name)}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-900">
                          {friend.display_name}
                        </p>
                        <p className="text-xs text-stone-400">@{friend.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-left sm:text-right">
                        <p
                          className={cn(
                            'text-sm font-bold font-mono',
                            friend.netBalanceMinor > 0
                              ? 'text-emerald-600'
                              : friend.netBalanceMinor < 0
                              ? 'text-red-600'
                              : 'text-stone-400'
                          )}
                        >
                          {friend.netBalanceMinor > 0
                            ? `owes you ${formatCurrency(friend.netBalanceMinor, userCurrency)}`
                            : friend.netBalanceMinor < 0
                            ? `you owe ${formatCurrency(Math.abs(friend.netBalanceMinor), userCurrency)}`
                            : 'Settled up'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {hasBalance && (
                          <button
                            onClick={() => {
                              setSelectedFriend(friend);
                              if (friend.netBalanceMinor < 0) {
                                setSettlePayerId(currentUserId);
                                setSettleAmount(fromMinorUnits(Math.abs(friend.netBalanceMinor)));
                              } else {
                                setSettlePayerId(friend.id);
                                setSettleAmount(fromMinorUnits(friend.netBalanceMinor));
                              }
                              setShowSettleModal(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors flex items-center gap-1.5"
                          >
                            <ArrowLeftRight size={13} /> Settle
                          </button>
                        )}

                        <Link
                          href={`/expenses/add?friend_id=${friend.id}`}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <PlusCircle size={13} /> Split
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Pending Requests */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          {/* Incoming */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
              Incoming Friend Requests ({pendingIncoming.length})
            </h3>
            {pendingIncoming.length === 0 ? (
              <div className="card p-6 text-center text-sm text-stone-400">
                No pending incoming requests
              </div>
            ) : (
              <div className="card divide-y divide-stone-100 overflow-hidden">
                {pendingIncoming.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                        style={{
                          backgroundColor: generateAvatarColor(req.requester?.id || ''),
                        }}
                      >
                        {getInitials(req.requester?.display_name || 'User')}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-900">
                          {req.requester?.display_name}
                        </p>
                        <p className="text-xs text-stone-400">@{req.requester?.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptFriend(req.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Check size={14} /> Accept
                      </button>
                      <button
                        onClick={() => handleDeclineFriend(req.id)}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <X size={14} /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
              Sent Requests ({pendingOutgoing.length})
            </h3>
            {pendingOutgoing.length === 0 ? (
              <div className="card p-6 text-center text-sm text-stone-400">
                No sent requests pending
              </div>
            ) : (
              <div className="card divide-y divide-stone-100 overflow-hidden">
                {pendingOutgoing.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                        style={{
                          backgroundColor: generateAvatarColor(req.addressee?.id || ''),
                        }}
                      >
                        {getInitials(req.addressee?.display_name || 'User')}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-900">
                          {req.addressee?.display_name}
                        </p>
                        <p className="text-xs text-stone-400">@{req.addressee?.username}</p>
                      </div>
                    </div>

                    <span className="text-xs font-semibold bg-stone-100 text-stone-500 px-2.5 py-1 rounded-full">
                      Pending acceptance
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Friend Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowAddModal(false)}
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
                <h3 className="font-bold text-lg text-stone-900">Add a Friend</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFriend} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Friend&apos;s Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-medium">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="username"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {addError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              {addSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>Friend request sent successfully!</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading || !addUsername.trim() || addSuccess}
                  className="btn btn-primary flex-1"
                >
                  {addLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Direct Modal */}
      {showSettleModal && selectedFriend && (
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
                  Settle with {selectedFriend.display_name}
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
                  <option value={currentUserId}>You paid {selectedFriend.display_name}</option>
                  <option value={selectedFriend.id}>{selectedFriend.display_name} paid you</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Amount ({userCurrency})
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
                  placeholder="e.g. Cash, Zelle, or Venmo"
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
