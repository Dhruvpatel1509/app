-- ============================================================
-- Cashual Database Schema — Migration 002
-- Row Level Security (RLS) Policies
-- ============================================================

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_item_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
-- Anyone can read profiles (needed for username search, group member display)
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (TRUE);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Profile is inserted by trigger (service role) after signup
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- FRIENDSHIPS
-- ============================================================
CREATE POLICY "friendships_select"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friendships_insert"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "friendships_update"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friendships_delete"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============================================================
-- GROUPS
-- ============================================================
-- Only group members can view groups
CREATE POLICY "groups_select_members"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "groups_insert"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "groups_update_admin"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
CREATE POLICY "group_members_select"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm2
      WHERE gm2.group_id = group_id AND gm2.user_id = auth.uid()
    )
  );

CREATE POLICY "group_members_insert_admin"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Group admin can add members, or the user is adding themselves via invitation
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "group_members_delete"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    -- Members can remove themselves, admins can remove anyone
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- ============================================================
-- RECEIPTS
-- ============================================================
CREATE POLICY "receipts_select_own"
  ON public.receipts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "receipts_insert_own"
  ON public.receipts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "receipts_update_own"
  ON public.receipts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "receipts_delete_own"
  ON public.receipts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- EXPENSES
-- ============================================================
-- Can view expense if: paid by you, created by you, or you're a participant
CREATE POLICY "expenses_select"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    auth.uid() = paid_by OR
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.expense_participants ep
      WHERE ep.expense_id = id AND ep.user_id = auth.uid()
    ) OR
    (group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = expenses.group_id AND gm.user_id = auth.uid()
    ))
  );

CREATE POLICY "expenses_insert"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "expenses_update"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = paid_by);

CREATE POLICY "expenses_delete"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- ============================================================
-- EXPENSE PARTICIPANTS
-- ============================================================
CREATE POLICY "expense_participants_select"
  ON public.expense_participants FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND (e.paid_by = auth.uid() OR e.created_by = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "expense_participants_insert"
  ON public.expense_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND e.created_by = auth.uid()
    )
  );

CREATE POLICY "expense_participants_delete"
  ON public.expense_participants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND e.created_by = auth.uid()
    )
  );

-- ============================================================
-- EXPENSE SPLITS
-- ============================================================
CREATE POLICY "expense_splits_select"
  ON public.expense_splits FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND (e.paid_by = auth.uid() OR e.created_by = auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id = expense_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "expense_splits_insert"
  ON public.expense_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND e.created_by = auth.uid()
    )
  );

CREATE POLICY "expense_splits_delete"
  ON public.expense_splits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND e.created_by = auth.uid()
    )
  );

-- ============================================================
-- EXPENSE ITEMS
-- ============================================================
CREATE POLICY "expense_items_select"
  ON public.expense_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND (
        e.paid_by = auth.uid() OR e.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.expense_participants ep
          WHERE ep.expense_id = e.id AND ep.user_id = auth.uid()
        ) OR
        (e.group_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = e.group_id AND gm.user_id = auth.uid()
        ))
      )
    )
  );

CREATE POLICY "expense_items_insert"
  ON public.expense_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND e.created_by = auth.uid()
    )
  );

CREATE POLICY "expense_items_update"
  ON public.expense_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND e.created_by = auth.uid()
    )
  );

CREATE POLICY "expense_items_delete"
  ON public.expense_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND e.created_by = auth.uid()
    )
  );

-- ============================================================
-- EXPENSE ITEM SPLITS
-- ============================================================
CREATE POLICY "expense_item_splits_select"
  ON public.expense_item_splits FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.expense_items ei
      JOIN public.expenses e ON e.id = ei.expense_id
      WHERE ei.id = expense_item_id AND (
        e.paid_by = auth.uid() OR e.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "expense_item_splits_insert"
  ON public.expense_item_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expense_items ei
      JOIN public.expenses e ON e.id = ei.expense_id
      WHERE ei.id = expense_item_id AND e.created_by = auth.uid()
    )
  );

CREATE POLICY "expense_item_splits_delete"
  ON public.expense_item_splits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_items ei
      JOIN public.expenses e ON e.id = ei.expense_id
      WHERE ei.id = expense_item_id AND e.created_by = auth.uid()
    )
  );

-- ============================================================
-- SETTLEMENTS
-- ============================================================
CREATE POLICY "settlements_select"
  ON public.settlements FOR SELECT
  TO authenticated
  USING (
    auth.uid() = payer_id OR auth.uid() = recipient_id OR
    (group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = settlements.group_id AND gm.user_id = auth.uid()
    ))
  );

CREATE POLICY "settlements_insert"
  ON public.settlements FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    (auth.uid() = payer_id OR auth.uid() = recipient_id)
  );

-- ============================================================
-- BUDGET CATEGORIES
-- ============================================================
CREATE POLICY "budget_categories_own"
  ON public.budget_categories FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE POLICY "budgets_own"
  ON public.budgets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- GROUP INVITATIONS
-- ============================================================
CREATE POLICY "invitations_select"
  ON public.group_invitations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = invited_by OR auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "invitations_insert"
  ON public.group_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = invited_by AND
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "invitations_update"
  ON public.group_invitations FOR UPDATE
  TO authenticated
  USING (auth.uid() = invited_by OR auth.uid() = user_id);
