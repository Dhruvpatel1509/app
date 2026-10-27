import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AddExpenseClient } from '@/components/expenses/add-expense-client';

export const metadata = { title: 'Add Expense — Cashual' };

interface AddExpensePageProps {
  searchParams: Promise<{
    group_id?: string;
    friend_id?: string;
  }>;
}

export default async function AddExpensePage({ searchParams }: AddExpensePageProps) {
  const { group_id, friend_id } = await searchParams;
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

  // 2. Fetch all groups where user is a member
  const { data: groupMemberships } = await supabase
    .from('group_members')
    .select(`
      group:groups(
        id,
        name,
        currency_code,
        members:group_members(
          user_id,
          role,
          profile:profiles(id, username, display_name, avatar_url)
        )
      )
    `)
    .eq('user_id', user.id);

  const groups = groupMemberships?.map((gm: any) => gm.group).filter(Boolean) || [];

  // 3. Fetch user's accepted friends
  const { data: friendships } = await supabase
    .from('friendships')
    .select(`
      id,
      requester_id,
      addressee_id,
      requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
      addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friends = (friendships || []).map((f: any) => {
    return f.requester_id === user.id ? f.addressee : f.requester;
  }).filter(Boolean);

  return (
    <AddExpenseClient
      currentUserId={user.id}
      userProfile={profile}
      groups={groups}
      friends={friends}
      initialGroupId={group_id}
      initialFriendId={friend_id}
    />
  );
}
