/**
 * VANTÉRA Commerce Pure Business Logic
 * Brand: VANTÉRA | Slogan: Technology, Elevated.
 */

export interface CartItemInput {
  productId: string;
  slug: string;
  quantity: number;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  title: string;
  retailPriceCents: number;
  supplierCostCents: number | null;
  stockQuantity: number;
  isAvailable: boolean;
}

export interface ComputedOrderItem {
  productId: string;
  slug: string;
  title: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  supplierCostCents: number | null;
}

export interface ComputedOrderTotal {
  items: ComputedOrderItem[];
  subtotalCents: number;
  shippingFeeCents: number;
  totalCents: number;
  itemCount: number;
}

export interface ProfitMetrics {
  totalSalesCents: number;
  paidSalesCents: number;
  supplierExpensesCents: number;
  shippingExpensesCents: number;
  refundsCents: number;
  grossProfitCents: number;
  estimatedNetProfitCents: number;
  unverifiedCostItemCount: number;
  hasIncompleteCostData: boolean;
}

/**
 * Formats cents into USD string (e.g. 799 -> "$7.99")
 */
export function formatUSD(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return 'Price on inquiry';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Formats whole Naira or NGN amount into Nigerian Naira string (e.g. 15000 -> "₦15,000")
 */
export function formatNGN(nairaAmount: number | null | undefined): string {
  if (nairaAmount === null || nairaAmount === undefined || isNaN(nairaAmount)) {
    return 'Price on inquiry';
  }
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(nairaAmount);
}

/**
 * Converts USD cents to NGN whole amount using the configured exchange rate.
 * Standard default exchange rate: 1 USD = ₦1,500
 */
export function convertUsdCentsToNgn(cents: number, exchangeRate = 1500): number {
  if (!cents || isNaN(cents) || cents < 0) return 0;
  const dollars = cents / 100;
  return Math.round(dollars * exchangeRate);
}

/**
 * Formats price in either USD or NGN according to active customer currency
 */
export function formatPrice(
  centsInUSD: number | null | undefined,
  currency: 'USD' | 'NGN' = 'USD',
  exchangeRate = 1500
): string {
  if (centsInUSD === null || centsInUSD === undefined || isNaN(centsInUSD)) {
    return 'Price on inquiry';
  }
  if (currency === 'NGN') {
    const ngn = convertUsdCentsToNgn(centsInUSD, exchangeRate);
    return formatNGN(ngn);
  }
  return formatUSD(centsInUSD);
}

/**
 * Calculates discount from a valid coupon code
 */
export function calculateCouponDiscount(
  subtotalCents: number,
  coupon: {
    type: 'percentage' | 'fixed';
    discountValue: number;
    minSpendCents?: number;
    currency?: string;
  },
  currency: 'USD' | 'NGN' = 'USD',
  exchangeRate = 1500
): number {
  if (!coupon || subtotalCents <= 0) return 0;
  if (coupon.minSpendCents && subtotalCents < coupon.minSpendCents) return 0;

  if (coupon.type === 'percentage') {
    const pct = Math.max(0, Math.min(100, coupon.discountValue));
    return Math.round((subtotalCents * pct) / 100);
  } else {
    // Fixed discount: if coupon is in USD, discountValue is in cents.
    // If in NGN and active currency is NGN, compute equivalent cents.
    let discountCents = coupon.discountValue;
    if (coupon.currency === 'NGN' && currency === 'USD') {
      discountCents = Math.round((coupon.discountValue / exchangeRate) * 100);
    }
    return Math.min(subtotalCents, Math.max(0, discountCents));
  }
}

/**
 * Password validation rule: min 8 characters
 */
export function isValidPassword(password: string): { valid: boolean; reason?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, reason: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long' };
  }
  return { valid: true };
}

/**
 * Generates an authoritative unique order reference e.g. VAN-2026-9481
 */
export function generateOrderReference(seed?: number): string {
  const year = 2026;
  const num = seed ?? Math.floor(1000 + Math.random() * 9000);
  return `VAN-${year}-${num}`;
}

/**
 * Server-side trusted calculation of order totals using actual catalog prices.
 * Browser-supplied prices and totals are never trusted.
 */
export function calculateOrderTotals(
  cartItems: CartItemInput[],
  catalog: Map<string, CatalogProduct>,
  shippingFeeCents: number = 0
): ComputedOrderTotal {
  const computedItems: ComputedOrderItem[] = [];
  let subtotal = 0;
  let itemCount = 0;

  for (const item of cartItems) {
    if (!item.quantity || item.quantity <= 0) continue;
    const product = catalog.get(item.productId) || catalog.get(item.slug);
    if (!product) {
      throw new Error(`Product not found in catalog: ${item.slug || item.productId}`);
    }
    if (!product.isAvailable) {
      throw new Error(`Product is not currently available: ${product.title}`);
    }

    const qty = Math.min(Math.max(1, Math.floor(item.quantity)), 99);
    const unitPrice = product.retailPriceCents;
    const itemTotal = unitPrice * qty;

    computedItems.push({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      unitPriceCents: unitPrice,
      quantity: qty,
      totalCents: itemTotal,
      supplierCostCents: product.supplierCostCents,
    });

    subtotal += itemTotal;
    itemCount += qty;
  }

  if (computedItems.length === 0) {
    throw new Error('Order must contain at least one valid product');
  }

  return {
    items: computedItems,
    subtotalCents: subtotal,
    shippingFeeCents,
    totalCents: subtotal + shippingFeeCents,
    itemCount,
  };
}

/**
 * Validates customer isolation: checks if user is allowed to access the order.
 */
export function canCustomerAccessOrder(
  user: { id: string; email: string; role: string },
  order: { customerId: string | null; customerEmail: string }
): boolean {
  if (user.role === 'admin' && user.email === 'emmanueladarikwu@gmail.com') {
    return true;
  }
  if (order.customerId && order.customerId === user.id) {
    return true;
  }
  if (order.customerEmail && order.customerEmail.toLowerCase() === user.email.toLowerCase()) {
    return true;
  }
  return false;
}

/**
 * Computes business profits, distinguishing confirmed sales from estimates,
 * and flagging missing supplier costs.
 */
export function calculateBusinessProfits(orders: Array<{
  paymentStatus: string;
  totalCents: number;
  shippingFeeCents?: number;
  items: Array<{ quantity: number; supplierCostCents?: number | null }>;
}>): ProfitMetrics {
  let totalSales = 0;
  let paidSales = 0;
  let supplierExpenses = 0;
  let shippingExpenses = 0;
  let refunds = 0;
  let unverifiedCostItemCount = 0;

  for (const order of orders) {
    totalSales += order.totalCents;

    if (order.paymentStatus === 'paid') {
      paidSales += order.totalCents;
      shippingExpenses += order.shippingFeeCents || 0;

      for (const item of order.items) {
        if (item.supplierCostCents !== null && item.supplierCostCents !== undefined) {
          supplierExpenses += item.supplierCostCents * item.quantity;
        } else {
          unverifiedCostItemCount += item.quantity;
        }
      }
    } else if (order.paymentStatus === 'refunded') {
      refunds += order.totalCents;
    }
  }

  const grossProfitCents = paidSales - supplierExpenses;
  const estimatedNetProfitCents = grossProfitCents - shippingExpenses - refunds;

  return {
    totalSalesCents: totalSales,
    paidSalesCents: paidSales,
    supplierExpensesCents: supplierExpenses,
    shippingExpensesCents: shippingExpenses,
    refundsCents: refunds,
    grossProfitCents,
    estimatedNetProfitCents,
    unverifiedCostItemCount,
    hasIncompleteCostData: unverifiedCostItemCount > 0,
  };
}
