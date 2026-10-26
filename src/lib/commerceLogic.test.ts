import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatUSD,
  formatNGN,
  convertUsdCentsToNgn,
  formatPrice,
  calculateCouponDiscount,
  isValidPassword,
  generateOrderReference,
  calculateOrderTotals,
  canCustomerAccessOrder,
  calculateBusinessProfits,
} from './commerceLogic.ts';
import type { CatalogProduct } from './commerceLogic.ts';

test('formatUSD formats cents correctly', () => {
  assert.equal(formatUSD(799), '$7.99');
  assert.equal(formatUSD(1099), '$10.99');
  assert.equal(formatUSD(0), '$0.00');
  assert.equal(formatUSD(null), 'Price on inquiry');
});

test('generateOrderReference produces standard VANTÉRA format', () => {
  const ref = generateOrderReference(4521);
  assert.equal(ref, 'VAN-2026-4521');
  const randRef = generateOrderReference();
  assert.match(randRef, /^VAN-2026-\d{4}$/);
});

test('calculateOrderTotals computes accurate server-authoritative totals', () => {
  const catalog = new Map<string, CatalogProduct>([
    [
      'clear-phone-case',
      {
        id: 'clear-phone-case',
        slug: 'clear-phone-case',
        title: 'Clear Phone Case',
        retailPriceCents: 799,
        supplierCostCents: 199,
        stockQuantity: 50,
        isAvailable: true,
      },
    ],
    [
      'usb-c-charging-cable',
      {
        id: 'usb-c-charging-cable',
        slug: 'usb-c-charging-cable',
        title: 'USB-C Charging Cable',
        retailPriceCents: 699,
        supplierCostCents: 150,
        stockQuantity: 20,
        isAvailable: true,
      },
    ],
    [
      'out-of-stock-item',
      {
        id: 'out-of-stock-item',
        slug: 'out-of-stock-item',
        title: 'Out of Stock Item',
        retailPriceCents: 999,
        supplierCostCents: 300,
        stockQuantity: 0,
        isAvailable: false,
      },
    ],
  ]);

  const result = calculateOrderTotals(
    [
      { productId: 'clear-phone-case', slug: 'clear-phone-case', quantity: 2 },
      { productId: 'usb-c-charging-cable', slug: 'usb-c-charging-cable', quantity: 1 },
    ],
    catalog,
    500 // $5 shipping
  );

  assert.equal(result.subtotalCents, 799 * 2 + 699); // 1598 + 699 = 2297
  assert.equal(result.totalCents, 2297 + 500); // 2797 ($27.97)
  assert.equal(result.itemCount, 3);
  assert.equal(result.items.length, 2);

  // Reject unavailable product
  assert.throws(() => {
    calculateOrderTotals([{ productId: 'out-of-stock-item', slug: 'out-of-stock-item', quantity: 1 }], catalog);
  }, /not currently available/);
});

test('canCustomerAccessOrder strictly isolates customer order data', () => {
  const customerA = { id: 'usr_1', email: 'alice@example.com', role: 'customer' };
  const customerB = { id: 'usr_2', email: 'bob@example.com', role: 'customer' };
  const ceoAdnuel = { id: 'usr_ceo', email: 'emmanueladarikwu@gmail.com', role: 'admin' };
  const imposterAdmin = { id: 'usr_fake', email: 'attacker@example.com', role: 'admin' };

  const orderA = { customerId: 'usr_1', customerEmail: 'alice@example.com' };

  // Customer A can view own order
  assert.equal(canCustomerAccessOrder(customerA, orderA), true);
  // Customer B cannot view Customer A order
  assert.equal(canCustomerAccessOrder(customerB, orderA), false);
  // CEO Adnuel can view any order
  assert.equal(canCustomerAccessOrder(ceoAdnuel, orderA), true);
  // Fake admin email cannot view order as admin
  assert.equal(canCustomerAccessOrder(imposterAdmin, orderA), false);
});

test('calculateBusinessProfits flags missing supplier costs and ignores unpaid orders', () => {
  const orders = [
    {
      paymentStatus: 'pending',
      totalCents: 5000,
      items: [{ quantity: 1, supplierCostCents: 1000 }],
    },
    {
      paymentStatus: 'paid',
      totalCents: 3000,
      shippingFeeCents: 500,
      items: [
        { quantity: 2, supplierCostCents: 500 }, // 1000 cost
      ],
    },
    {
      paymentStatus: 'paid',
      totalCents: 2000,
      shippingFeeCents: 0,
      items: [
        { quantity: 1, supplierCostCents: null }, // unverified cost!
      ],
    },
    {
      paymentStatus: 'refunded',
      totalCents: 1000,
      items: [{ quantity: 1, supplierCostCents: 200 }],
    },
  ];

  const metrics = calculateBusinessProfits(orders);
  assert.equal(metrics.totalSalesCents, 11000); // 5000 + 3000 + 2000 + 1000
  assert.equal(metrics.paidSalesCents, 5000); // 3000 + 2000
  assert.equal(metrics.supplierExpensesCents, 1000); // 500 * 2
  assert.equal(metrics.shippingExpensesCents, 500);
  assert.equal(metrics.refundsCents, 1000);
  assert.equal(metrics.grossProfitCents, 4000); // 5000 - 1000
  assert.equal(metrics.estimatedNetProfitCents, 2500); // 4000 - 500 - 1000
  assert.equal(metrics.unverifiedCostItemCount, 1);
  assert.equal(metrics.hasIncompleteCostData, true);
});

test('formatNGN and convertUsdCentsToNgn compute accurate Naira values', () => {
  // $10.00 (1000 cents) at 1 USD = 1500 NGN -> ₦15,000
  const naira = convertUsdCentsToNgn(1000, 1500);
  assert.equal(naira, 15000);
  assert.match(formatNGN(15000), /15,000/);

  // formatPrice switches dynamically
  assert.equal(formatPrice(1000, 'USD', 1500), '$10.00');
  assert.match(formatPrice(1000, 'NGN', 1500), /15,000/);
});

test('calculateCouponDiscount computes percentage and fixed discounts accurately', () => {
  // 10% off $50 ($5.00 discount)
  const pctDiscount = calculateCouponDiscount(5000, {
    type: 'percentage',
    discountValue: 10,
  });
  assert.equal(pctDiscount, 500);

  // Minimum spend threshold not met
  const minSpendMiss = calculateCouponDiscount(2000, {
    type: 'percentage',
    discountValue: 15,
    minSpendCents: 3000,
  });
  assert.equal(minSpendMiss, 0);

  // Fixed $10 off $50
  const fixedDiscount = calculateCouponDiscount(5000, {
    type: 'fixed',
    discountValue: 1000,
  });
  assert.equal(fixedDiscount, 1000);
});

test('isValidPassword enforces 8 character minimum requirement', () => {
  assert.equal(isValidPassword('short').valid, false);
  assert.equal(isValidPassword('securePass123!').valid, true);
});

test('order totals calculate correctly when discounts and shipping thresholds apply', () => {
  const catalog = new Map([
    ['p1', { id: 'p1', slug: 'p1', title: 'Luxury Cable', retailPriceCents: 2000, supplierCostCents: 500, stockQuantity: 20, isAvailable: true }],
  ]);
  const totals = calculateOrderTotals(
    [{ productId: 'p1', slug: 'p1', quantity: 2 }],
    catalog,
    500
  );
  assert.equal(totals.subtotalCents, 4000);
  assert.equal(totals.shippingFeeCents, 500);
  assert.equal(totals.totalCents, 4500);
  assert.equal(totals.itemCount, 2);
});


