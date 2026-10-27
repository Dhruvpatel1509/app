import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { GroupDetailClient } from '@/components/groups/group-detail-client';

export const metadata = { title: 'Group Details — Cashual' };

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupDetailPage({ params }: GroupPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch group details
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .single();

  if (groupError || !group) {
    notFound();
  }

  // 2. Fetch group members with profiles
  const { data: members } = await supabase
    .from('group_members')
    .select(`
      group_id,
      user_id,
      role,
      joined_at,
      profile:profiles(id, username, display_name, avatar_url, preferred_currency, created_at, updated_at)
    `)
    .eq('group_id', id);

  // Check if current user is a member
  const currentMember = members?.find((m) => m.user_id === user.id);
  if (!currentMember) {
    redirect('/groups');
  }

  // 3. Fetch expenses in this group
  const { data: expenses } = await supabase
    .from('expenses')
    .select(`
      *,
      payer:profiles!expenses_paid_by_fkey(id, username, display_name, avatar_url),
      splits:expense_splits(
        id,
        expense_id,
        user_id,
        owed_amount_minor,
        personal_spending_minor,
        profile:profiles(id, username, display_name, avatar_url)
      ),
      items:expense_items(
        id,
        description,
        quantity,
        unit_price_minor,
        line_total_minor
      )
    `)
    .eq('group_id', id)
    .eq('is_deleted', false)
    .order('expense_date', { ascending: false });

  // 4. Fetch settlements in this group
  const { data: settlements } = await supabase
    .from('settlements')
    .select(`
      *,
      payer:profiles!settlements_payer_id_fkey(id, username, display_name, avatar_url),
      recipient:profiles!settlements_recipient_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('group_id', id)
    .order('settlement_date', { ascending: false });

  const formattedMembers = (members || []).map((m: any) => ({
    group_id: m.group_id,
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
  }));

  return (
    <GroupDetailClient
      group={group}
      members={formattedMembers}
      expenses={(expenses as any) || []}
      settlements={(settlements as any) || []}
      currentUserId={user.id}
      isAdmin={currentMember.role === 'admin'}
    />
  );
}
