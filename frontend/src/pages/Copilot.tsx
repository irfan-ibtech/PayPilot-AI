import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Bot,
  Sparkles,
  Send,
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Database,
  ChevronRight,
} from 'lucide-react';

interface Recommendation {
  id?: number;
  title: string;
  description: string;
  supporting_metric: string;
  suggested_action: string;
  priority: 'high' | 'medium' | 'low';
  created_at?: string;
}

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  recommendations?: Recommendation[];
}

interface ContextMetrics {
  total_revenue: string;
  aov: string;
  conversion_rate: number;
  paid_orders: number;
  total_orders: number;
  potential_recovery?: string;
}

interface CopilotProps {
  onNavigateRecovery?: () => void;
  onNavigateAssistant?: () => void;
}

export const Copilot: React.FC<CopilotProps> = ({ onNavigateRecovery, onNavigateAssistant }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextMetrics, setContextMetrics] = useState<ContextMetrics | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: "### Welcome to PayPilot AI Copilot\n\nI am your **CFO & Operations Intelligence Partner**. I analyze your live PayPal transaction logs, calculate store conversion metrics, detect abandoned revenue, and generate actionable financial strategies.\n\nAsk me any operational question or select one of the suggested prompts below to analyze your store performance.",
    },
  ]);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);

  const suggestedChips = [
    'Analyze my sales performance and recommend three actions to improve revenue.',
    'What is my best-selling product and how can I capitalize on it?',
    'How are my payment conversion rates looking this week?',
  ];

  const fetchContextMetrics = async () => {
    try {
      const [overviewRes, recoveryRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/recovery/metrics').catch(() => ({ data: { data: null } })),
      ]);

      const m = overviewRes.data.metrics;
      const rec = recoveryRes.data.data;

      if (m) {
        setContextMetrics({
          total_revenue: m.formatted_revenue || `$${Number(m.total_revenue || 0).toFixed(2)}`,
          aov: m.formatted_aov || `$${Number(m.average_order_value || 0).toFixed(2)}`,
          conversion_rate: m.conversion_rate || 0,
          paid_orders: m.paid_orders || 0,
          total_orders: m.total_orders || 0,
          potential_recovery: rec?.formatted_potential_revenue,
        });
      }
    } catch (err) {
      console.error('Failed to load context metrics', err);
    }
  };

  const fetchRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const response = await api.get('/ai/copilot/recommendations');
      setRecommendations(response.data.data || []);
    } catch (err) {
      console.error('Failed to load recommendations', err);
    } finally {
      setLoadingRecs(false);
    }
  };

  useEffect(() => {
    fetchContextMetrics();
    fetchRecommendations();
  }, []);

  const handleAsk = async (questionToAsk?: string) => {
    const q = (questionToAsk || prompt).trim();
    if (!q || isLoading) return;

    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setPrompt('');
    setIsLoading(true);

    try {
      const response = await api.post('/ai/copilot/ask', { question: q });
      const { analysis, recommendations: newRecs } = response.data;

      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: analysis,
          recommendations: newRecs,
        },
      ]);

      fetchRecommendations();
      fetchContextMetrics();
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to contact Copilot intelligence engine.';
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `⚠️ **Error:** ${errorMsg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormattedMarkdown = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 text-sm leading-relaxed text-slate-200">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          // Headers
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-base font-bold text-white pt-2 border-b border-slate-800 pb-1">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('#### ')) {
            return (
              <h5 key={idx} className="text-sm font-semibold text-blue-300 pt-1">
                {trimmed.replace('#### ', '')}
              </h5>
            );
          }

          // Bullet points
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const rawText = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-blue-400 mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: formatInline(rawText) }} />
              </div>
            );
          }

          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
          );
        })}
      </div>
    );
  };

  const formatInline = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-slate-300">$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-900 text-blue-300 text-xs font-mono">$1</code>');
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Medium Priority
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Tactical Low
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">AI Financial Copilot</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center gap-1 shadow-sm">
              <Bot className="h-3 w-3" />
              Gemini 3.1 Flash Lite • Live
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Zero-Hallucination SQL Grounded
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Verified analytics synthesis, telemetry reasoning & autonomous recommendation engine
          </p>
        </div>
        <button
          onClick={() => {
            fetchRecommendations();
            fetchContextMetrics();
          }}
          className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Sync Telemetry</span>
        </button>
      </div>

      {/* Live Verified SQL Context Ribbon */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-blue-400">
                Bound Grounding Context
              </span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold font-mono">
                Deterministic MySQL Aggregates
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gemini reasons exclusively over verified ledger sums — no simulated hallucinations
            </p>
          </div>
        </div>

        {contextMetrics && (
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-sans">Settled Revenue</span>
              <span className="text-white font-bold tabular-nums">{contextMetrics.total_revenue}</span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-slate-500 block text-[10px] uppercase font-sans">Avg Order Value</span>
              <span className="text-blue-400 font-bold tabular-nums">{contextMetrics.aov}</span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-slate-500 block text-[10px] uppercase font-sans">Success Rate</span>
              <span className="text-emerald-400 font-bold tabular-nums">{contextMetrics.conversion_rate}%</span>
            </div>
            {contextMetrics.potential_recovery && (
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-500 block text-[10px] uppercase font-sans">Recoverable Pipeline</span>
                <span className="text-purple-400 font-bold tabular-nums">{contextMetrics.potential_recovery}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Chat & Diagnostic Console */}
        <div className="lg:col-span-2 flex flex-col h-[680px] rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
          {/* Console Header */}
          <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">PayPilot Advisory Assistant</h3>
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Store Telemetry Grounded
                </span>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              Series-B Fintech Intelligence
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'assistant' && (
                  <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-2xl p-4 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/20 text-sm'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-bl-none shadow-lg'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <p className="leading-relaxed">{msg.text}</p>
                  ) : (
                    renderFormattedMarkdown(msg.text)
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start items-center text-slate-400 text-xs py-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <span>Analyzing store volume, conversion funnel, and synthesizing CFO recommendations...</span>
              </div>
            )}
          </div>

          {/* Quick-Prompt Chips */}
          <div className="px-4 py-2 bg-slate-900 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1 font-medium">Inquire:</span>
            {suggestedChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isLoading}
                onClick={() => handleAsk(chip)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-xs text-slate-300 hover:text-white transition text-left truncate max-w-[280px]"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              disabled={isLoading}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask Copilot e.g., 'Analyze my sales performance and recommend three actions to improve revenue.'"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-40 active:scale-95"
            >
              <Send className="h-4 w-4" />
              <span className="text-xs font-semibold">Ask Copilot</span>
            </button>
          </form>
        </div>

        {/* Right Col: Persisted Strategic Recommendations */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold text-base">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>Executive Strategic Actions</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {recommendations.length} Active
              </span>
            </div>

            {loadingRecs ? (
              <p className="text-xs text-slate-500 py-6 text-center">Loading recommendations...</p>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 space-y-2">
                <Lightbulb className="h-6 w-6 text-slate-600 mx-auto" />
                <p>No recommendations stored yet.</p>
                <p>Ask the Copilot above to generate strategic actions!</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[540px] overflow-y-auto pr-1">
                {recommendations.map((rec, idx) => {
                  const isRecoveryAction =
                    rec.title.toLowerCase().includes('abandon') ||
                    rec.title.toLowerCase().includes('recovery') ||
                    rec.suggested_action.toLowerCase().includes('recovery') ||
                    rec.description.toLowerCase().includes('recovery') ||
                    rec.description.toLowerCase().includes('drop-off');

                  const isOrderAction =
                    rec.title.toLowerCase().includes('product') ||
                    rec.title.toLowerCase().includes('catalog') ||
                    rec.suggested_action.toLowerCase().includes('order');

                  return (
                    <div
                      key={rec.id || idx}
                      className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2.5 hover:border-slate-600 transition shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-white leading-snug">{rec.title}</h4>
                        {getPriorityBadge(rec.priority)}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{rec.description}</p>
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-700/50">
                        <span className="text-[11px] font-mono font-medium text-emerald-400">
                          {rec.supporting_metric}
                        </span>

                        <div className="flex items-center gap-2">
                          {isRecoveryAction && onNavigateRecovery ? (
                            <button
                              type="button"
                              onClick={onNavigateRecovery}
                              className="text-xs px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium transition flex items-center gap-1 shadow-sm"
                            >
                              <span>Open Recovery</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          ) : isOrderAction && onNavigateAssistant ? (
                            <button
                              type="button"
                              onClick={onNavigateAssistant}
                              className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition flex items-center gap-1 shadow-sm"
                            >
                              <span>Create AI Order</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          ) : (
                            <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                              {rec.suggested_action}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Persisted deterministically to the database.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Copilot;