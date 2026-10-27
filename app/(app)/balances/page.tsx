import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BalancesClient } from '@/components/balances/balances-client';

export const metadata = { title: 'Balances & Settlements — Cashual' };

export default async function BalancesPage() {
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

  // 2. Fetch all expenses where user paid
  const { data: expensesPaid } = await supabase
    .from('expenses')
    .select(`
      id,
      total_minor,
      currency_code,
      splits:expense_splits(user_id, owed_amount_minor)
    `)
    .eq('paid_by', user.id)
    .eq('is_deleted', false);

  // 3. Fetch all splits where user owes someone
  const { data: userSplits } = await supabase
    .from('expense_splits')
    .select(`
      owed_amount_minor,
      expense:expenses!expense_splits_expense_id_fkey(
        id,
        paid_by,
        total_minor,
        currency_code,
        is_deleted
      )
    `)
    .eq('user_id', user.id);

  // 4. Fetch all settlements involving the user
  const { data: settlements } = await supabase
    .from('settlements')
    .select(`
      *,
      payer:profiles!settlements_payer_id_fkey(id, username, display_name, avatar_url),
      recipient:profiles!settlements_recipient_id_fkey(id, username, display_name, avatar_url),
      group:groups(id, name)
    `)
    .or(`payer_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('settlement_date', { ascending: false });

  // 5. Fetch profiles of all known contacts (friends & group co-members)
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*');

  return (
    <BalancesClient
      currentUserId={user.id}
      userProfile={profile}
      expensesPaid={expensesPaid || []}
      userSplits={userSplits || []}
      settlements={settlements || []}
      allProfiles={allProfiles || []}
    />
  );
}
