import React, { useState } from 'react';

export interface CustomerEvent {
  id: string;
  type: string;
  timestamp: string;
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  status: 'completed' | 'pending' | 'failed' | 'success';
  metadata?: Record<string, any>;
}

interface LiveActivityPanelProps {
  events: CustomerEvent[];
  isLiveConnected: boolean;
  onRefresh?: () => void;
}

export function LiveActivityPanel({ events, isLiveConnected, onRefresh }: LiveActivityPanelProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredEvents = events.filter((ev) => {
    if (filterType !== 'all') {
      if (filterType === 'orders' && !['order_placed', 'order_status_updated', 'checkout_initiated'].includes(ev.type)) return false;
      if (filterType === 'payments' && !['payment_confirmed', 'payment_initiated', 'payment_failed', 'refund_requested', 'refund_confirmed'].includes(ev.type)) return false;
      if (filterType === 'cart' && !['cart_item_added', 'cart_item_removed', 'cart_quantity_changed'].includes(ev.type)) return false;
      if (filterType === 'auth' && !['customer_registered', 'customer_login', 'customer_logout'].includes(ev.type)) return false;
      if (filterType === 'browse' && !['product_viewed', 'product_searched', 'category_visited'].includes(ev.type)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = ev.customerName?.toLowerCase().includes(q);
      const matchEmail = ev.customerEmail?.toLowerCase().includes(q);
      const matchType = ev.type.toLowerCase().includes(q);
      const matchRef = ev.metadata?.orderReference?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchType && !matchRef) return false;
    }
    return true;
  });

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'order_placed':
        return { label: 'ORDER PLACED', bg: 'bg-[#064e3b]', text: 'text-[#6ee7b7]' };
      case 'payment_confirmed':
        return { label: 'PAYMENT CONFIRMED', bg: 'bg-[#14532d]', text: 'text-[#86efac]' };
      case 'payment_initiated':
        return { label: 'PAYMENT INITIATED', bg: 'bg-[#78350f]', text: 'text-[#fde68a]' };
      case 'cart_item_added':
        return { label: 'ADDED TO CART', bg: 'bg-[#1e1b4b]', text: 'text-[#c7d2fe]' };
      case 'checkout_initiated':
        return { label: 'CHECKOUT STARTED', bg: 'bg-[#312e81]', text: 'text-[#e0e7ff]' };
      case 'customer_registered':
        return { label: 'NEW CUSTOMER', bg: 'bg-[#4a044e]', text: 'text-[#f5d0fe]' };
      case 'customer_login':
        return { label: 'LOGIN', bg: 'bg-[#18181b]', text: 'text-[#a1a1aa]' };
      case 'product_viewed':
        return { label: 'PAGE VIEW', bg: 'bg-[#1c1917]', text: 'text-[#d6d3d1]' };
      case 'order_status_updated':
        return { label: 'ORDER UPDATED', bg: 'bg-[#1e293b]', text: 'text-[#38bdf8]' };
      default:
        return { label: type.toUpperCase().replace(/_/g, ' '), bg: 'bg-[#27272a]', text: 'text-[#e4e4e7]' };
    }
  };

  return (
    <div className="bg-white border border-[#e7e4de] shadow-xs">
      {/* Top Header */}
      <div className="p-4 border-b border-[#e7e4de] flex flex-wrap items-center justify-between gap-4 bg-[#fbfbfa]">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-lg font-bold text-[#121210]">Live Customer Activity Stream</h2>
          {isLiveConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live SSE Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono text-[#77746d] bg-gray-100">
              Periodic Sync
            </span>
          )}
          <span className="text-xs text-[#77746d] font-mono">({filteredEvents.length} events)</span>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 text-xs border border-[#e7e4de] bg-white hover:bg-[#f4f2ee] text-[#121210] font-mono transition-colors"
            >
              ↻ Refresh
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border-b border-[#e7e4de] bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap gap-1">
          {[
            { id: 'all', label: 'All Activity' },
            { id: 'orders', label: 'Orders' },
            { id: 'payments', label: 'Payments' },
            { id: 'cart', label: 'Cart Actions' },
            { id: 'auth', label: 'Customer Auth' },
            { id: 'browse', label: 'Browsing' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                filterType === f.id
                  ? 'bg-[#121210] text-[#f8f7f4] font-semibold'
                  : 'bg-[#f4f2ee] text-[#77746d] hover:text-[#121210]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter by customer, order ref, or event..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-[#e7e4de] px-3 py-1 text-xs w-64 bg-[#fbfbfa]"
        />
      </div>

      {/* Event Feed List */}
      <div className="divide-y divide-[#e7e4de] max-h-[550px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#77746d]">
            No activity records match your current filter. Events populate automatically as customers interact with the store.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const badge = getEventBadge(ev.type);
            return (
              <div key={ev.id} className="p-3.5 hover:bg-[#faf9f6] transition-colors flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    {ev.customerName && (
                      <span className="font-semibold text-[#121210]">
                        {ev.customerName}
                        {ev.customerEmail ? ` (${ev.customerEmail})` : ''}
                      </span>
                    )}
                  </div>

                  {/* Metadata display */}
                  {ev.metadata && (
                    <div className="text-[11px] text-[#77746d] font-mono pl-0.5">
                      {ev.metadata.orderReference && (
                        <span>Order Ref: <strong className="text-[#121210]">{ev.metadata.orderReference}</strong> · </span>
                      )}
                      {ev.metadata.amountCents !== undefined && (
                        <span>Amount: ${(ev.metadata.amountCents / 100).toFixed(2)} · </span>
                      )}
                      {ev.metadata.productTitle && (
                        <span>Product: {ev.metadata.productTitle} · </span>
                      )}
                      {ev.metadata.carrier && (
                        <span>Carrier: {ev.metadata.carrier} (#{ev.metadata.trackingNumber}) · </span>
                      )}
                      {ev.metadata.updatedBy && (
                        <span>Actor: {ev.metadata.updatedBy} · </span>
                      )}
                      {ev.metadata.notes && (
                        <span>Note: {ev.metadata.notes}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right text-[11px] font-mono text-[#a1a1aa] whitespace-nowrap">
                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
