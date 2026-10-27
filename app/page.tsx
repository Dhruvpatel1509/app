import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  Camera,
  Users,
  Wallet,
  ArrowLeftRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  CreditCard,
  PieChart,
} from 'lucide-react';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-stone-800 bg-stone-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white shadow-md shadow-emerald-500/20">
              C
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">Cashual</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-stone-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-20 pb-24 md:pt-32 md:pb-36 px-4">
          {/* Subtle Background Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-emerald-600/30 via-teal-500/20 to-transparent blur-3xl pointer-events-none rounded-full" />

          <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold animate-fade-in shadow-inner">
              <Sparkles size={14} className="text-emerald-400" />
              <span>Next-Gen Expense Splitting & AI Receipt Scanner</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]">
              Splitting bills shouldn&apos;t feel like{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200">
                accounting.
              </span>
            </h1>

            <p className="text-base sm:text-xl text-stone-400 max-w-2xl mx-auto leading-relaxed">
              Scan restaurant receipts in seconds, split individual items fairly with friends, simplify group debts, and track your personal budget with penny-exact accuracy.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 text-sm"
              >
                Create Free Account <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-7 py-3.5 bg-stone-800/80 hover:bg-stone-800 text-stone-200 font-semibold rounded-xl border border-stone-700 transition-all text-sm"
              >
                Sign In to Existing Account
              </Link>
            </div>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section className="max-w-6xl mx-auto px-4 pb-28">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-stone-950/60 border border-stone-800/80 space-y-3 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Camera size={22} />
              </div>
              <h3 className="text-lg font-bold text-white">AI Receipt Scanner</h3>
              <p className="text-sm text-stone-400 leading-relaxed">
                Snap a photo of any receipt. OCR reads every line item, subtotal, tax, and tip. Assign items directly to who ordered them.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-stone-950/60 border border-stone-800/80 space-y-3 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                <ArrowLeftRight size={22} />
              </div>
              <h3 className="text-lg font-bold text-white">Debt Simplification</h3>
              <p className="text-sm text-stone-400 leading-relaxed">
                Graph optimization minimizes payments across your whole group. Settle debts with the fewest possible transactions.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-stone-950/60 border border-stone-800/80 space-y-3 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Wallet size={22} />
              </div>
              <h3 className="text-lg font-bold text-white">Personal Budgeting</h3>
              <p className="text-sm text-stone-400 leading-relaxed">
                Only your allocated share counts toward your personal spending. Track monthly limits by dining, groceries, and travel.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-800/80 py-8 text-center text-xs text-stone-500">
        <p>Cashual — Intelligent Expense Sharing & AI Receipt Scanning</p>
        <p className="mt-1">All financial calculations execute with integer penny precision.</p>
      </footer>
    </div>
  );
}
