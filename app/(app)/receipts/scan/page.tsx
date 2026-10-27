import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ReceiptScannerClient } from '@/components/receipts/receipt-scanner-client';

export const metadata = { title: 'Scan Receipt — Cashual' };

export default async function ReceiptScanPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <ReceiptScannerClient currentUserId={user.id} />;
}
