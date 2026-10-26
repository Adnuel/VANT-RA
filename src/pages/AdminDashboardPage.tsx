import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { formatUSD } from '../lib/commerceLogic.ts';
import { CATEGORIES } from '../data/catalog.ts';
import { downloadProjectZip } from '../lib/downloadZip.ts';
import type { RealAnalyticsSummary, AnalyticsTimeRange } from '../lib/analyticsLogic.ts';
import type { CustomerEvent } from '../../server/db.ts';
import { LiveActivityPanel } from '../components/LiveActivityPanel.tsx';
import { InventoryPanel } from '../components/InventoryPanel.tsx';
import { ShippingZonesPanel } from '../components/ShippingZonesPanel.tsx';
import { DomainSetupManager } from '../components/DomainSetupManager.tsx';

interface AdminDashboardPageProps {
  onNavigate: (url: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const { adminUser, adminToken, logoutAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'activity' | 'overview' | 'orders' | 'products' | 'inventory' | 'shipping' | 'suppliers' | 'customers' | 'bank' | 'audit' | 'domain'
  >('activity');

  const [statusToast, setStatusToast] = useState<{ message: string; type?: 'info' | 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusToast({ message, type });
    setTimeout(() => setStatusToast(null), 4000);
  };

  // Real Analytics & Time Filter States
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsTimeRange>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [realAnalytics, setRealAnalytics] = useState<RealAnalyticsSummary | null>(null);

  // Live Customer Activity Events State
  const [customerEvents, setCustomerEvents] = useState<CustomerEvent[]>([]);
  const [eventFilterType, setEventFilterType] = useState<string>('all');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);

  // Core Data States
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankSettings, setBankSettings] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('');
  const [orderFulfilmentFilter, setOrderFulfilmentFilter] = useState('');

  // Modals & form state
  const [shippingModalOrder, setShippingModalOrder] = useState<any | null>(null);
  const [shippingCarrier, setShippingCarrier] = useState('DHL Express');
  const [shippingTrackingNumber, setShippingTrackingNumber] = useState('');
  const [shippingTrackingUrl, setShippingTrackingUrl] = useState('');

  const [refundModalOrder, setRefundModalOrder] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState('Customer request / returns');
  const [isRefunding, setIsRefunding] = useState(false);

  // CEO Real-Time Order Editing
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderSaveSuccess, setOrderSaveSuccess] = useState<string | null>(null);
  const [orderEditForm, setOrderEditForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    streetAddress: '',
    apartment: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    paymentStatus: 'pending',
    fulfilmentStatus: 'unfulfilled',
    carrier: '',
    trackingNumber: '',
    trackingUrl: '',
    notes: '',
    adminNotes: '',
  });

  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    title: '',
    category: 'phone-cases',
    retailPrice: '9.99',
    supplierCost: '3.50',
    stockQuantity: 30,
    isAvailable: true,
    description: '',
    image: '',
    supplierName: 'AliExpress Direct',
    supplierLink: '',
  });

  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    sortCode: '',
    instructions: '',
    whatsapp: '',
    email: '',
  });

  // Load all admin data including real analytics & real customer events
  const loadDashboardData = async () => {
    if (!adminToken) return;
    try {
      const headers = { Authorization: `Bearer ${adminToken}` };

      const analyticsUrl = `/api/admin/analytics?range=${analyticsRange}${
        customStart ? `&start=${encodeURIComponent(customStart)}` : ''
      }${customEnd ? `&end=${encodeURIComponent(customEnd)}` : ''}`;

      const [statsRes, analyticsRes, eventsRes, ordersRes, productsRes, customersRes, suppliersRes, bankRes, auditRes, notifRes] =
        await Promise.all([
          fetch('/api/admin/dashboard-stats', { headers }),
          fetch(analyticsUrl, { headers }),
          fetch('/api/admin/events?limit=100', { headers }),
          fetch('/api/admin/orders', { headers }),
          fetch('/api/admin/products', { headers }),
          fetch('/api/admin/customers', { headers }),
          fetch('/api/admin/suppliers', { headers }),
          fetch('/api/admin/bank-settings', { headers }),
          fetch('/api/admin/audit-logs', { headers }),
          fetch('/api/admin/notifications', { headers }),
        ]);

      if (statsRes && (statsRes.status === 401 || statsRes.status === 403)) {
        logoutAdmin();
        onNavigate('/admin/login');
        return;
      }

      const safeJson = async (res: Response | null, fallback: any) => {
        if (!res || !res.ok) return fallback;
        try {
          return await res.json();
        } catch {
          return fallback;
        }
      };

      const [statsData, analyticsData, eventsData, ordersData, productsData, customersData, suppliersData, bankData, auditData, notifData] =
        await Promise.all([
          safeJson(statsRes, null),
          safeJson(analyticsRes, {}),
          safeJson(eventsRes, { events: [] }),
          safeJson(ordersRes, { orders: [] }),
          safeJson(productsRes, { products: [] }),
          safeJson(customersRes, { customers: [] }),
          safeJson(suppliersRes, { suppliers: [] }),
          safeJson(bankRes, {}),
          safeJson(auditRes, { auditLogs: [] }),
          safeJson(notifRes, { notifications: [] }),
        ]);

      setStats(statsData);
      setRealAnalytics(analyticsData.analytics || null);
      setCustomerEvents(eventsData.events || []);
      setOrders(ordersData.orders || []);
      setProducts(productsData.products || []);
      setCustomers(customersData.customers || []);
      setSuppliers(suppliersData.suppliers || []);
      if (bankData.bankSettings) {
        setBankSettings(bankData.bankSettings);
        setBankForm(bankData.bankSettings);
      }
      setAuditLogs(auditData.auditLogs || []);
      setNotifications(notifData.notifications || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!adminToken) {
      onNavigate('/admin/login');
      return;
    }
    loadDashboardData();
  }, [adminToken, analyticsRange]);

  // Real-Time Server-Sent Events (SSE) Stream
  useEffect(() => {
    if (!adminToken) return;

    let eventSource: EventSource | null = null;
    try {
      const streamUrl = `/api/admin/events/stream?token=${encodeURIComponent(adminToken)}`;
      eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        setIsLiveConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const incoming = JSON.parse(e.data);
          if (incoming && incoming.type !== 'connected') {
            setCustomerEvents((prev) => [incoming, ...prev.filter((x) => x.id !== incoming.id)]);
            // Auto refresh metrics on critical financial or order operations
            if (
              [
                'order_placed',
                'payment_confirmed',
                'payment_initiated',
                'order_cancelled',
                'refund_confirmed',
                'customer_registered',
              ].includes(incoming.type)
            ) {
              loadDashboardData();
            }
          }
        } catch {}
      };

      eventSource.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch {
      setIsLiveConnected(false);
    }

    // Periodic poll fallback every 10 seconds
    const interval = setInterval(() => {
      loadDashboardData();
    }, 10000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [adminToken, analyticsRange]);

  // Actions
  const handleVerifyPayment = async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/verify-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        loadDashboardData();
      }
    } catch {}
  };

  const handleConfirmRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalOrder) return;
    setIsRefunding(true);
    try {
      const res = await fetch(`/api/admin/orders/${refundModalOrder.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: refundReason }),
      });
      if (res.ok) {
        setRefundModalOrder(null);
        setRefundReason('Customer request / returns');
        loadDashboardData();
      }
    } catch {
    } finally {
      setIsRefunding(false);
    }
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingModalOrder) return;
    try {
      const res = await fetch(`/api/admin/orders/${shippingModalOrder.id}/shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          carrier: shippingCarrier,
          trackingNumber: shippingTrackingNumber,
          trackingUrl: shippingTrackingUrl,
        }),
      });
      if (res.ok) {
        setShippingModalOrder(null);
        setShippingTrackingNumber('');
        loadDashboardData();
      }
    } catch {}
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        loadDashboardData();
      }
    } catch {}
  };

  const openEditOrderModal = (order: any) => {
    setEditingOrder(order);
    setOrderSaveSuccess(null);
    setOrderEditForm({
      customerName: order.customerName || '',
      customerEmail: order.customerEmail || '',
      customerPhone: order.customerPhone || '',
      streetAddress: order.shippingAddress?.streetAddress || '',
      apartment: order.shippingAddress?.apartment || '',
      city: order.shippingAddress?.city || '',
      state: order.shippingAddress?.state || '',
      postalCode: order.shippingAddress?.postalCode || '',
      country: order.shippingAddress?.country || 'Nigeria',
      paymentStatus: order.paymentStatus || 'pending',
      fulfilmentStatus: order.fulfilmentStatus || 'unfulfilled',
      carrier: order.carrier || '',
      trackingNumber: order.trackingNumber || '',
      trackingUrl: order.trackingUrl || '',
      notes: order.notes || '',
      adminNotes: order.adminNotes || '',
    });
  };

  const handleSaveOrderEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setIsSavingOrder(true);
    setOrderSaveSuccess(null);
    try {
      const res = await fetch(`/api/admin/orders/${editingOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          customerName: orderEditForm.customerName,
          customerEmail: orderEditForm.customerEmail,
          customerPhone: orderEditForm.customerPhone,
          shippingAddress: {
            fullName: orderEditForm.customerName,
            phone: orderEditForm.customerPhone,
            streetAddress: orderEditForm.streetAddress,
            apartment: orderEditForm.apartment,
            city: orderEditForm.city,
            state: orderEditForm.state,
            postalCode: orderEditForm.postalCode,
            country: orderEditForm.country,
          },
          paymentStatus: orderEditForm.paymentStatus,
          fulfilmentStatus: orderEditForm.fulfilmentStatus,
          carrier: orderEditForm.carrier,
          trackingNumber: orderEditForm.trackingNumber,
          trackingUrl: orderEditForm.trackingUrl,
          notes: orderEditForm.notes,
          adminNotes: orderEditForm.adminNotes,
        }),
      });
      if (res.ok) {
        setOrderSaveSuccess(`Order ${editingOrder.orderReference} updated in real time.`);
        setTimeout(() => {
          setEditingOrder(null);
          setOrderSaveSuccess(null);
        }, 800);
        await loadDashboardData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update order', 'error');
      }
    } catch {
      showToast('Network error while saving order edits', 'error');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const retailPriceCents = Math.round(parseFloat(productForm.retailPrice) * 100);
    const supplierCostCents = productForm.supplierCost ? Math.round(parseFloat(productForm.supplierCost) * 100) : null;

    try {
      if (editingProduct) {
        await fetch(`/api/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            title: productForm.title,
            category: productForm.category,
            retailPriceCents,
            supplierCostCents,
            stockQuantity: parseInt(String(productForm.stockQuantity), 10),
            isAvailable: productForm.isAvailable,
            description: productForm.description,
            image: productForm.image || null,
            supplierName: productForm.supplierName,
            supplierLink: productForm.supplierLink,
          }),
        });
        setEditingProduct(null);
      } else if (isAddingProduct) {
        await fetch('/api/admin/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            title: productForm.title,
            category: productForm.category,
            retailPriceCents,
            supplierCostCents,
            stockQuantity: parseInt(String(productForm.stockQuantity), 10),
            isAvailable: productForm.isAvailable,
            availability: 'Ready for Order',
            description: productForm.description,
            image: productForm.image || null,
            imageAlt: productForm.title,
            imageNeedsReview: false,
            sourceTitle: productForm.title,
            referencePriceCents: retailPriceCents,
            priceBasis: 'provisional-estimate',
            sourceDescription: true,
            trending: false,
            supplierName: productForm.supplierName,
            supplierLink: productForm.supplierLink,
          }),
        });
        setIsAddingProduct(false);
      }
      loadDashboardData();
    } catch {}
  };

  const handleSaveBankSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/bank-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(bankForm),
      });
      if (res.ok) {
        showToast('Bank transfer details updated successfully.', 'success');
        loadDashboardData();
      }
    } catch {
      showToast('Error saving bank transfer details', 'error');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (orderPaymentFilter && o.paymentStatus !== orderPaymentFilter) return false;
    if (orderFulfilmentFilter && o.fulfilmentStatus !== orderFulfilmentFilter) return false;
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      return (
        o.orderReference.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredEvents = customerEvents.filter((evt) => {
    if (eventFilterType === 'all') return true;
    return evt.type === eventFilterType;
  });

  // Human friendly event type labels & color tags
  const getEventBadge = (type: string) => {
    switch (type) {
      case 'customer_registered':
        return <span className="bg-[#e6fffa] text-[#234e52] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Registration</span>;
      case 'customer_login':
        return <span className="bg-[#eef8ee] text-[#1e7e34] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Customer Login</span>;
      case 'customer_logout':
        return <span className="bg-[#f4f2ee] text-[#77746d] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Customer Logout</span>;
      case 'product_viewed':
        return <span className="bg-[#f0eef8] text-[#553c9a] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Product View</span>;
      case 'product_searched':
        return <span className="bg-[#eef2ff] text-[#3730a3] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Search Query</span>;
      case 'category_visited':
        return <span className="bg-[#f3f4f6] text-[#374151] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Category Visit</span>;
      case 'cart_item_added':
        return <span className="bg-[#fff8e6] text-[#856404] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Cart Add</span>;
      case 'cart_item_removed':
        return <span className="bg-[#fdf2f2] text-[#9b1c1c] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Cart Remove</span>;
      case 'cart_quantity_changed':
        return <span className="bg-[#fffdfa] text-[#c4a66b] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Cart Qty</span>;
      case 'checkout_initiated':
        return <span className="bg-[#fef3c7] text-[#92400e] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Checkout Start</span>;
      case 'order_placed':
        return <span className="bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Order Placed</span>;
      case 'payment_initiated':
        return <span className="bg-[#fff8e6] text-[#b45309] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Payment Sent</span>;
      case 'payment_confirmed':
        return <span className="bg-[#1e7e34] text-white px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Payment Verified</span>;
      case 'order_cancelled':
        return <span className="bg-[#fee2e2] text-[#991b1b] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Order Cancelled</span>;
      case 'refund_confirmed':
        return <span className="bg-[#991b1b] text-white px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Refund Confirmed</span>;
      case 'newsletter_subscribed':
        return <span className="bg-[#e0e7ff] text-[#4338ca] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Newsletter</span>;
      case 'contact_form_submitted':
        return <span className="bg-[#ccfbf1] text-[#115e59] px-2 py-0.5 rounded-xs font-mono text-[10px] font-bold uppercase">Client Inquiry</span>;
      default:
        return <span className="bg-[#f4f2ee] text-[#121210] px-2 py-0.5 rounded-xs font-mono text-[10px] uppercase">{type}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f2ee] text-[#121210] flex flex-col font-sans">
      {/* CEO Executive Top Bar */}
      <header className="bg-[#121210] text-[#f8f7f4] border-b border-[#252521] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-[#c4a66b] text-[#121210] flex items-center justify-center font-serif text-base font-bold rounded-xs">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-widest text-sm uppercase text-white font-sans">
                  VANTÉRA
                </span>
                <span className="text-[10px] bg-[#c4a66b] text-[#121210] px-1.5 py-0.2 rounded-xs font-mono font-bold uppercase">
                  CEO Executive Suite
                </span>
                {isLiveConnected ? (
                  <span className="inline-flex items-center gap-1 bg-[#1e7e34]/30 border border-[#1e7e34] text-[#a7f3d0] text-[9px] px-2 py-0.5 rounded-full font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse"></span>
                    Live SSE Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-[#77746d]/20 text-[#d1d5db] text-[9px] px-2 py-0.5 rounded-full font-mono">
                    Polling Updates
                  </span>
                )}
              </div>
              <span className="text-xs text-[#a9a69f]">
                Store Owner: <strong>Adnuel</strong> (emmanueladarikwu@gmail.com)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('/')}
              className="text-xs text-[#a9a69f] hover:text-[#f8f7f4] transition-colors"
            >
              ← Storefront
            </button>
            <button
              onClick={() => {
                setActiveTab('products');
                setEditingProduct(null);
                setIsAddingProduct(true);
                setProductForm({
                  title: '',
                  category: 'phone-cases',
                  retailPrice: '9.99',
                  supplierCost: '3.50',
                  stockQuantity: 30,
                  isAvailable: true,
                  description: '',
                  image: '',
                  supplierName: 'AliExpress Direct',
                  supplierLink: '',
                });
              }}
              className="bg-[#c4a66b] text-[#121210] font-semibold px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-[#d4af37] transition-colors flex items-center gap-1 shadow-xs"
              title="Add a new product to VANTÉRA catalog"
            >
              <span>+</span>
              <span>Add Product</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                setIsDownloadingZip(true);
                const res = await downloadProjectZip();
                setIsDownloadingZip(false);
                if (!res.success) {
                  showToast(`Download notice: ${res.message}`, 'info');
                }
              }}
              disabled={isDownloadingZip}
              className="bg-[#c4a66b] text-[#121210] font-semibold px-3 py-1.5 text-xs hover:bg-[#b3955a] transition-colors rounded-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Download verified binary ZIP of complete project"
            >
              <span>📦</span>
              <span>{isDownloadingZip ? 'Verifying & Downloading ZIP...' : 'Download Project ZIP'}</span>
            </button>
            <button
              onClick={() => {
                logoutAdmin();
                onNavigate('/admin/login');
              }}
              className="border border-[#77746d]/40 text-[#f8f7f4] px-3.5 py-1.5 text-xs hover:border-[#f8f7f4] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <nav className="bg-white border-b border-[#e7e4de] px-6">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto scrollbar-none text-xs font-medium uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('activity')}
            className={`py-3.5 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'activity' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Storefront Feed</span>
            {customerEvents.length > 0 && (
              <span className="bg-[#121210] text-white px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                {customerEvents.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3.5 transition-colors border-b-2 ${
              activeTab === 'overview' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            Overview & Real Metrics
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3.5 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'orders' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            <span>Orders</span>
            {stats && stats.orders.new > 0 && (
              <span className="bg-[#c4a66b] text-[#121210] px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                {stats.orders.new}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`py-3.5 transition-colors border-b-2 ${
              activeTab === 'products' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            Product Catalog ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3.5 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'inventory' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            <span>Inventory & Stock</span>
            {products.filter((p) => p.stockQuantity <= 5).length > 0 && (
              <span className="bg-[#d97706] text-white px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                {products.filter((p) => p.stockQuantity <= 5).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`py-3.5 transition-colors border-b-2 ${
              activeTab === 'shipping' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            Shipping Zones
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`py-3.5 transition-colors border-b-2 ${
              activeTab === 'suppliers' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            Suppliers & Sync
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`py-3.5 transition-colors border-b-2 ${
              activeTab === 'customers' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            Registered Customers ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`py-3.5 transition-colors border-b-2 ${
              activeTab === 'bank' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            Bank Transfer Settings
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3.5 transition-colors border-b-2 ${
              activeTab === 'audit' ? 'border-[#121210] text-[#121210] font-bold' : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('domain')}
            className={`py-3.5 transition-colors border-b-2 font-bold ${
              activeTab === 'domain'
                ? 'border-[#c4a66b] text-[#121210]'
                : 'border-transparent text-[#b45309] hover:text-[#121210]'
            }`}
          >
            Custom Domain & Hosting
          </button>
        </div>
      </nav>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-[#77746d] space-y-3">
            <div className="w-8 h-8 border-2 border-[#121210] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs uppercase tracking-wider font-mono">Loading Authoritative CEO Metrics...</p>
          </div>
        )}

        {/* 1. OVERVIEW & METRICS (GENUINE DATABASE ONLY) */}
        {!isLoading && activeTab === 'overview' && realAnalytics && stats && (
          <div className="space-y-8">
            {/* CEO Executive Infrastructure & Operations Banner */}
            <div className="bg-[#121210] border border-[#252521] text-[#f8f7f4] p-6 shadow-md rounded-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#c4a66b] font-bold">
                      EXECUTIVE INFRASTRUCTURE & DOMAIN
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold">
                      ● Active & Live
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-sans text-white">
                    vantera.com.ng & Operations Hub
                  </h3>
                  <p className="text-xs text-[#a9a69f] max-w-2xl leading-relaxed">
                    Custom domain and DNS routing, verified project source backup, and live CEO controls are managed privately here in your Executive Suite.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('domain')}
                    className="bg-[#c4a66b] text-[#121210] font-bold px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#d4af37] transition-colors rounded-xs flex items-center gap-2 cursor-pointer shadow-xs"
                    title="Configure Custom Domain and DNS settings"
                  >
                    <span>🌐</span>
                    <span>Custom Domain & DNS Setup</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsDownloadingZip(true);
                      const res = await downloadProjectZip();
                      setIsDownloadingZip(false);
                      if (!res.success) {
                        showToast(`Download notice: ${res.message}`, 'info');
                      } else {
                        showToast('Project ZIP downloaded successfully!', 'success');
                      }
                    }}
                    disabled={isDownloadingZip}
                    className="border border-[#c4a66b] text-[#c4a66b] hover:bg-[#c4a66b] hover:text-[#121210] font-bold px-4 py-2 text-xs uppercase tracking-wider transition-colors rounded-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    title="Download verified binary ZIP of complete project"
                  >
                    <span>📦</span>
                    <span>{isDownloadingZip ? 'Downloading ZIP...' : 'Download Verified ZIP'}</span>
                  </button>

                  <a
                    href="https://vantera.com.ng"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-[#77746d]/50 text-[#f8f7f4] hover:border-[#f8f7f4] px-3.5 py-2 text-xs font-mono transition-colors rounded-xs flex items-center gap-1.5"
                    title="View live production domain"
                  >
                    <span>↗</span>
                    <span>vantera.com.ng</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Time Period Filter Bar */}
            <div className="bg-white border border-[#e7e4de] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-mono text-[#77746d] mr-2">Filter Analytics:</span>
                {(['today', '7days', '30days', 'all', 'custom'] as AnalyticsTimeRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setAnalyticsRange(r)}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider font-semibold transition-colors rounded-xs ${
                      analyticsRange === r
                        ? 'bg-[#121210] text-[#f8f7f4]'
                        : 'bg-[#f4f2ee] text-[#77746d] hover:bg-[#e7e4de] hover:text-[#121210]'
                    }`}
                  >
                    {r === 'today' && 'Today'}
                    {r === '7days' && 'Last 7 Days'}
                    {r === '30days' && 'Last 30 Days'}
                    {r === 'all' && 'All Time'}
                    {r === 'custom' && 'Custom Range'}
                  </button>
                ))}
              </div>

              {analyticsRange === 'custom' && (
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="border border-[#e7e4de] px-2 py-1 bg-white text-xs"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="border border-[#e7e4de] px-2 py-1 bg-white text-xs"
                  />
                  <button
                    onClick={() => loadDashboardData()}
                    className="bg-[#c4a66b] text-[#121210] px-3 py-1 text-xs font-semibold uppercase hover:bg-[#b3955a]"
                  >
                    Apply
                  </button>
                </div>
              )}

              <div className="text-[11px] text-[#77746d] font-mono flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#1e7e34]"></span>
                Strict Rule: 100% genuine database metrics (No simulated values)
              </div>
            </div>

            {/* Top Financial Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-[#e7e4de] p-5 shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-[#77746d] font-mono block">Gross Sales ({analyticsRange})</span>
                <span className="text-2xl font-bold font-serif text-[#1e7e34] block mt-1">
                  {formatUSD(realAnalytics.grossSalesCents)}
                </span>
                <span className="text-[10px] text-[#77746d] block mt-1">
                  {realAnalytics.paidOrdersPeriod} paid orders in period
                </span>
              </div>

              <div className="bg-white border border-[#e7e4de] p-5 shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-[#77746d] font-mono block">Confirmed Refunds ({analyticsRange})</span>
                <span className="text-2xl font-bold font-serif text-[#9b1c1c] block mt-1">
                  {formatUSD(realAnalytics.confirmedRefundsCents)}
                </span>
                <span className="text-[10px] text-[#77746d] block mt-1">
                  from confirmed refunded transactions
                </span>
              </div>

              <div className="bg-white border border-[#e7e4de] p-5 shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-[#77746d] font-mono block">Net Sales After Refunds</span>
                <span className="text-2xl font-bold font-serif text-[#121210] block mt-1">
                  {formatUSD(realAnalytics.netSalesCents)}
                </span>
                <span className="text-[10px] text-[#77746d] block mt-1">
                  Calculated: Gross Sales minus Refunds
                </span>
              </div>

              <div className="bg-white border border-[#e7e4de] p-5 shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-[#77746d] font-mono block">Average Order Value (AOV)</span>
                <span className="text-2xl font-bold font-serif text-[#121210] block mt-1">
                  {formatUSD(realAnalytics.averageOrderValueCents)}
                </span>
                <span className="text-[10px] text-[#77746d] block mt-1">
                  Gross Sales / Paid Orders ({realAnalytics.paidOrdersPeriod})
                </span>
              </div>
            </div>

            {/* Funnel & Conversion Analytics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-[#e7e4de] p-5 shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-[#77746d] font-mono block">Checkout Conversion Rate</span>
                <span className="text-2xl font-bold font-serif text-[#121210] block mt-1">
                  {realAnalytics.checkoutConversionRate !== null
                    ? `${realAnalytics.checkoutConversionRate}%`
                    : 'No data available'}
                </span>
                <span className="text-[10px] text-[#77746d] block mt-1">
                  Orders Placed / Checkouts Initiated
                </span>
              </div>

              <div className="bg-white border border-[#e7e4de] p-5 shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-[#77746d] font-mono block">Unique Visitors ({analyticsRange})</span>
                <span className="text-2xl font-bold font-serif text-[#121210] block mt-1">
                  {realAnalytics.uniqueVisitorsPeriod}
                </span>
                <span className="text-[10px] text-[#77746d] block mt-1">
                  First-party visitor sessions tracked
                </span>
              </div>

              <div className="bg-white border border-[#e7e4de] p-5 shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-[#77746d] font-mono block">Active Carts vs Abandoned</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-serif text-[#1e7e34]">{realAnalytics.activeCartsCount}</span>
                  <span className="text-xs text-[#77746d]">active /</span>
                  <span className="text-2xl font-bold font-serif text-[#856404]">{realAnalytics.abandonedCartsCount}</span>
                  <span className="text-xs text-[#77746d]">abandoned</span>
                </div>
                <span className="text-[10px] text-[#77746d] block mt-1">
                  Inactivity threshold: &gt; 60 minutes
                </span>
              </div>

              <div className="bg-white border border-[#e7e4de] p-5 shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-[#77746d] font-mono block">Active Customer Sessions</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-serif text-[#121210]">{realAnalytics.activeAuthenticatedSessions}</span>
                  <span className="text-xs text-[#77746d]">active now</span>
                </div>
                <span className="text-[10px] text-[#77746d] block mt-1">
                  Active within the last 15 minutes
                </span>
              </div>
            </div>

            {/* Pipeline & Catalog Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Order Status Pipeline */}
              <div className="bg-white border border-[#e7e4de] p-6 space-y-4 shadow-xs">
                <h3 className="font-serif text-base text-[#121210] border-b border-[#e7e4de] pb-3 flex justify-between items-center">
                  <span>Orders Pipeline</span>
                  <span className="text-[10px] font-mono text-[#77746d] uppercase">{analyticsRange}</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#77746d]">Total Orders in Period</span>
                    <strong className="font-mono">{realAnalytics.totalOrdersPeriod}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#856404]">Awaiting Bank Verification</span>
                    <span className="bg-[#fff8e6] text-[#856404] px-2 py-0.5 rounded-xs font-mono font-bold">
                      {realAnalytics.pendingOrdersPeriod}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#1e7e34]">Confirmed Paid Orders</span>
                    <span className="bg-[#eef8ee] text-[#1e7e34] px-2 py-0.5 rounded-xs font-mono font-bold">
                      {realAnalytics.paidOrdersPeriod}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#553c9a]">Active Confirmed Fulfilment</span>
                    <span className="bg-[#f0eef8] text-[#553c9a] px-2 py-0.5 rounded-xs font-mono font-bold">
                      {realAnalytics.confirmedOrdersPeriod}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9b1c1c]">Cancelled Orders</span>
                    <span className="bg-[#fdf2f2] text-[#9b1c1c] px-2 py-0.5 rounded-xs font-mono font-bold">
                      {realAnalytics.cancelledOrdersPeriod}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Account Metrics */}
              <div className="bg-white border border-[#e7e4de] p-6 space-y-4 shadow-xs">
                <h3 className="font-serif text-base text-[#121210] border-b border-[#e7e4de] pb-3">
                  Customer Account Analytics
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#77746d]">Total Registered Customers:</span>
                    <strong className="font-mono">{realAnalytics.totalRegisteredCustomers}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#77746d]">New Registrations ({analyticsRange}):</span>
                    <span className="font-mono font-bold text-[#1e7e34]">+{realAnalytics.newRegistrationsPeriod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#77746d]">Active Authenticated Sessions:</span>
                    <span className="font-mono">{realAnalytics.activeAuthenticatedSessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#77746d]">Product Page Views ({analyticsRange}):</span>
                    <span className="font-mono font-bold text-[#121210]">{realAnalytics.productPageViewsPeriod}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('customers')}
                    className="w-full border border-[#121210] text-[#121210] py-2 text-xs uppercase tracking-wider hover:bg-[#121210] hover:text-[#f8f7f4] transition-colors"
                  >
                    View All Registered Customers ({customers.length})
                  </button>
                </div>
              </div>

              {/* Catalog Inventory */}
              <div className="bg-white border border-[#e7e4de] p-6 space-y-4 shadow-xs">
                <h3 className="font-serif text-base text-[#121210] border-b border-[#e7e4de] pb-3">
                  Catalog Inventory
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#77746d]">Active Products:</span>
                    <strong className="font-mono">{stats.products.available}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#856404]">Low Stock (≤ 5):</span>
                    <strong className="font-mono text-[#856404]">{stats.products.lowStock}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b1c1c]">Out of Stock / Coming Soon:</span>
                    <strong className="font-mono text-[#9b1c1c]">{stats.products.outOfStock}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#77746d]">Total Products in Store:</span>
                    <strong className="font-mono">{stats.products.total}</strong>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('products')}
                    className="w-full bg-[#121210] text-[#f8f7f4] py-2 text-xs uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] transition-colors"
                  >
                    Manage Products & Costs
                  </button>
                </div>
              </div>
            </div>

            {/* Product Performance Intelligence: Views vs Cart Adds */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Most Viewed Products */}
              <div className="bg-white border border-[#e7e4de] p-6 space-y-4 shadow-xs">
                <h3 className="font-serif text-base text-[#121210] border-b border-[#e7e4de] pb-3 flex justify-between items-center">
                  <span>Most Viewed Products ({analyticsRange})</span>
                  <span className="text-[10px] font-mono text-[#77746d]">Page Views</span>
                </h3>
                {realAnalytics.mostViewedProducts.length === 0 ? (
                  <p className="text-xs text-[#77746d] italic">No product page views recorded in this period.</p>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    {realAnalytics.mostViewedProducts.map((p, idx) => (
                      <div key={p.productId} className="flex items-center justify-between border-b border-[#e7e4de]/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#a9a69f]">#{idx + 1}</span>
                          <span className="font-semibold text-[#121210]">{p.title}</span>
                        </div>
                        <span className="font-mono bg-[#f0eef8] text-[#553c9a] px-2 py-0.5 rounded-xs font-bold">
                          {p.count} views
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Most Added to Cart */}
              <div className="bg-white border border-[#e7e4de] p-6 space-y-4 shadow-xs">
                <h3 className="font-serif text-base text-[#121210] border-b border-[#e7e4de] pb-3 flex justify-between items-center">
                  <span>Most Added-to-Cart Products ({analyticsRange})</span>
                  <span className="text-[10px] font-mono text-[#77746d]">Units Added</span>
                </h3>
                {realAnalytics.mostAddedToCartProducts.length === 0 ? (
                  <p className="text-xs text-[#77746d] italic">No cart additions recorded in this period.</p>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    {realAnalytics.mostAddedToCartProducts.map((p, idx) => (
                      <div key={p.productId} className="flex items-center justify-between border-b border-[#e7e4de]/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#a9a69f]">#{idx + 1}</span>
                          <span className="font-semibold text-[#121210]">{p.title}</span>
                        </div>
                        <span className="font-mono bg-[#fff8e6] text-[#856404] px-2 py-0.5 rounded-xs font-bold">
                          {p.count} units
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Live Customer Activity Stream Widget */}
            <div className="bg-white border border-[#e7e4de] p-6 space-y-4 shadow-xs">
              <div className="flex justify-between items-center border-b border-[#e7e4de] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1e7e34] animate-pulse"></span>
                  <h3 className="font-serif text-base text-[#121210]">
                    Recent Customer Activity Stream (Live Feed)
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('activity')}
                  className="text-xs text-[#c4a66b] font-semibold hover:underline"
                >
                  View Full Event Stream →
                </button>
              </div>

              {customerEvents.length === 0 ? (
                <p className="text-xs text-[#77746d] italic">No customer events recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-[#e7e4de]/60">
                  {customerEvents.slice(0, 6).map((evt) => (
                    <div key={evt.id} className="pt-2 flex items-start justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3">
                        {getEventBadge(evt.type)}
                        <span className="font-mono text-[10px] text-[#a9a69f]">{evt.id}</span>
                        <span className="text-[#121210]">
                          {evt.customerEmail ? (
                            <strong>{evt.customerEmail}</strong>
                          ) : (
                            <span className="text-[#77746d]">Visitor {evt.sessionId?.slice(0, 10)}</span>
                          )}
                          {evt.metadata?.productTitle && ` · ${evt.metadata.productTitle}`}
                          {evt.metadata?.orderReference && ` · Order ${evt.metadata.orderReference}`}
                          {evt.metadata?.query && ` · Searched "${evt.metadata.query}"`}
                          {evt.metadata?.category && ` · Category: ${evt.metadata.category}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#77746d] font-mono whitespace-nowrap">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. DEDICATED LIVE CUSTOMER ACTIVITY FEED TAB */}
        {activeTab === 'activity' && (
          <LiveActivityPanel
            events={customerEvents}
            isLiveConnected={isLiveConnected}
            onRefresh={loadDashboardData}
          />
        )}

        {/* 3. ORDER MANAGEMENT */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#e7e4de] p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
              <div className="flex-1 w-full max-w-md">
                <input
                  type="text"
                  placeholder="Search reference, customer email, or name..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <select
                  value={orderPaymentFilter}
                  onChange={(e) => setOrderPaymentFilter(e.target.value)}
                  className="border border-[#e7e4de] bg-white px-3 py-2 text-xs"
                >
                  <option value="">All Payment Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="awaiting_verification">Awaiting Verification</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>

                <select
                  value={orderFulfilmentFilter}
                  onChange={(e) => setOrderFulfilmentFilter(e.target.value)}
                  className="border border-[#e7e4de] bg-white px-3 py-2 text-xs"
                >
                  <option value="">All Fulfilment Statuses</option>
                  <option value="unfulfilled">Unfulfilled</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Orders Table */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white border border-[#e7e4de] p-12 text-center text-xs text-[#77746d]">
                No orders found matching the filter criteria.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="bg-white border border-[#e7e4de] p-5 space-y-4 shadow-xs">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#e7e4de] pb-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-base font-bold text-[#121210]">
                            {order.orderReference}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                              order.paymentStatus === 'paid'
                                ? 'bg-[#eef8ee] text-[#1e7e34]'
                                : order.paymentStatus === 'refunded'
                                ? 'bg-[#991b1b] text-white'
                                : order.paymentStatus === 'awaiting_verification'
                                ? 'bg-[#fff8e6] text-[#856404]'
                                : 'bg-[#f4f2ee] text-[#121210]'
                            }`}
                          >
                            Payment: {order.paymentStatus.replace('_', ' ')}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                              order.fulfilmentStatus === 'shipped'
                                ? 'bg-[#f0eef8] text-[#553c9a]'
                                : order.fulfilmentStatus === 'delivered'
                                ? 'bg-[#e6fffa] text-[#234e52]'
                                : order.fulfilmentStatus === 'cancelled'
                                ? 'bg-[#fdf2f2] text-[#9b1c1c]'
                                : 'bg-[#f4f2ee] text-[#121210] border border-[#e7e4de]'
                            }`}
                          >
                            {order.fulfilmentStatus}
                          </span>
                        </div>
                        <div className="text-xs text-[#77746d] mt-1">
                          Placed by <strong className="text-[#121210]">{order.customerName}</strong> ({order.customerEmail}) · Phone: {order.customerPhone || 'N/A'}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded' && (
                          <button
                            onClick={() => handleVerifyPayment(order.id)}
                            className="bg-[#1e7e34] text-white px-3.5 py-1.5 text-xs font-semibold uppercase hover:bg-[#186429] transition-colors"
                          >
                            ✓ Verify Bank Payment
                          </button>
                        )}

                        {order.paymentStatus === 'paid' && (
                          <button
                            onClick={() => {
                              setRefundModalOrder(order);
                              setRefundReason('Customer return request');
                            }}
                            className="bg-[#9b1c1c] text-white px-3 py-1.5 text-xs font-semibold uppercase hover:bg-[#801515] transition-colors"
                          >
                            Issue Refund
                          </button>
                        )}

                        <button
                          onClick={() => openEditOrderModal(order)}
                          className="bg-[#121210] text-[#c4a66b] border border-[#c4a66b] px-3.5 py-1.5 text-xs font-semibold uppercase hover:bg-[#c4a66b] hover:text-[#121210] transition-colors flex items-center gap-1.5"
                          title="Edit customer information, address, lifecycle status, tracking, and notes in real time"
                        >
                          ✏️ Edit Order
                        </button>

                        <button
                          onClick={() => {
                            setShippingModalOrder(order);
                            setShippingCarrier(order.carrier || 'DHL Express');
                            setShippingTrackingNumber(order.trackingNumber || '');
                            setShippingTrackingUrl(order.trackingUrl || '');
                          }}
                          className="border border-[#121210] text-[#121210] px-3.5 py-1.5 text-xs font-semibold uppercase hover:bg-[#121210] hover:text-[#f8f7f4] transition-colors"
                        >
                          📦 Shipping & Tracking
                        </button>

                        <select
                          value={order.fulfilmentStatus}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className="border border-[#e7e4de] px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="unfulfilled">Unfulfilled</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    {/* Customer Bank Transfer Notes */}
                    {order.paymentProofNotes && (
                      <div className="bg-[#fffdfa] border border-[#c4a66b]/40 p-3 text-xs space-y-1">
                        <span className="font-bold text-[#9d8048] block text-[10px] uppercase font-mono">
                          Customer Payment Proof Notes
                        </span>
                        <p className="text-[#121210]">{order.paymentProofNotes}</p>
                      </div>
                    )}

                    {/* Items List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-[#77746d] block mb-2">Order Items:</span>
                        <ul className="space-y-1.5">
                          {order.items.map((it: any, idx: number) => (
                            <li key={idx} className="flex justify-between border-b border-[#e7e4de]/40 pb-1">
                              <span>{it.quantity}x {it.title}</span>
                              <span className="font-mono">{formatUSD(it.totalCents)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-mono text-[#77746d] block">Shipping Address:</span>
                        <p className="text-xs text-[#252521] leading-relaxed">
                          {order.shippingAddress.streetAddress}
                          {order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ''}
                          <br />
                          {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                          <br />
                          {order.shippingAddress.country}
                        </p>
                        <div className="pt-2 flex justify-between font-bold border-t border-[#e7e4de]">
                          <span>Order Total:</span>
                          <span className="font-mono text-sm text-[#1e7e34]">{formatUSD(order.totalCents)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Verification & Tracking Metadata */}
                    <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-[#e7e4de]/40 text-[11px] text-[#77746d]">
                      {order.paymentVerifiedAt && (
                        <span>Verified by {order.paymentVerifiedBy} on {new Date(order.paymentVerifiedAt).toLocaleString()}</span>
                      )}
                      {order.trackingNumber && (
                        <span>Carrier: {order.carrier} | #{order.trackingNumber}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. PRODUCT MANAGEMENT */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl text-[#121210]">VANTÉRA Product Catalogue</h2>
                <p className="text-xs text-[#77746d]">
                  Configure retail prices, verified supplier costs, stock levels, and storefront availability.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsAddingProduct(true);
                  setProductForm({
                    title: '',
                    category: 'phone-cases',
                    retailPrice: '9.99',
                    supplierCost: '3.50',
                    stockQuantity: 30,
                    isAvailable: true,
                    description: '',
                    image: '',
                    supplierName: 'AliExpress Direct',
                    supplierLink: '',
                  });
                }}
                className="bg-[#121210] text-[#f8f7f4] px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210]"
              >
                + Add New Product
              </button>
            </div>

            {/* Products Table */}
            <div className="bg-white border border-[#e7e4de] overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8f7f4] border-b border-[#e7e4de] uppercase text-[10px] text-[#77746d] font-mono">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Retail Price</th>
                    <th className="p-3">Supplier Cost</th>
                    <th className="p-3">Gross Margin</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e4de]">
                  {products.map((p) => {
                    const margin =
                      p.retailPriceCents && p.supplierCostCents
                        ? (((p.retailPriceCents - p.supplierCostCents) / p.retailPriceCents) * 100).toFixed(0)
                        : null;

                    return (
                      <tr key={p.id} className="hover:bg-[#fbfaf7]">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {p.image ? (
                              <img src={p.image} alt="" className="w-8 h-8 object-contain bg-[#f4f2ee] p-1 border border-[#e7e4de]" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-8 h-8 bg-[#f4f2ee] border border-[#e7e4de] flex items-center justify-center font-serif text-[10px]">V</div>
                            )}
                            <div>
                              <strong className="block text-[#121210]">{p.title}</strong>
                              <span className="text-[10px] text-[#77746d] font-mono">{p.slug}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 uppercase text-[10px] font-mono text-[#77746d]">{p.category}</td>
                        <td className="p-3 font-mono font-bold text-[#121210]">{formatUSD(p.retailPriceCents)}</td>
                        <td className="p-3 font-mono text-[#77746d]">{formatUSD(p.supplierCostCents)}</td>
                        <td className="p-3 font-mono">
                          {margin ? (
                            <span className="text-[#1e7e34] font-semibold">{margin}%</span>
                          ) : (
                            <span className="text-[#856404] text-[10px]">Awaiting Cost</span>
                          )}
                        </td>
                        <td className="p-3 font-mono">{p.stockQuantity}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-xs ${
                              p.isAvailable && p.stockQuantity > 0
                                ? 'bg-[#eef8ee] text-[#1e7e34]'
                                : 'bg-[#fdf2f2] text-[#9b1c1c]'
                            }`}
                          >
                            {p.isAvailable && p.stockQuantity > 0 ? 'Active' : 'Unavailable'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setIsAddingProduct(false);
                              setProductForm({
                                title: p.title,
                                category: p.category,
                                retailPrice: (p.retailPriceCents / 100).toFixed(2),
                                supplierCost: p.supplierCostCents ? (p.supplierCostCents / 100).toFixed(2) : '',
                                stockQuantity: p.stockQuantity,
                                isAvailable: p.isAvailable,
                                description: p.description || '',
                                image: p.image || '',
                                supplierName: p.supplierName || 'AliExpress Direct',
                                supplierLink: p.supplierLink || '',
                              });
                            }}
                            className="text-[#121210] font-semibold hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INVENTORY & OVERSOLD PREVENTION */}
        {activeTab === 'inventory' && (
          <InventoryPanel
            products={products}
            adminToken={adminToken}
            onProductUpdated={loadDashboardData}
          />
        )}

        {/* DESTINATION-DEPENDENT SHIPPING ZONES */}
        {activeTab === 'shipping' && (
          <ShippingZonesPanel />
        )}

        {/* 5. SUPPLIER MANAGEMENT */}
        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            <h2 className="font-serif text-2xl text-[#121210]">Supplier & Dropshipping Integrations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {suppliers.map((sup) => (
                <div key={sup.id} className="bg-white border border-[#e7e4de] p-6 space-y-4 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-serif text-base font-bold text-[#121210]">{sup.name}</h3>
                      <span className="text-[10px] text-[#77746d] font-mono block uppercase">{sup.integrationType}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-xs ${
                        sup.status === 'operational'
                          ? 'bg-[#eef8ee] text-[#1e7e34]'
                          : 'bg-[#fff8e6] text-[#856404]'
                      }`}
                    >
                      {sup.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-[#77746d] leading-relaxed">{sup.notes}</p>

                  <div className="pt-2 border-t border-[#e7e4de] text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#a9a69f]">Website:</span>
                      <a href={sup.website} target="_blank" rel="noopener noreferrer" className="text-[#121210] hover:underline">
                        {sup.website}
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#a9a69f]">Contact:</span>
                      <span className="text-[#121210]">{sup.contact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. CUSTOMER MANAGEMENT */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <h2 className="font-serif text-2xl text-[#121210]">Registered Customers ({customers.length})</h2>
            <div className="bg-white border border-[#e7e4de] overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8f7f4] border-b border-[#e7e4de] uppercase text-[10px] text-[#77746d] font-mono">
                  <tr>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Registered Date</th>
                    <th className="p-3">Total Orders</th>
                    <th className="p-3">Total Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e4de]">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-[#fbfaf7]">
                      <td className="p-3 font-bold text-[#121210]">{c.name}</td>
                      <td className="p-3 font-mono text-[#77746d]">{c.email}</td>
                      <td className="p-3 font-mono">{c.phone || 'N/A'}</td>
                      <td className="p-3">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 font-mono">{c.orderCount}</td>
                      <td className="p-3 font-mono font-bold text-[#1e7e34]">
                        {formatUSD(c.totalSpentCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. BANK TRANSFER CONFIGURATION */}
        {activeTab === 'bank' && (
          <div className="max-w-2xl bg-white border border-[#e7e4de] p-8 shadow-xs space-y-6">
            <div>
              <h2 className="font-serif text-2xl text-[#121210]">Business Bank Transfer Details</h2>
              <p className="text-xs text-[#77746d]">
                These details are displayed to customers at checkout and on their order tracking screens.
              </p>
            </div>

            <form onSubmit={handleSaveBankSettings} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Bank Name</label>
                <input
                  type="text"
                  required
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                  className="w-full border border-[#e7e4de] p-2.5 focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Account Name</label>
                <input
                  type="text"
                  required
                  value={bankForm.accountName}
                  onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })}
                  className="w-full border border-[#e7e4de] p-2.5 focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Account Number</label>
                  <input
                    type="text"
                    required
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                    className="w-full border border-[#e7e4de] p-2.5 font-mono focus:border-[#121210] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Sort Code / Swift (Optional)</label>
                  <input
                    type="text"
                    value={bankForm.sortCode}
                    onChange={(e) => setBankForm({ ...bankForm, sortCode: e.target.value })}
                    className="w-full border border-[#e7e4de] p-2.5 font-mono focus:border-[#121210] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Transfer Instructions to Customers</label>
                <textarea
                  rows={3}
                  value={bankForm.instructions}
                  onChange={(e) => setBankForm({ ...bankForm, instructions: e.target.value })}
                  className="w-full border border-[#e7e4de] p-2.5 focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Support WhatsApp</label>
                  <input
                    type="text"
                    value={bankForm.whatsapp}
                    onChange={(e) => setBankForm({ ...bankForm, whatsapp: e.target.value })}
                    className="w-full border border-[#e7e4de] p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Support Email</label>
                  <input
                    type="email"
                    value={bankForm.email}
                    onChange={(e) => setBankForm({ ...bankForm, email: e.target.value })}
                    className="w-full border border-[#e7e4de] p-2.5 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bg-[#121210] text-[#f8f7f4] px-6 py-2.5 text-xs uppercase tracking-wider font-semibold hover:bg-[#c4a66b] hover:text-[#121210]"
              >
                Save Bank Details
              </button>
            </form>
          </div>
        )}

        {/* 8. AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <h2 className="font-serif text-2xl text-[#121210]">Security & Operation Audit Logs</h2>
            <div className="bg-white border border-[#e7e4de] shadow-xs divide-y divide-[#e7e4de] max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 text-xs flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono uppercase text-[10px] font-bold text-[#c4a66b] mr-2">
                      [{log.action}]
                    </span>
                    <strong className="text-[#121210]">{log.actor}</strong>: {log.details}
                  </div>
                  <span className="text-[10px] text-[#77746d] font-mono whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. CUSTOM DOMAIN & HOSTING */}
        {activeTab === 'domain' && (
          <DomainSetupManager />
        )}
      </main>

      {/* Real-Time Order Editor Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white max-w-2xl w-full p-6 border border-[#e7e4de] shadow-2xl space-y-4 text-xs my-8">
            <div className="flex justify-between items-center border-b border-[#e7e4de] pb-3">
              <div>
                <h3 className="font-serif text-base font-bold text-[#121210] flex items-center gap-2">
                  <span>Edit Order: {editingOrder.orderReference}</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live Real-Time Sync
                  </span>
                </h3>
                <p className="text-[11px] text-[#77746d]">
                  Changes saved here immediately update the customer tracking page, database, and CEO analytics feed.
                </p>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="text-[#77746d] hover:text-[#121210] text-sm"
              >
                ✕
              </button>
            </div>

            {orderSaveSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs rounded">
                ✓ {orderSaveSuccess}
              </div>
            )}

            <form onSubmit={handleSaveOrderEdits} className="space-y-4">
              {/* Customer Contact */}
              <div className="space-y-2 border-b border-[#e7e4de] pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-[#c4a66b] block">
                  Customer Contact Information
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Customer Full Name</label>
                    <input
                      type="text"
                      required
                      value={orderEditForm.customerName}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, customerName: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Customer Email</label>
                    <input
                      type="email"
                      required
                      value={orderEditForm.customerEmail}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, customerEmail: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Phone Number</label>
                    <input
                      type="text"
                      value={orderEditForm.customerPhone}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, customerPhone: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="space-y-2 border-b border-[#e7e4de] pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-[#c4a66b] block">
                  Delivery Destination
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Street Address</label>
                    <input
                      type="text"
                      required
                      value={orderEditForm.streetAddress}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, streetAddress: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Apartment / Suite (Optional)</label>
                    <input
                      type="text"
                      value={orderEditForm.apartment}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, apartment: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:col-span-2">
                    <div>
                      <label className="block text-[#77746d] mb-1 font-medium">City</label>
                      <input
                        type="text"
                        required
                        value={orderEditForm.city}
                        onChange={(e) => setOrderEditForm({ ...orderEditForm, city: e.target.value })}
                        className="w-full border border-[#e7e4de] p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[#77746d] mb-1 font-medium">State / Region</label>
                      <input
                        type="text"
                        required
                        value={orderEditForm.state}
                        onChange={(e) => setOrderEditForm({ ...orderEditForm, state: e.target.value })}
                        className="w-full border border-[#e7e4de] p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[#77746d] mb-1 font-medium">Country</label>
                      <input
                        type="text"
                        required
                        value={orderEditForm.country}
                        onChange={(e) => setOrderEditForm({ ...orderEditForm, country: e.target.value })}
                        className="w-full border border-[#e7e4de] p-2"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status & Lifecycle */}
              <div className="space-y-2 border-b border-[#e7e4de] pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-[#c4a66b] block">
                  Payment & Fulfilment Lifecycle
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Payment Status</label>
                    <select
                      value={orderEditForm.paymentStatus}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, paymentStatus: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2 bg-white"
                    >
                      <option value="pending">Pending Payment</option>
                      <option value="awaiting_verification">Awaiting CEO Verification</option>
                      <option value="paid">Paid & Verified</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Fulfilment Status</label>
                    <select
                      value={orderEditForm.fulfilmentStatus}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, fulfilmentStatus: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2 bg-white"
                    >
                      <option value="unfulfilled">Unfulfilled</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tracking & Carrier */}
              <div className="space-y-2 border-b border-[#e7e4de] pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-[#c4a66b] block">
                  Carrier & Live Tracking
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Logistics Carrier</label>
                    <input
                      type="text"
                      value={orderEditForm.carrier}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, carrier: e.target.value })}
                      placeholder="DHL Express, FedEx, GIG..."
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Tracking Number</label>
                    <input
                      type="text"
                      value={orderEditForm.trackingNumber}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, trackingNumber: e.target.value })}
                      placeholder="e.g. 9841284729"
                      className="w-full border border-[#e7e4de] p-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#77746d] mb-1 font-medium">Tracking Web URL</label>
                    <input
                      type="url"
                      value={orderEditForm.trackingUrl}
                      onChange={(e) => setOrderEditForm({ ...orderEditForm, trackingUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full border border-[#e7e4de] p-2 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Customer Order Instructions</label>
                  <textarea
                    rows={2}
                    value={orderEditForm.notes}
                    onChange={(e) => setOrderEditForm({ ...orderEditForm, notes: e.target.value })}
                    placeholder="Notes left by customer during checkout..."
                    className="w-full border border-[#e7e4de] p-2"
                  />
                </div>
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Internal CEO Audit Notes (Private)</label>
                  <textarea
                    rows={2}
                    value={orderEditForm.adminNotes}
                    onChange={(e) => setOrderEditForm({ ...orderEditForm, adminNotes: e.target.value })}
                    placeholder="Private management notes, supplier order ref, etc..."
                    className="w-full border border-[#e7e4de] p-2 bg-[#faf9f5]"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#e7e4de]">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 border border-[#e7e4de]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingOrder}
                  className="bg-[#121210] text-[#f8f7f4] px-6 py-2 uppercase tracking-wider font-semibold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors"
                >
                  {isSavingOrder ? 'Saving...' : 'Save Order Updates (Real-Time)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shipping & Tracking Modal */}
      {shippingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 border border-[#e7e4de] shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#e7e4de] pb-3">
              <h3 className="font-serif text-base font-bold text-[#121210]">
                Record Shipping & Tracking Details
              </h3>
              <button onClick={() => setShippingModalOrder(null)} className="text-[#77746d] hover:text-[#121210]">✕</button>
            </div>
            <p className="text-xs text-[#77746d]">
              Order: <strong className="font-mono text-[#121210]">{shippingModalOrder.orderReference}</strong> for{' '}
              {shippingModalOrder.customerName}
            </p>

            <form onSubmit={handleSaveShipping} className="space-y-3">
              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Logistics Carrier</label>
                <input
                  type="text"
                  required
                  value={shippingCarrier}
                  onChange={(e) => setShippingCarrier(e.target.value)}
                  placeholder="e.g. DHL Express, FedEx, GIG Logistics"
                  className="w-full border border-[#e7e4de] p-2"
                />
              </div>

              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Tracking Number</label>
                <input
                  type="text"
                  required
                  value={shippingTrackingNumber}
                  onChange={(e) => setShippingTrackingNumber(e.target.value)}
                  placeholder="e.g. 9841284729"
                  className="w-full border border-[#e7e4de] p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Carrier Tracking URL (Optional)</label>
                <input
                  type="url"
                  value={shippingTrackingUrl}
                  onChange={(e) => setShippingTrackingUrl(e.target.value)}
                  placeholder="https://www.dhl.com/track?num=..."
                  className="w-full border border-[#e7e4de] p-2 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShippingModalOrder(null)}
                  className="px-4 py-2 border border-[#e7e4de]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#121210] text-[#f8f7f4] px-5 py-2 uppercase tracking-wider font-semibold hover:bg-[#c4a66b] hover:text-[#121210]"
                >
                  Save & Notify Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Refund Modal */}
      {refundModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 border border-[#e7e4de] shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#e7e4de] pb-3">
              <h3 className="font-serif text-base font-bold text-[#9b1c1c]">
                Confirm Order Refund
              </h3>
              <button onClick={() => setRefundModalOrder(null)} className="text-[#77746d] hover:text-[#121210]">✕</button>
            </div>
            <p className="text-xs text-[#252521]">
              Are you sure you want to confirm refund for order <strong className="font-mono text-[#121210]">{refundModalOrder.orderReference}</strong>?
            </p>
            <div className="p-3 bg-[#fdf2f2] border border-[#f8b4b4] text-[#9b1c1c] font-mono text-sm font-bold flex justify-between">
              <span>Refund Amount:</span>
              <span>{formatUSD(refundModalOrder.totalCents)}</span>
            </div>

            <form onSubmit={handleConfirmRefund} className="space-y-3">
              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Refund Audit Reason</label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Returned item received / Customer bank transfer reversal"
                  className="w-full border border-[#e7e4de] p-2"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRefundModalOrder(null)}
                  className="px-4 py-2 border border-[#e7e4de]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRefunding}
                  className="bg-[#9b1c1c] text-white px-5 py-2 uppercase tracking-wider font-semibold hover:bg-[#801515] transition-colors"
                >
                  {isRefunding ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Add Product Modal */}
      {(editingProduct || isAddingProduct) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white max-w-lg w-full p-6 border border-[#e7e4de] shadow-2xl space-y-4 text-xs my-8">
            <div className="flex justify-between items-center border-b border-[#e7e4de] pb-3">
              <h3 className="font-serif text-base font-bold text-[#121210]">
                {editingProduct ? `Edit: ${editingProduct.title}` : 'Add New Product'}
              </h3>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsAddingProduct(false);
                }}
                className="text-[#77746d] hover:text-[#121210]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Product Title *</label>
                <input
                  type="text"
                  required
                  value={productForm.title}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                  className="w-full border border-[#e7e4de] p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full border border-[#e7e4de] p-2 bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.stockQuantity}
                    onChange={(e) => setProductForm({ ...productForm, stockQuantity: parseInt(e.target.value, 10) || 0 })}
                    className="w-full border border-[#e7e4de] p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Retail Price (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.retailPrice}
                    onChange={(e) => setProductForm({ ...productForm, retailPrice: e.target.value })}
                    className="w-full border border-[#e7e4de] p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Supplier Cost (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.supplierCost}
                    onChange={(e) => setProductForm({ ...productForm, supplierCost: e.target.value })}
                    className="w-full border border-[#e7e4de] p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Description</label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full border border-[#e7e4de] p-2"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[#77746d] font-medium">Product Photography (URL or Image Path)</label>
                  {!productForm.image && (
                    <button
                      type="button"
                      onClick={() => {
                        const samples: Record<string, string> = {
                          'phone-cases': 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&w=800&q=80',
                          'charging': 'https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=800&q=80',
                          'audio': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
                          'photography': 'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=800&q=80',
                          'room-desk': 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
                          'computer': 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
                        };
                        const suggested = samples[productForm.category] || samples['phone-cases'];
                        setProductForm({ ...productForm, image: suggested });
                      }}
                      className="text-[11px] text-[#c4a66b] hover:underline font-mono"
                    >
                      ✨ Auto-Suggest Luxury Photo
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={productForm.image}
                  onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                  placeholder="https://images.unsplash.com/... or /manus-storage/..."
                  className="w-full border border-[#e7e4de] p-2 font-mono text-[11px]"
                />
                {productForm.image && (
                  <div className="mt-2 p-2 bg-[#f8f7f4] border border-[#e7e4de] rounded flex items-center gap-3">
                    <img
                      src={productForm.image}
                      alt="Product preview"
                      className="h-12 w-12 object-cover rounded border border-[#e7e4de]"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/products/charging-phone-stand.jpg';
                      }}
                    />
                    <div className="text-[11px] text-[#77746d] font-mono truncate">
                      <span className="text-emerald-600 font-bold block">✓ Live Image Preview</span>
                      <span className="truncate">{productForm.image}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="avail-toggle"
                  checked={productForm.isAvailable}
                  onChange={(e) => setProductForm({ ...productForm, isAvailable: e.target.checked })}
                />
                <label htmlFor="avail-toggle" className="text-xs text-[#121210]">
                  Product is Available for Storefront Ordering
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#e7e4de]">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsAddingProduct(false);
                  }}
                  className="px-4 py-2 border border-[#e7e4de]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#121210] text-[#f8f7f4] px-5 py-2 uppercase tracking-wider font-semibold hover:bg-[#c4a66b] hover:text-[#121210]"
                >
                  Save Product Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Status Toast Notification */}
      {statusToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[#121210] text-[#f8f7f4] border border-[#2e2e2a] shadow-2xl rounded-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className={`w-2 h-2 rounded-full ${statusToast.type === 'error' ? 'bg-rose-500' : statusToast.type === 'success' ? 'bg-emerald-500' : 'bg-[#c4a66b]'}`}></span>
          <span className="text-xs font-mono">{statusToast.message}</span>
          <button
            onClick={() => setStatusToast(null)}
            className="text-gray-400 hover:text-white text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
