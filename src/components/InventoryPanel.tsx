import React, { useState } from 'react';
import type { Product } from '../data/catalog';

interface InventoryPanelProps {
  products: Product[];
  adminToken: string | null;
  onProductUpdated: () => void;
}

export function InventoryPanel({ products, adminToken, onProductUpdated }: InventoryPanelProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'low' | 'out'>('all');
  const [search, setSearch] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (filterStockStatus === 'low' && (p.stockQuantity > 5 || p.stockQuantity <= 0)) return false;
    if (filterStockStatus === 'out' && p.stockQuantity > 0) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !p.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleAdjustStock = async (product: Product, delta: number) => {
    const newQty = Math.max(0, product.stockQuantity + delta);
    setUpdatingId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          stockQuantity: newQty,
          isAvailable: newQty > 0 ? product.isAvailable : false,
        }),
      });
      if (res.ok) {
        onProductUpdated();
      }
    } catch (err) {
      console.error('Failed to adjust stock', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleAvailability = async (product: Product) => {
    setUpdatingId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          isAvailable: !product.isAvailable,
        }),
      });
      if (res.ok) {
        onProductUpdated();
      }
    } catch (err) {
      console.error('Failed to toggle availability', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const lowStockCount = products.filter((p) => p.stockQuantity <= 5 && p.stockQuantity > 0).length;
  const outOfStockCount = products.filter((p) => p.stockQuantity === 0).length;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-[#e7e4de] shadow-xs">
          <span className="text-[10px] font-mono uppercase text-[#77746d] block">Total SKUs in Catalog</span>
          <span className="text-2xl font-bold font-mono text-[#121210]">{products.length}</span>
          <span className="text-[11px] text-[#77746d] block mt-1">Authoritative inventory</span>
        </div>

        <div className="p-4 bg-white border border-[#e7e4de] shadow-xs">
          <span className="text-[10px] font-mono uppercase text-[#b45309] block">Low Stock (≤ 5 units)</span>
          <span className="text-2xl font-bold font-mono text-[#d97706]">{lowStockCount}</span>
          <button
            onClick={() => setFilterStockStatus('low')}
            className="text-[11px] text-[#b45309] hover:underline block mt-1"
          >
            Filter low stock items →
          </button>
        </div>

        <div className="p-4 bg-white border border-[#e7e4de] shadow-xs">
          <span className="text-[10px] font-mono uppercase text-[#991b1b] block">Out of Stock (0 units)</span>
          <span className="text-2xl font-bold font-mono text-[#dc2626]">{outOfStockCount}</span>
          <button
            onClick={() => setFilterStockStatus('out')}
            className="text-[11px] text-[#991b1b] hover:underline block mt-1"
          >
            Filter out-of-stock items →
          </button>
        </div>
      </div>

      {/* Control & Search Bar */}
      <div className="bg-white border border-[#e7e4de] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#121210]">Filter:</span>
          <button
            onClick={() => setFilterStockStatus('all')}
            className={`px-3 py-1 rounded ${filterStockStatus === 'all' ? 'bg-[#121210] text-white' : 'bg-[#f4f2ee] text-[#77746d]'}`}
          >
            All Stock
          </button>
          <button
            onClick={() => setFilterStockStatus('low')}
            className={`px-3 py-1 rounded ${filterStockStatus === 'low' ? 'bg-[#d97706] text-white' : 'bg-[#f4f2ee] text-[#77746d]'}`}
          >
            Low Stock ({lowStockCount})
          </button>
          <button
            onClick={() => setFilterStockStatus('out')}
            className={`px-3 py-1 rounded ${filterStockStatus === 'out' ? 'bg-[#dc2626] text-white' : 'bg-[#f4f2ee] text-[#77746d]'}`}
          >
            Out of Stock ({outOfStockCount})
          </button>
        </div>

        <input
          type="text"
          placeholder="Search products by title or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[#e7e4de] px-3 py-1.5 w-64 bg-[#fbfbfa]"
        />
      </div>

      {/* Products Inventory Table */}
      <div className="bg-white border border-[#e7e4de] shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#fbfbfa] text-[#77746d] border-b border-[#e7e4de] font-mono text-[11px] uppercase">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Category</th>
              <th className="p-3">Retail Price</th>
              <th className="p-3">Current Stock</th>
              <th className="p-3">Storefront Status</th>
              <th className="p-3 text-right">Quick Inventory Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e7e4de]">
            {filteredProducts.map((p) => {
              const isLow = p.stockQuantity <= 5 && p.stockQuantity > 0;
              const isOut = p.stockQuantity === 0;

              return (
                <tr key={p.id} className="hover:bg-[#faf9f6] transition-colors">
                  <td className="p-3 flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt={p.title} className="w-10 h-10 object-cover rounded border border-[#e7e4de]" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded border border-[#e7e4de] flex items-center justify-center text-[10px]">No img</div>
                    )}
                    <div>
                      <div className="font-semibold text-[#121210]">{p.title}</div>
                      <div className="text-[10px] text-[#77746d] font-mono">ID: {p.id}</div>
                    </div>
                  </td>

                  <td className="p-3 font-mono text-[#77746d] uppercase text-[11px]">{p.category}</td>

                  <td className="p-3 font-mono font-semibold text-[#121210]">
                    ${(p.retailPriceCents / 100).toFixed(2)}
                  </td>

                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      isOut ? 'bg-red-50 text-red-700 border border-red-200' :
                      isLow ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {p.stockQuantity} in stock
                    </span>
                  </td>

                  <td className="p-3">
                    <button
                      onClick={() => handleToggleAvailability(p)}
                      disabled={updatingId === p.id}
                      className={`px-2.5 py-1 text-[11px] font-semibold uppercase rounded transition-colors ${
                        p.isAvailable
                          ? 'bg-[#121210] text-[#f8f7f4] hover:bg-gray-800'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {p.isAvailable ? 'Available' : 'Hidden'}
                    </button>
                  </td>

                  <td className="p-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => handleAdjustStock(p, -1)}
                        disabled={p.stockQuantity === 0 || updatingId === p.id}
                        className="w-7 h-7 flex items-center justify-center border border-[#e7e4de] rounded hover:bg-[#f4f2ee] font-mono disabled:opacity-40"
                        title="Reduce stock by 1"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => handleAdjustStock(p, 5)}
                        disabled={updatingId === p.id}
                        className="px-2 h-7 flex items-center justify-center border border-[#e7e4de] rounded hover:bg-[#f4f2ee] font-mono text-[11px]"
                        title="Add 5 units"
                      >
                        +5
                      </button>
                      <button
                        onClick={() => handleAdjustStock(p, 20)}
                        disabled={updatingId === p.id}
                        className="px-2 h-7 flex items-center justify-center border border-[#e7e4de] rounded hover:bg-[#f4f2ee] font-mono text-[11px]"
                        title="Restock 20 units"
                      >
                        +20
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
