'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setServerError('Invalid email or password. Please try again.');
      } else if (error.message.includes('Email not confirmed')) {
        setServerError('Please verify your email address before signing in.');
      } else {
        setServerError(error.message);
      }
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-600 rounded-xl mb-4">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Welcome back</h1>
          <p className="text-stone-500 text-sm mt-1">Sign in to your Cashual account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {serverError}
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={cn('input', errors.email && 'input-error')}
              placeholder="you@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="label mb-0">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={cn('input pr-10', errors.password && 'input-error')}
                placeholder="••••••••"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full mt-2"
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Sign in
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center text-sm text-stone-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-emerald-600 font-medium hover:text-emerald-700">
            Create account
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="text-center text-emerald-200 text-xs mt-6 opacity-75">
        Split expenses fairly. Track what matters.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md p-8 bg-white/10 rounded-2xl shadow-xl animate-pulse h-96" />
      }
    >
      <LoginForm />
    </Suspense>
  );
}
