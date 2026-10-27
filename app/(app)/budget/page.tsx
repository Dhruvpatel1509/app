import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BudgetClient } from '@/components/budget/budget-client';

export const metadata = { title: 'My Budget — Cashual' };

export default async function BudgetPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 2. Fetch all budgets set by user
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', user.id);

  // 3. Fetch user's splits to calculate real personal spending
  const { data: userSplits } = await supabase
    .from('expense_splits')
    .select(`
      owed_amount_minor,
      personal_spending_minor,
      expense:expenses!expense_splits_expense_id_fkey(
        id,
        category,
        total_minor,
        expense_date,
        currency_code,
        description,
        is_deleted
      )
    `)
    .eq('user_id', user.id);

  return (
    <BudgetClient
      currentUserId={user.id}
      userProfile={profile}
      budgets={budgets || []}
      userSplits={userSplits || []}
    />
  );
}
