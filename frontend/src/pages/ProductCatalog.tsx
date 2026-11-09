import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  Package,
  Plus,
  Search,
  ShieldCheck,
  Edit2,
  Trash2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Tag,
  TrendingUp,
  LayoutGrid,
  List,
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  description?: string | null;
  unit_price: string | number;
  currency: string;
  created_at?: string;
}

interface ProductCatalogProps {
  onNavigateAssistant?: (initialPrompt?: string) => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ onNavigateAssistant }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [sortOption, setSortOption] = useState<'name' | 'price_asc' | 'price_desc'>('name');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState<string>('USD');
  const [formDescription, setFormDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products');
      setProducts(res.data.data || []);
    } catch (err) {
      console.error('Failed to load products', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to load merchant product catalog.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormCurrency('USD');
    setFormDescription('');
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormPrice(String(p.unit_price));
    setFormCurrency(p.currency || 'USD');
    setFormDescription(p.description || '');
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice.trim()) return;

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, {
          name: formName.trim(),
          unit_price: parseFloat(formPrice),
          currency: formCurrency.trim().toUpperCase(),
          description: formDescription.trim() || null,
        });
        setFeedbackMsg({ type: 'success', text: `Product "${formName}" updated successfully.` });
      } else {
        await api.post('/products', {
          name: formName.trim(),
          unit_price: parseFloat(formPrice),
          currency: formCurrency.trim().toUpperCase(),
          description: formDescription.trim() || null,
        });
        setFeedbackMsg({ type: 'success', text: `Product "${formName}" added to catalog.` });
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: unknown) {
      console.error('Failed to save product', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to save product. Please check the values.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from the product catalog?`)) {
      return;
    }

    try {
      await api.delete(`/products/${id}`);
      setFeedbackMsg({ type: 'success', text: `Product "${name}" deleted from catalog.` });
      fetchProducts();
    } catch (err) {
      console.error('Failed to delete product', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to delete product.' });
    }
  };

  const handleTestInAssistant = (productName: string, price: string | number) => {
    const formattedPrice = parseFloat(String(price)).toFixed(2);
    const testPrompt = `2 ${productName} for $${formattedPrice} with standard checkout`;
    if (onNavigateAssistant) {
      onNavigateAssistant(testPrompt);
    }
  };

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          String(p.unit_price).includes(q)
        );
      })
      .sort((a, b) => {
        if (sortOption === 'price_asc') {
          return parseFloat(String(a.unit_price)) - parseFloat(String(b.unit_price));
        }
        if (sortOption === 'price_desc') {
          return parseFloat(String(b.unit_price)) - parseFloat(String(a.unit_price));
        }
        return a.name.localeCompare(b.name);
      });
  }, [products, searchQuery, sortOption]);

  const avgPrice = useMemo(() => {
    if (!products.length) return 0;
    const sum = products.reduce((acc, p) => acc + (parseFloat(String(p.unit_price)) || 0), 0);
    return sum / products.length;
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white">Product Catalog</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800">
              Authoritative Registry
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-mono">
              <ShieldCheck className="h-3 w-3" />
              Zero-Trust Protected
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Merchant source-of-truth database. Natural language prompts and checkout totals strictly validate against these authoritative prices.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition disabled:opacity-50"
            title="Refresh Catalog"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-lg ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/50 border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-white text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Total Catalog SKUs</span>
            <div className="text-2xl font-bold font-mono text-white tracking-tight mt-0.5 tabular-nums">
              {products.length}
            </div>
            <span className="text-[11px] text-blue-400 font-medium">Active in AI Parser</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Average Unit Price</span>
            <div className="text-2xl font-bold font-mono text-white tracking-tight mt-0.5 tabular-nums">
              ${avgPrice.toFixed(2)}
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">USD Currency Base</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Zero-Trust Guard</span>
            <div className="text-base font-bold text-white tracking-tight mt-1">
              Authoritative
            </div>
            <span className="text-[11px] text-purple-400 font-medium">Prompt overrides blocked</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Tag className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Calculation Engine</span>
            <div className="text-base font-bold font-mono text-white tracking-tight mt-1">
              BCMath Scale-2
            </div>
            <span className="text-[11px] text-amber-400 font-medium">Zero-float drift</span>
          </div>
        </div>
      </div>

      {/* Filter, Search & Layout Controls */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by title, description, or price..."
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

        {/* Sort & View Mode */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>

          <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
          <span>Loading merchant catalog...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-16 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
          <Package className="h-10 w-10 text-slate-600 mx-auto" />
          <p className="text-base font-semibold text-slate-300">No products found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery ? 'No catalog items match your search term.' : 'Your product catalog is currently empty.'}
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add First Product</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-[11px] uppercase tracking-wider bg-slate-800/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4">Catalog SKU</th>
                  <th className="py-3 px-4">Authoritative Unit Price</th>
                  <th className="py-3 px-4">AI Parser Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition group">
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-white block">{p.name}</span>
                        {p.description && (
                          <span className="text-xs text-slate-400 line-clamp-1 mt-0.5">{p.description}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      SKU-{String(p.id).padStart(4, '0')}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-base tabular-nums">
                      ${parseFloat(String(p.unit_price)).toFixed(2)}{' '}
                      <span className="text-xs font-normal text-slate-400 font-sans">{p.currency || 'USD'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Catalog Enforced</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onNavigateAssistant && (
                          <button
                            onClick={() => handleTestInAssistant(p.name, p.unit_price)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-medium flex items-center gap-1 transition"
                            title="Generate natural-language order prompt"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>Test in AI Order</span>
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Edit Product"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                          title="Delete Product"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 hover:border-slate-700 transition flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono text-slate-500 block">SKU-{String(p.id).padStart(4, '0')}</span>
                    <h3 className="text-base font-bold text-white truncate mt-0.5">{p.name}</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                    Enforced
                  </span>
                </div>
                {p.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{p.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-sans">Authoritative Price</span>
                  <span className="text-xl font-mono font-bold text-emerald-400 tabular-nums">
                    ${parseFloat(String(p.unit_price)).toFixed(2)}{' '}
                    <span className="text-xs text-slate-400 font-sans font-normal">{p.currency || 'USD'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(p)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Edit Product"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p.id, p.name)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                    title="Delete Product"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {onNavigateAssistant && (
                <button
                  onClick={() => handleTestInAssistant(p.name, p.unit_price)}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Test in AI Order Assistant</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-400" />
                <h2 className="text-base font-bold text-white">
                  {editingProduct ? 'Edit Catalog Product' : 'Add New Catalog Product'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ergonomic Mechanical Keyboard"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Authoritative Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="85.00"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full pl-6 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Currency</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-blue-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Brief description or item specifications..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-900/50 text-[11px] text-blue-300 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Zero-Trust pricing engine will automatically match natural language order prompts to this SKU and enforce this price prior to PayPal capture.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingProduct ? 'Save Changes' : 'Create Product'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;