import { AuthProvider } from '@/components/auth/auth-provider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-dvh bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 flex items-center justify-center p-4">
        {children}
      </div>
    </AuthProvider>
  );
}
