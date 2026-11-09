import React, { useEffect, useState, useMemo } from 'react';
import StatCard from '../components/StatCard';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Percent,
  ArrowRight,
  Package,
  RotateCcw,
  Search,
  X,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import PayPalCheckoutModal from '../components/PayPalCheckoutModal';
import type { Order } from '../types/order';
import type { RecoveryMetrics } from '../types/recovery';

interface TopProduct {
  product_name: string;
  total_units_sold: number;
  total_revenue_generated: number;
}

interface DailyVolume {
  date: string;
  day: string;
  orders_count: number;
  daily_total: number;
}

interface AnalyticsOverview {
  total_revenue: number;
  formatted_revenue: string;
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  failed_orders: number;
  conversion_rate: number;
  average_order_value: number;
  formatted_aov: string;
  top_selling_products: TopProduct[];
  daily_volume: DailyVolume[];
}

interface Recommendation {
  id: number;
  title: string;
  description: string;
  supporting_metric: string;
  suggested_action: string;
  priority: 'high' | 'medium' | 'low';
}

interface DashboardProps {
  onNavigateCopilot?: () => void;
  onNavigateRecovery?: () => void;
}

type OrderFilter = 'ALL' | 'PAID' | 'PENDING' | 'FAILED';

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateCopilot, onNavigateRecovery }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [recoveryMetrics, setRecoveryMetrics] = useState<RecoveryMetrics | null>(null);
  const [latestRec, setLatestRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderFilter>('ALL');

  // Modal checkout state for inline paying
  const [selectedOrderForPay, setSelectedOrderForPay] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Slide-over Order Inspector Drawer
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, ordersRes, recoveryRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/orders'),
        api.get('/recovery/metrics').catch(() => ({ data: { data: null } })),
      ]);

      setAnalytics(analyticsRes.data.metrics);
      setLatestRec(analyticsRes.data.latest_recommendation);
      setOrders(ordersRes.data.data || []);
      setRecoveryMetrics(recoveryRes.data.data || null);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handlePayOrder = (order: Order) => {
    setSelectedOrderForPay(order);
    setIsModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    fetchDashboardData();
    if (inspectingOrder) {
      // Refresh current inspected order if open
      api.get(`/orders/${inspectingOrder.id}`)
        .then((res) => setInspectingOrder(res.data.data))
        .catch(() => {});
    }
  };

  // Filtered orders ledger
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Status filter
      if (statusFilter !== 'ALL' && ord.status !== statusFilter) {
        return false;
      }
      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchNumber = ord.order_number?.toLowerCase().includes(q);
      const matchItems = ord.items?.some((it) => it.product_name.toLowerCase().includes(q));
      const matchTotal = String(ord.total).includes(q);
      return matchNumber || matchItems || matchTotal;
    });
  }, [orders, statusFilter, searchQuery]);

  const filterCounts = useMemo(() => {
    return {
      ALL: orders.length,
      PAID: orders.filter((o) => o.status === 'PAID').length,
      PENDING: orders.filter((o) => o.status === 'PENDING').length,
      FAILED: orders.filter((o) => o.status === 'FAILED').length,
    };
  }, [orders]);

  const chartData = useMemo(() => {
    return analytics?.daily_volume?.map((d) => ({
      day: d.day,
      date: d.date,
      revenue: d.daily_total,
      orders: d.orders_count,
    })) || [];
  }, [analytics]);

  const sevenDayTotal = useMemo(() => {
    return chartData.reduce((sum, item) => sum + (item.revenue || 0), 0);
  }, [chartData]);

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Merchant Overview</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950 text-blue-400 border border-blue-800/80">
              Deterministic Telemetry
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Verified PayPal settlement ledger, AI revenue recovery diagnostics, and real-time financial metrics
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="self-start sm:self-center flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-medium transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
          <span>Sync Telemetry</span>
        </button>
      </div>

      {/* AI Revenue Recovery Alert Bar (Executive Hero) */}
      {recoveryMetrics && (recoveryMetrics.pending_review > 0 || (recoveryMetrics.potential_recoverable_revenue ?? 0) > 0) && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-800/50 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-full bg-purple-500/5 blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                <RotateCcw className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-purple-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
                    Autonomous Revenue Recovery Pipeline
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-purple-900/60 text-purple-200 border border-purple-700/70 font-semibold tabular-nums">
                    {recoveryMetrics.pending_review} Actionable Drop-offs
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mt-1">
                  <span className="text-purple-300 font-mono font-bold tabular-nums">
                    {recoveryMetrics.formatted_potential_revenue}
                  </span>{' '}
                  in uncaptured transactions ready for merchant review
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  AI diagnostic agent identified drop-offs with high recovery probability. Merchant retains full approval control before firing targeted PayPal reminders.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              {onNavigateRecovery && (
                <button
                  onClick={onNavigateRecovery}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-purple-500/25 transition active:scale-95"
                >
                  <span>Review Recovery Agent</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Financial Recommendation Banner */}
      {latestRec && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-900 border border-blue-800/50 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase font-bold tracking-wider text-blue-400">
                  AI Executive Copilot Insight
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {latestRec.supporting_metric}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-white mt-1">{latestRec.title}</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {latestRec.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            {onNavigateCopilot && (
              <button
                onClick={onNavigateCopilot}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
              >
                <span>Ask Copilot</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Deterministic StatCards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Verified Revenue"
          value={loading ? '...' : analytics?.formatted_revenue || '$0.00'}
          change={`${analytics?.paid_orders || 0} Settled Orders`}
          isPositive={true}
          icon={DollarSign}
          subtitle="Captured via PayPal v2 API"
          progress={analytics ? Math.min(100, Math.round(((analytics.paid_orders || 0) / (analytics.total_orders || 1)) * 100)) : undefined}
        />
        <StatCard
          title="Average Order Value"
          value={loading ? '...' : analytics?.formatted_aov || '$0.00'}
          change="BCMath Scale-2 Precision"
          isPositive={true}
          icon={TrendingUp}
          subtitle="Revenue per paid transaction"
        />
        <StatCard
          title="Checkout Success Rate"
          value={loading ? '...' : `${analytics?.conversion_rate || 0}%`}
          change={`${analytics?.paid_orders || 0} of ${analytics?.total_orders || 0} Total`}
          isPositive={(analytics?.conversion_rate || 0) >= 60}
          icon={Percent}
          subtitle="Settlement conversion ratio"
          progress={analytics?.conversion_rate}
        />
        <StatCard
          title="Pending Pipeline"
          value={loading ? '...' : analytics?.pending_orders || 0}
          change={recoveryMetrics ? `${recoveryMetrics.formatted_potential_revenue} uncaptured` : 'Awaiting capture'}
          isPositive={false}
          icon={Clock}
          subtitle="Orders awaiting PayPal payment"
        />
      </div>

      {/* Charts & Top Products Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Velocity Chart (2 Columns) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">7-Day Revenue Velocity</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium">
                  Verified Settlement
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic daily volume breakdown via MySQL aggregated records
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-sans">7-Day Settled</span>
                <span className="text-emerald-400 font-semibold tabular-nums">${sevenDayTotal.toFixed(2)}</span>
              </div>
              {recoveryMetrics && (
                <div className="border-l border-slate-800 pl-4">
                  <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-sans">Uncaptured Pipeline</span>
                  <span className="text-purple-400 font-semibold tabular-nums">{recoveryMetrics.formatted_potential_revenue}</span>
                </div>
              )}
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revVelocityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  }}
                  formatter={(val: any) => [`$${Number(val ?? 0).toFixed(2)}`, 'Settled Revenue']}
                  labelFormatter={(lbl, payload) => {
                    const item = payload?.[0]?.payload;
                    return item?.date ? `${lbl} (${item.date})` : lbl;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revVelocityGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top-Selling Products by Revenue */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Top Revenue Drivers</h2>
                <p className="text-xs text-slate-400">Leading catalog products by settled volume</p>
              </div>
              <Package className="h-4 w-4 text-blue-400" />
            </div>

            <div className="mt-4">
              {loading ? (
                <p className="text-xs text-slate-500 py-8 text-center">Loading product revenue...</p>
              ) : !analytics?.top_selling_products?.length ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <p>No settled orders in catalog yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {analytics.top_selling_products.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/70 transition flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-3">
                        <h4 className="text-xs font-semibold text-white truncate">{p.product_name}</h4>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {p.total_units_sold} unit{p.total_units_sold === 1 ? '' : 's'} sold
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                        ${p.total_revenue_generated.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/70 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Verified Server Aggregation</span>
            <span className="font-mono text-slate-500">MySQL Grouped</span>
          </div>
        </div>
      </div>

      {/* Orders Ledger with Search, Filter Tabs & Inspector Drawer */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        {/* Ledger Header & Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Merchant Order Ledger</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono tabular-nums">
                {filteredOrders.length} showing
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any order to inspect line-item provenance and PayPal multi-attempt capture logs
            </p>
          </div>

          {/* Search & Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders, items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition"
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

            {/* Status Filter Tabs */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/80 text-xs">
              {(['ALL', 'PAID', 'PENDING', 'FAILED'] as OrderFilter[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    statusFilter === tab
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()} ({filterCounts[tab]})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        {loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Loading orders ledger...</p>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            <Package className="h-8 w-8 mx-auto text-slate-600 mb-2" />
            <p className="font-medium text-slate-400">No orders matching current filter.</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-blue-400 hover:underline"
              >
                Clear search query
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider bg-slate-800/40 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order # & Provenance</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Line Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredOrders.map((ord) => (
                  <tr
                    key={ord.id}
                    onClick={() => setInspectingOrder(ord)}
                    className="hover:bg-slate-800/50 cursor-pointer transition group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 group-hover:underline">{ord.order_number}</span>
                        {ord.is_demo_seed ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Demo Seed
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            Live Sandbox
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                      {new Date(ord.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-300 max-w-xs truncate">
                      {ord.items?.map((it) => `${it.product_name} (x${it.quantity})`).join(', ') ||
                        '1 Item'}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-white tabular-nums">
                      ${parseFloat(String(ord.total)).toFixed(2)} <span className="text-xs text-slate-400">{ord.currency}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      {ord.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>PAID</span>
                        </span>
                      ) : ord.status === 'PENDING' ? (
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
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setInspectingOrder(ord)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                          title="Inspect Order & Payment Attempts"
                        >
                          Inspect
                        </button>
                        {ord.status === 'PENDING' && (
                          <button
                            onClick={() => handlePayOrder(ord)}
                            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1.5 transition shadow-sm shadow-blue-500/20 active:scale-95"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Pay</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Order & Payment Attempt Inspector Drawer */}
      {inspectingOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setInspectingOrder(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-white">
                      {inspectingOrder.order_number}
                    </span>
                    {inspectingOrder.is_demo_seed ? (
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
                    onClick={() => setInspectingOrder(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {inspectingOrder.status === 'PAID' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>SETTLED / PAID</span>
                      </span>
                    ) : inspectingOrder.status === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                        <Clock className="h-3 w-3" />
                        <span>PENDING CHECKOUT</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                        <AlertTriangle className="h-3 w-3" />
                        <span>FAILED / DROPPED</span>
                      </span>
                    )}
                    <span className="text-xs text-slate-500 font-mono">
                      Order ID: #{inspectingOrder.id}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Total Amount</span>
                    <span className="text-lg font-mono font-bold text-white tabular-nums">
                      ${parseFloat(String(inspectingOrder.total)).toFixed(2)}{' '}
                      <span className="text-xs text-blue-400">{inspectingOrder.currency}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="p-6 space-y-6 flex-1">
                {/* Order Details Metadata */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Created At</span>
                    <span className="text-slate-200 font-mono font-medium">
                      {new Date(inspectingOrder.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Calculation Engine</span>
                    <span className="text-emerald-400 font-mono font-medium flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      BCMath Scale-2
                    </span>
                  </div>
                  {inspectingOrder.notes && (
                    <div className="col-span-2 pt-2 border-t border-slate-700/50">
                      <span className="text-slate-400 block text-[11px]">Merchant Notes</span>
                      <p className="text-slate-300 text-xs italic">{inspectingOrder.notes}</p>
                    </div>
                  )}
                </div>

                {/* Line Items Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-blue-400" />
                      <span>Itemized Line Items</span>
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {inspectingOrder.items?.length || 0} items
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-800/60 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Product</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {inspectingOrder.items?.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3">
                              <span className="font-medium text-white block">{it.product_name}</span>
                              <span className="text-[10px] text-emerald-400/90 font-mono">
                                Catalog Verified
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">{it.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-400 tabular-nums">
                              ${parseFloat(String(it.unit_price)).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-white tabular-nums">
                              ${parseFloat(String(it.line_total || Number(it.quantity) * Number(it.unit_price))).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Multi-Attempt Payment Ledger */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-purple-400" />
                      <span>PayPal Payment Telemetry & Attempts</span>
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {inspectingOrder.payments?.length || (inspectingOrder.payment ? 1 : 0)} attempt(s)
                    </span>
                  </div>

                  {(!inspectingOrder.payments || inspectingOrder.payments.length === 0) && !inspectingOrder.payment ? (
                    <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-center">
                      <Clock className="h-5 w-5 text-amber-400 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-300 font-medium">No payment attempts initiated yet</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Order is in pending state. Launch checkout below to generate PayPal v2 order tokens.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(inspectingOrder.payments && inspectingOrder.payments.length > 0
                        ? inspectingOrder.payments
                        : inspectingOrder.payment
                        ? [inspectingOrder.payment]
                        : []
                      ).map((pay, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white font-mono">
                                Attempt #{pay.attempt_number || pIdx + 1}
                              </span>
                              {pay.is_recovery_attempt && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800">
                                  Recovery Prompt
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                pay.status === 'COMPLETED'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : pay.status === 'FAILED'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {pay.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-750">
                            <div>
                              <span className="text-slate-500 block text-[10px] font-sans">Provider</span>
                              <span>{pay.provider.toUpperCase()}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px] font-sans">Amount</span>
                              <span className="text-emerald-400 font-semibold tabular-nums">
                                ${parseFloat(String(pay.amount)).toFixed(2)} {pay.currency}
                              </span>
                            </div>
                            {pay.paypal_order_id && (
                              <div className="col-span-2">
                                <span className="text-slate-500 block text-[10px] font-sans">PayPal Order Token</span>
                                <span className="text-slate-300 truncate block text-[10px]">
                                  {pay.paypal_order_id}
                                </span>
                              </div>
                            )}
                            {pay.paypal_capture_id && (
                              <div className="col-span-2">
                                <span className="text-slate-500 block text-[10px] font-sans">PayPal Capture ID</span>
                                <span className="text-emerald-400 truncate block text-[10px] font-bold">
                                  {pay.paypal_capture_id}
                                </span>
                              </div>
                            )}
                            {pay.idempotency_key && (
                              <div className="col-span-2">
                                <span className="text-slate-500 block text-[10px] font-sans">Idempotency Key</span>
                                <span className="text-slate-400 truncate block text-[10px]">
                                  {pay.idempotency_key}
                                </span>
                              </div>
                            )}
                            {pay.failure_reason && (
                              <div className="col-span-2 p-2 rounded bg-rose-950/40 border border-rose-900/50 text-rose-300 text-[11px]">
                                <span className="text-rose-400 font-semibold block">Failure Reason:</span>
                                <span>{pay.failure_reason}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
                <button
                  onClick={() => setInspectingOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Close
                </button>
                {inspectingOrder.status === 'PENDING' && (
                  <button
                    onClick={() => {
                      const o = inspectingOrder;
                      setInspectingOrder(null);
                      handlePayOrder(o);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition active:scale-95"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Launch PayPal Checkout</span>
                  </button>
                )}
                {inspectingOrder.status === 'PAID' && (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Server-Side Verified Capture
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline PayPal Checkout Modal */}
      <PayPalCheckoutModal
        order={selectedOrderForPay}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrderForPay(null);
        }}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default Dashboard;