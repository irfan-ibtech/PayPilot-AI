import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Sparkles,
  Bot,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  ArrowLeft,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import PayPalCheckoutModal from '../components/PayPalCheckoutModal';
import type { Order, PaymentRecord } from '../types/order';

interface DraftItem {
  product_id?: number | null;
  name: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  catalog_matched?: boolean;
}

interface AIDraftOrder {
  raw_prompt: string;
  items: DraftItem[];
  subtotal: string;
  total: string;
  currency: string;
  notes: string | null;
  ai_verified: boolean;
  ai_source?: string;
}

interface Product {
  id: number;
  name: string;
  unit_price: string;
  currency: string;
}

interface OrderAssistantProps {
  onNavigateDashboard?: () => void;
}

export const OrderAssistant: React.FC<OrderAssistantProps> = ({ onNavigateDashboard }) => {
  // AI NLP State
  const [prompt, setPrompt] = useState('2 wireless headphones at $45 each and one phone case at $12');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [draftOrder, setDraftOrder] = useState<AIDraftOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Catalog items for quick browsing
  const [products, setProducts] = useState<Product[]>([]);

  // Checkout modal & completion
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<PaymentRecord | null>(null);

  const sampleChips = [
    '2 wireless headphones at $45 each and one phone case at $12',
    '3 Ergonomic Mouse at $35.50 and 2 USB-C hubs at $22',
    '1 Mechanical Keyboard for $85 with expedited setup note',
  ];

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const response = await api.get('/products');
        setProducts(response.data.data || []);
      } catch (err) {
        console.error('Failed to load products', err);
      }
    };
    fetchCatalog();
  }, []);

  // Handle AI Parse Request
  const handleAnalyzePrompt = async (textToParse?: string) => {
    const targetPrompt = (textToParse || prompt).trim();
    if (!targetPrompt) return;

    setError(null);
    setIsAnalyzing(true);

    try {
      const response = await api.post('/ai/parse-order', {
        prompt: targetPrompt,
      });
      setDraftOrder(response.data);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setError(res?.data?.message || 'Failed to extract order details.');
      } else {
        setError('Connection error contacting AI extraction engine.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Modify draft items inline
  const handleItemChange = (index: number, field: 'name' | 'quantity' | 'unit_price', value: string | number) => {
    if (!draftOrder) return;

    const newItems = [...draftOrder.items];
    const currentItem = { ...newItems[index] };

    if (field === 'name') {
      currentItem.name = String(value);
    } else if (field === 'quantity') {
      currentItem.quantity = Math.max(1, parseInt(String(value), 10) || 1);
    } else if (field === 'unit_price') {
      currentItem.unit_price = value;
    }

    const qty = currentItem.quantity;
    const price = parseFloat(String(currentItem.unit_price)) || 0;
    currentItem.line_total = (qty * price).toFixed(2);
    newItems[index] = currentItem;

    // Recalculate subtotal
    const newSubtotal = newItems
      .reduce((sum, it) => sum + it.quantity * (parseFloat(String(it.unit_price)) || 0), 0)
      .toFixed(2);

    setDraftOrder({
      ...draftOrder,
      items: newItems,
      subtotal: newSubtotal,
      total: newSubtotal,
    });
  };

  const handleRemoveDraftItem = (index: number) => {
    if (!draftOrder) return;
    const newItems = draftOrder.items.filter((_, idx) => idx !== index);
    const newSubtotal = newItems
      .reduce((sum, it) => sum + it.quantity * (parseFloat(String(it.unit_price)) || 0), 0)
      .toFixed(2);

    setDraftOrder({
      ...draftOrder,
      items: newItems,
      subtotal: newSubtotal,
      total: newSubtotal,
    });
  };

  const handleAddDraftItem = () => {
    if (!draftOrder) return;
    const newItem: DraftItem = {
      name: 'Additional Item',
      quantity: 1,
      unit_price: '20.00',
      line_total: '20.00',
    };
    const newItems = [...draftOrder.items, newItem];
    const newSubtotal = newItems
      .reduce((sum, it) => sum + it.quantity * (parseFloat(String(it.unit_price)) || 0), 0)
      .toFixed(2);

    setDraftOrder({
      ...draftOrder,
      items: newItems,
      subtotal: newSubtotal,
      total: newSubtotal,
    });
  };

  // Submit verified draft to server & trigger PayPal modal
  const handleConfirmOrder = async () => {
    if (!draftOrder || draftOrder.items.length === 0) return;
    setError(null);
    setIsConfirming(true);

    try {
      const response = await api.post('/ai/confirm-order', {
        items: draftOrder.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unit_price: parseFloat(String(it.unit_price)),
        })),
        currency: draftOrder.currency || 'USD',
        notes: draftOrder.notes || `AI Order: ${draftOrder.raw_prompt}`,
      });

      const createdOrder: Order = response.data.data;
      setActiveOrder(createdOrder);
      setIsModalOpen(true);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setError(res?.data?.message || 'Failed to create order on server.');
      } else {
        setError('Network error confirming order.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">AI Order Assistant</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center gap-1 shadow-sm">
              <Sparkles className="h-3 w-3" />
              Gemini Powered
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Zero-Trust Verification
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Describe orders in natural language — PayPilot parses items, recalculates totals strictly server-side, and launches verified PayPal checkout.
          </p>
        </div>
        {onNavigateDashboard && (
          <button
            onClick={onNavigateDashboard}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Completed Payment Banner */}
      {completedPayment && activeOrder && (
        <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
            <CheckCircle2 className="h-6 w-6" />
            <span>Order #{activeOrder.order_number} Captured & Paid!</span>
          </div>
          <p className="text-xs text-slate-300">
            Payment successfully captured in PayPal Sandbox with cryptographic server-side validation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block">PayPal Order ID</span>
              <span className="text-blue-400 font-semibold">{completedPayment.paypal_order_id}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block">Capture ID</span>
              <span className="text-emerald-400 font-semibold">{completedPayment.paypal_capture_id || 'COMPLETED'}</span>
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
                setDraftOrder(null);
                setActiveOrder(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition"
            >
              Parse Another Order
            </button>
            {onNavigateDashboard && (
              <button
                onClick={onNavigateDashboard}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition"
              >
                View in Dashboard
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI Command Input Bar */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-400" />
            <span>Natural Language Merchant Prompt</span>
          </label>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" />
            Zero-Trust Recalculation Engine
          </span>
        </div>

        <div className="relative">
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. 2 wireless headphones at $45 each and one phone case at $12..."
            className="w-full p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm leading-relaxed"
          />
        </div>

        {/* Quick-Prompt Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 mr-1 font-medium">Quick Examples:</span>
          {sampleChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPrompt(chip);
                handleAnalyzePrompt(chip);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-xs text-slate-300 hover:text-white transition text-left flex items-center gap-1.5"
            >
              <Sparkles className="h-3 w-3 text-blue-400 shrink-0" />
              <span className="truncate max-w-[280px] sm:max-w-none">{chip}</span>
            </button>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            disabled={isAnalyzing || !prompt.trim()}
            onClick={() => handleAnalyzePrompt()}
            className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 shadow-lg shadow-blue-500/25 transition disabled:opacity-50 text-sm"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Extracting with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Analyze & Draft Order</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Draft Review State (Zero-Trust Verification Card) */}
      {draftOrder && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Extracted Order Draft</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">
                  AI Generated
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Verified by Server Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Prompt: <span className="italic text-slate-300">"{draftOrder.raw_prompt}"</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAddDraftItem}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-medium flex items-center gap-1 border border-slate-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item</span>
              </button>
              <button
                type="button"
                onClick={() => setDraftOrder(null)}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/30 transition"
              >
                Discard Draft
              </button>
            </div>
          </div>

          {/* Editable Draft Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/60 text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Product / Item Name</th>
                  <th className="py-3 px-4 w-28">Quantity</th>
                  <th className="py-3 px-4 w-36">Unit Price ($)</th>
                  <th className="py-3 px-4 w-32">Line Total</th>
                  <th className="py-3 px-4 w-16 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {draftOrder.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                        {item.catalog_matched && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 shadow-sm">
                            <ShieldCheck className="h-3 w-3 text-emerald-400" />
                            <span>Catalog Verified</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          className="w-full pl-6 pr-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-blue-400">
                      ${parseFloat(String(item.line_total)).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {draftOrder.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 transition"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Launch Section */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-slate-400 font-semibold">Server Recalculated Total:</span>
                <span className="font-mono text-2xl font-bold text-white">${parseFloat(draftOrder.total).toFixed(2)}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  {draftOrder.currency}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Zero-Trust validation: prices recalculate on backend prior to PayPal authorization.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                disabled={isConfirming || draftOrder.items.length === 0}
                onClick={handleConfirmOrder}
                className="w-full sm:w-auto py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition disabled:opacity-50 text-sm"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>Confirm & Launch PayPal Checkout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Reference Section */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Merchant Catalog Quick Reference
        </h3>
        {products.length === 0 ? (
          <p className="text-xs text-slate-500">Loading catalog items...</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const newPrompt = `1 ${p.name} for $${parseFloat(p.unit_price).toFixed(2)}`;
                  setPrompt(newPrompt);
                  handleAnalyzePrompt(newPrompt);
                }}
                className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition"
              >
                <p className="text-xs font-medium text-white truncate">{p.name}</p>
                <p className="text-xs font-mono font-semibold text-blue-400 mt-0.5">
                  ${parseFloat(p.unit_price).toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PayPal Checkout Modal */}
      <PayPalCheckoutModal
        order={activeOrder}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPaymentSuccess={(p) => setCompletedPayment(p)}
      />
    </div>
  );
};

export default OrderAssistant;
