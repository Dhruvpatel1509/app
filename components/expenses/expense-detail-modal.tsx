'use client';

import React from 'react';
import {
  X,
  Calendar,
  Tag,
  CreditCard,
  User,
  Receipt as ReceiptIcon,
  ShoppingBag,
  Utensils,
  Car,
  Plane,
  Home,
  Film,
  Zap,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { formatCurrency, fromMinorUnits } from '@/lib/calculations';
import { getInitials, generateAvatarColor, cn } from '@/lib/utils';
import type { Expense } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  groceries: ShoppingBag,
  dining: Utensils,
  transport: Car,
  travel: Plane,
  household: Home,
  shopping: ShoppingBag,
  entertainment: Film,
  bills: Zap,
  other: MoreHorizontal,
};

interface ExpenseDetailModalProps {
  expense: Expense | null;
  currentUserId: string;
  onClose: () => void;
  onDeleted?: (expenseId: string) => void;
}

export function ExpenseDetailModal({
  expense,
  currentUserId,
  onClose,
  onDeleted,
}: ExpenseDetailModalProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!expense) return null;

  const CategoryIcon = CATEGORY_ICONS[expense.category] || MoreHorizontal;
  const payerName =
    expense.payer?.id === currentUserId
      ? 'You'
      : expense.payer?.display_name || 'Someone';

  const userSplit = expense.splits?.find((s) => s.user_id === currentUserId);
  const isCreatorOrPayer =
    expense.created_by === currentUserId || expense.paid_by === currentUserId;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this expense? This cannot be undone.')) {
      return;
    }
    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('expenses')
      .update({ is_deleted: true })
      .eq('id', expense.id);

    setIsDeleting(false);
    if (!error) {
      if (onDeleted) onDeleted(expense.id);
      onClose();
      router.refresh();
    } else {
      alert('Failed to delete expense: ' + error.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 px-6 py-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <CategoryIcon size={24} className="text-emerald-300" />
            </div>
            <div className="min-w-0 pr-8">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                {expense.category}
              </span>
              <h2 className="text-xl font-bold text-white truncate">
                {expense.description}
              </h2>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-baseline justify-between">
            <span className="text-sm text-emerald-200">Total Amount</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {formatCurrency(expense.total_minor, expense.currency_code)}
            </span>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Key metadata grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex items-center gap-2.5">
              <Calendar size={16} className="text-stone-400 shrink-0" />
              <div>
                <p className="text-xs text-stone-500">Date</p>
                <p className="font-medium text-stone-800">
                  {new Date(expense.expense_date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex items-center gap-2.5">
              <CreditCard size={16} className="text-stone-400 shrink-0" />
              <div>
                <p className="text-xs text-stone-500">Paid by</p>
                <p className="font-medium text-stone-800 truncate">{payerName}</p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex items-center gap-2.5">
              <Tag size={16} className="text-stone-400 shrink-0" />
              <div>
                <p className="text-xs text-stone-500">Split Method</p>
                <p className="font-medium text-stone-800 capitalize">
                  {expense.split_method}
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex items-center gap-2.5">
              <User size={16} className="text-stone-400 shrink-0" />
              <div>
                <p className="text-xs text-stone-500">Your Share</p>
                <p className="font-semibold text-emerald-700">
                  {userSplit
                    ? formatCurrency(userSplit.owed_amount_minor, expense.currency_code)
                    : 'Not involved'}
                </p>
              </div>
            </div>
          </div>

          {/* Subtotal / Tax / Tip Breakdown if applicable */}
          {(expense.tax_minor > 0 || expense.tip_minor > 0 || expense.discount_minor > 0) && (
            <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs space-y-1.5">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span>{formatCurrency(expense.subtotal_minor, expense.currency_code)}</span>
              </div>
              {expense.tax_minor > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Tax</span>
                  <span>+{formatCurrency(expense.tax_minor, expense.currency_code)}</span>
                </div>
              )}
              {expense.tip_minor > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Tip</span>
                  <span>+{formatCurrency(expense.tip_minor, expense.currency_code)}</span>
                </div>
              )}
              {expense.discount_minor > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(expense.discount_minor, expense.currency_code)}</span>
                </div>
              )}
            </div>
          )}

          {/* Itemized list if available */}
          {expense.items && expense.items.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
                <ReceiptIcon size={14} /> Itemized Breakdown
              </h4>
              <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 overflow-hidden text-sm">
                {expense.items.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between bg-white hover:bg-stone-50">
                    <div>
                      <p className="font-medium text-stone-800">{item.description}</p>
                      <p className="text-xs text-stone-400">
                        {item.quantity} &times; {formatCurrency(item.unit_price_minor, expense.currency_code)}
                      </p>
                    </div>
                    <span className="font-medium font-mono text-stone-700">
                      {formatCurrency(item.line_total_minor, expense.currency_code)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participant splits list */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
              <User size={14} /> Split Breakdown ({expense.splits?.length || 0})
            </h4>
            <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 overflow-hidden">
              {expense.splits?.map((split) => {
                const isUser = split.user_id === currentUserId;
                const name = isUser ? 'You' : split.profile?.display_name || 'Member';
                const avatarColor = split.profile?.id
                  ? generateAvatarColor(split.profile.id)
                  : '#059669';

                return (
                  <div
                    key={split.id}
                    className={cn(
                      'p-3 flex items-center justify-between text-sm',
                      isUser ? 'bg-emerald-50/40' : 'bg-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {getInitials(name)}
                      </div>
                      <span className={cn('font-medium', isUser ? 'text-emerald-900 font-semibold' : 'text-stone-800')}>
                        {name}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-stone-800">
                      {formatCurrency(split.owed_amount_minor, expense.currency_code)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes if present */}
          {expense.notes && (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600">
              <span className="font-semibold text-stone-700 block mb-0.5">Notes:</span>
              {expense.notes}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          {isCreatorOrPayer ? (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              {isDeleting ? 'Deleting...' : 'Delete Expense'}
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
