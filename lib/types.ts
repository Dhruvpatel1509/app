// ============================================================
// Cashual — Core TypeScript Type Definitions
// All monetary values are stored as integer minor units (cents)
// ============================================================

export type CurrencyCode = string; // ISO 4217 e.g. 'USD', 'EUR'

// ============================================================
// Auth & Profiles
// ============================================================
export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  preferred_currency: CurrencyCode;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Friendships
// ============================================================
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
  // Joined
  requester?: Profile;
  addressee?: Profile;
}

export interface Friend extends Profile {
  friendship_id: string;
  friendship_status: FriendshipStatus;
  net_balance_minor: number; // positive = they owe you, negative = you owe them
  currency_code: CurrencyCode;
}

// ============================================================
// Groups
// ============================================================
export type GroupRole = 'admin' | 'member';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  currency_code: CurrencyCode;
  created_at: string;
  updated_at: string;
  // Computed
  member_count?: number;
  user_balance_minor?: number;
  total_expenses_minor?: number;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  // Joined
  profile?: Profile;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  invited_by: string;
  email: string | null;
  user_id: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  created_at: string;
}

// ============================================================
// Expenses
// ============================================================
export type SplitMethod = 'equal' | 'exact' | 'percentage' | 'shares' | 'adjustment' | 'itemized';

export type ExpenseCategory =
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'travel'
  | 'household'
  | 'shopping'
  | 'entertainment'
  | 'bills'
  | 'other';

export interface Expense {
  id: string;
  description: string;
  group_id: string | null;
  paid_by: string;
  created_by: string;
  currency_code: CurrencyCode;
  category: ExpenseCategory;
  split_method: SplitMethod;
  subtotal_minor: number;
  tax_minor: number;
  tip_minor: number;
  discount_minor: number;
  total_minor: number;
  receipt_id: string | null;
  expense_date: string;
  notes: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  payer?: Profile;
  group?: Group;
  splits?: ExpenseSplit[];
  items?: ExpenseItem[];
  receipt?: Receipt;
}

export interface ExpenseParticipant {
  id: string;
  expense_id: string;
  user_id: string;
  profile?: Profile;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  owed_amount_minor: number;
  personal_spending_minor: number;
  split_metadata: Record<string, unknown> | null;
  profile?: Profile;
}

export interface ExpenseItem {
  id: string;
  expense_id: string;
  description: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
  category: string | null;
  sort_order: number;
  tax_minor: number;
  discount_minor: number;
  created_at: string;
  updated_at: string;
  // Computed
  item_splits?: ExpenseItemSplit[];
}

export interface ExpenseItemSplit {
  id: string;
  expense_item_id: string;
  user_id: string;
  allocated_quantity: number | null;
  share_amount_minor: number;
  split_method: SplitMethod;
  split_metadata: Record<string, unknown> | null;
  profile?: Profile;
}

// ============================================================
// Receipts
// ============================================================
export type ReceiptProcessingStatus =
  | 'uploaded'
  | 'processing'
  | 'review_required'
  | 'confirmed'
  | 'failed';

export interface Receipt {
  id: string;
  user_id: string;
  storage_path: string;
  merchant: string | null;
  receipt_date: string | null;
  currency_code: CurrencyCode;
  subtotal_minor: number;
  tax_minor: number;
  tip_minor: number;
  discount_minor: number;
  grand_total_minor: number;
  processing_status: ReceiptProcessingStatus;
  provider_document_id: string | null;
  ocr_raw: VeryfiReceiptResponse | null;
  created_at: string;
  updated_at: string;
  // Computed
  signed_url?: string;
}

// Veryfi API response shape (relevant fields)
export interface VeryfiReceiptResponse {
  id: number;
  vendor: {
    name: string;
    raw_name?: string;
  };
  date: string;
  currency_code: string;
  subtotal: number;
  tax: number;
  tip: number;
  discount: number;
  total: number;
  line_items: VeryfiLineItem[];
  payment?: {
    type?: string;
    card_number?: string;
  };
  notes?: string;
}

export interface VeryfiLineItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  category?: string;
  discount?: number;
  tax?: number;
  tax_rate?: number;
}

// ============================================================
// Settlements
// ============================================================
export interface Settlement {
  id: string;
  payer_id: string;
  recipient_id: string;
  group_id: string | null;
  currency_code: CurrencyCode;
  amount_minor: number;
  settlement_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  // Joined
  payer?: Profile;
  recipient?: Profile;
  group?: Group;
}

// ============================================================
// Budgets
// ============================================================
export interface BudgetCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_name: string;
  budget_month: string; // YYYY-MM-DD (first of month)
  amount_minor: number;
  currency_code: CurrencyCode;
  created_at: string;
  updated_at: string;
  // Computed
  spent_minor?: number;
  remaining_minor?: number;
  percentage_used?: number;
}

// ============================================================
// Financial Calculation Types
// ============================================================

export interface ParticipantAllocation {
  user_id: string;
  owed_amount_minor: number;
  personal_spending_minor: number;
}

export interface SplitInput {
  method: SplitMethod;
  total_minor: number;
  participants: SplitParticipant[];
}

export interface SplitParticipant {
  user_id: string;
  exact_minor?: number;      // for 'exact' method
  percentage?: number;       // for 'percentage' method (0-100)
  shares?: number;           // for 'shares' method
  adjustment_minor?: number; // for 'adjustment' method
}

export interface ItemizedSplitInput {
  items: ItemSplitInput[];
  tax_minor: number;
  tip_minor: number;
  discount_minor: number;
  tax_allocation: 'proportional' | 'equal';
  tip_allocation: 'proportional' | 'equal';
}

export interface ItemSplitInput {
  temp_id: string;
  description: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
  category?: string;
  participants: string[]; // user_ids
  method: SplitMethod;
  participant_overrides?: SplitParticipant[];
}

export interface CalculatedSplit {
  allocations: ParticipantAllocation[];
  total_allocated_minor: number;
  rounding_remainder_minor: number;
  is_valid: boolean;
  errors: string[];
}

// ============================================================
// Dashboard
// ============================================================
export interface DashboardSummary {
  you_owe_minor: number;
  you_are_owed_minor: number;
  net_balance_minor: number;
  personal_spending_this_month_minor: number;
  currency_code: CurrencyCode;
  recent_expenses: Expense[];
  recent_settlements: Settlement[];
  group_balances: GroupBalance[];
  monthly_spending: MonthlySpending[];
  category_spending: CategorySpending[];
  budget_progress: Budget[];
}

export interface GroupBalance {
  group_id: string;
  group_name: string;
  balance_minor: number; // positive = owed to you, negative = you owe
  currency_code: CurrencyCode;
}

export interface MonthlySpending {
  month: string; // YYYY-MM
  amount_minor: number;
  currency_code: CurrencyCode;
}

export interface CategorySpending {
  category: string;
  amount_minor: number;
  percentage: number;
  currency_code: CurrencyCode;
}

// ============================================================
// Form Types
// ============================================================
export interface CreateExpenseForm {
  description: string;
  total_amount: string; // User input as string
  currency_code: CurrencyCode;
  expense_date: string;
  category: ExpenseCategory;
  paid_by: string;
  group_id?: string;
  participants: string[];
  split_method: SplitMethod;
  notes?: string;
  // Per-participant overrides
  exact_amounts?: Record<string, string>;
  percentages?: Record<string, string>;
  shares?: Record<string, string>;
  adjustments?: Record<string, string>;
}

export interface CreateGroupForm {
  name: string;
  description?: string;
  currency_code: CurrencyCode;
  initial_members?: string[];
}

export interface CreateSettlementForm {
  payer_id: string;
  recipient_id: string;
  amount: string;
  currency_code: CurrencyCode;
  settlement_date: string;
  group_id?: string;
  notes?: string;
}

export interface ProfileUpdateForm {
  display_name: string;
  username: string;
  preferred_currency: CurrencyCode;
  avatar_url?: string;
}

// ============================================================
// API Response Types
// ============================================================
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}
