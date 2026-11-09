import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Bot,
  Package,
  CreditCard,
  RotateCcw,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import api from '../services/api';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const [pendingRecoveryCount, setPendingRecoveryCount] = useState<number>(0);

  useEffect(() => {
    const fetchRecoveryBadge = async () => {
      try {
        const res = await api.get('/recovery/metrics');
        if (res.data?.data?.pending_review !== undefined) {
          setPendingRecoveryCount(res.data.data.pending_review);
        }
      } catch (e) {
        // Silently ignore if offline
      }
    };

    fetchRecoveryBadge();
    const interval = setInterval(fetchRecoveryBadge, 15000);
    return () => clearInterval(interval);
  }, []);

  const commerceNav = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'assistant', label: 'Order Assistant', icon: ShoppingCart },
    { id: 'products', label: 'Product Catalog', icon: Package },
    { id: 'payments', label: 'Transactions Ledger', icon: CreditCard },
  ];

  const intelligenceNav = [
    {
      id: 'recovery',
      label: 'Revenue Recovery',
      icon: RotateCcw,
      badge: pendingRecoveryCount > 0 ? pendingRecoveryCount : undefined,
    },
    { id: 'copilot', label: 'CFO Business Copilot', icon: Bot },
  ];

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between p-4 min-h-[calc(100vh-4rem)] select-none">
      <div className="space-y-6">
        {/* Core Commerce Section */}
        <div className="space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Core Commerce
          </div>
          {commerceNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Intelligence & Autonomy Section */}
        <div className="space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-purple-400/90 flex items-center justify-between">
            <span>Intelligence & Agents</span>
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
          </div>
          {intelligenceNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950 shadow-sm animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live System Status Footer */}
      <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/90 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-400 text-[10px] tracking-wider uppercase flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-blue-400" />
            System Telemetry
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
            HEALTHY
          </span>
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PayPal REST v2
            </span>
            <span className="text-emerald-400 font-mono font-medium">Sandbox</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Gemini 3.1 Flash Lite
            </span>
            <span className="text-emerald-400 font-mono font-medium">Live</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-blue-400" />
              BCMath Engine
            </span>
            <span className="text-blue-400 font-mono font-medium">Scale-2</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
