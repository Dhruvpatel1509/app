'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Store,
  CreditCard,
  Plus,
  Trash2,
  Users,
  Check,
  AlertCircle,
  Sparkles,
  DollarSign,
  PieChart,
  ArrowRight,
} from 'lucide-react';
import {
  toMinorUnits,
  fromMinorUnits,
  formatCurrency,
  calculateItemizedSplit,
  reconcileReceiptAllocation,
} from '@/lib/calculations';
import { getInitials, generateAvatarColor, cn } from '@/lib/utils';
import type { Receipt, Profile, ItemSplitInput, ExpenseCategory } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface ReceiptReviewClientProps {
  receipt: Receipt;
  currentUserId: string;
  userProfile: Profile | null;
  friends: Profile[];
  groups: any[];
}

interface EditableItem {
  temp_id: string;
  description: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
  participants: string[]; // user_ids
}

export function ReceiptReviewClient({
  receipt,
  currentUserId,
  userProfile,
  friends,
  groups,
}: ReceiptReviewClientProps) {
  const router = useRouter();

  // Receipt meta
  const [merchant, setMerchant] = useState(receipt.merchant || 'Unknown Merchant');
  const [date, setDate] = useState(receipt.receipt_date || new Date().toISOString().split('T')[0]);
  const [currencyCode, setCurrencyCode] = useState(receipt.currency_code || 'EUR');
  const [category, setCategory] = useState<ExpenseCategory>('dining');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [paidByUserId, setPaidByUserId] = useState(currentUserId);

  // Financial inputs
  const [taxStr, setTaxStr] = useState(fromMinorUnits(receipt.tax_minor));
  const [tipStr, setTipStr] = useState(fromMinorUnits(receipt.tip_minor));
  const [taxAllocation, setTaxAllocation] = useState<'proportional' | 'equal'>('proportional');
  const [tipAllocation, setTipAllocation] = useState<'proportional' | 'equal'>('proportional');

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

  // Overall selected participants for this receipt
  const [activeParticipantIds, setActiveParticipantIds] = useState<string[]>([currentUserId]);

  // Line items state initialized from OCR
  const [items, setItems] = useState<EditableItem[]>(() => {
    const ocrItems = receipt.ocr_raw?.line_items || [];
    if (ocrItems.length === 0) {
      return [
        {
          temp_id: 'item-1',
          description: 'General Items',
          quantity: 1,
          unit_price_minor: receipt.subtotal_minor || receipt.grand_total_minor,
          line_total_minor: receipt.subtotal_minor || receipt.grand_total_minor,
          participants: [currentUserId],
        },
      ];
    }

    return ocrItems.map((item, idx) => ({
      temp_id: `ocr-${item.id || idx}`,
      description: item.description,
      quantity: item.quantity || 1,
      unit_price_minor: toMinorUnits(item.unit_price || item.total),
      line_total_minor: toMinorUnits(item.total || (item.unit_price || 0) * (item.quantity || 1)),
      participants: [currentUserId],
    }));
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Toggle active participants for the entire expense
  const toggleGlobalParticipant = (uid: string) => {
    if (activeParticipantIds.includes(uid)) {
      if (activeParticipantIds.length <= 1) return;
      const next = activeParticipantIds.filter((id) => id !== uid);
      setActiveParticipantIds(next);
      // Remove from any items where they were selected
      setItems(
        items.map((it) => ({
          ...it,
          participants: it.participants.filter((p) => p !== uid),
        }))
      );
    } else {
      setActiveParticipantIds([...activeParticipantIds, uid]);
    }
  };

  // Toggle participant on a specific item
  const toggleItemParticipant = (tempId: string, uid: string) => {
    setItems(
      items.map((it) => {
        if (it.temp_id !== tempId) return it;
        const exists = it.participants.includes(uid);
        const updated = exists
          ? it.participants.filter((p) => p !== uid)
          : [...it.participants, uid];
        return { ...it, participants: updated.length === 0 ? [uid] : updated };
      })
    );
  };

  // Select all active participants for an item
  const selectAllForItem = (tempId: string) => {
    setItems(
      items.map((it) => {
        if (it.temp_id !== tempId) return it;
        return { ...it, participants: [...activeParticipantIds] };
      })
    );
  };

  // Add / remove items
  const handleAddItem = () => {
    const newItem: EditableItem = {
      temp_id: `custom-${Date.now()}`,
      description: 'New Item',
      quantity: 1,
      unit_price_minor: 0,
      line_total_minor: 0,
      participants: [...activeParticipantIds],
    };
    setItems([...items, newItem]);
  };

  const handleDeleteItem = (tempId: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((it) => it.temp_id !== tempId));
  };

  // Update item field
  const updateItem = (tempId: string, field: 'description' | 'total', value: string) => {
    setItems(
      items.map((it) => {
        if (it.temp_id !== tempId) return it;
        if (field === 'description') {
          return { ...it, description: value };
        }
        const line_total_minor = toMinorUnits(value);
        return {
          ...it,
          line_total_minor,
          unit_price_minor: line_total_minor / (it.quantity || 1),
        };
      })
    );
  };

  // Minor unit totals
  const subtotalMinor = items.reduce((sum, it) => sum + it.line_total_minor, 0);
  const taxMinor = toMinorUnits(taxStr);
  const tipMinor = toMinorUnits(tipStr);
  const grandTotalMinor = subtotalMinor + taxMinor + tipMinor;

  // Run calculation engine
  const calculationResult = useMemo(() => {
    const itemSplitInputs: ItemSplitInput[] = items.map((it) => ({
      temp_id: it.temp_id,
      description: it.description,
      quantity: it.quantity,
      unit_price_minor: it.unit_price_minor,
      line_total_minor: it.line_total_minor,
      participants: it.participants,
      method: 'equal',
    }));

    return calculateItemizedSplit({
      items: itemSplitInputs,
      tax_minor: taxMinor,
      tip_minor: tipMinor,
      discount_minor: 0,
      tax_allocation: taxAllocation,
      tip_allocation: tipAllocation,
    });
  }, [items, taxMinor, tipMinor, taxAllocation, tipAllocation]);

  // Reconcile
  const reconciliation = useMemo(() => {
    return reconcileReceiptAllocation(grandTotalMinor, calculationResult.expense_splits);
  }, [grandTotalMinor, calculationResult]);

  // Save to database
  const handleConfirmAndSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      // 1. Create expense
      const { data: newExpense, error: expError } = await supabase
        .from('expenses')
        .insert({
          description: `${merchant} (Receipt)`,
          group_id: selectedGroupId || null,
          paid_by: paidByUserId,
          created_by: currentUserId,
          currency_code: currencyCode,
          category,
          split_method: 'itemized',
          subtotal_minor: subtotalMinor,
          tax_minor: taxMinor,
          tip_minor: tipMinor,
          discount_minor: 0,
          total_minor: grandTotalMinor,
          receipt_id: receipt.id,
          expense_date: date,
          notes: `Itemized receipt split with ${activeParticipantIds.length} people.`,
          is_deleted: false,
        })
        .select()
        .single();

      if (expError || !newExpense) {
        throw new Error(expError?.message || 'Failed to create expense.');
      }

      // 2. Insert expense_participants
      const participantRows = activeParticipantIds.map((uid) => ({
        expense_id: newExpense.id,
        user_id: uid,
      }));
      await supabase.from('expense_participants').insert(participantRows);

      // 3. Insert expense_items
      const itemRows = items.map((it, idx) => ({
        expense_id: newExpense.id,
        description: it.description,
        quantity: it.quantity,
        unit_price_minor: it.unit_price_minor,
        line_total_minor: it.line_total_minor,
        sort_order: idx,
        tax_minor: 0,
        discount_minor: 0,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('expense_items')
        .insert(itemRows)
        .select();

      if (itemsError || !insertedItems) {
        throw new Error(itemsError?.message || 'Failed to save line items.');
      }

      // 4. Insert expense_splits
      const splitRows = calculationResult.expense_splits.map((alloc) => ({
        expense_id: newExpense.id,
        user_id: alloc.user_id,
        owed_amount_minor: alloc.owed_amount_minor,
        personal_spending_minor: alloc.personal_spending_minor,
        split_metadata: {
          method: 'itemized',
          tax_allocation: taxAllocation,
          tip_allocation: tipAllocation,
        },
      }));
      await supabase.from('expense_splits').insert(splitRows);

      // 5. Update receipt status
      await supabase
        .from('receipts')
        .update({
          merchant,
          receipt_date: date,
          subtotal_minor: subtotalMinor,
          tax_minor: taxMinor,
          tip_minor: tipMinor,
          grand_total_minor: grandTotalMinor,
          processing_status: 'confirmed',
        })
        .eq('id', receipt.id);

      // Done! Redirect
      if (selectedGroupId) {
        router.push(`/groups/${selectedGroupId}`);
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while saving itemized expense.');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">
      {/* Top back nav */}
      <div className="flex items-center gap-2">
        <Link
          href="/receipts/scan"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors bg-white px-2.5 py-1.5 rounded-lg border border-stone-200"
        >
          <ArrowLeft size={14} /> Scan Another
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-semibold rounded-full mb-1">
            <Sparkles size={12} /> AI Extracted
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Review Receipt & Split Items
          </h1>
          <p className="text-sm text-stone-500">
            Assign each item to the people who shared it. Tax & tip are split proportionally.
          </p>
        </div>
      </div>

      {/* SECTION 1: Receipt Header Info */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Merchant
            </label>
            <div className="relative">
              <Store size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Receipt Date
            </label>
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Group (Optional)
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Personal / With Friends</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Paid By
            </label>
            <select
              value={paidByUserId}
              onChange={(e) => setPaidByUserId(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {candidatePool
                .filter((p) => activeParticipantIds.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === currentUserId ? 'You' : p.display_name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 2: Global Participants Filter */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            People on this Bill
          </label>
          <span className="text-xs text-stone-400">
            {activeParticipantIds.length} person{activeParticipantIds.length === 1 ? '' : 's'} splitting
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {candidatePool.map((p) => {
            const isSelected = activeParticipantIds.includes(p.id);
            const isCurrentUser = p.id === currentUserId;
            const avatarColor = generateAvatarColor(p.id);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleGlobalParticipant(p.id)}
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

      {/* SECTION 3: Line Items & Participant Assignment Table */}
      <div className="card divide-y divide-stone-100 overflow-hidden">
        <div className="p-4 bg-stone-50/70 flex items-center justify-between border-b border-stone-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            Receipt Line Items ({items.length})
          </h2>
          <button
            type="button"
            onClick={handleAddItem}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>

        {items.map((item, index) => (
          <div key={item.temp_id} className="p-4 space-y-3 hover:bg-stone-50/40 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-stone-400 w-5 text-right shrink-0">
                {index + 1}.
              </span>

              {/* Description Input */}
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(item.temp_id, 'description', e.target.value)}
                className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

              {/* Line Total Input */}
              <div className="relative w-28 shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">
                  €
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fromMinorUnits(item.line_total_minor)}
                  onChange={(e) => updateItem(item.temp_id, 'total', e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold text-stone-900 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Delete Button */}
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.temp_id)}
                  className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Item Split Selection Chips */}
            <div className="pl-8 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mr-1">
                Shared by:
              </span>

              {activeParticipantIds.map((uid) => {
                const isItemParticipant = item.participants.includes(uid);
                const participant = candidatePool.find((p) => p.id === uid);
                const name = uid === currentUserId ? 'You' : participant?.display_name || 'Member';
                const avatarColor = generateAvatarColor(uid);

                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => toggleItemParticipant(item.temp_id, uid)}
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all',
                      isItemParticipant
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    )}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials(name)}
                    </div>
                    <span>{name}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => selectAllForItem(item.temp_id)}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline ml-2"
              >
                All
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 4: Tax, Tip, and Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tax and Tip Settings */}
        <div className="card p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            Tax & Tip Allocation
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <label className="text-xs font-medium text-stone-700">Tax Amount (€)</label>
              <div className="relative w-32">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxStr}
                  onChange={(e) => setTaxStr(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>Tax Distribution:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTaxAllocation('proportional')}
                  className={cn(
                    'px-2 py-0.5 rounded font-medium',
                    taxAllocation === 'proportional'
                      ? 'bg-emerald-100 text-emerald-800 font-bold'
                      : 'bg-stone-100 text-stone-600'
                  )}
                >
                  Proportional
                </button>
                <button
                  type="button"
                  onClick={() => setTaxAllocation('equal')}
                  className={cn(
                    'px-2 py-0.5 rounded font-medium',
                    taxAllocation === 'equal'
                      ? 'bg-emerald-100 text-emerald-800 font-bold'
                      : 'bg-stone-100 text-stone-600'
                  )}
                >
                  Equal
                </button>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-3 flex items-center justify-between gap-4">
              <label className="text-xs font-medium text-stone-700">Tip Amount (€)</label>
              <div className="relative w-32">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs">€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tipStr}
                  onChange={(e) => setTipStr(e.target.value)}
                  className="w-full pl-6 pr-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>Tip Distribution:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipAllocation('proportional')}
                  className={cn(
                    'px-2 py-0.5 rounded font-medium',
                    tipAllocation === 'proportional'
                      ? 'bg-emerald-100 text-emerald-800 font-bold'
                      : 'bg-stone-100 text-stone-600'
                  )}
                >
                  Proportional
                </button>
                <button
                  type="button"
                  onClick={() => setTipAllocation('equal')}
                  className={cn(
                    'px-2 py-0.5 rounded font-medium',
                    tipAllocation === 'equal'
                      ? 'bg-emerald-100 text-emerald-800 font-bold'
                      : 'bg-stone-100 text-stone-600'
                  )}
                >
                  Equal
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Bill Totals Card */}
        <div className="card p-5 space-y-3 bg-gradient-to-br from-stone-900 to-stone-800 text-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Bill Total Summary
          </h3>

          <div className="space-y-1.5 text-xs text-stone-300">
            <div className="flex justify-between">
              <span>Subtotal ({items.length} items)</span>
              <span className="font-mono">{formatCurrency(subtotalMinor, currencyCode)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span className="font-mono">+{formatCurrency(taxMinor, currencyCode)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tip</span>
              <span className="font-mono">+{formatCurrency(tipMinor, currencyCode)}</span>
            </div>
            <div className="border-t border-stone-700 pt-2 flex justify-between items-baseline text-base font-bold text-white">
              <span>Grand Total</span>
              <span className="text-xl font-mono text-emerald-400">
                {formatCurrency(grandTotalMinor, currencyCode)}
              </span>
            </div>
          </div>

          <div className="pt-2">
            {reconciliation.is_balanced ? (
              <div className="p-2 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-300 flex items-center gap-1.5">
                <Check size={13} className="text-emerald-400" />
                <span>Split allocations match grand total perfectly</span>
              </div>
            ) : (
              <div className="p-2 bg-amber-950/60 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 flex items-center gap-1.5">
                <AlertCircle size={13} className="text-amber-400" />
                <span>{reconciliation.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 5: Individual Breakdown Live Preview */}
      <div className="card p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
          Who Pays What (Live Calculation)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {calculationResult.expense_splits.map((alloc) => {
            const participant = candidatePool.find((p) => p.id === alloc.user_id);
            const name = alloc.user_id === currentUserId ? 'You' : participant?.display_name || 'Member';
            const avatarColor = generateAvatarColor(alloc.user_id);

            return (
              <div
                key={alloc.user_id}
                className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {getInitials(name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-900 text-xs truncate">{name}</p>
                    <p className="text-[10px] text-stone-400">
                      Items + Tax + Tip
                    </p>
                  </div>
                </div>

                <span className="font-mono font-bold text-sm text-stone-900 shrink-0">
                  {formatCurrency(alloc.owed_amount_minor, currencyCode)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Submit Action */}
      <div className="flex gap-4">
        <Link href="/receipts/scan" className="btn btn-secondary px-6">
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleConfirmAndSave}
          disabled={saving || grandTotalMinor <= 0}
          className="btn btn-primary flex-1 py-3 text-base font-semibold shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2"
        >
          {saving ? 'Creating Expense...' : 'Confirm & Save Shared Expense'}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
