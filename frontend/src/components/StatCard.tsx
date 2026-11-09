import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  subtitle?: string;
  progressPercent?: number;
  progress?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
  icon: Icon,
  subtitle,
  progressPercent,
  progress,
}) => {
  const activeProgress = progressPercent !== undefined ? progressPercent : progress;
  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-sm hover:border-slate-700/80 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold text-white font-mono tracking-tight tabular-nums">{value}</span>
        {change && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full font-mono ${
              isPositive
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                : 'bg-amber-950 text-amber-400 border border-amber-800/80'
            }`}
          >
            {change}
          </span>
        )}
      </div>
      {activeProgress !== undefined && (
        <div className="mt-2.5 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, activeProgress))}%` }}
          />
        </div>
      )}
      {subtitle && <p className="mt-2 text-[11px] text-slate-500">{subtitle}</p>}
    </div>
  );
};

export default StatCard;
