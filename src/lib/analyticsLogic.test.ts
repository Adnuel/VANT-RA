import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRealAnalytics,
  getTimeRangeDates,
} from './analyticsLogic.ts';
import type {
  StoredUser,
  StoredOrder,
  TrackedEvent,
  StoredCart,
  VisitorSession,
} from './analyticsLogic.ts';

test('calculateRealAnalytics returns zero metrics when database is empty (no fake data)', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');
  const result = calculateRealAnalytics({
    range: 'today',
    now,
    users: [],
    orders: [],
    events: [],
    carts: [],
    visitorSessions: [],
  });

  assert.equal(result.totalRegisteredCustomers, 0);
  assert.equal(result.newRegistrationsPeriod, 0);
  assert.equal(result.activeAuthenticatedSessions, 0);
  assert.equal(result.uniqueVisitorsPeriod, 0);
  assert.equal(result.productPageViewsPeriod, 0);
  assert.equal(result.mostViewedProducts.length, 0);
  assert.equal(result.mostAddedToCartProducts.length, 0);
  assert.equal(result.activeCartsCount, 0);
  assert.equal(result.abandonedCartsCount, 0);
  assert.equal(result.totalOrdersPeriod, 0);
  assert.equal(result.pendingOrdersPeriod, 0);
  assert.equal(result.paidOrdersPeriod, 0);
  assert.equal(result.grossSalesCents, 0);
  assert.equal(result.confirmedRefundsCents, 0);
  assert.equal(result.netSalesCents, 0);
  assert.equal(result.averageOrderValueCents, 0);
  assert.equal(result.checkoutConversionRate, null);
});

test('calculateRealAnalytics accurately calculates gross sales, refunds, net sales and conversion', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');
  const users: StoredUser[] = [
    { id: 'u1', email: 'c1@example.com', name: 'Client 1', role: 'customer', createdAt: '2026-10-15T09:00:00.000Z' },
    { id: 'u2', email: 'c2@example.com', name: 'Client 2', role: 'customer', createdAt: '2026-10-10T09:00:00.000Z' },
  ];

  const orders: StoredOrder[] = [
    {
      id: 'o1',
      orderReference: 'VAN-2026-1001',
      customerId: 'u1',
      customerEmail: 'c1@example.com',
      customerName: 'Client 1',
      paymentStatus: 'paid',
      fulfilmentStatus: 'shipped',
      totalCents: 1500, // $15.00
      subtotalCents: 1000,
      shippingFeeCents: 500,
      supplierCostTotalCents: 400,
      createdAt: '2026-10-15T10:00:00.000Z',
      updatedAt: '2026-10-15T10:00:00.000Z',
      items: [{ productId: 'p1', slug: 'p1', title: 'Case', unitPriceCents: 1000, quantity: 1, supplierCostCents: 400 }],
    },
    {
      id: 'o2',
      orderReference: 'VAN-2026-1002',
      customerId: 'u2',
      customerEmail: 'c2@example.com',
      customerName: 'Client 2',
      paymentStatus: 'refunded',
      fulfilmentStatus: 'cancelled',
      totalCents: 500, // $5.00 refund
      subtotalCents: 500,
      shippingFeeCents: 0,
      supplierCostTotalCents: 200,
      createdAt: '2026-10-15T11:00:00.000Z',
      updatedAt: '2026-10-15T11:00:00.000Z',
      items: [{ productId: 'p2', slug: 'p2', title: 'Cable', unitPriceCents: 500, quantity: 1, supplierCostCents: 200 }],
    },
  ];

  const events: TrackedEvent[] = [
    { id: 'e1', type: 'product_viewed', timestamp: '2026-10-15T09:30:00.000Z', status: 'success', metadata: { productId: 'p1', productTitle: 'Case' } },
    { id: 'e2', type: 'product_viewed', timestamp: '2026-10-15T09:35:00.000Z', status: 'success', metadata: { productId: 'p1', productTitle: 'Case' } },
    { id: 'e3', type: 'cart_item_added', timestamp: '2026-10-15T09:40:00.000Z', status: 'success', metadata: { productId: 'p1', productTitle: 'Case', quantity: 1 } },
    { id: 'e4', type: 'checkout_initiated', timestamp: '2026-10-15T09:50:00.000Z', status: 'success' },
    { id: 'e5', type: 'order_placed', timestamp: '2026-10-15T10:00:00.000Z', status: 'success' },
  ];

  const carts: StoredCart[] = [
    {
      id: 'cart_active',
      itemCount: 1,
      subtotalCents: 1000,
      createdAt: '2026-10-15T11:45:00.000Z',
      updatedAt: '2026-10-15T11:45:00.000Z', // 15 mins ago -> active (< 60m)
      items: [{ productId: 'p1', quantity: 1 }],
    },
    {
      id: 'cart_abandoned',
      itemCount: 2,
      subtotalCents: 2000,
      createdAt: '2026-10-15T08:00:00.000Z',
      updatedAt: '2026-10-15T08:00:00.000Z', // 4 hours ago -> abandoned (> 60m)
      items: [{ productId: 'p2', quantity: 2 }],
    },
  ];

  const visitorSessions: VisitorSession[] = [
    { sessionId: 's1', firstSeen: '2026-10-15T09:00:00.000Z', lastActive: '2026-10-15T11:55:00.000Z', authenticatedUserId: 'u1', pageViews: 5 },
    { sessionId: 's2', firstSeen: '2026-10-15T08:00:00.000Z', lastActive: '2026-10-15T08:30:00.000Z', authenticatedUserId: null, pageViews: 2 },
  ];

  const result = calculateRealAnalytics({
    range: 'today',
    now,
    users,
    orders,
    events,
    carts,
    visitorSessions,
  });

  assert.equal(result.totalRegisteredCustomers, 2);
  assert.equal(result.newRegistrationsPeriod, 1); // u1 created today
  assert.equal(result.activeAuthenticatedSessions, 1); // s1 active 5 mins ago
  assert.equal(result.uniqueVisitorsPeriod, 2);
  assert.equal(result.productPageViewsPeriod, 2);
  assert.equal(result.mostViewedProducts[0].productId, 'p1');
  assert.equal(result.mostViewedProducts[0].count, 2);
  assert.equal(result.mostAddedToCartProducts[0].productId, 'p1');
  assert.equal(result.activeCartsCount, 1);
  assert.equal(result.abandonedCartsCount, 1);
  assert.equal(result.totalOrdersPeriod, 2);
  assert.equal(result.paidOrdersPeriod, 1);
  assert.equal(result.grossSalesCents, 1500);
  assert.equal(result.confirmedRefundsCents, 500);
  assert.equal(result.netSalesCents, 1000);
  assert.equal(result.averageOrderValueCents, 1500);
  assert.equal(result.checkoutConversionRate, 100);
});

test('getTimeRangeDates calculates correct boundaries for today and 7days', () => {
  const now = new Date('2026-10-15T15:30:00.000Z');
  const todayRange = getTimeRangeDates('today', undefined, undefined, now);
  assert.equal(todayRange.startDate.getDate(), 15);
  assert.equal(todayRange.startDate.getHours(), 0);

  const sevenDaysRange = getTimeRangeDates('7days', undefined, undefined, now);
  const diffDays = Math.round((sevenDaysRange.endDate.getTime() - sevenDaysRange.startDate.getTime()) / (24 * 3600 * 1000));
  assert.equal(diffDays, 7);
});
