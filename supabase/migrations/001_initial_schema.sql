-- ============================================================
-- Cashual Database Schema — Migration 001
-- Initial schema: profiles, friendships, groups, expenses,
-- receipts, settlements, budgets
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username       TEXT UNIQUE NOT NULL,
  display_name   TEXT NOT NULL,
  avatar_url     TEXT,
  preferred_currency TEXT NOT NULL DEFAULT 'EUR',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce username format: lowercase, alphanumeric + underscores, 3-30 chars
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-z0-9_]{3,30}$');

-- ============================================================
-- FRIENDSHIPS
-- ============================================================
CREATE TABLE public.friendships (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','declined','blocked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent self-friendship and duplicate requests
  CONSTRAINT no_self_friendship CHECK (requester_id != addressee_id),
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id)
);

-- Index for fast lookup of a user's friendships
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE public.groups (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  created_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  currency_code TEXT NOT NULL DEFAULT 'EUR',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_created_by ON public.groups(created_by);

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
CREATE TABLE public.group_members (
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON public.group_members(user_id);

-- ============================================================
-- RECEIPTS (created before expenses so expense can ref receipt)
-- ============================================================
CREATE TABLE public.receipts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  storage_path         TEXT NOT NULL,
  merchant             TEXT,
  receipt_date         DATE,
  currency_code        TEXT NOT NULL DEFAULT 'EUR',
  subtotal_minor       BIGINT NOT NULL DEFAULT 0,
  tax_minor            BIGINT NOT NULL DEFAULT 0,
  tip_minor            BIGINT NOT NULL DEFAULT 0,
  discount_minor       BIGINT NOT NULL DEFAULT 0,
  grand_total_minor    BIGINT NOT NULL DEFAULT 0,
  processing_status    TEXT NOT NULL DEFAULT 'uploaded'
                         CHECK (processing_status IN (
                           'uploaded','processing','review_required',
                           'confirmed','failed'
                         )),
  provider_document_id TEXT,
  ocr_raw              JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipts_user ON public.receipts(user_id);
CREATE INDEX idx_receipts_status ON public.receipts(processing_status);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE public.expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description     TEXT NOT NULL,
  group_id        UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  paid_by         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  currency_code   TEXT NOT NULL DEFAULT 'EUR',
  category        TEXT NOT NULL DEFAULT 'other',
  split_method    TEXT NOT NULL DEFAULT 'equal'
                    CHECK (split_method IN (
                      'equal','exact','percentage','shares',
                      'adjustment','itemized'
                    )),
  subtotal_minor  BIGINT NOT NULL DEFAULT 0,
  tax_minor       BIGINT NOT NULL DEFAULT 0,
  tip_minor       BIGINT NOT NULL DEFAULT 0,
  discount_minor  BIGINT NOT NULL DEFAULT 0,
  total_minor     BIGINT NOT NULL,
  receipt_id      UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_group ON public.expenses(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date);

-- ============================================================
-- EXPENSE PARTICIPANTS
-- ============================================================
CREATE TABLE public.expense_participants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id  UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  UNIQUE (expense_id, user_id)
);

CREATE INDEX idx_expense_participants_user ON public.expense_participants(user_id);

-- ============================================================
-- EXPENSE SPLITS (per-user financial allocation for an expense)
-- ============================================================
CREATE TABLE public.expense_splits (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id        UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  owed_amount_minor BIGINT NOT NULL DEFAULT 0,
  -- Amount this user counts toward personal spending (own consumption)
  personal_spending_minor BIGINT NOT NULL DEFAULT 0,
  split_metadata    JSONB,
  UNIQUE (expense_id, user_id)
);

CREATE INDEX idx_expense_splits_user ON public.expense_splits(user_id);
CREATE INDEX idx_expense_splits_expense ON public.expense_splits(expense_id);

-- ============================================================
-- EXPENSE ITEMS (for itemized / receipt-based expenses)
-- ============================================================
CREATE TABLE public.expense_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id       UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  description      TEXT NOT NULL,
  quantity         NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price_minor BIGINT NOT NULL DEFAULT 0,
  line_total_minor BIGINT NOT NULL DEFAULT 0,
  category         TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  tax_minor        BIGINT NOT NULL DEFAULT 0,
  discount_minor   BIGINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expense_items_expense ON public.expense_items(expense_id);

-- ============================================================
-- EXPENSE ITEM SPLITS (who pays for each item)
-- ============================================================
CREATE TABLE public.expense_item_splits (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_item_id     UUID NOT NULL REFERENCES public.expense_items(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  allocated_quantity  NUMERIC(10,3),
  share_amount_minor  BIGINT NOT NULL DEFAULT 0,
  split_method        TEXT NOT NULL DEFAULT 'equal',
  split_metadata      JSONB,
  UNIQUE (expense_item_id, user_id)
);

CREATE INDEX idx_expense_item_splits_user ON public.expense_item_splits(user_id);

-- ============================================================
-- SETTLEMENTS
-- ============================================================
CREATE TABLE public.settlements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payer_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recipient_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  group_id        UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  currency_code   TEXT NOT NULL DEFAULT 'EUR',
  amount_minor    BIGINT NOT NULL,
  settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_settlement CHECK (payer_id != recipient_id),
  CONSTRAINT positive_amount CHECK (amount_minor > 0)
);

CREATE INDEX idx_settlements_payer ON public.settlements(payer_id);
CREATE INDEX idx_settlements_recipient ON public.settlements(recipient_id);

-- ============================================================
-- BUDGET CATEGORIES
-- ============================================================
CREATE TABLE public.budget_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#10b981',
  icon       TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE TABLE public.budgets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_name   TEXT NOT NULL,
  budget_month    DATE NOT NULL, -- First day of the month
  amount_minor    BIGINT NOT NULL,
  currency_code   TEXT NOT NULL DEFAULT 'EUR',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_name, budget_month)
);

CREATE INDEX idx_budgets_user_month ON public.budgets(user_id, budget_month);

-- ============================================================
-- GROUP INVITATIONS
-- ============================================================
CREATE TABLE public.group_invitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email       TEXT,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_group ON public.group_invitations(group_id);
CREATE INDEX idx_invitations_token ON public.group_invitations(token);
