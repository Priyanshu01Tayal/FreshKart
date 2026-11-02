import React, { useState } from 'react';
import { ShoppingBag, Lock, Mail, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { signIn, isSupabaseConnected } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5FAF5] p-4 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-[#D5EEDB] bg-white p-8 shadow-sm">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#168447] text-white shadow-md">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-[#17251C]">
            FreshKart Admin
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Quick Commerce Store & Dispatch Operations
          </p>
        </div>

        {/* Environment Connection Status Warning */}
        {!isSupabaseConnected && (
          <div className="mt-6 flex items-start space-x-2.5 rounded-2xl bg-amber-50 p-4 text-xs text-amber-800 border border-amber-200">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Supabase Backend Unconnected</p>
              <p className="mt-0.5 text-amber-700">
                Please set <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> in{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env</code> to connect to your live database.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-6 flex items-start space-x-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#17251C] uppercase tracking-wider mb-1.5">
              Administrator Email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Mail className="h-5 w-5" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@freshkart.com"
                required
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-[#17251C] outline-none transition focus:border-[#168447] focus:ring-2 focus:ring-[#EAF7EE]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#17251C] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Lock className="h-5 w-5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-[#17251C] outline-none transition focus:border-[#168447] focus:ring-2 focus:ring-[#EAF7EE]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isSupabaseConnected}
            className="flex w-full items-center justify-center space-x-2 rounded-xl bg-[#168447] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#105C35] active:scale-[0.99] disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Verifying with Supabase Auth...' : 'Sign In to Hub'}</span>
            {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-gray-400">
          Protected strictly by Supabase Auth and PostgreSQL Row-Level Security (RLS). Customer and Delivery Partner accounts cannot access this portal.
        </div>
      </div>
    </div>
  );
};
