import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FriendsClient } from '@/components/friends/friends-client';

export const metadata = { title: 'Friends — Cashual' };

export default async function FriendsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch all friendships involving the current user
  const { data: friendships } = await supabase
    .from('friendships')
    .select(`
      id,
      requester_id,
      addressee_id,
      status,
      created_at,
      updated_at,
      requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url, preferred_currency),
      addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url, preferred_currency)
    `)
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  // 2. Fetch expenses involving the user to calculate net balances with friends
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

  // 3. Fetch expenses where user paid and others owe user
  const { data: expensesPaidByUser } = await supabase
    .from('expenses')
    .select(`
      id,
      total_minor,
      currency_code,
      splits:expense_splits(user_id, owed_amount_minor)
    `)
    .eq('paid_by', user.id)
    .eq('is_deleted', false);

  // 4. Fetch settlements involving user
  const { data: settlements } = await supabase
    .from('settlements')
    .select('*')
    .or(`payer_id.eq.${user.id},recipient_id.eq.${user.id}`);

  // 5. Fetch user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <FriendsClient
      friendships={friendships || []}
      userSplits={userSplits || []}
      expensesPaidByUser={expensesPaidByUser || []}
      settlements={settlements || []}
      currentUserId={user.id}
      userCurrency={profile?.preferred_currency || 'EUR'}
    />
  );
}
