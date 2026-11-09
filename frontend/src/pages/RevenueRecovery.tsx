import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Copy,
  Check,
  XCircle,
  TrendingUp,
  DollarSign,
  Layers,
  Bot,
  Percent,
  Mail,
  MessageSquare,
  Zap,
} from 'lucide-react';
import api from '../services/api';
import type { RecoveryOpportunity, RecoveryMetrics, RecoveryStatus } from '../types/recovery';
import type { PaymentRecord } from '../types/order';
import { PayPalCheckoutModal } from '../components/PayPalCheckoutModal';

const RadialScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const radius = 34;
  const stroke = 5;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color = score >= 85 ? '#10b981' : score >= 70 ? '#3b82f6' : '#f59e0b';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        <circle
          stroke="#1e293b"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.6s ease-in-out' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-sm font-bold font-mono text-white tabular-nums">{score}</span>
        <span className="text-[8px] uppercase tracking-wider text-slate-400 font-sans">Score</span>
      </div>
    </div>
  );
};

export const RevenueRecovery: React.FC = () => {
  const [opportunities, setOpportunities] = useState<RecoveryOpportunity[]>([]);
  const [metrics, setMetrics] = useState<RecoveryMetrics | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<RecoveryOpportunity | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [isReanalyzing, setIsReanalyzing] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editable copy message & composer mode
  const [editedMessage, setEditedMessage] = useState<string>('');
  const [composerMode, setComposerMode] = useState<'email' | 'sms'>('email');
  const [copied, setCopied] = useState<boolean>(false);

  // Checkout modal
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);

  // Fetch metrics and opportunities
  const loadData = async (statusFilter?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [oppRes, metricsRes] = await Promise.all([
        api.get('/recovery/opportunities', {
          params: statusFilter && statusFilter !== 'ALL' ? { status: statusFilter } : {},
        }),
        api.get('/recovery/metrics'),
      ]);

      const loadedOpps: RecoveryOpportunity[] = oppRes.data.data || [];
      setOpportunities(loadedOpps);
      setMetrics(metricsRes.data.data || null);

      if (loadedOpps.length > 0) {
        setSelectedOpportunity((prev) => {
          if (!prev) return loadedOpps[0];
          const found = loadedOpps.find((o) => o.id === prev.id);
          return found || loadedOpps[0];
        });
      } else {
        setSelectedOpportunity(null);
      }
    } catch (err: unknown) {
      console.error('Failed to load recovery data', err);
      setErrorMsg('Failed to fetch revenue recovery telemetry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedOpportunity) {
      setEditedMessage(selectedOpportunity.customer_message_draft || '');
    }
  }, [selectedOpportunity]);

  // Run autonomous scan
  const handleScan = async () => {
    setIsScanning(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);
    try {
      const res = await api.post('/recovery/scan');
      setActionSuccessMsg(res.data.message || 'Scan completed.');
      await loadData(activeTab);
    } catch (err: unknown) {
      console.error('Scan failed', err);
      setErrorMsg('Autonomous recovery scan encountered an error.');
    } finally {
      setIsScanning(false);
    }
  };

  // Live Re-Analyze via Gemini
  const handleReanalyze = async () => {
    if (!selectedOpportunity) return;
    setIsReanalyzing(true);
    setErrorMsg(null);
    try {
      const res = await api.post(`/recovery/opportunities/${selectedOpportunity.id}/analyze`);
      const updated = res.data.data;
      setSelectedOpportunity(updated);
      setEditedMessage(updated.customer_message_draft || '');
      setActionSuccessMsg(
        `Gemini Live Diagnostics Completed (${res.data.model || 'Gemini 2.5 Flash'}). Strategy and message refreshed!`
      );
      await loadData(activeTab);
    } catch (err: unknown) {
      console.error('Re-analyze failed', err);
      setErrorMsg('Failed to run live Gemini diagnostic.');
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Approve opportunity
  const handleApprove = async () => {
    if (!selectedOpportunity) return;
    setIsProcessingAction(true);
    setErrorMsg(null);
    try {
      const res = await api.post(`/recovery/opportunities/${selectedOpportunity.id}/approve`, {
        custom_message: editedMessage,
      });
      setActionSuccessMsg('Recovery opportunity approved. Ready for customer recovery outreach.');
      const updated: RecoveryOpportunity = res.data.data;
      setSelectedOpportunity(updated);
      await loadData(activeTab);
    } catch (err: unknown) {
      console.error('Approve failed', err);
      setErrorMsg('Failed to approve opportunity.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Reject / Dismiss opportunity
  const handleReject = async () => {
    if (!selectedOpportunity) return;
    setIsProcessingAction(true);
    setErrorMsg(null);
    try {
      const res = await api.post(`/recovery/opportunities/${selectedOpportunity.id}/reject`, {
        reason: 'Dismissed by merchant',
      });
      setActionSuccessMsg('Opportunity dismissed from active queue.');
      const updated: RecoveryOpportunity = res.data.data;
      setSelectedOpportunity(updated);
      await loadData(activeTab);
    } catch (err: unknown) {
      console.error('Reject failed', err);
      setErrorMsg('Failed to dismiss opportunity.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleLaunchCheckout = () => {
    if (!selectedOpportunity) return;
    setIsCheckoutModalOpen(true);
  };

  const handlePaymentSuccess = async (payment: PaymentRecord) => {
    setIsCheckoutModalOpen(false);
    setActionSuccessMsg(`Payment captured successfully! PayPal Order: ${payment.paypal_order_id}`);
    await loadData(activeTab);
  };

  const handleCopyMessage = () => {
    if (!editedMessage) return;
    navigator.clipboard.writeText(editedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: RecoveryStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">Review Pending</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800">Approved</span>;
      case 'IN_FLIGHT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-400 border border-indigo-800">Checkout In Flight</span>;
      case 'RECOVERED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">Recovered & Paid</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">Dismissed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  // Stepper logic
  const getStepStatus = (stepIndex: number, status: RecoveryStatus) => {
    if (status === 'RECOVERED') return 'completed';
    if (status === 'REJECTED') {
      if (stepIndex <= 2) return 'completed';
      if (stepIndex === 3) return 'rejected';
      return 'pending';
    }
    if (status === 'IN_FLIGHT') {
      if (stepIndex <= 3) return 'completed';
      return 'active';
    }
    if (status === 'APPROVED') {
      if (stepIndex <= 3) return 'completed';
      return 'pending';
    }
    // PENDING
    if (stepIndex === 1) return 'completed';
    if (stepIndex === 2) return 'completed';
    if (stepIndex === 3) return 'active';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">AI Revenue Recovery Agent</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center gap-1 shadow-sm">
              <Sparkles className="h-3 w-3" />
              Gemini 2.5 Flash • Live
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Merchant Approval Governed
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Autonomous cart drop-off detection, live Gemini behavioral diagnosis, and approval-controlled PayPal recovery checkout.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={isScanning}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition disabled:opacity-60 active:scale-95 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning Telemetry...' : 'Run Telemetry Scan'}</span>
        </button>
      </div>

      {/* Notifications */}
      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200 text-xs">Dismiss</button>
        </div>
      )}

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Recoverable Revenue</span>
            <div className="text-xl font-bold font-mono text-white tracking-tight mt-0.5 tabular-nums">
              {metrics?.formatted_potential_revenue || '$0.00'}
            </div>
            <span className="text-[11px] text-amber-400 font-medium">In active pipeline</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Captured Recoveries</span>
            <div className="text-xl font-bold font-mono text-white tracking-tight mt-0.5 tabular-nums">
              {metrics?.formatted_recovered_revenue || '$0.00'}
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">{metrics?.recovered_count || 0} orders recovered</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Pending Review</span>
            <div className="text-xl font-bold font-mono text-white tracking-tight mt-0.5 tabular-nums">
              {metrics?.pending_review || 0}
            </div>
            <span className="text-[11px] text-blue-400 font-medium">Requires merchant action</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-xl">
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Recovery Win Rate</span>
            <div className="text-xl font-bold font-mono text-white tracking-tight mt-0.5 tabular-nums">
              {metrics?.recovery_rate || 0}%
            </div>
            <span className="text-[11px] text-purple-400 font-medium">Conversion success</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-medium">
        {[
          { id: 'ALL', label: 'All Opportunities' },
          { id: 'PENDING', label: `Pending Review (${metrics?.pending_review || 0})` },
          { id: 'APPROVED', label: `Approved (${metrics?.approved_for_recovery || 0})` },
          { id: 'IN_FLIGHT', label: `In Flight (${metrics?.in_flight || 0})` },
          { id: 'RECOVERED', label: `Recovered (${metrics?.recovered_count || 0})` },
          { id: 'REJECTED', label: 'Dismissed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Split Pane: Queue (Left) & Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Queue */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Identified Opportunities ({opportunities.length})</span>
            <span className="font-mono text-[11px]">Ranked by Probability</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
              <span>Loading recovery pipeline...</span>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-medium text-slate-300">No matching recovery opportunities.</p>
              <p className="text-xs text-slate-500">Run a telemetry scan or adjust filters to review unrecovered drop-offs.</p>
              <button
                onClick={handleScan}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Scan Telemetry</span>
              </button>
            </div>
          ) : (
            opportunities.map((opp) => {
              const isSelected = selectedOpportunity?.id === opp.id;
              return (
                <div
                  key={opp.id}
                  onClick={() => setSelectedOpportunity(opp)}
                  className={`p-4 rounded-2xl border cursor-pointer transition relative ${
                    isSelected
                      ? 'bg-slate-900 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-3">
                      <RadialScoreGauge score={opp.recovery_score} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">
                            #{opp.order?.order_number || `Order-${opp.order_id}`}
                          </span>
                          {getStatusBadge(opp.status)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 font-mono">
                          {opp.order?.items?.length || 1} item(s) • <span className="text-white font-semibold">${opp.order?.total}</span> {opp.order?.currency || 'USD'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {opp.priority} Priority
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Drop-off Telemetry</span>
                    {opp.failure_reason_summary || 'Checkout session interrupted.'}
                  </p>

                  <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {opp.eligibility_signals?.hours_since_dropoff || 1}h ago
                    </span>
                    <span className="text-blue-400 flex items-center gap-1 font-medium group">
                      Inspect strategy <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Pane: Inspector & Action Center */}
        <div className="lg:col-span-7">
          {selectedOpportunity ? (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                  <RadialScoreGauge score={selectedOpportunity.recovery_score} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white font-mono">
                        #{selectedOpportunity.order?.order_number}
                      </h2>
                      {getStatusBadge(selectedOpportunity.status)}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Cart Total: <span className="font-bold text-white font-mono">${selectedOpportunity.order?.total} {selectedOpportunity.order?.currency}</span> •
                      Detected {selectedOpportunity.eligibility_signals?.hours_since_dropoff || 1} hours ago
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    onClick={handleReanalyze}
                    disabled={isReanalyzing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 border border-purple-800 text-purple-200 text-xs font-semibold transition disabled:opacity-50"
                    title="Run live Gemini diagnostic for this opportunity"
                  >
                    <Sparkles className={`h-3.5 w-3.5 text-purple-400 ${isReanalyzing ? 'animate-spin' : ''}`} />
                    <span>{isReanalyzing ? 'Analyzing...' : 'Re-Analyze with Live Gemini'}</span>
                  </button>
                </div>
              </div>

              {/* 4-Step Horizontal Lifecycle Stepper */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { step: 1, title: '1. Detected', sub: 'Cart Abandoned' },
                    { step: 2, title: '2. Analyzed', sub: 'Gemini 2.5 Flash' },
                    { step: 3, title: '3. Approved', sub: 'Zero-Trust Gate' },
                    { step: 4, title: '4. Settled', sub: 'PayPal Captured' },
                  ].map((s) => {
                    const st = getStepStatus(s.step, selectedOpportunity.status);
                    const isDone = st === 'completed';
                    const isActive = st === 'active';
                    const isRejected = st === 'rejected';

                    return (
                      <div
                        key={s.step}
                        className={`p-2.5 rounded-lg border transition ${
                          isDone
                            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                            : isActive
                            ? 'bg-blue-950/50 border-blue-500 text-blue-200 ring-1 ring-blue-500/40'
                            : isRejected
                            ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                            : 'bg-slate-900/40 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold block">{s.title}</span>
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : isActive ? (
                            <Zap className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                          ) : isRejected ? (
                            <XCircle className="h-3.5 w-3.5 text-rose-400" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-slate-600" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{s.sub}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cart Telemetry Signal Chips */}
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Cart Telemetry & Signal Vectors
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                    <span className="text-slate-500 block text-[10px]">Cart Value Tier</span>
                    <span className="font-semibold text-slate-200 capitalize">
                      {selectedOpportunity.eligibility_signals?.cart_value_tier || 'Standard'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                    <span className="text-slate-500 block text-[10px]">Payment Attempts</span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {selectedOpportunity.eligibility_signals?.attempt_count || 1} Recorded
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                    <span className="text-slate-500 block text-[10px]">Basket Depth</span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {selectedOpportunity.order?.items?.length || 1} Line Items
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                    <span className="text-slate-500 block text-[10px]">Recovery Urgency</span>
                    <span className="font-semibold text-emerald-400 capitalize">
                      {selectedOpportunity.priority} Priority
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Diagnostic Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-indigo-950/30 border border-purple-800/60 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                    <Bot className="h-4 w-4" />
                    <span>Gemini 2.5 Flash Autonomous Behavioral Diagnostic</span>
                  </div>
                  <span className="text-[11px] font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800">
                    Confidence: {selectedOpportunity.ai_confidence || 85}%
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-400 font-medium">Root Cause:</span>{' '}
                    <span className="text-white font-medium">{selectedOpportunity.ai_summary}</span>
                  </div>
                  {selectedOpportunity.ai_reasoning && (
                    <div className="text-slate-300">
                      <span className="font-medium text-slate-400">Behavioral Reasoning:</span>{' '}
                      {selectedOpportunity.ai_reasoning}
                    </div>
                  )}
                  <div className="p-2.5 rounded-xl bg-purple-950/50 border border-purple-800/50 text-purple-200 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-purple-400 mt-0.5" />
                    <div>
                      <span className="font-semibold text-purple-300">Recommended Recovery Strategy:</span>{' '}
                      {selectedOpportunity.ai_recommended_action}
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Outreach Draft Composer */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Customer Payment Reminder Draft
                    </span>
                    <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[11px]">
                      <button
                        onClick={() => setComposerMode('email')}
                        className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium ${
                          composerMode === 'email' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Mail className="h-3 w-3" />
                        <span>Email</span>
                      </button>
                      <button
                        onClick={() => setComposerMode('sms')}
                        className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium ${
                          composerMode === 'sms' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>SMS</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyMessage}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Draft'}</span>
                  </button>
                </div>

                {/* Composer Simulated Header */}
                <div className="p-3 rounded-t-xl bg-slate-950 border border-b-0 border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-slate-500 w-16">Recipient:</span>
                    <span className="text-slate-300 font-mono">customer@paypilot.demo</span>
                  </div>
                  {composerMode === 'email' && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="text-slate-500 w-16">Subject:</span>
                      <span className="text-white font-medium truncate">
                        Complete your checkout for order #{selectedOpportunity.order?.order_number}
                      </span>
                    </div>
                  )}
                </div>

                <textarea
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  disabled={selectedOpportunity.status === 'RECOVERED'}
                  rows={4}
                  className="w-full p-3.5 rounded-b-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none transition font-sans resize-none disabled:opacity-60"
                  placeholder="Recovery copy for customer..."
                />

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    The <code className="text-blue-400 font-mono">[RECOVERY_LINK]</code> placeholder is dynamically bound to the verified PayPal Sandbox checkout URL.
                  </span>
                  <span className="font-mono tabular-nums">{editedMessage.length} characters</span>
                </div>
              </div>

              {/* Action Controls */}
              <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {selectedOpportunity.status === 'PENDING' && (
                    <>
                      <button
                        onClick={handleApprove}
                        disabled={isProcessingAction}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition disabled:opacity-50 active:scale-95"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Approve Strategy</span>
                      </button>

                      <button
                        onClick={handleReject}
                        disabled={isProcessingAction}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4 text-slate-400" />
                        <span>Dismiss</span>
                      </button>
                    </>
                  )}

                  {(selectedOpportunity.status === 'APPROVED' || selectedOpportunity.status === 'IN_FLIGHT') && (
                    <button
                      onClick={handleLaunchCheckout}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition active:scale-95"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Launch 1-Click PayPal Recovery Checkout</span>
                    </button>
                  )}

                  {selectedOpportunity.status === 'RECOVERED' && (
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-xl">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Payment Settled & Verified via PayPal Capture</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-mono">
                  Opportunity ID: <span className="text-slate-400">#{selectedOpportunity.id}</span>
                </div>
              </div>

              {/* Audit Trail Timeline */}
              {selectedOpportunity.audit_trail && selectedOpportunity.audit_trail.length > 0 && (
                <div className="border-t border-slate-800 pt-4">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Immutable Audit Trail
                  </span>
                  <div className="space-y-2 text-xs">
                    {selectedOpportunity.audit_trail.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-slate-400">
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-300 font-mono text-[11px]">{log.action}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            <span className="text-slate-500 font-medium">Actor: {log.actor}</span> — {log.details || log.reason || 'Event executed.'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-16 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 shadow-xl">
              <Bot className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-300">Select a Recovery Opportunity</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Choose any cart drop-off from the pipeline queue to inspect AI root-cause diagnostics, edit the customer reminder copy, or execute PayPal recovery checkout.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* PayPal Checkout Modal for Recovery Flow */}
      {isCheckoutModalOpen && selectedOpportunity?.order && (
        <PayPalCheckoutModal
          order={selectedOpportunity.order}
          isOpen={isCheckoutModalOpen}
          onClose={() => setIsCheckoutModalOpen(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default RevenueRecovery;