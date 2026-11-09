import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  CreditCard,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  Copy,
  Check,
  X,
  FileCode,
  ShieldCheck,
} from 'lucide-react';

interface OrderItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: string | number;
  line_total: string | number;
}

interface OrderRecord {
  id: number;
  order_number: string;
  subtotal: string | number;
  total: string | number;
  currency: string;
  status: string;
  created_at: string;
  items?: OrderItem[];
}

interface PaymentTransaction {
  id: number;
  order_id: number;
  provider: string;
  paypal_order_id: string;
  paypal_capture_id?: string | null;
  amount: string | number;
  currency: string;
  attempt_number?: number;
  idempotency_key?: string | null;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  failure_reason?: string | null;
  is_recovery_attempt?: boolean;
  is_demo_seed?: boolean;
  payload?: any;
  captured_at?: string | null;
  created_at: string;
  order?: OrderRecord | null;
}

type TransactionFilter = 'ALL' | 'COMPLETED' | 'PENDING' | 'FAILED';

export const TransactionLedger: React.FC = () => {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<TransactionFilter>('ALL');

  // Inspector State
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments');
      setTransactions(res.data.data || []);
    } catch (err) {
      console.error('Failed to load transaction ledger', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (statusFilter !== 'ALL' && tx.status !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchOrderId = tx.order?.order_number?.toLowerCase().includes(q);
      const matchPaypalOrder = tx.paypal_order_id?.toLowerCase().includes(q);
      const matchCapture = tx.paypal_capture_id?.toLowerCase().includes(q);
      const matchIdem = tx.idempotency_key?.toLowerCase().includes(q);
      const matchAmount = String(tx.amount).includes(q);
      return matchOrderId || matchPaypalOrder || matchCapture || matchIdem || matchAmount;
    });
  }, [transactions, statusFilter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    let completedVolume = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    transactions.forEach((tx) => {
      if (tx.status === 'COMPLETED') {
        completedVolume += parseFloat(String(tx.amount)) || 0;
        completedCount++;
      } else if (tx.status === 'PENDING') {
        pendingCount++;
      } else if (tx.status === 'FAILED') {
        failedCount++;
      }
    });

    return {
      totalVolume: completedVolume,
      completedCount,
      pendingCount,
      failedCount,
      totalCount: transactions.length,
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Transactions Ledger</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800">
              PayPal REST API v2
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-mono">
              <ShieldCheck className="h-3 w-3" />
              Cryptographic Verification
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Immutable settlement ledger capturing every PayPal v2 authorization, capture token, idempotency key, and failure audit log.
          </p>
        </div>

        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="self-start sm:self-center flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
          <span>Sync Ledger</span>
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Settled Transaction Volume</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight mt-0.5 tabular-nums">
              ${stats.totalVolume.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{stats.completedCount} Settled Captures</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Capture Success Ratio</span>
            <div className="text-2xl font-bold font-mono text-white tracking-tight mt-0.5 tabular-nums">
              {stats.totalCount > 0 ? Math.round((stats.completedCount / stats.totalCount) * 100) : 0}%
            </div>
            <span className="text-[11px] text-blue-400 font-medium">Authorization conversion</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Pending / In-Flight</span>
            <div className="text-2xl font-bold font-mono text-amber-400 tracking-tight mt-0.5 tabular-nums">
              {stats.pendingCount}
            </div>
            <span className="text-[11px] text-amber-400 font-medium">Awaiting final capture</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Declined / Dropped</span>
            <div className="text-2xl font-bold font-mono text-rose-400 tracking-tight mt-0.5 tabular-nums">
              {stats.failedCount}
            </div>
            <span className="text-[11px] text-rose-400 font-medium">Recovery eligible</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by order #, PayPal token, capture ID, idempotency..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs self-start sm:self-auto">
          {(['ALL', 'COMPLETED', 'PENDING', 'FAILED'] as TransactionFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                statusFilter === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'ALL'
                ? `All (${stats.totalCount})`
                : tab === 'COMPLETED'
                ? `Settled (${stats.completedCount})`
                : tab === 'PENDING'
                ? `Pending (${stats.pendingCount})`
                : `Failed (${stats.failedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
          <span>Loading transaction ledger...</span>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="p-16 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 space-y-2">
          <CreditCard className="h-10 w-10 text-slate-600 mx-auto" />
          <p className="text-base font-semibold text-slate-300">No transactions match current filters</p>
          <p className="text-xs text-slate-500">
            {searchQuery ? 'Try clearing your search query or switching tabs.' : 'No transactions recorded yet.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider bg-slate-800/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Timestamp & Attempt</th>
                  <th className="py-3 px-4">Local Order #</th>
                  <th className="py-3 px-4">PayPal Order Token</th>
                  <th className="py-3 px-4">PayPal Capture ID</th>
                  <th className="py-3 px-4 text-right">Settled Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="hover:bg-slate-800/40 transition cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <span className="text-white block font-medium">
                        {new Date(tx.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(tx.created_at).toLocaleTimeString()} • Attempt #{tx.attempt_number || 1}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="text-blue-400 font-semibold group-hover:underline">
                          {tx.order?.order_number || `#${tx.order_id}`}
                        </span>
                        {tx.is_demo_seed ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Demo
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Live
                          </span>
                        )}
                        {tx.is_recovery_attempt && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-950 text-purple-300 border border-purple-800">
                            Recovery
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div className="flex items-center gap-1 text-slate-300">
                        <span className="truncate max-w-[140px]">{tx.paypal_order_id}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(tx.paypal_order_id, `order_${tx.id}`);
                          }}
                          className="text-slate-500 hover:text-white p-0.5"
                          title="Copy PayPal Order Token"
                        >
                          {copiedKey === `order_${tx.id}` ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs">
                      {tx.paypal_capture_id ? (
                        <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <span className="truncate max-w-[140px]">{tx.paypal_capture_id}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(tx.paypal_capture_id!, `cap_${tx.id}`);
                            }}
                            className="text-emerald-500 hover:text-white p-0.5"
                            title="Copy Capture ID"
                          >
                            {copiedKey === `cap_${tx.id}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Uncaptured</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-base tabular-nums">
                      <span className={tx.status === 'COMPLETED' ? 'text-emerald-400' : tx.status === 'FAILED' ? 'text-rose-400' : 'text-slate-300'}>
                        ${parseFloat(String(tx.amount)).toFixed(2)}
                      </span>{' '}
                      <span className="text-xs font-normal text-slate-400 font-sans">{tx.currency}</span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {tx.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>COMPLETED</span>
                        </span>
                      ) : tx.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                          <Clock className="h-3 w-3" />
                          <span>PENDING</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                          <AlertTriangle className="h-3 w-3" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTx(tx);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over Transaction & Payload Inspector Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedTx(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-blue-400" />
                    <span className="font-mono text-base font-bold text-white">
                      Transaction #{selectedTx.id}
                    </span>
                    {selectedTx.is_demo_seed ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        Demo Seed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        Live Sandbox
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedTx(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block">Associated Order</span>
                    <span className="text-sm font-mono font-bold text-blue-400">
                      {selectedTx.order?.order_number || `#${selectedTx.order_id}`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Capture Volume</span>
                    <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
                      ${parseFloat(String(selectedTx.amount)).toFixed(2)} {selectedTx.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-6 flex-1">
                {/* Status & Failure Banner */}
                {selectedTx.status === 'COMPLETED' ? (
                  <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>Payment verified cryptographically via PayPal v2 Capture API.</span>
                  </div>
                ) : selectedTx.status === 'FAILED' ? (
                  <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-rose-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Payment Attempt Failed:</span>
                    </div>
                    <p className="text-slate-300 font-mono text-[11px] pl-6">
                      {selectedTx.failure_reason || 'Checkout dropped before authorization completion.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-300 text-xs flex items-center gap-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>Transaction created. Awaiting customer payment confirmation in PayPal modal.</span>
                  </div>
                )}

                {/* Cryptographic Key Tokens */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    PayPal API Tokens & Idempotency
                  </h3>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-slate-500 block text-[10px] font-sans">PayPal Order Token</span>
                        <span className="text-white select-all">{selectedTx.paypal_order_id}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(selectedTx.paypal_order_id, 'drawer_order')}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Copy"
                      >
                        {copiedKey === 'drawer_order' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {selectedTx.paypal_capture_id && (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 block text-[10px] font-sans">PayPal Capture ID</span>
                          <span className="text-emerald-400 font-bold select-all">{selectedTx.paypal_capture_id}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(selectedTx.paypal_capture_id!, 'drawer_capture')}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Copy"
                        >
                          {copiedKey === 'drawer_capture' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}

                    {selectedTx.idempotency_key && (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 block text-[10px] font-sans">Idempotency Key</span>
                          <span className="text-slate-400 text-[11px] select-all truncate block max-w-xs">{selectedTx.idempotency_key}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(selectedTx.idempotency_key!, 'drawer_idem')}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Copy"
                        >
                          {copiedKey === 'drawer_idem' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items for this Order */}
                {selectedTx.order?.items && selectedTx.order.items.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Purchased Items
                    </h3>
                    <div className="rounded-xl border border-slate-800 overflow-hidden text-xs">
                      <table className="w-full text-left text-slate-300">
                        <thead className="bg-slate-800/60 text-[10px] uppercase text-slate-400">
                          <tr>
                            <th className="py-2 px-3">Item</th>
                            <th className="py-2 px-3 text-center">Qty</th>
                            <th className="py-2 px-3 text-right">Price</th>
                            <th className="py-2 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {selectedTx.order.items.map((it, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-3 font-sans font-medium text-white">{it.product_name}</td>
                              <td className="py-2 px-3 text-center">{it.quantity}</td>
                              <td className="py-2 px-3 text-right tabular-nums">${parseFloat(String(it.unit_price)).toFixed(2)}</td>
                              <td className="py-2 px-3 text-right tabular-nums font-semibold text-white">
                                ${parseFloat(String(it.line_total)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Raw PayPal Payload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FileCode className="h-3.5 w-3.5 text-blue-400" />
                      <span>Raw PayPal v2 API Response Payload</span>
                    </h3>
                    {selectedTx.payload && (
                      <button
                        onClick={() => handleCopy(JSON.stringify(selectedTx.payload, null, 2), 'drawer_payload')}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                      >
                        {copiedKey === 'drawer_payload' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>Copy JSON</span>
                      </button>
                    )}
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed">
                    {selectedTx.payload
                      ? JSON.stringify(selectedTx.payload, null, 2)
                      : '// No raw payload cached for this simulated record'}
                  </pre>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">
                  Recorded: {new Date(selectedTx.created_at).toLocaleString()}
                </span>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionLedger;