import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';

export const metadata = {
  title: 'Dashboard — Cashual',
};

async function getDashboardData(userId: string) {
  const supabase = await createClient();

  // Fetch all needed data in parallel
  const [
    expenseSplitsResult,
    settlementsResult,
    recentExpensesResult,
    groupBalancesResult,
    budgetResult,
  ] = await Promise.all([
    // All expense splits involving this user
    supabase
      .from('expense_splits')
      .select(`
        *,
        expense:expenses(
          id, description, total_minor, currency_code, expense_date,
          category, paid_by, group_id, is_deleted,
          payer:profiles!paid_by(id, display_name, username, avatar_url)
        )
      `)
      .eq('user_id', userId),

    // All settlements involving this user
    supabase
      .from('settlements')
      .select(`
        *,
        payer:profiles!payer_id(id, display_name, username, avatar_url),
        recipient:profiles!recipient_id(id, display_name, username, avatar_url)
      `)
      .or(`payer_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('settlement_date', { ascending: false }),

    // Recent expenses
    supabase
      .from('expenses')
      .select(`
        *,
        payer:profiles!paid_by(id, display_name, username, avatar_url),
        group:groups(id, name),
        splits:expense_splits(
          user_id, owed_amount_minor,
          profile:profiles(id, display_name, username, avatar_url)
        )
      `)
      .or(`paid_by.eq.${userId},created_by.eq.${userId}`)
      .eq('is_deleted', false)
      .order('expense_date', { ascending: false })
      .limit(10),

    // Group balances
    supabase
      .from('group_members')
      .select(`
        group_id,
        group:groups(id, name, currency_code)
      `)
      .eq('user_id', userId),

    // Budget for current month
    supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .gte('budget_month', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
      .lte('budget_month', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]),
  ]);

  return {
    expenseSplits: expenseSplitsResult.data ?? [],
    settlements: settlementsResult.data ?? [],
    recentExpenses: recentExpensesResult.data ?? [],
    groupMemberships: groupBalancesResult.data ?? [],
    budgets: budgetResult.data ?? [],
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const data = await getDashboardData(user.id);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient userId={user.id} data={data} />
    </Suspense>
  );
}
