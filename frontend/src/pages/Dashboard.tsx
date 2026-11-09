import React, { useEffect, useState } from 'react';
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

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateCopilot, onNavigateRecovery }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [recoveryMetrics, setRecoveryMetrics] = useState<RecoveryMetrics | null>(null);
  const [latestRec, setLatestRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal checkout state for inline paying
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    fetchDashboardData();
  };

  const chartData = analytics?.daily_volume?.map((d) => ({
    day: d.day,
    revenue: d.daily_total,
    orders: d.orders_count,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Merchant Overview</h1>
          <p className="text-sm text-slate-400">
            Deterministic financial analytics, verified PayPal telemetry & AI intelligence
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Analytics</span>
        </button>
      </div>

      {/* AI Quick Insight Banner */}
      {latestRec && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border border-blue-800/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                  AI Financial Insight
                </span>
                <span className="text-xs px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {latestRec.supporting_metric}
                </span>
              </div>
              <h3 className="text-base font-semibold text-white mt-0.5">{latestRec.title}</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {latestRec.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {onNavigateCopilot && (
              <button
                onClick={onNavigateCopilot}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition"
              >
                <span>Consult Copilot</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI Revenue Recovery Pipeline Banner */}
      {recoveryMetrics && (recoveryMetrics.total_opportunities > 0 || recoveryMetrics.recovered_count > 0) && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/50 border border-purple-800/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-purple-400">
                  AI Revenue Recovery Pipeline
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-semibold">
                  {recoveryMetrics.pending_review} Actionable Drop-offs
                </span>
              </div>
              <h3 className="text-base font-semibold text-white mt-0.5">
                {recoveryMetrics.formatted_potential_revenue} Recoverable Revenue Identified
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Autonomous recovery agent detected uncaptured drop-offs. Merchants review AI diagnosis and launch approval-controlled 1-click PayPal recovery.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {onNavigateRecovery && (
              <button
                onClick={onNavigateRecovery}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition"
              >
                <span>Open Recovery Agent</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Deterministic StatCards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Verified Revenue"
          value={loading ? '...' : analytics?.formatted_revenue || '$0.00'}
          change={`${analytics?.paid_orders || 0} Settled`}
          isPositive={true}
          icon={DollarSign}
          subtitle="Captured via PayPal v2 API"
        />
        <StatCard
          title="Average Order Value"
          value={loading ? '...' : analytics?.formatted_aov || '$0.00'}
          change="AOV Metric"
          isPositive={true}
          icon={TrendingUp}
          subtitle="Revenue per paid transaction"
        />
        <StatCard
          title="Checkout Success Rate"
          value={loading ? '...' : `${analytics?.conversion_rate || 0}%`}
          change={`${analytics?.paid_orders || 0}/${analytics?.total_orders || 0} Orders`}
          isPositive={(analytics?.conversion_rate || 0) >= 60}
          icon={Percent}
          subtitle="Settlement conversion ratio"
        />
        <StatCard
          title="Pending Checkout"
          value={loading ? '...' : analytics?.pending_orders || 0}
          change="Awaiting Pay"
          isPositive={false}
          icon={Clock}
          subtitle="Ready for PayPal capture"
        />
      </div>

      {/* Charts & Top Products Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Progression Chart (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">7-Day Revenue Velocity</h2>
              <p className="text-xs text-slate-400">Deterministic transaction volume breakdown</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium">
              Verified Settlement
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
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
                  }}
                  formatter={(val: any) => [`$${Number(val ?? 0).toFixed(2)}`, 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revGrad2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top-Selling Products by Revenue */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Top Revenue Drivers</h2>
              <p className="text-xs text-slate-400">Leading catalog products</p>
            </div>
            <Package className="h-4 w-4 text-blue-400" />
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 py-6 text-center">Loading product revenue...</p>
          ) : !analytics?.top_selling_products?.length ? (
            <p className="text-xs text-slate-500 py-6 text-center">No settled products yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.top_selling_products.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-white">{p.product_name}</h4>
                    <span className="text-[11px] text-slate-400">{p.total_units_sold} units sold</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    ${p.total_revenue_generated.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent Merchant Orders</h2>
            <p className="text-xs text-slate-400">Live order state & verification records</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {orders.length} order(s) recorded
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-4">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            <p>No orders recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/60 text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-medium text-white">
                      <div className="flex items-center gap-2">
                        <span>{ord.order_number}</span>
                        {(ord as any).is_demo_seed ? (
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
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {new Date(ord.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300 max-w-xs truncate">
                      {ord.items?.map((it) => `${it.product_name} (x${it.quantity})`).join(', ') ||
                        '1 Item'}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-blue-400">
                      ${parseFloat(String(ord.total)).toFixed(2)} {ord.currency}
                    </td>
                    <td className="py-3 px-4">
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                          {ord.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {ord.status === 'PENDING' && (
                        <button
                          onClick={() => handlePayOrder(ord)}
                          className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium inline-flex items-center gap-1.5 transition shadow-sm shadow-blue-500/20"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>Pay with PayPal</span>
                        </button>
                      )}
                      {ord.status === 'PAID' && (
                        <span className="text-xs text-slate-500">Verified</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PayPal Modal */}
      <PayPalCheckoutModal
        order={selectedOrder}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default Dashboard;
