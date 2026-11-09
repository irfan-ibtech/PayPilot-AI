import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ShoppingCart, Plus, CheckCircle, CreditCard } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  unit_price: string;
  currency: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const OrderAssistant: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const response = await api.get('/products');
        setProducts(response.data.data || []);
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + parseFloat(item.product.unit_price) * item.quantity,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Order Creation Assistant</h1>
        <p className="text-sm text-slate-400">
          Build multi-item merchant orders ready for PayPal Checkout
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Products */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-4">Available Catalog Items</h2>

            {loading ? (
              <p className="text-sm text-slate-400">Loading catalog...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-slate-400">No products available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-medium text-white">{prod.name}</h3>
                      <p className="text-sm font-mono text-blue-400 font-semibold mt-1">
                        ${parseFloat(prod.unit_price).toFixed(2)} {prod.currency}
                      </p>
                    </div>
                    <button
                      onClick={() => addToCart(prod)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Order Summary & Cart */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-lg border-b border-slate-800 pb-3">
              <ShoppingCart className="h-5 w-5 text-blue-400" />
              <span>Order Summary</span>
            </div>

            {cart.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Your order tray is empty.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between text-sm py-2 border-b border-slate-800"
                  >
                    <div>
                      <p className="text-white font-medium">{item.product.name}</p>
                      <p className="text-xs text-slate-400">
                        {item.quantity} × ${parseFloat(item.product.unit_price).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white font-semibold">
                        ${(parseFloat(item.product.unit_price) * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 ml-1"
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
                Order Notes / Customer Info
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Customer email or shipping notes..."
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              disabled={cart.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition disabled:opacity-40"
            >
              <CreditCard className="h-4 w-4" />
              <span>Checkout with PayPal (M2 Ready)</span>
            </button>

            <div className="p-3 bg-blue-950/40 border border-blue-900 rounded-lg flex items-start gap-2 text-xs text-blue-300">
              <CheckCircle className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
              <span>
                Orders created here will connect to PayPal Orders API v2 in Milestone 2.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderAssistant;
