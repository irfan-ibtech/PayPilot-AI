import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, AlertCircle, Sparkles } from 'lucide-react';

interface LoginProps {
  onNavigateRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo@paypilot.ai');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setError(res?.data?.message || 'Login failed. Please check your credentials.');
      } else {
        setError('Connection error. Ensure backend server is running.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@paypilot.ai');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-xl bg-blue-600 items-center justify-center font-bold text-xl text-white shadow-lg shadow-blue-500/25 mb-3">
            P
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to PayPilot AI</h1>
          <p className="text-sm text-slate-400 mt-1">Autonomous Merchant Finance & PayPal Copilot</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Merchant Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="demo@paypilot.ai"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleFillDemo}
            className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-blue-400 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700/60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Fill Hackathon Demo Credentials</span>
          </button>

          <p className="text-center text-xs text-slate-400 mt-2">
            Don't have a merchant account?{' '}
            <button
              onClick={onNavigateRegister}
              className="text-blue-400 hover:underline font-medium"
            >
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
