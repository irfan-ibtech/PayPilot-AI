import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ShoppingCart, Plus, CheckCircle, CreditCard, Sparkles, AlertCircle, ArrowLeft } from 'lucide-react';
import PayPalCheckoutModal from '../components/PayPalCheckoutModal';
import type { Order, PaymentRecord } from '../types/order';

interface Product {
  id: number;
  name: string;
  unit_price: string;
  currency: string;
}

interface CartItem {
  product_id?: number;
  name: string;
  quantity: number;
  unit_price: number;
}

interface OrderAssistantProps {
  onNavigateDashboard?: () => void;
}

export const OrderAssistant: React.FC<OrderAssistantProps> = ({ onNavigateDashboard }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customName, setCustomName] = useState('Custom Tech Gadget');
  const [customPrice, setCustomPrice] = useState('49.99');
  const [customQty, setCustomQty] = useState(1);
  const [notes, setNotes] = useState('Created via PayPilot Order Assistant');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal & Completed State
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const response = await api.get('/products');
        const items = response.data.data || [];
        setProducts(items);

        // Preload cart with 1 sample item if empty
        if (items.length > 0) {
          setCart([
            {
              product_id: items[0].id,
              name: items[0].name,
              quantity: 1,
              unit_price: parseFloat(items[0].unit_price),
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const addCatalogProduct = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          unit_price: parseFloat(product.unit_price),
        },
      ];
    });
  };

  const addCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || isNaN(parseFloat(customPrice)) || parseFloat(customPrice) <= 0) {
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        name: customName.trim(),
        quantity: customQty,
        unit_price: parseFloat(customPrice),
      },
    ]);
    setCustomName('');
    setCustomPrice('29.00');
    setCustomQty(1);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const handleCreateOrderAndCheckout = async () => {
    if (cart.length === 0) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await api.post('/orders', {
        items: cart,
        currency: 'USD',
        notes: notes.trim(),
      });

      const orderData: Order = response.data.data;
      setActiveOrder(orderData);
      setIsModalOpen(true);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setError(res?.data?.message || 'Failed to create order on server.');
      } else {
        setError('Network error while creating order.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = (payment: PaymentRecord) => {
    setCompletedPayment(payment);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Order Creation Assistant</h1>
          <p className="text-sm text-slate-400">
            Build multi-item merchant orders and verify PayPal v2 capture in real-time
          </p>
        </div>
        {onNavigateDashboard && (
          <button
            onClick={onNavigateDashboard}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>View All Orders</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Completed Banner if paid */}
      {completedPayment && (
        <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
            <CheckCircle className="h-6 w-6" />
            <span>Order #{activeOrder?.order_number} Paid & Verified!</span>
          </div>
          <p className="text-xs text-slate-300">
            PayPal Payment record was verified server-side with zero amount tampering.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono pt-2">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block">PayPal Order ID</span>
              <span className="text-blue-400 font-semibold">{completedPayment.paypal_order_id}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block">Capture ID</span>
              <span className="text-emerald-400 font-semibold">
                {completedPayment.paypal_capture_id || 'COMPLETED'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block">Status</span>
              <span className="text-emerald-300 font-semibold">{completedPayment.status}</span>
            </div>
          </div>
          <div className="pt-2 flex gap-3">
            <button
              onClick={() => {
                setCompletedPayment(null);
                setCart([]);
                setActiveOrder(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition"
            >
              Create Another Order
            </button>
            {onNavigateDashboard && (
              <button
                onClick={onNavigateDashboard}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Catalog & Manual Item Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Catalog Selector */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-3">Merchant Catalog Items</h2>
            {loading ? (
              <p className="text-sm text-slate-400">Loading catalog...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-slate-400">No products configured.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between hover:border-slate-600 transition"
                  >
                    <div>
                      <h4 className="font-medium text-white text-sm">{prod.name}</h4>
                      <p className="text-xs font-mono font-semibold text-blue-400 mt-0.5">
                        ${parseFloat(prod.unit_price).toFixed(2)} {prod.currency}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addCatalogProduct(prod)}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-medium flex items-center gap-1 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Test Item Form */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Add Custom Test Order Item</h2>
            </div>
            <form onSubmit={addCustomItem} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase text-slate-400 font-semibold mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Test Widget"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-slate-400 font-semibold mb-1">
                  Unit Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700 transition h-[38px]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Custom</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Col: Order Cart & Checkout Trigger */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-lg border-b border-slate-800 pb-3">
              <ShoppingCart className="h-5 w-5 text-blue-400" />
              <span>Current Order Tray</span>
            </div>

            {cart.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Your order tray is empty.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm py-2 border-b border-slate-800"
                  >
                    <div>
                      <p className="text-white font-medium">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        {item.quantity} × ${item.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white font-semibold">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="text-xs text-rose-400 hover:text-rose-300 ml-1 p-1"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}

                <div className="pt-2 flex justify-between items-center text-base font-bold text-white">
                  <span>Order Total:</span>
                  <span className="font-mono text-xl text-blue-400">${subtotal.toFixed(2)} USD</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Order Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional order notes..."
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              disabled={cart.length === 0 || isSubmitting}
              onClick={handleCreateOrderAndCheckout}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition disabled:opacity-40"
            >
              <CreditCard className="h-4 w-4" />
              <span>{isSubmitting ? 'Creating Order...' : 'Create & Checkout with PayPal'}</span>
            </button>

            <div className="p-3 bg-blue-950/40 border border-blue-900 rounded-lg flex items-start gap-2 text-xs text-blue-300">
              <CheckCircle className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
              <span>
                Calculates totals strictly on server, issues PayPal v2 order, and captures with anti-tamper validation.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PayPal Checkout Modal */}
      <PayPalCheckoutModal
        order={activeOrder}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default OrderAssistant;
