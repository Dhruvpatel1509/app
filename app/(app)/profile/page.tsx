import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProfileClient } from '@/components/profile/profile-client';

export const metadata = { title: 'Profile & Settings — Cashual' };

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 2. Fetch stats
  const { count: expensesCount } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', user.id);

  const { count: groupsCount } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: friendsCount } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const { count: settlementsCount } = await supabase
    .from('settlements')
    .select('*', { count: 'exact', head: true })
    .or(`payer_id.eq.${user.id},recipient_id.eq.${user.id}`);

  return (
    <ProfileClient
      profile={profile}
      email={user.email || ''}
      stats={{
        expenses: expensesCount || 0,
        groups: groupsCount || 0,
        friends: friendsCount || 0,
        settlements: settlementsCount || 0,
      }}
    />
  );
}
