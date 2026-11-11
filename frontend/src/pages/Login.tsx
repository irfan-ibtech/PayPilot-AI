import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LogIn,
  AlertCircle,
  Sparkles,
  Bot,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight,
  DollarSign,
  Layers,
  Globe,
  Cpu,
} from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Navigation / Status Header */}
      <header className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-3 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-blue-500/25">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">PayPilot AI</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950 text-blue-400 border border-blue-800 font-mono uppercase">
                v2.0 Fintech Hardened
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Revenue Recovery & Merchant Copilot</p>
          </div>
        </div>

        {/* Hackathon Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>PayPal AI Hackathon 2026</span>
          </div>
          <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-blue-400" />
            <span>Gemini 3.1 Flash Lite</span>
          </div>
          <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-emerald-400" />
            <span>PayPal REST API v2 Sandbox</span>
          </div>
        </div>
      </header>

      {/* Main Split Layout: Showcase on Left, Login on Right */}
      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto py-4">
        {/* Left Column: Product Showcase & Architecture (Col 7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-950/80 to-indigo-950/80 border border-blue-800/60 text-blue-300 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span>Next-Gen Autonomous Merchant Commerce Platform</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Turn Failed Checkouts Into <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
                Verified Settled Revenue.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
              PayPilot AI pairs Google Gemini with the PayPal REST API v2, fortified by zero-trust financial precision,
              explainable recovery scoring, and human-authorized outreach to rescue abandoned merchant sales.
            </p>
          </div>

          {/* 4 Core Architectural Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {/* Feature 1 */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 transition shadow-sm space-y-2">
              <div className="h-8 w-8 rounded-xl bg-blue-950 text-blue-400 border border-blue-800 flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white">AI Revenue Recovery Agent</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Autonomous Gemini 3.1 Flash Lite behavioral diagnostics uncover payment root causes, generate tailored outreach drafts, and enforce strict merchant approval gates.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[11px] font-mono text-blue-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>Explainable Priority Scoring (10–98)</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 transition shadow-sm space-y-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white">Genuine PayPal REST v2 Engine</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                1-Click recovery checkouts with live buyer authorization, server-side capture status/amount validation, and decoupled 3-step concurrency safety.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>Upstream Idempotency (PayPal-Request-Id)</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 transition shadow-sm space-y-2">
              <div className="h-8 w-8 rounded-xl bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white">Zero-Float Financial Hardening</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Eliminates IEEE 754 precision drift using BCMath arbitrary-precision string math. Strictly segregates live PayPal revenue from simulation and demo data.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[11px] font-mono text-amber-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>Multi-Currency ISO Scales (USD, JPY, BHD)</span>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 transition shadow-sm space-y-2">
              <div className="h-8 w-8 rounded-xl bg-purple-950 text-purple-400 border border-purple-800 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white">CFO Copilot & Smart Orders</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Natural-language order parsing with catalog price injection defense, chronological audit event timelines, and deterministic revenue metrics.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[11px] font-mono text-purple-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>Application-Level Event Log Stream</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/60">
            <div>
              <p className="text-[11px] uppercase font-semibold text-slate-400">Priority Engine</p>
              <p className="text-lg font-bold font-mono text-blue-400 mt-0.5">10–98</p>
              <p className="text-[10px] text-slate-400">Heuristic Signals</p>
            </div>
            <div>
              <p className="text-[11px] uppercase font-semibold text-slate-400">Math Precision</p>
              <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">$0.00</p>
              <p className="text-[10px] text-slate-400">Zero Float Drift</p>
            </div>
            <div>
              <p className="text-[11px] uppercase font-semibold text-slate-400">Capture Guard</p>
              <p className="text-lg font-bold font-mono text-indigo-400 mt-0.5">Server-Side</p>
              <p className="text-[10px] text-slate-400">Verified via REST v2</p>
            </div>
            <div>
              <p className="text-[11px] uppercase font-semibold text-slate-400">Tenant Safety</p>
              <p className="text-lg font-bold font-mono text-amber-400 mt-0.5">Multi-Tenant</p>
              <p className="text-[10px] text-slate-400">Scoped Authorization</p>
            </div>
          </div>
        </div>

        {/* Right Column: High-Trust Login Card (Col 5) */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Subtle Gradient Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative space-y-6">
              {/* Card Header */}
              <div className="text-center">
                <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 items-center justify-center font-bold text-xl text-white shadow-lg shadow-blue-500/30 mb-3">
                  P
                </div>
                <h2 className="text-xl font-bold text-white">Merchant Console Sign In</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Access autonomous recovery telemetry & PayPal transaction management
                </p>
              </div>

              {/* 1-Click Fill Hackathon Demo Merchant Button */}
              <button
                type="button"
                onClick={handleFillDemo}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-purple-900/60 hover:from-blue-900/80 hover:via-indigo-900/80 hover:to-purple-900/80 text-blue-200 text-xs font-semibold flex items-center justify-center gap-2 border border-blue-700/60 transition shadow-sm group"
              >
                <Sparkles className="h-4 w-4 text-blue-400 group-hover:scale-110 transition" />
                <span>1-Click Fill Hackathon Demo Credentials</span>
              </button>

              {/* Error Notice */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Merchant Email</span>
                    <span className="text-[10px] text-slate-400 font-mono">Sanctum Auth</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition"
                      placeholder="demo@paypilot.ai"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Password</span>
                    <span className="text-[10px] text-slate-400 font-mono">Bcrypt Salted</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono transition"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{isSubmitting ? 'Authenticating Merchant...' : 'Sign In to Merchant Console'}</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </button>
              </form>

              {/* Demo Dataset Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  <span>Pre-Seeded Hackathon Environment</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  Demo merchant is pre-loaded with 5 catalog items, 12 historical PayPal transactions, live Gemini 3.1 Flash Lite integration, and actionable revenue recovery opportunities.
                </p>
              </div>

              {/* Footer Links */}
              <div className="pt-2 text-center text-xs text-slate-400 flex items-center justify-between border-t border-slate-800">
                <span>Need a merchant workspace?</span>
                <button
                  type="button"
                  onClick={onNavigateRegister}
                  className="text-blue-400 hover:text-blue-300 font-semibold transition"
                >
                  Register New Account &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer System Status Strip */}
      <footer className="max-w-7xl mx-auto w-full pt-4 mt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <p>PayPilot AI &copy; 2026 &bull; PayPal AI Hackathon 2026 Official Project &bull; Built with Laravel 12 & React 19</p>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            PayPal Sandbox: Operational
          </span>
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
            Gemini Live: Operational
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Login;
