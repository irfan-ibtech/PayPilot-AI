import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Bot,
  User,
  Server,
  CreditCard,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { PaymentEventItem } from '../types/recovery';

interface PaymentEventTimelineProps {
  events: PaymentEventItem[];
  isLoading?: boolean;
  title?: string;
  emptyMessage?: string;
}

export const PaymentEventTimeline: React.FC<PaymentEventTimelineProps> = ({
  events,
  isLoading = false,
  title = 'Payment & Audit Event Timeline',
  emptyMessage = 'No chronological events recorded yet.',
}) => {
  const [expandedPayloads, setExpandedPayloads] = useState<Record<number, boolean>>({});

  const togglePayload = (id: number) => {
    setExpandedPayloads((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getSourceBadge = (source: string) => {
    const s = source.toUpperCase();
    if (s.includes('PAYPAL')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <CreditCard className="w-3 h-3" />
          {source}
        </span>
      );
    }
    if (s.includes('AI') || s.includes('GEMINI')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Bot className="w-3 h-3" />
          {source}
        </span>
      );
    }
    if (s.includes('MERCHANT') || s.includes('USER')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <User className="w-3 h-3" />
          {source}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Server className="w-3 h-3" />
        {source}
      </span>
    );
  };

  const getEventIcon = (eventType: string) => {
    const e = eventType.toUpperCase();
    if (e.includes('COMPLETED') || e.includes('SETTLED') || e.includes('APPROVED')) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
    if (e.includes('FAILED') || e.includes('DISMISSED') || e.includes('ERROR')) {
      return <XCircle className="w-4 h-4 text-rose-400" />;
    }
    if (e.includes('RECONCILED')) {
      return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
    }
    if (e.includes('DETECTED') || e.includes('ANALYZED')) {
      return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
    if (e.includes('CHECKOUT') || e.includes('CAPTURE_PREPARED')) {
      return <Zap className="w-4 h-4 text-blue-400" />;
    }
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <h4 className="text-sm font-semibold text-white tracking-wide">{title}</h4>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {events.length} event{events.length === 1 ? '' : 's'}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
          <Clock className="w-4 h-4 animate-spin text-indigo-400" />
          Loading audit events...
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-xs">{emptyMessage}</div>
      ) : (
        <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
          {events.map((event) => {
            const hasPayload = event.payload && Object.keys(event.payload).length > 0;
            const isExpanded = expandedPayloads[event.id] || false;

            return (
              <div key={event.id} className="relative group">
                {/* Node icon on line */}
                <div className="absolute -left-6 top-0.5 p-1 rounded-full bg-slate-900 border border-slate-700 shadow-sm">
                  {getEventIcon(event.event_type)}
                </div>

                <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800/60 transition-colors hover:border-slate-700/80">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold font-mono text-white">
                        {event.event_type}
                      </span>
                      {getSourceBadge(event.source)}
                    </div>
                    <time className="text-[11px] font-mono text-slate-400">
                      {new Date(event.occurred_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </time>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{event.summary}</p>

                  {hasPayload && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => togglePayload(event.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-indigo-400 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        <span>{isExpanded ? 'Hide Payload' : 'Inspect Audit Payload'}</span>
                      </button>

                      {isExpanded && (
                        <pre className="mt-2 p-2.5 rounded bg-slate-950 text-[10px] font-mono text-slate-300 overflow-x-auto border border-slate-800 max-h-48">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
