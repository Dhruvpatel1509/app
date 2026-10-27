-- ============================================================
-- Cashual Database Schema — Migration 003
-- Functions, triggers, and helper views
-- ============================================================

-- ============================================================
-- Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  raw_username TEXT;
  final_username TEXT;
  counter INT := 0;
BEGIN
  -- Generate username from email prefix, sanitized
  raw_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  -- Ensure minimum length
  IF LENGTH(raw_username) < 3 THEN
    raw_username := raw_username || 'user';
  END IF;
  -- Truncate to 25 chars to leave room for suffix
  raw_username := LEFT(raw_username, 25);

  -- Find a unique username
  final_username := raw_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := raw_username || counter::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, preferred_currency)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', final_username),
    COALESCE(NEW.raw_user_meta_data->>'preferred_currency', 'USD')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER expense_items_updated_at
  BEFORE UPDATE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Add group creator as admin member automatically
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- ============================================================
-- View: net balances between users
-- Combines expense splits and settlements
-- ============================================================
CREATE OR REPLACE VIEW public.user_balances AS
SELECT
  es.user_id,
  e.paid_by AS counterpart_id,
  SUM(es.owed_amount_minor) AS owes_minor,
  e.currency_code
FROM public.expense_splits es
JOIN public.expenses e ON e.id = es.expense_id
WHERE e.is_deleted = FALSE
  AND es.user_id != e.paid_by
GROUP BY es.user_id, e.paid_by, e.currency_code;

-- ============================================================
-- Function: get_balance_between_users
-- Returns net amount user_a owes to user_b (positive = a owes b)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_balance_between_users(
  p_user_a UUID,
  p_user_b UUID,
  p_currency TEXT DEFAULT 'USD'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a_owes_b BIGINT := 0;
  b_owes_a BIGINT := 0;
  a_settled_b BIGINT := 0;
  b_settled_a BIGINT := 0;
  result BIGINT;
BEGIN
  -- What a owes b from expenses
  SELECT COALESCE(SUM(es.owed_amount_minor), 0)
  INTO a_owes_b
  FROM public.expense_splits es
  JOIN public.expenses e ON e.id = es.expense_id
  WHERE es.user_id = p_user_a
    AND e.paid_by = p_user_b
    AND e.is_deleted = FALSE
    AND e.currency_code = p_currency;

  -- What b owes a from expenses
  SELECT COALESCE(SUM(es.owed_amount_minor), 0)
  INTO b_owes_a
  FROM public.expense_splits es
  JOIN public.expenses e ON e.id = es.expense_id
  WHERE es.user_id = p_user_b
    AND e.paid_by = p_user_a
    AND e.is_deleted = FALSE
    AND e.currency_code = p_currency;

  -- Settlements from a to b
  SELECT COALESCE(SUM(amount_minor), 0)
  INTO a_settled_b
  FROM public.settlements
  WHERE payer_id = p_user_a AND recipient_id = p_user_b AND currency_code = p_currency;

  -- Settlements from b to a
  SELECT COALESCE(SUM(amount_minor), 0)
  INTO b_settled_a
  FROM public.settlements
  WHERE payer_id = p_user_b AND recipient_id = p_user_a AND currency_code = p_currency;

  -- Net: positive = a owes b, negative = b owes a
  result := (a_owes_b - a_settled_b) - (b_owes_a - b_settled_a);
  RETURN result;
END;
$$;

-- ============================================================
-- Function: insert_expense_with_splits (atomic)
-- Used by the API to avoid partial writes
-- ============================================================
CREATE OR REPLACE FUNCTION public.insert_expense_with_splits(
  p_expense JSONB,
  p_splits JSONB,
  p_items JSONB DEFAULT NULL,
  p_item_splits JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_expense_id UUID;
  v_item JSONB;
  v_item_id UUID;
  v_split JSONB;
  v_item_split JSONB;
BEGIN
  -- Insert expense
  INSERT INTO public.expenses (
    description, group_id, paid_by, created_by, currency_code,
    category, split_method, subtotal_minor, tax_minor, tip_minor,
    discount_minor, total_minor, receipt_id, expense_date, notes
  )
  VALUES (
    p_expense->>'description',
    (p_expense->>'group_id')::UUID,
    (p_expense->>'paid_by')::UUID,
    auth.uid(),
    p_expense->>'currency_code',
    COALESCE(p_expense->>'category', 'other'),
    COALESCE(p_expense->>'split_method', 'equal'),
    COALESCE((p_expense->>'subtotal_minor')::BIGINT, 0),
    COALESCE((p_expense->>'tax_minor')::BIGINT, 0),
    COALESCE((p_expense->>'tip_minor')::BIGINT, 0),
    COALESCE((p_expense->>'discount_minor')::BIGINT, 0),
    (p_expense->>'total_minor')::BIGINT,
    (p_expense->>'receipt_id')::UUID,
    COALESCE((p_expense->>'expense_date')::DATE, CURRENT_DATE),
    p_expense->>'notes'
  )
  RETURNING id INTO v_expense_id;

  -- Insert participants and splits
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO public.expense_participants (expense_id, user_id)
    VALUES (v_expense_id, (v_split->>'user_id')::UUID)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.expense_splits (
      expense_id, user_id, owed_amount_minor, personal_spending_minor, split_metadata
    )
    VALUES (
      v_expense_id,
      (v_split->>'user_id')::UUID,
      (v_split->>'owed_amount_minor')::BIGINT,
      COALESCE((v_split->>'personal_spending_minor')::BIGINT, 0),
      v_split->'metadata'
    );
  END LOOP;

  -- Insert items if provided
  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.expense_items (
        expense_id, description, quantity, unit_price_minor,
        line_total_minor, category, sort_order, tax_minor, discount_minor
      )
      VALUES (
        v_expense_id,
        v_item->>'description',
        COALESCE((v_item->>'quantity')::NUMERIC, 1),
        COALESCE((v_item->>'unit_price_minor')::BIGINT, 0),
        COALESCE((v_item->>'line_total_minor')::BIGINT, 0),
        v_item->>'category',
        COALESCE((v_item->>'sort_order')::INT, 0),
        COALESCE((v_item->>'tax_minor')::BIGINT, 0),
        COALESCE((v_item->>'discount_minor')::BIGINT, 0)
      )
      RETURNING id INTO v_item_id;

      -- Insert item splits
      IF p_item_splits IS NOT NULL THEN
        FOR v_item_split IN
          SELECT * FROM jsonb_array_elements(p_item_splits)
          WHERE value->>'temp_item_id' = v_item->>'temp_id'
        LOOP
          INSERT INTO public.expense_item_splits (
            expense_item_id, user_id, allocated_quantity,
            share_amount_minor, split_method, split_metadata
          )
          VALUES (
            v_item_id,
            (v_item_split->>'user_id')::UUID,
            (v_item_split->>'allocated_quantity')::NUMERIC,
            (v_item_split->>'share_amount_minor')::BIGINT,
            COALESCE(v_item_split->>'split_method', 'equal'),
            v_item_split->'metadata'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN v_expense_id;
END;
$$;

-- ============================================================
-- Default budget categories seeded on first login
-- (Called via trigger or API)
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_default_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.budget_categories (user_id, name, color, icon, is_default)
  VALUES
    (p_user_id, 'groceries',      '#10b981', 'ShoppingCart',   TRUE),
    (p_user_id, 'dining',         '#f59e0b', 'UtensilsCrossed',TRUE),
    (p_user_id, 'transport',      '#3b82f6', 'Car',            TRUE),
    (p_user_id, 'travel',         '#8b5cf6', 'Plane',          TRUE),
    (p_user_id, 'household',      '#6b7280', 'Home',           TRUE),
    (p_user_id, 'shopping',       '#ec4899', 'ShoppingBag',    TRUE),
    (p_user_id, 'entertainment',  '#f97316', 'Tv',             TRUE),
    (p_user_id, 'bills',          '#ef4444', 'Receipt',        TRUE),
    (p_user_id, 'other',          '#9ca3af', 'MoreHorizontal', TRUE)
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$;
