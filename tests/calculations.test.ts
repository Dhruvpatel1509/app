import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  formatCurrency,
  largestRemainderRound,
  calculateSplit,
  calculateItemizedSplit,
  calculateNetBalances,
  calculatePersonalSpending,
  validateSettlementAmount,
  reconcileReceiptAllocation,
  simplifyDebts,
} from '@/lib/calculations';

describe('Currency & Minor Unit Conversions', () => {
  it('converts decimal strings to minor units accurately', () => {
    expect(toMinorUnits('12.50')).toBe(1250);
    expect(toMinorUnits('0.01')).toBe(1);
    expect(toMinorUnits('100')).toBe(10000);
    expect(toMinorUnits('0.99')).toBe(99);
    expect(toMinorUnits('0')).toBe(0);
  });

  it('converts minor units back to decimal strings', () => {
    expect(fromMinorUnits(1250)).toBe('12.50');
    expect(fromMinorUnits(1)).toBe('0.01');
    expect(fromMinorUnits(10000)).toBe('100.00');
    expect(fromMinorUnits(0)).toBe('0.00');
    expect(fromMinorUnits(-250)).toBe('-2.50');
  });

  it('formats currency strings properly', () => {
    expect(formatCurrency(1250, 'EUR')).toMatch(/12[,.]50/);
    expect(formatCurrency(1250, 'EUR')).toContain('€');
    expect(formatCurrency(0, 'EUR')).toMatch(/0[,.]00/);
  });
});

describe('Largest-Remainder Rounding Algorithm', () => {
  it('distributes remainder pennies so sum equals total exactly', () => {
    // Splitting $1.00 (100 cents) between 3 people evenly
    const weights = [1, 1, 1];
    const shares = largestRemainderRound(weights, 100);

    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(shares).toEqual([34, 33, 33]);
  });

  it('handles weighted splits with exact penny conservation', () => {
    // Splitting $100.00 (10000 cents) with weights 1:2:3
    const weights = [1, 2, 3];
    const shares = largestRemainderRound(weights, 10000);

    expect(shares.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('returns empty array when weights are empty', () => {
    expect(largestRemainderRound([], 100)).toEqual([]);
  });
});

describe('Equal Split Method', () => {
  it('splits expense equally with zero rounding loss', () => {
    const result = calculateSplit({
      method: 'equal',
      total_minor: 10000, // $100.00
      participants: [
        { user_id: 'u1' },
        { user_id: 'u2' },
        { user_id: 'u3' },
      ],
    });

    expect(result.is_valid).toBe(true);
    expect(result.total_allocated_minor).toBe(10000);
    expect(result.allocations.map((a) => a.owed_amount_minor)).toEqual([3334, 3333, 3333]);
  });
});

describe('Exact Split Method', () => {
  it('validates matching exact split amounts', () => {
    const result = calculateSplit({
      method: 'exact',
      total_minor: 5000, // $50.00
      participants: [
        { user_id: 'u1', exact_minor: 2000 },
        { user_id: 'u2', exact_minor: 3000 },
      ],
    });

    expect(result.is_valid).toBe(true);
    expect(result.total_allocated_minor).toBe(5000);
  });

  it('fails validation when exact amounts do not match total', () => {
    const result = calculateSplit({
      method: 'exact',
      total_minor: 5000,
      participants: [
        { user_id: 'u1', exact_minor: 2000 },
        { user_id: 'u2', exact_minor: 2000 },
      ],
    });

    expect(result.is_valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Percentage Split Method', () => {
  it('splits accurately by percentage with penny rounding', () => {
    const result = calculateSplit({
      method: 'percentage',
      total_minor: 10000, // $100.00
      participants: [
        { user_id: 'u1', percentage: 50 },
        { user_id: 'u2', percentage: 30 },
        { user_id: 'u3', percentage: 20 },
      ],
    });

    expect(result.is_valid).toBe(true);
    expect(result.total_allocated_minor).toBe(10000);
    expect(result.allocations[0].owed_amount_minor).toBe(5000);
    expect(result.allocations[1].owed_amount_minor).toBe(3000);
    expect(result.allocations[2].owed_amount_minor).toBe(2000);
  });

  it('flags error if percentages do not sum to 100', () => {
    const result = calculateSplit({
      method: 'percentage',
      total_minor: 10000,
      participants: [
        { user_id: 'u1', percentage: 40 },
        { user_id: 'u2', percentage: 40 },
      ],
    });

    expect(result.is_valid).toBe(false);
  });
});

describe('Shares Split Method', () => {
  it('allocates according to ratio of shares', () => {
    const result = calculateSplit({
      method: 'shares',
      total_minor: 6000, // $60.00
      participants: [
        { user_id: 'u1', shares: 2 },
        { user_id: 'u2', shares: 1 },
      ],
    });

    expect(result.is_valid).toBe(true);
    expect(result.allocations[0].owed_amount_minor).toBe(4000);
    expect(result.allocations[1].owed_amount_minor).toBe(2000);
  });
});

describe('Itemized Receipt Split with Tax & Tip', () => {
  it('distributes items and allocates tax & tip proportionally', () => {
    // Person A has $30 item, Person B has $10 item.
    // Subtotal = $40. Tax = $4 (10%). Tip = $8 (20%). Total = $52.
    // Person A (75% of subtotal) should pay $30 + $3 tax + $6 tip = $39.
    // Person B (25% of subtotal) should pay $10 + $1 tax + $2 tip = $13.
    const result = calculateItemizedSplit({
      items: [
        {
          temp_id: 'it1',
          description: 'Steak',
          quantity: 1,
          unit_price_minor: 3000,
          line_total_minor: 3000,
          participants: ['userA'],
          method: 'equal',
        },
        {
          temp_id: 'it2',
          description: 'Salad',
          quantity: 1,
          unit_price_minor: 1000,
          line_total_minor: 1000,
          participants: ['userB'],
          method: 'equal',
        },
      ],
      tax_minor: 400,
      tip_minor: 800,
      discount_minor: 0,
      tax_allocation: 'proportional',
      tip_allocation: 'proportional',
    });

    expect(result.is_valid).toBe(true);
    expect(result.total_allocated_minor).toBe(5200);

    const shareA = result.expense_splits.find((s) => s.user_id === 'userA');
    const shareB = result.expense_splits.find((s) => s.user_id === 'userB');

    expect(shareA?.owed_amount_minor).toBe(3900);
    expect(shareB?.owed_amount_minor).toBe(1300);
  });
});

describe('Debt Simplification Algorithm', () => {
  it('simplifies triangular debt into a single direct transfer', () => {
    // Net balances:
    // A owes $10 (net = -1000)
    // B is even (paid $10, owes $10 -> net = 0)
    // C is owed $10 (net = +1000)
    const netVector = {
      userA: -1000,
      userB: 0,
      userC: 1000,
    };

    const simplified = simplifyDebts(netVector, 'USD');
    expect(simplified.length).toBe(1);
    expect(simplified[0].from).toBe('userA');
    expect(simplified[0].to).toBe('userC');
    expect(simplified[0].amount_minor).toBe(1000);
  });

  it('simplifies 4-person debt network with minimal transfers', () => {
    const netVector = {
      u1: -5000, // owes $50
      u2: -3000, // owes $30
      u3: 6000,  // owed $60
      u4: 2000,  // owed $20
    };

    const simplified = simplifyDebts(netVector, 'USD');
    const totalTransferred = simplified.reduce((sum, tx) => sum + tx.amount_minor, 0);
    expect(totalTransferred).toBe(8000);
    expect(simplified.length).toBeLessThanOrEqual(3);
  });
});

describe('Receipt Reconciliation', () => {
  it('reconciles allocations against receipt total', () => {
    const allocations = [
      { user_id: 'u1', owed_amount_minor: 2500, personal_spending_minor: 2500 },
      { user_id: 'u2', owed_amount_minor: 2500, personal_spending_minor: 2500 },
    ];

    const result = reconcileReceiptAllocation(5000, allocations);
    expect(result.is_balanced).toBe(true);
    expect(result.difference_minor).toBe(0);
  });

  it('detects unallocated amount if items do not equal total', () => {
    const allocations = [
      { user_id: 'u1', owed_amount_minor: 2000, personal_spending_minor: 2000 },
    ];

    const result = reconcileReceiptAllocation(3000, allocations);
    expect(result.is_balanced).toBe(false);
    expect(result.difference_minor).toBe(1000);
  });
});
