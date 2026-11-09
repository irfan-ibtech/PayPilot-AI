import React, { useState } from 'react';
import { Bot, Sparkles, Send, Lightbulb, CheckCircle2 } from 'lucide-react';

export const Copilot: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'assistant',
      text: 'Hello Merchant! I am PayPilot AI Copilot. I analyze your store revenue, optimize pricing, suggest bundle deals, and automate PayPal invoices. What would you like to review today?',
    },
  ]);

  const recommendations = [
    {
      title: 'Bundle Opportunity: Keyboard + Mousepad',
      desc: 'Customers who buy Mechanical Keyboards have a 42% propensity to add Ergonomic Mousepads. Offer a 10% combo discount.',
      metric: '+18% Projected AOV',
      action: 'Create Promo Bundle',
    },
    {
      title: 'Cart Recovery via PayPal Quick-Pay',
      desc: '3 abandoned carts detected in the last 24 hours. Dispatching 1-click PayPal paylink can recover ~$135.',
      metric: '72% Recovery Rate',
      action: 'Send Recovery Paylinks',
    },
  ];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const userMsg = prompt.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setPrompt('');

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Analyzing "${userMsg}" against merchant transaction history... In Milestone 3, this integrates directly with Gemini 2.5 Flash for autonomous real-time payment actions and merchant telemetry.`,
        },
      ]);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Financial Copilot</h1>
        <p className="text-sm text-slate-400">
          Autonomous business intelligence & conversational transaction dispatch
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-2 flex flex-col h-[520px] rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Merchant AI Assistant</h3>
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ready (Gemini AI Engine)
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs shrink-0">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-md p-3.5 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask Copilot e.g., 'What is my top selling item this week?'"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* AI Recommendations Panel */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-base border-b border-slate-800 pb-3">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Autonomous Recommendations</span>
            </div>

            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <h4 className="text-sm font-medium text-white">{rec.title}</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-normal">{rec.desc}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-mono font-semibold text-emerald-400">
                      {rec.metric}
                    </span>
                    <button className="text-xs px-2.5 py-1 rounded bg-blue-600/80 hover:bg-blue-600 text-white font-medium transition">
                      {rec.action}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Persisted via business_recommendations table.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Copilot;
