import { AuthProvider } from '@/components/auth/auth-provider';
import { Sidebar, BottomNav } from '@/components/layout/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-dvh bg-stone-50">
        <Sidebar />
        <BottomNav />
        <main className="main-with-sidebar">
          <div className="px-4 py-6 md:px-6 lg:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}
