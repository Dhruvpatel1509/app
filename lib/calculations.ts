// ============================================================
// Cashual — Financial Calculation Engine
// All amounts are integer minor units (e.g., cents for USD)
// This module is pure and has no UI or database dependencies.
// ============================================================

import type {
  SplitMethod,
  SplitInput,
  SplitParticipant,
  ParticipantAllocation,
  CalculatedSplit,
  ItemizedSplitInput,
  ItemSplitInput,
} from './types';

// ============================================================
// CURRENCY UTILITIES
// ============================================================

/**
 * Converts a decimal string (e.g. "12.50") to minor units (1250)
 * Uses string parsing to avoid floating-point imprecision.
 */
export function toMinorUnits(amount: string | number, decimals = 2): number {
  const str = String(amount).trim();
  if (!str || isNaN(Number(str))) return 0;

  const [intPart, fracPart = ''] = str.split('.');
  const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
  const minor = parseInt(intPart, 10) * Math.pow(10, decimals) + parseInt(paddedFrac, 10);
  return isNaN(minor) ? 0 : minor;
}

/**
 * Converts minor units to a formatted decimal string.
 */
export function fromMinorUnits(minor: number, decimals = 2): string {
  const factor = Math.pow(10, decimals);
  const int = Math.floor(Math.abs(minor) / factor);
  const frac = Math.abs(minor) % factor;
  const sign = minor < 0 ? '-' : '';
  return `${sign}${int}.${String(frac).padStart(decimals, '0')}`;
}

/**
 * Formats minor units as currency display string.
 */
export function formatCurrency(
  minor: number,
  currencyCode = 'EUR',
  locale = 'en-US'
): string {
  const decimal = minor / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(decimal);
}

/**
 * Largest-remainder rounding for distributing integer amounts.
 * Ensures sum(result) === total exactly.
 */
export function largestRemainderRound(
  weights: number[],
  total: number
): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (w / sum) * total);
  const floored = exact.map(Math.floor);
  const remainder = total - floored.reduce((a, b) => a + b, 0);

  // Sort by fractional part descending, distribute remaining pennies
  const fractionals = exact.map((v, i) => ({ i, frac: v - floored[i] }));
  fractionals.sort((a, b) => b.frac - a.frac);

  for (let r = 0; r < remainder; r++) {
    floored[fractionals[r].i] += 1;
  }

  return floored;
}

// ============================================================
// SPLIT CALCULATORS
// ============================================================

/**
 * Equal split: divide total evenly using largest-remainder rounding.
 */
function calculateEqualSplit(
  total_minor: number,
  participants: SplitParticipant[]
): number[] {
  const n = participants.length;
  if (n === 0) return [];
  return largestRemainderRound(new Array(n).fill(1), total_minor);
}

/**
 * Exact split: each participant specifies their amount.
 * Validates sum === total.
 */
function calculateExactSplit(
  total_minor: number,
  participants: SplitParticipant[]
): { amounts: number[]; errors: string[] } {
  const amounts = participants.map((p) => p.exact_minor ?? 0);
  const sum = amounts.reduce((a, b) => a + b, 0);
  const errors: string[] = [];

  if (sum !== total_minor) {
    errors.push(
      `Exact amounts sum to ${fromMinorUnits(sum)} but total is ${fromMinorUnits(total_minor)} (difference: ${fromMinorUnits(total_minor - sum)})`
    );
  }

  return { amounts, errors };
}

/**
 * Percentage split: participants specify percentages (0–100).
 * Validates percentages sum to 100.
 */
function calculatePercentageSplit(
  total_minor: number,
  participants: SplitParticipant[]
): { amounts: number[]; errors: string[] } {
  const percentages = participants.map((p) => p.percentage ?? 0);
  const sum = percentages.reduce((a, b) => a + b, 0);
  const errors: string[] = [];

  if (Math.abs(sum - 100) > 0.001) {
    errors.push(`Percentages sum to ${sum.toFixed(2)}% but must equal 100%`);
  }

  const amounts = largestRemainderRound(percentages, total_minor);
  return { amounts, errors };
}

/**
 * Shares split: each participant has a weight (e.g. 2 shares vs 1 share).
 */
function calculateSharesSplit(
  total_minor: number,
  participants: SplitParticipant[]
): { amounts: number[]; errors: string[] } {
  const shares = participants.map((p) => Math.max(p.shares ?? 1, 0));
  const errors: string[] = [];

  if (shares.every((s) => s === 0)) {
    errors.push('All share weights are zero');
    return { amounts: shares.map(() => 0), errors };
  }

  const amounts = largestRemainderRound(shares, total_minor);
  return { amounts, errors };
}

/**
 * Adjustment split: base is equal, then adjustments are applied.
 * Remaining amount after adjustments is split equally.
 */
function calculateAdjustmentSplit(
  total_minor: number,
  participants: SplitParticipant[]
): { amounts: number[]; errors: string[] } {
  const adjustments = participants.map((p) => p.adjustment_minor ?? 0);
  const totalAdjustment = adjustments.reduce((a, b) => a + b, 0);
  const errors: string[] = [];
  const remaining = total_minor - totalAdjustment;

  if (remaining < 0) {
    errors.push(
      `Total adjustments (${fromMinorUnits(totalAdjustment)}) exceed expense total (${fromMinorUnits(total_minor)})`
    );
    return { amounts: adjustments, errors };
  }

  const equalParts = largestRemainderRound(
    new Array(participants.length).fill(1),
    remaining
  );

  const amounts = equalParts.map((eq, i) => eq + adjustments[i]);
  return { amounts, errors };
}

// ============================================================
// MAIN SPLIT CALCULATOR
// ============================================================

/**
 * Calculate participant allocations for an expense.
 * Returns the owed_amount_minor for each participant.
 * The payer gets credit for what others owe them (handled at balance level).
 */
export function calculateSplit(input: SplitInput): CalculatedSplit {
  const { method, total_minor, participants } = input;

  if (participants.length === 0) {
    return {
      allocations: [],
      total_allocated_minor: 0,
      rounding_remainder_minor: 0,
      is_valid: false,
      errors: ['No participants specified'],
    };
  }

  let amounts: number[] = [];
  let errors: string[] = [];

  switch (method) {
    case 'equal': {
      amounts = calculateEqualSplit(total_minor, participants);
      break;
    }
    case 'exact': {
      const result = calculateExactSplit(total_minor, participants);
      amounts = result.amounts;
      errors = result.errors;
      break;
    }
    case 'percentage': {
      const result = calculatePercentageSplit(total_minor, participants);
      amounts = result.amounts;
      errors = result.errors;
      break;
    }
    case 'shares': {
      const result = calculateSharesSplit(total_minor, participants);
      amounts = result.amounts;
      errors = result.errors;
      break;
    }
    case 'adjustment': {
      const result = calculateAdjustmentSplit(total_minor, participants);
      amounts = result.amounts;
      errors = result.errors;
      break;
    }
    default:
      errors.push(`Unknown split method: ${method}`);
      amounts = participants.map(() => 0);
  }

  const total_allocated = amounts.reduce((a, b) => a + b, 0);
  const rounding_remainder = total_minor - total_allocated;

  if (Math.abs(rounding_remainder) > participants.length) {
    errors.push(
      `Allocation total (${fromMinorUnits(total_allocated)}) differs from expense total (${fromMinorUnits(total_minor)}) by more than rounding tolerance`
    );
  }

  const allocations: ParticipantAllocation[] = participants.map((p, i) => ({
    user_id: p.user_id,
    owed_amount_minor: amounts[i],
    personal_spending_minor: amounts[i], // Overridden for itemized splits
  }));

  return {
    allocations,
    total_allocated_minor: total_allocated,
    rounding_remainder_minor: rounding_remainder,
    is_valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// ITEMIZED SPLIT CALCULATOR
// ============================================================

export interface ItemizedSplitResult {
  item_allocations: {
    temp_id: string;
    user_allocations: { user_id: string; share_minor: number }[];
  }[];
  expense_splits: ParticipantAllocation[];
  total_allocated_minor: number;
  is_valid: boolean;
  errors: string[];
}

/**
 * Calculate itemized splits with tax/tip/discount allocation.
 */
export function calculateItemizedSplit(
  input: ItemizedSplitInput
): ItemizedSplitResult {
  const errors: string[] = [];
  const allParticipants = new Set<string>();

  // Collect all participants
  input.items.forEach((item) => {
    item.participants.forEach((uid) => allParticipants.add(uid));
  });

  // Per-item allocation (before tax/tip/discount)
  const itemResults = input.items.map((item) => {
    const participantInputs: SplitParticipant[] = item.participants.map((uid) => {
      const override = item.participant_overrides?.find((o) => o.user_id === uid);
      return { user_id: uid, ...override };
    });

    const splitResult = calculateSplit({
      method: item.method,
      total_minor: item.line_total_minor,
      participants: participantInputs,
    });

    errors.push(...splitResult.errors.map((e) => `Item "${item.description}": ${e}`));

    return {
      temp_id: item.temp_id,
      user_allocations: splitResult.allocations.map((a) => ({
        user_id: a.user_id,
        share_minor: a.owed_amount_minor,
      })),
    };
  });

  // Aggregate item totals per user
  const userItemTotals: Record<string, number> = {};
  itemResults.forEach((item) => {
    item.user_allocations.forEach(({ user_id, share_minor }) => {
      userItemTotals[user_id] = (userItemTotals[user_id] ?? 0) + share_minor;
    });
  });

  const grandItemTotal = Object.values(userItemTotals).reduce((a, b) => a + b, 0);

  // Allocate tax proportionally
  let userTaxAllocations: Record<string, number> = {};
  if (input.tax_minor > 0 && grandItemTotal > 0) {
    const userIds = Object.keys(userItemTotals);
    const weights = userIds.map((uid) => userItemTotals[uid]);
    const taxAmounts = largestRemainderRound(weights, input.tax_minor);
    userIds.forEach((uid, i) => {
      userTaxAllocations[uid] = taxAmounts[i];
    });
  }

  // Allocate tip proportionally
  let userTipAllocations: Record<string, number> = {};
  if (input.tip_minor > 0 && grandItemTotal > 0) {
    const userIds = Object.keys(userItemTotals);
    const weights = userIds.map((uid) => userItemTotals[uid]);
    const tipAmounts = largestRemainderRound(weights, input.tip_minor);
    userIds.forEach((uid, i) => {
      userTipAllocations[uid] = tipAmounts[i];
    });
  }

  // Allocate discount proportionally (reduces each user's share)
  let userDiscountAllocations: Record<string, number> = {};
  if (input.discount_minor > 0 && grandItemTotal > 0) {
    const userIds = Object.keys(userItemTotals);
    const weights = userIds.map((uid) => userItemTotals[uid]);
    const discountAmounts = largestRemainderRound(weights, input.discount_minor);
    userIds.forEach((uid, i) => {
      userDiscountAllocations[uid] = discountAmounts[i];
    });
  }

  // Final per-user totals
  const expense_splits: ParticipantAllocation[] = Array.from(allParticipants).map((uid) => {
    const items = userItemTotals[uid] ?? 0;
    const tax = userTaxAllocations[uid] ?? 0;
    const tip = userTipAllocations[uid] ?? 0;
    const discount = userDiscountAllocations[uid] ?? 0;
    const total = items + tax + tip - discount;

    return {
      user_id: uid,
      owed_amount_minor: total,
      personal_spending_minor: total, // All items treated as personal for itemized
    };
  });

  const total_allocated = expense_splits.reduce((a, b) => a + b.owed_amount_minor, 0);

  return {
    item_allocations: itemResults,
    expense_splits,
    total_allocated_minor: total_allocated,
    is_valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// BALANCE CALCULATIONS
// ============================================================

export interface BalanceEntry {
  counterpart_id: string;
  net_minor: number; // positive = counterpart owes you, negative = you owe counterpart
  currency_code: string;
}

/**
 * Calculate net balance between current user and all others.
 * Uses expense splits and settlements.
 */
export function calculateNetBalances(
  userId: string,
  expenseSplits: Array<{
    expense_id: string;
    user_id: string;
    owed_amount_minor: number;
    expense: { paid_by: string; currency_code: string };
  }>,
  settlements: Array<{
    payer_id: string;
    recipient_id: string;
    amount_minor: number;
    currency_code: string;
  }>
): BalanceEntry[] {
  const balances: Record<string, Record<string, number>> = {};

  // From expense splits: money owed
  expenseSplits.forEach((split) => {
    const payer = split.expense.paid_by;
    const currency = split.expense.currency_code;

    if (split.user_id === userId && payer !== userId) {
      // I owe payer
      if (!balances[payer]) balances[payer] = {};
      balances[payer][currency] = (balances[payer][currency] ?? 0) - split.owed_amount_minor;
    } else if (payer === userId && split.user_id !== userId) {
      // They owe me
      if (!balances[split.user_id]) balances[split.user_id] = {};
      balances[split.user_id][currency] = (balances[split.user_id][currency] ?? 0) + split.owed_amount_minor;
    }
  });

  // From settlements
  settlements.forEach((s) => {
    const currency = s.currency_code;
    if (s.payer_id === userId) {
      // I paid them — reduces what I owe
      if (!balances[s.recipient_id]) balances[s.recipient_id] = {};
      balances[s.recipient_id][currency] = (balances[s.recipient_id][currency] ?? 0) + s.amount_minor;
    } else if (s.recipient_id === userId) {
      // They paid me — reduces what they owe
      if (!balances[s.payer_id]) balances[s.payer_id] = {};
      balances[s.payer_id][currency] = (balances[s.payer_id][currency] ?? 0) - s.amount_minor;
    }
  });

  // Flatten to BalanceEntry[]
  const result: BalanceEntry[] = [];
  Object.entries(balances).forEach(([counterpartId, currencies]) => {
    Object.entries(currencies).forEach(([currency, net]) => {
      if (net !== 0) {
        result.push({
          counterpart_id: counterpartId,
          net_minor: net,
          currency_code: currency,
        });
      }
    });
  });

  return result;
}

/**
 * Calculate personal spending for the current user.
 * Based on personal_spending_minor from expense_splits.
 * Excludes expenses where the user paid on behalf of others only.
 */
export function calculatePersonalSpending(
  splits: Array<{ personal_spending_minor: number; expense?: { expense_date?: string } }>
): number {
  return splits.reduce((acc, s) => acc + s.personal_spending_minor, 0);
}

/**
 * Validate that a proposed settlement amount is valid.
 * Settlement cannot exceed the outstanding balance in that direction.
 */
export function validateSettlementAmount(
  amount_minor: number,
  outstanding_minor: number
): { valid: boolean; error?: string } {
  if (amount_minor <= 0) {
    return { valid: false, error: 'Settlement amount must be positive' };
  }
  // Allow settling more than outstanding? No — strict mode.
  if (amount_minor > outstanding_minor) {
    return {
      valid: false,
      error: `Settlement amount exceeds outstanding balance of ${fromMinorUnits(outstanding_minor)}`,
    };
  }
  return { valid: true };
}

// ============================================================
// RECEIPT RECONCILIATION
// ============================================================

export interface ReconciliationResult {
  receipt_total_minor: number;
  allocated_total_minor: number;
  difference_minor: number;
  is_balanced: boolean;
  message: string | null;
}

export function reconcileReceiptAllocation(
  receipt_total_minor: number,
  expense_splits: ParticipantAllocation[]
): ReconciliationResult {
  const allocated = expense_splits.reduce((a, b) => a + b.owed_amount_minor, 0);
  const diff = receipt_total_minor - allocated;

  return {
    receipt_total_minor,
    allocated_total_minor: allocated,
    difference_minor: diff,
    is_balanced: Math.abs(diff) === 0,
    message:
      diff === 0
        ? null
        : diff > 0
        ? `Receipt total is ${fromMinorUnits(diff)} more than allocated. Please assign remaining amount.`
        : `Allocations exceed receipt total by ${fromMinorUnits(Math.abs(diff))}. Please review item prices.`,
  };
}

// ============================================================
// DEBT SIMPLIFICATION
// ============================================================

export interface DebtTransaction {
  from: string;
  to: string;
  amount_minor: number;
  currency_code: string;
}

/**
 * Greedy debt simplification algorithm.
 * Reduces bipartite transactions to minimal number of transfers.
 */
export function simplifyDebts(
  netBalances: Record<string, number>,
  currencyCode = 'EUR'
): DebtTransaction[] {
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  Object.entries(netBalances).forEach(([id, net]) => {
    if (net < 0) {
      debtors.push({ id, amount: Math.abs(net) });
    } else if (net > 0) {
      creditors.push({ id, amount: net });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions: DebtTransaction[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.amount, creditor.amount);
    if (settleAmount > 0) {
      transactions.push({
        from: debtor.id,
        to: creditor.id,
        amount_minor: settleAmount,
        currency_code: currencyCode,
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount === 0) dIdx++;
    if (creditor.amount === 0) cIdx++;
  }

  return transactions;
}

