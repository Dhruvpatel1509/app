import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { ReceiptReviewClient } from '@/components/receipts/receipt-review-client';

export const metadata = { title: 'Review Receipt & Split Items — Cashual' };

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch receipt
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('*')
    .eq('id', id)
    .single();

  if (receiptError || !receipt) {
    notFound();
  }

  // 2. Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 3. Fetch user's friends
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

  // 4. Fetch user's groups
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

  return (
    <ReceiptReviewClient
      receipt={receipt}
      currentUserId={user.id}
      userProfile={profile}
      friends={friends}
      groups={groups}
    />
  );
}
