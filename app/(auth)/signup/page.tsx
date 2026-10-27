'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, isValidUsername } from '@/lib/utils';

const signupSchema = z
  .object({
    display_name: z.string().min(2, 'Name must be at least 2 characters').max(50),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .refine(isValidUsername, 'Username can only contain lowercase letters, numbers, and underscores'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password too long'),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setServerError(null);

    // Check username availability
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', data.username.toLowerCase())
      .single();

    if (existingUser) {
      setServerError('Username is already taken. Please choose a different one.');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.display_name,
          username: data.username.toLowerCase(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        setServerError('An account with this email already exists. Please sign in.');
      } else {
        setServerError(error.message);
      }
      return;
    }

    // Check if email confirmation is required
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Email confirmation not required — go directly to dashboard
      router.push('/dashboard');
      router.refresh();
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-stone-900 mb-2">Check your inbox</h2>
          <p className="text-stone-500 text-sm mb-6">
            We&apos;ve sent a verification link to your email address. Please click it to activate your account.
          </p>
          <Link href="/login" className="btn-primary inline-flex">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-600 rounded-xl mb-4">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Create your account</h1>
          <p className="text-stone-500 text-sm mt-1">Start splitting expenses smarter</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {serverError}
            </div>
          )}

          {/* Display name */}
          <div>
            <label htmlFor="display_name" className="label">
              Full name
            </label>
            <input
              id="display_name"
              type="text"
              autoComplete="name"
              className={cn('input', errors.display_name && 'input-error')}
              placeholder="Alex Johnson"
              {...register('display_name')}
            />
            {errors.display_name && (
              <p className="mt-1 text-xs text-red-600">{errors.display_name.message}</p>
            )}
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="label">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-stone-400 text-sm">
                @
              </span>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className={cn('input pl-7', errors.username && 'input-error')}
                placeholder="alexj"
                {...register('username')}
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>
            )}
            <p className="mt-1 text-xs text-stone-400">Lowercase letters, numbers, and underscores only</p>
          </div>

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
            <label htmlFor="password" className="label">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className={cn('input pr-10', errors.password && 'input-error')}
                placeholder="Min. 8 characters"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm_password" className="label">
              Confirm password
            </label>
            <input
              id="confirm_password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className={cn('input', errors.confirm_password && 'input-error')}
              placeholder="••••••••"
              {...register('confirm_password')}
            />
            {errors.confirm_password && (
              <p className="mt-1 text-xs text-red-600">{errors.confirm_password.message}</p>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-2">
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Create account
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="text-xs text-stone-400 text-center">
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </p>
        </form>

        <p className="text-center text-sm text-stone-500 mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-600 font-medium hover:text-emerald-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
