/**
 * VANTÉRA CEO Real-Time Analytics & Audit Logic
 * STRICT RULE: Never invent, simulate, randomly generate, or hardcode business statistics.
 * If a metric has no data, return 0 or undefined.
 */

export interface TrackedEvent {
  id: string;
  type: string;
  timestamp: string; // ISO 8601
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  sessionId?: string | null;
  status: 'success' | 'pending' | 'failed' | 'completed';
  metadata?: Record<string, any>;
}

export interface StoredOrder {
  id: string;
  orderReference: string;
  customerId: string | null;
  customerEmail: string;
  customerName: string;
  paymentStatus: 'pending' | 'awaiting_verification' | 'paid' | 'failed' | 'refunded';
  fulfilmentStatus: 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalCents: number;
  subtotalCents: number;
  shippingFeeCents: number;
  supplierCostTotalCents: number | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    productId: string;
    slug: string;
    title: string;
    unitPriceCents: number;
    quantity: number;
    supplierCostCents: number | null;
  }>;
}

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
  createdAt: string;
}

export interface StoredCart {
  id: string;
  customerId?: string | null;
  customerEmail?: string | null;
  sessionId?: string | null;
  itemCount: number;
  subtotalCents: number;
  updatedAt: string;
  createdAt: string;
  items: Array<{
    productId: string;
    quantity: number;
    retailPriceCents?: number;
  }>;
}

export interface VisitorSession {
  sessionId: string;
  firstSeen: string;
  lastActive: string;
  authenticatedUserId?: string | null;
  pageViews: number;
}

export type AnalyticsTimeRange = 'today' | '7days' | '30days' | 'all' | 'custom';

export interface DateFilterRange {
  startDate: Date;
  endDate: Date;
}

export interface RealAnalyticsSummary {
  range: AnalyticsTimeRange;
  startDateIso: string;
  endDateIso: string;
  totalRegisteredCustomers: number;
  newRegistrationsPeriod: number;
  activeAuthenticatedSessions: number;
  uniqueVisitorsPeriod: number;
  productPageViewsPeriod: number;
  mostViewedProducts: Array<{ productId: string; title: string; count: number }>;
  mostAddedToCartProducts: Array<{ productId: string; title: string; count: number }>;
  activeCartsCount: number;
  abandonedCartsCount: number;
  totalOrdersPeriod: number;
  pendingOrdersPeriod: number;
  confirmedOrdersPeriod: number;
  cancelledOrdersPeriod: number;
  paidOrdersPeriod: number;
  grossSalesCents: number;
  confirmedRefundsCents: number;
  netSalesCents: number;
  averageOrderValueCents: number;
  checkoutConversionRate: number | null; // null if 0 checkouts initiated
}

/**
 * Calculates start and end timestamps for a named filter range.
 */
export function getTimeRangeDates(
  range: AnalyticsTimeRange,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date()
): DateFilterRange {
  const end = customEnd ? new Date(customEnd) : new Date(now);

  if (range === 'custom' && customStart) {
    return { startDate: new Date(customStart), endDate: end };
  }

  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { startDate: start, endDate: end };
  }

  if (range === '7days') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { startDate: start, endDate: end };
  }

  if (range === '30days') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: start, endDate: end };
  }

  // 'all' time: beginning of epoch
  return { startDate: new Date(0), endDate: end };
}

/**
 * Pure calculation of real CEO dashboard metrics with zero simulated data.
 */
export function calculateRealAnalytics(params: {
  range: AnalyticsTimeRange;
  customStart?: string;
  customEnd?: string;
  now?: Date;
  users: StoredUser[];
  orders: StoredOrder[];
  events: TrackedEvent[];
  carts: StoredCart[];
  visitorSessions: VisitorSession[];
  inactivityThresholdMinutes?: number;
}): RealAnalyticsSummary {
  const now = params.now || new Date();
  const { startDate, endDate } = getTimeRangeDates(
    params.range,
    params.customStart,
    params.customEnd,
    now
  );

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  const isWithinPeriod = (timestampIso: string) => {
    const t = new Date(timestampIso).getTime();
    return t >= startMs && t <= endMs;
  };

  // 1. Customers
  const customerUsers = params.users.filter((u) => u.role === 'customer');
  const totalRegisteredCustomers = customerUsers.length;
  const newRegistrationsPeriod = customerUsers.filter((u) => isWithinPeriod(u.createdAt)).length;

  // Active authenticated sessions: users active within last 15 minutes
  const activeSessionThresholdMs = now.getTime() - 15 * 60 * 1000;
  const activeAuthenticatedSessions = params.visitorSessions.filter((s) => {
    return s.authenticatedUserId && new Date(s.lastActive).getTime() >= activeSessionThresholdMs;
  }).length;

  // 2. Unique visitors in period
  const uniqueVisitorsPeriod = params.visitorSessions.filter((s) => {
    const lastActiveMs = new Date(s.lastActive).getTime();
    return lastActiveMs >= startMs && lastActiveMs <= endMs;
  }).length;

  // 3. Events within period
  const periodEvents = params.events.filter((e) => isWithinPeriod(e.timestamp));

  // Product page views
  const productViewEvents = periodEvents.filter((e) => e.type === 'product_viewed');
  const productPageViewsPeriod = productViewEvents.length;

  // Most viewed products
  const viewsMap = new Map<string, { title: string; count: number }>();
  for (const evt of productViewEvents) {
    const pid = evt.metadata?.productId || 'unknown';
    const title = evt.metadata?.productTitle || pid;
    const existing = viewsMap.get(pid) || { title, count: 0 };
    existing.count += 1;
    viewsMap.set(pid, existing);
  }
  const mostViewedProducts = Array.from(viewsMap.entries())
    .map(([productId, val]) => ({ productId, title: val.title, count: val.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Most frequently added to cart
  const addToCartEvents = periodEvents.filter((e) => e.type === 'cart_item_added');
  const cartAddsMap = new Map<string, { title: string; count: number }>();
  for (const evt of addToCartEvents) {
    const pid = evt.metadata?.productId || 'unknown';
    const title = evt.metadata?.productTitle || pid;
    const existing = cartAddsMap.get(pid) || { title, count: 0 };
    existing.count += (evt.metadata?.quantity || 1);
    cartAddsMap.set(pid, existing);
  }
  const mostAddedToCartProducts = Array.from(cartAddsMap.entries())
    .map(([productId, val]) => ({ productId, title: val.title, count: val.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 4. Carts: Active vs Abandoned
  const thresholdMins = params.inactivityThresholdMinutes ?? 60;
  const abandonThresholdMs = now.getTime() - thresholdMins * 60 * 1000;

  // Carts currently containing products
  const cartsWithItems = params.carts.filter((c) => c.itemCount > 0);
  const activeCartsCount = cartsWithItems.filter((c) => {
    const updateMs = new Date(c.updatedAt).getTime();
    return updateMs >= abandonThresholdMs;
  }).length;

  const abandonedCartsCount = cartsWithItems.filter((c) => {
    const updateMs = new Date(c.updatedAt).getTime();
    return updateMs < abandonThresholdMs;
  }).length;

  // 5. Orders in period
  const periodOrders = params.orders.filter((o) => isWithinPeriod(o.createdAt));
  const totalOrdersPeriod = periodOrders.length;
  const pendingOrdersPeriod = periodOrders.filter(
    (o) => o.paymentStatus === 'pending' || o.paymentStatus === 'awaiting_verification'
  ).length;
  const paidOrdersList = periodOrders.filter((o) => o.paymentStatus === 'paid');
  const paidOrdersPeriod = paidOrdersList.length;
  const confirmedOrdersPeriod = periodOrders.filter(
    (o) => o.paymentStatus === 'paid' && o.fulfilmentStatus !== 'cancelled'
  ).length;
  const cancelledOrdersPeriod = periodOrders.filter(
    (o) => o.fulfilmentStatus === 'cancelled'
  ).length;

  // 6. Finances in period
  const grossSalesCents = paidOrdersList.reduce((sum, o) => sum + o.totalCents, 0);
  const refundedOrdersList = periodOrders.filter((o) => o.paymentStatus === 'refunded');
  const confirmedRefundsCents = refundedOrdersList.reduce((sum, o) => sum + o.totalCents, 0);
  const netSalesCents = grossSalesCents - confirmedRefundsCents;

  const averageOrderValueCents =
    paidOrdersPeriod > 0 ? Math.round(grossSalesCents / paidOrdersPeriod) : 0;

  // 7. Checkout Conversion Rate
  const checkoutsInitiated = periodEvents.filter((e) => e.type === 'checkout_initiated').length;
  const ordersPlaced = periodEvents.filter((e) => e.type === 'order_placed').length;

  let checkoutConversionRate: number | null = null;
  if (checkoutsInitiated > 0) {
    checkoutConversionRate = Math.min(
      100,
      parseFloat(((ordersPlaced / checkoutsInitiated) * 100).toFixed(1))
    );
  } else if (ordersPlaced > 0) {
    // If order placed without checkout_initiated event, set to 100%
    checkoutConversionRate = 100.0;
  }

  return {
    range: params.range,
    startDateIso: startDate.toISOString(),
    endDateIso: endDate.toISOString(),
    totalRegisteredCustomers,
    newRegistrationsPeriod,
    activeAuthenticatedSessions,
    uniqueVisitorsPeriod,
    productPageViewsPeriod,
    mostViewedProducts,
    mostAddedToCartProducts,
    activeCartsCount,
    abandonedCartsCount,
    totalOrdersPeriod,
    pendingOrdersPeriod,
    confirmedOrdersPeriod,
    cancelledOrdersPeriod,
    paidOrdersPeriod,
    grossSalesCents,
    confirmedRefundsCents,
    netSalesCents,
    averageOrderValueCents,
    checkoutConversionRate,
  };
}
