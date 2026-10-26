import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRealAnalytics } from '../src/lib/analyticsLogic.ts';
import { calculateOrderTotals, calculateCouponDiscount } from '../src/lib/commerceLogic.ts';

test('Cart calculations: Accurate pricing, line totals, and shipping threshold logic', () => {
  const catalog = new Map([
    ['p1', { id: 'p1', slug: 'p1', title: 'Luxury Cable', retailPriceCents: 2000, supplierCostCents: 600, stockQuantity: 50, isAvailable: true }],
    ['p2', { id: 'p2', slug: 'p2', title: 'Wireless Pad', retailPriceCents: 3500, supplierCostCents: 1200, stockQuantity: 30, isAvailable: true }],
  ]);

  // Subtotal $55.00 >= $50.00 free shipping
  const cartAboveThreshold = [
    { productId: 'p1', slug: 'p1', quantity: 1 },
    { productId: 'p2', slug: 'p2', quantity: 1 },
  ];

  const totalsFreeShipping = calculateOrderTotals(cartAboveThreshold, catalog, 0);
  assert.equal(totalsFreeShipping.subtotalCents, 5500);
  assert.equal(totalsFreeShipping.shippingFeeCents, 0);
  assert.equal(totalsFreeShipping.totalCents, 5500);

  // Subtotal $20.00 < $50.00 -> $5.00 shipping fee
  const cartBelowThreshold = [
    { productId: 'p1', slug: 'p1', quantity: 1 },
  ];

  const totalsWithShipping = calculateOrderTotals(cartBelowThreshold, catalog, 500);
  assert.equal(totalsWithShipping.subtotalCents, 2000);
  assert.equal(totalsWithShipping.shippingFeeCents, 500);
  assert.equal(totalsWithShipping.totalCents, 2500);
});

test('Coupon calculations: Fixed and percentage discounts apply correctly', () => {
  // 10% off $50.00 (5000 cents) -> $5.00 (500 cents)
  const pctDiscount = calculateCouponDiscount(5000, {
    type: 'percentage',
    discountValue: 10,
  });
  assert.equal(pctDiscount, 500);

  // $15.00 off $100.00 -> $15.00
  const fixedDiscount = calculateCouponDiscount(10000, {
    type: 'fixed',
    discountValue: 1500,
  });
  assert.equal(fixedDiscount, 1500);
});

test('Real CEO Analytics: Pure database aggregation without any simulated values', () => {
  const orders: any[] = [
    { id: '1', paymentStatus: 'paid', totalCents: 10000, createdAt: new Date().toISOString() },
    { id: '2', paymentStatus: 'paid', totalCents: 5000, createdAt: new Date().toISOString() },
    { id: '3', paymentStatus: 'refunded', totalCents: 3000, createdAt: new Date().toISOString() },
    { id: '4', paymentStatus: 'pending', totalCents: 4000, createdAt: new Date().toISOString() },
  ];

  const events: any[] = [
    { type: 'product_viewed', timestamp: new Date().toISOString() },
    { type: 'product_viewed', timestamp: new Date().toISOString() },
    { type: 'checkout_initiated', timestamp: new Date().toISOString() },
    { type: 'order_placed', timestamp: new Date().toISOString() },
    { type: 'order_placed', timestamp: new Date().toISOString() },
  ];

  const analytics = calculateRealAnalytics({
    range: 'today',
    orders,
    events,
    users: [
      { id: 'u1', email: 'c1@example.com', name: 'Customer 1', role: 'customer', createdAt: new Date().toISOString() },
      { id: 'u2', email: 'c2@example.com', name: 'Customer 2', role: 'customer', createdAt: new Date().toISOString() },
    ],
    carts: [],
    visitorSessions: [],
  });

  assert.equal(analytics.totalOrdersPeriod, 4); // 4 total orders in period (2 paid, 1 refunded, 1 pending)
  assert.equal(analytics.paidOrdersPeriod, 2);
  assert.equal(analytics.grossSalesCents, 15000); // 10000 + 5000
  assert.equal(analytics.confirmedRefundsCents, 3000);
  assert.equal(analytics.netSalesCents, 12000); // 15000 - 3000
});
