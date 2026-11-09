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

export const Copilot: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

      // Refresh persisted recommendations
      fetchRecommendations();
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

  // Simple, elegant Markdown renderer for analysis responses
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">AI Financial Copilot</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1">
              <Bot className="h-3 w-3 text-indigo-400" />
              CFO Intelligence
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Verified analytics synthesis, telemetry reasoning & autonomous recommendation engine
          </p>
        </div>
        <button
          onClick={fetchRecommendations}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Sync Recommendations</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Chat & Diagnostic Console */}
        <div className="lg:col-span-2 flex flex-col h-[680px] rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
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
                  Connected to Store Telemetry
                </span>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
              Deterministic Verification
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
                <span>Analyzing store volume, conversion funnel, and calculating recommendations...</span>
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
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              <span className="text-xs font-semibold">Ask Copilot</span>
            </button>
          </form>
        </div>

        {/* Right Col: Persisted Strategic Recommendations */}
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-semibold text-base">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>Strategic Recommendations</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
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
                {recommendations.map((rec, idx) => (
                  <div
                    key={rec.id || idx}
                    className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2.5 hover:border-slate-600 transition shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-white leading-snug">{rec.title}</h4>
                      {getPriorityBadge(rec.priority)}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{rec.description}</p>
                    <div className="pt-1 flex items-center justify-between border-t border-slate-700/50">
                      <span className="text-xs font-mono font-medium text-emerald-400">
                        {rec.supporting_metric}
                      </span>
                      <button
                        type="button"
                        onClick={() => alert(`Action "${rec.suggested_action}" triggered! In a production merchant deployment, this initiates the corresponding PayPal automated workflow.`)}
                        className="text-xs px-3 py-1 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white font-medium transition"
                      >
                        {rec.suggested_action}
                      </button>
                    </div>
                  </div>
                ))}
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
