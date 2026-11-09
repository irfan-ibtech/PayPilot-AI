import React, { useEffect, useState } from 'react';
import StatCard from '../components/StatCard';
import { DollarSign, ShoppingBag, Zap, TrendingUp, Package } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

interface Product {
  id: number;
  name: string;
  description: string;
  unit_price: string;
  currency: string;
}

export const Dashboard: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get('/products');
        setProducts(response.data.data || []);
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const chartData = [
    { day: 'Mon', revenue: 420 },
    { day: 'Tue', revenue: 680 },
    { day: 'Wed', revenue: 950 },
    { day: 'Thu', revenue: 810 },
    { day: 'Fri', revenue: 1240 },
    { day: 'Sat', revenue: 1680 },
    { day: 'Sun', revenue: 1450 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Merchant Overview</h1>
        <p className="text-sm text-slate-400">Autonomous PayPal telemetry and store performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total PayPal Volume"
          value="$7,230.00"
          change="+18.4%"
          isPositive={true}
          icon={DollarSign}
          subtitle="Processed via PayPal v2 API"
        />
        <StatCard
          title="Total Orders"
          value="48"
          change="+12.5%"
          isPositive={true}
          icon={ShoppingBag}
          subtitle="Orders created & fulfilled"
        />
        <StatCard
          title="Active Products"
          value={loading ? '...' : products.length}
          change="+5 items"
          isPositive={true}
          icon={Package}
          subtitle="Available in merchant catalog"
        />
        <StatCard
          title="AI Automation Score"
          value="98.2%"
          change="+4.1%"
          isPositive={true}
          icon={Zap}
          subtitle="Copilot assist efficiency"
        />
      </div>

      {/* Chart Section */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Weekly Revenue Trajectory</h2>
            <p className="text-xs text-slate-400">Real-time payment analytics overview</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Optimal Growth</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#fff',
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Seeded Products Section */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-lg font-semibold text-white mb-3">Merchant Catalog Products</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Loading catalog...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-slate-400">No products configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/60 text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4">Currency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {products.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-medium text-white">{item.name}</td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{item.description}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-blue-400">
                      ${parseFloat(item.unit_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">{item.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
