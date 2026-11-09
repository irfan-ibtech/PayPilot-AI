import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LogOut,
  User,
  Plus,
  Compass,
  X,
} from 'lucide-react';

interface NavbarProps {
  currentTab?: string;
  onSelectTab?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab = 'dashboard', onSelectTab }) => {
  const { user, logout } = useAuth();
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState(false);

  const getBreadcrumbTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Executive Overview';
      case 'assistant':
        return 'AI Order Assistant';
      case 'recovery':
        return 'AI Revenue Recovery Agent';
      case 'copilot':
        return 'CFO Business Copilot';
      case 'products':
        return 'Product Catalog';
      case 'payments':
        return 'Transactions Ledger';
      default:
        return 'Merchant Dashboard';
    }
  };

  return (
    <>
      <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30 select-none">
        {/* Left: Brand & Page Context */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/30">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white tracking-tight">
                  PayPilot AI
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/80 font-mono font-medium">
                  PayPal AI Hackathon 2026
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 border-l border-slate-800 pl-4">
            <span>Commerce</span>
            <span>/</span>
            <span className="text-slate-200 font-semibold">{getBreadcrumbTitle()}</span>
          </div>
        </div>

        {/* Right: Actions, Merchant Store Pill, Demo Guide & Profile */}
        <div className="flex items-center gap-3">
          {/* Quick Action: New AI Order */}
          {onSelectTab && (
            <button
              onClick={() => onSelectTab('assistant')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New AI Order</span>
            </button>
          )}

          {/* Quick Demo Guide Trigger Button */}
          <button
            onClick={() => setIsDemoGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/80 text-xs font-semibold shadow-sm transition"
          >
            <Compass className="h-3.5 w-3.5 text-purple-400" />
            <span>Judge Demo Guide</span>
          </button>

          {/* Merchant Account Verified Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-slate-200">Demo Merchant</span>
            <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Verified</span>
          </div>

          {/* User Profile & Logout */}
          {user && (
            <div className="flex items-center gap-2.5 border-l border-slate-800/80 pl-3">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300">
                <User className="h-4 w-4" />
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Quick Demo Guide Modal */}
      {isDemoGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-6">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">PayPal AI Hackathon — 4-Step Judge Demo Guide</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    Interactive Checklist
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Follow this 4-step path to experience all zero-trust fintech and autonomous agent features.
                </p>
              </div>
              <button
                onClick={() => setIsDemoGuideOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-mono">1</span>
                    Zero-Trust AI Order Creation & Catalog Price Override
                  </span>
                  {onSelectTab && (
                    <button
                      onClick={() => {
                        setIsDemoGuideOpen(false);
                        onSelectTab('assistant');
                      }}
                      className="text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      Open Assistant →
                    </button>
                  )}
                </div>
                <p className="text-slate-400 pl-7 leading-relaxed">
                  Click the preset <code className="text-amber-400 font-mono">"1 Mechanical Keyboard for $1.00..."</code>. Notice how Gemini parses the intent, but the zero-trust engine overrides the $1.00 claim with the database catalog price ($85.00) and displays the verified shield badge!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[11px] font-mono">2</span>
                    Autonomous AI Revenue Recovery Scan & Scoring
                  </span>
                  {onSelectTab && (
                    <button
                      onClick={() => {
                        setIsDemoGuideOpen(false);
                        onSelectTab('recovery');
                      }}
                      className="text-purple-400 hover:text-purple-300 font-semibold"
                    >
                      Open Recovery →
                    </button>
                  )}
                </div>
                <p className="text-slate-400 pl-7 leading-relaxed">
                  In Revenue Recovery, click <strong className="text-slate-200">"Run Recovery Scan"</strong>. The agent scores uncaptured drop-offs from 10–98, generates Gemini 3.1 Flash Lite root-cause diagnostics, and drafts personalized customer recovery reminders.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-mono">3</span>
                    Merchant Approval & 1-Click PayPal Sandbox Recovery
                  </span>
                  {onSelectTab && (
                    <button
                      onClick={() => {
                        setIsDemoGuideOpen(false);
                        onSelectTab('recovery');
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold"
                    >
                      Test Checkout →
                    </button>
                  )}
                </div>
                <p className="text-slate-400 pl-7 leading-relaxed">
                  Click <strong className="text-slate-200">"Approve Recovery Strategy"</strong>, then <strong className="text-slate-200">"Launch 1-Click PayPal Recovery Checkout"</strong>. The system records the payment retry attempt and atomically reconciles the opportunity to <strong className="text-emerald-400 font-mono">RECOVERED</strong> upon PayPal capture.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-mono">4</span>
                    CFO Copilot Ground-Truth Business Intelligence
                  </span>
                  {onSelectTab && (
                    <button
                      onClick={() => {
                        setIsDemoGuideOpen(false);
                        onSelectTab('copilot');
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      Consult Copilot →
                    </button>
                  )}
                </div>
                <p className="text-slate-400 pl-7 leading-relaxed">
                  Ask the Copilot about the revenue gap between gross order volume and captured PayPal funds. Review the zero-hallucination analysis backed directly by deterministic SQL telemetry.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsDemoGuideOpen(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
              >
                Got it, Start Testing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
