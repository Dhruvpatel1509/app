import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { GroupsClient } from '@/components/groups/groups-client';

export const metadata = { title: 'Groups — Cashual' };

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: groups } = await supabase
    .from('group_members')
    .select(`
      role, joined_at,
      group:groups(
        id, name, description, currency_code, created_by, created_at,
        members:group_members(
          user_id,
          profile:profiles(id, display_name, username, avatar_url)
        )
      )
    `)
    .eq('user_id', user.id);

  // For each group, compute user's balance
  const groupsWithBalance = await Promise.all(
    (groups ?? []).map(async (gm) => {
      const g = gm.group as any;
      if (!g) return null;

      const { data: splits } = await supabase
        .from('expense_splits')
        .select('owed_amount_minor, expense:expenses(paid_by, is_deleted)')
        .eq('user_id', user.id)
        .filter('expense.group_id', 'eq', g.id);

      const { data: settlements } = await supabase
        .from('settlements')
        .select('payer_id, recipient_id, amount_minor')
        .eq('group_id', g.id)
        .or(`payer_id.eq.${user.id},recipient_id.eq.${user.id}`);

      let balance = 0;
      (splits ?? []).forEach((s: any) => {
        if (s.expense?.is_deleted) return;
        if (s.expense?.paid_by !== user.id) balance -= s.owed_amount_minor;
        else balance += s.owed_amount_minor;
      });
      (settlements ?? []).forEach((s: any) => {
        if (s.payer_id === user.id) balance += s.amount_minor;
        else balance -= s.amount_minor;
      });

      return {
        ...g,
        role: gm.role,
        user_balance_minor: balance,
        member_count: g.members?.length ?? 0,
      };
    })
  );

  return <GroupsClient userId={user.id} groups={groupsWithBalance.filter(Boolean)} />;
}
