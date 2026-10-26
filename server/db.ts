import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { INITIAL_PRODUCTS } from '../src/data/catalog.ts';
import type { Product } from '../src/data/catalog.ts';
import { calculateRealAnalytics } from '../src/lib/analyticsLogic.ts';
import type { AnalyticsTimeRange } from '../src/lib/analyticsLogic.ts';
import { CURATED_PRODUCT_IMAGES } from './curatedImages.ts';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
  passwordHash?: string;
  salt?: string;
  phone?: string;
  isPasswordSet: boolean;
  createdAt: string;
  updatedAt: string;
  resetToken?: string;
  resetTokenExpiry?: number;
}

export interface DeliveryAddress {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  streetAddress: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  slug: string;
  title: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  supplierCostCents: number | null;
  image?: string | null;
}

export interface Order {
  id: string;
  orderReference: string;
  customerId: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    streetAddress: string;
    apartment?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: OrderItem[];
  subtotalCents: number;
  discountCents?: number;
  couponCode?: string | null;
  shippingFeeCents: number;
  totalCents: number;
  currency: 'USD' | 'NGN';
  exchangeRateUsed?: number;
  paymentMethod: 'bank_transfer' | 'card_online';
  paymentStatus: 'pending' | 'awaiting_verification' | 'paid' | 'failed' | 'refunded';
  paymentProofNotes: string | null;
  paymentVerifiedAt: string | null;
  paymentVerifiedBy: string | null;
  fulfilmentStatus: 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  supplierOrderId: string | null;
  supplierName: string | null;
  supplierCostTotalCents: number | null;
  notes: string | null;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankSettings {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode: string;
  instructions: string;
  whatsapp: string;
  email: string;
}

export interface Supplier {
  id: string;
  name: string;
  website: string;
  contact: string;
  integrationType: 'manual' | 'aliexpress_api' | 'cjdropshipping_api';
  status: 'operational' | 'pending_setup' | 'credentials_required';
  notes: string;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export interface NotificationRecord {
  id: string;
  orderId?: string;
  recipient: string;
  channel: 'email' | 'whatsapp';
  event: 'order_created' | 'payment_verified' | 'order_shipped' | 'order_delivered' | 'account_registered';
  status: 'dispatched' | 'simulated';
  message: string;
  timestamp: string;
}

export interface CustomerEvent {
  id: string;
  type:
    | 'customer_registered'
    | 'customer_login'
    | 'customer_logout'
    | 'product_viewed'
    | 'product_searched'
    | 'category_visited'
    | 'cart_item_added'
    | 'cart_item_removed'
    | 'cart_quantity_changed'
    | 'checkout_initiated'
    | 'order_placed'
    | 'payment_initiated'
    | 'payment_confirmed'
    | 'payment_failed'
    | 'order_cancelled'
    | 'refund_requested'
    | 'refund_confirmed'
    | 'newsletter_subscribed'
    | 'contact_form_submitted'
    | 'order_status_updated';
  timestamp: string;
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  sessionId?: string | null;
  status: 'success' | 'pending' | 'failed' | 'completed';
  metadata: Record<string, any>;
}

export interface ActiveCartRecord {
  id: string;
  customerId?: string | null;
  customerEmail?: string | null;
  sessionId?: string | null;
  items: any[];
  itemCount: number;
  subtotalCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface VisitorSessionRecord {
  sessionId: string;
  firstSeen: string;
  lastActive: string;
  authenticatedUserId?: string | null;
  pageViews: number;
}

export interface CurrencySettings {
  defaultCurrency: 'USD' | 'NGN';
  ngnExchangeRate: number;
  enableNgn: boolean;
  enableUsd: boolean;
  lastUpdated: string;
}

export interface BankAccountDestination {
  id: string;
  currency: 'USD' | 'NGN';
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCodeOrRouting?: string;
  swiftBic?: string;
  instructions: string;
  isActive: boolean;
  isVerified: boolean;
  whatsappContact?: string;
  emailContact?: string;
  updatedAt: string;
}

export interface CouponRecord {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  discountValue: number;
  currency?: 'USD' | 'NGN' | 'ALL';
  minSpendCents?: number;
  maxUsageCount?: number;
  usedCount: number;
  expiryDate?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SupportTicketRecord {
  id: string;
  ticketNumber: string;
  customerId?: string | null;
  customerEmail: string;
  customerName: string;
  orderReference?: string | null;
  subject: string;
  category: 'general' | 'order_issue' | 'payment_inquiry' | 'return_refund' | 'technical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  messages: Array<{
    id: string;
    sender: 'customer' | 'support' | 'ceo';
    senderName: string;
    message: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordResetVerificationCode {
  id: string;
  email: string;
  codeHash: string;
  salt: string;
  expiresAt: number;
  attempts: number;
  used: boolean;
  createdAt: string;
}

export interface ImageAuditSummary {
  lastScannedAt: string;
  totalProducts: number;
  withWorkingImages: number;
  missingImages: number;
  repairedImages: number;
  awaitingReview: number;
}

export interface PaymentGatewaySettings {
  paystackEnabled: boolean;
  paystackPublicKey: string;
  paystackSecretKey: string;
  paystackTestMode: boolean;
  bankTransferEnabled: boolean;
  activeCurrencies: ('NGN' | 'USD')[];
  updatedAt: string;
}

export interface CustomDomainSettings {
  domain: string;
  status: 'not_configured' | 'active' | 'dns_pending' | 'propagating';
  primaryRegistrar?: string;
  targetCname: string;
  sslStatus: 'active' | 'provisioning' | 'pending';
  lastChecked?: string;
  configuredAt?: string;
}

export interface DatabaseSchema {
  users: User[];
  deliveryAddresses: DeliveryAddress[];
  products: Product[];
  orders: Order[];
  bankSettings: BankSettings;
  paymentSettings: PaymentGatewaySettings;
  currencySettings: CurrencySettings;
  customDomainSettings?: CustomDomainSettings;
  bankDestinations: BankAccountDestination[];
  coupons: CouponRecord[];
  supportTickets: SupportTicketRecord[];
  verificationCodes: PasswordResetVerificationCode[];
  imageAudit: ImageAuditSummary;
  suppliers: Supplier[];
  auditLogs: AuditLog[];
  notifications: NotificationRecord[];
  events: CustomerEvent[];
  carts: ActiveCartRecord[];
  visitorSessions: VisitorSessionRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'vantera_db.json');
const TOKEN_SECRET = process.env.SESSION_SECRET || 'vantera-secret-key-2026-elevated-tech';

export const AUTHORIZED_CEO_EMAIL = 'emmanueladarikwu@gmail.com';
export const AUTHORIZED_CEO_NAME = 'Adnuel';

let dbCache: DatabaseSchema | null = null;

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDatabase(): DatabaseSchema {
  if (dbCache) return dbCache;
  ensureDataDirectory();

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      dbCache = JSON.parse(content);
      if (dbCache) {
        if (!Array.isArray(dbCache.events)) dbCache.events = [];
        if (!Array.isArray(dbCache.carts)) dbCache.carts = [];
        if (!Array.isArray(dbCache.visitorSessions)) dbCache.visitorSessions = [];
        if (!dbCache.currencySettings) {
          dbCache.currencySettings = {
            defaultCurrency: 'USD',
            ngnExchangeRate: 1500,
            enableNgn: true,
            enableUsd: true,
            lastUpdated: new Date().toISOString(),
          };
        }
        if (!dbCache.paymentSettings) {
          dbCache.paymentSettings = {
            paystackEnabled: true,
            paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_sample_vantera_key',
            paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || 'sk_test_sample_vantera_key',
            paystackTestMode: true,
            bankTransferEnabled: true,
            activeCurrencies: ['NGN', 'USD'],
            updatedAt: new Date().toISOString(),
          };
        }
        if (!Array.isArray(dbCache.bankDestinations) || dbCache.bankDestinations.length === 0) {
          dbCache.bankDestinations = [
            {
              id: 'dest_ngn_gtbank',
              currency: 'NGN',
              bankName: 'Guaranty Trust Bank (GTBank)',
              accountName: 'VANTÉRA ENTERPRISES - Adnuel',
              accountNumber: '0812345678',
              sortCodeOrRouting: '058-152062',
              instructions:
                'Transfer the exact order total in Nigerian Naira (₦) using your Order Reference as narration. Click "I Have Transferred" to notify CEO Adnuel for verification.',
              isActive: true,
              isVerified: true,
              whatsappContact: '+234 913 279 3670',
              emailContact: AUTHORIZED_CEO_EMAIL,
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'dest_usd_wire',
              currency: 'USD',
              bankName: 'VANTÉRA Global Settlement (Mercury / Wire)',
              accountName: 'VANTÉRA ENTERPRISES - Adnuel',
              accountNumber: '984102938471',
              sortCodeOrRouting: '021000021',
              swiftBic: 'MERCUS33XXX',
              instructions:
                'Wire transfer order total in USD ($) referencing your Order Reference in the memo. Submit transfer confirmation for verification by CEO Adnuel.',
              isActive: true,
              isVerified: true,
              whatsappContact: '+234 913 279 3670',
              emailContact: AUTHORIZED_CEO_EMAIL,
              updatedAt: new Date().toISOString(),
            },
          ];
        }
        if (!Array.isArray(dbCache.coupons)) {
          dbCache.coupons = [
            {
              id: 'cpn_vantera10',
              code: 'VANTERA10',
              type: 'percentage',
              discountValue: 10,
              minSpendCents: 2000,
              usedCount: 0,
              isActive: true,
              createdAt: new Date().toISOString(),
            },
          ];
        }
        if (!Array.isArray(dbCache.supportTickets)) dbCache.supportTickets = [];
        if (!Array.isArray(dbCache.verificationCodes)) dbCache.verificationCodes = [];
        if (!dbCache.imageAudit) {
          dbCache.imageAudit = {
            lastScannedAt: new Date().toISOString(),
            totalProducts: dbCache.products.length,
            withWorkingImages: dbCache.products.filter((p) => p.image).length,
            missingImages: dbCache.products.filter((p) => !p.image).length,
            repairedImages: 0,
            awaitingReview: dbCache.products.filter((p) => p.imageNeedsReview).length,
          };
        }

        // Merge newly added catalog products (e.g. Festive Season Bestsellers) into database
        let newProductsAdded = 0;
        for (const initP of INITIAL_PRODUCTS) {
          const exists = dbCache.products.some((p) => p.id === initP.id);
          if (!exists) {
            dbCache.products.unshift(initP);
            newProductsAdded++;
          }
        }
        if (newProductsAdded > 0) {
          dbCache.imageAudit.totalProducts = dbCache.products.length;
          dbCache.imageAudit.withWorkingImages = dbCache.products.filter((p) => p.image).length;
          saveDatabase(dbCache);
        }
      }
      return dbCache!;
    } catch (err) {
      console.error('Failed to parse database file, reinitializing:', err);
    }
  }

  // Initial Seed
  const initialSchema: DatabaseSchema = {
    users: [
      {
        id: 'usr_ceo_adnuel',
        email: AUTHORIZED_CEO_EMAIL,
        name: AUTHORIZED_CEO_NAME,
        role: 'admin',
        isPasswordSet: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    deliveryAddresses: [],
    products: INITIAL_PRODUCTS,
    orders: [],
    bankSettings: {
      bankName: 'Guaranty Trust Bank (GTBank)',
      accountName: 'ADARIKWU EMMANUEL UGBADA',
      accountNumber: '1033269410',
      sortCode: '058-152062',
      instructions:
        'Transfer the exact order total using your unique Order Reference (e.g. VAN-2026-XXXX) as the transaction narration. Once sent, click "I Have Transferred" to notify CEO Adnuel for instant verification.',
      whatsapp: '+234 913 279 3670',
      email: AUTHORIZED_CEO_EMAIL,
    },
    paymentSettings: {
      paystackEnabled: true,
      paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_sample_vantera_key',
      paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || 'sk_test_sample_vantera_key',
      paystackTestMode: true,
      bankTransferEnabled: true,
      activeCurrencies: ['NGN', 'USD'],
      updatedAt: new Date().toISOString(),
    },
    currencySettings: {
      defaultCurrency: 'USD',
      ngnExchangeRate: 1500,
      enableNgn: true,
      enableUsd: true,
      lastUpdated: new Date().toISOString(),
    },
    bankDestinations: [
      {
        id: 'dest_ngn_gtbank',
        currency: 'NGN',
        bankName: 'Guaranty Trust Bank (GTBank)',
        accountName: 'ADARIKWU EMMANUEL UGBADA',
        accountNumber: '1033269410',
        sortCodeOrRouting: '058-152062',
        instructions:
          'Transfer the exact order total in Nigerian Naira (₦) using your Order Reference as narration. Click "I Have Transferred" to notify CEO Adnuel for verification.',
        isActive: true,
        isVerified: true,
        whatsappContact: '+234 913 279 3670',
        emailContact: AUTHORIZED_CEO_EMAIL,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'dest_usd_wire',
        currency: 'USD',
        bankName: 'VANTÉRA Global Settlement (Mercury / Wire)',
        accountName: 'VANTÉRA ENTERPRISES - Adnuel',
        accountNumber: '984102938471',
        sortCodeOrRouting: '021000021',
        swiftBic: 'MERCUS33XXX',
        instructions:
          'Wire transfer order total in USD ($) referencing your Order Reference in the memo. Submit transfer confirmation for verification by CEO Adnuel.',
        isActive: true,
        isVerified: true,
        whatsappContact: '+234 913 279 3670',
        emailContact: AUTHORIZED_CEO_EMAIL,
        updatedAt: new Date().toISOString(),
      },
    ],
    coupons: [
      {
        id: 'cpn_vantera10',
        code: 'VANTERA10',
        type: 'percentage',
        discountValue: 10,
        minSpendCents: 2000,
        usedCount: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ],
    supportTickets: [],
    verificationCodes: [],
    imageAudit: {
      lastScannedAt: new Date().toISOString(),
      totalProducts: INITIAL_PRODUCTS.length,
      withWorkingImages: INITIAL_PRODUCTS.filter((p) => p.image).length,
      missingImages: INITIAL_PRODUCTS.filter((p) => !p.image).length,
      repairedImages: 0,
      awaitingReview: INITIAL_PRODUCTS.filter((p) => p.imageNeedsReview).length,
    },
    suppliers: [
      {
        id: 'sup_aliexpress',
        name: 'AliExpress Direct Dropship',
        website: 'https://www.aliexpress.com',
        contact: 'supplier-support@aliexpress.com',
        integrationType: 'aliexpress_api',
        status: 'pending_setup',
        notes: 'API credentials required before live automated supplier order dispatch.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sup_cjdropshipping',
        name: 'CJdropshipping Global',
        website: 'https://cjdropshipping.com',
        contact: 'support@cjdropshipping.com',
        integrationType: 'cjdropshipping_api',
        status: 'pending_setup',
        notes: 'Free-tier account ready; API key configuration required for automated stock sync.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sup_manual_direct',
        name: 'Shenzhen Fast Logistics Hub',
        website: 'https://1688.com',
        contact: '+86 755 8321 4400',
        integrationType: 'manual',
        status: 'operational',
        notes: 'Manual order placement and tracking confirmation verified by CEO Adnuel.',
        createdAt: new Date().toISOString(),
      },
    ],
    auditLogs: [
      {
        id: 'log_init',
        timestamp: new Date().toISOString(),
        actor: 'System',
        action: 'INITIALIZE_STORE',
        details: 'VANTÉRA unified database seeded with 60 products and CEO authorization for Adnuel.',
      },
    ],
    notifications: [],
    events: [],
    carts: [],
    visitorSessions: [],
  };

  saveDatabase(initialSchema);
  dbCache = initialSchema;
  return dbCache;
}

function saveDatabase(data: DatabaseSchema): void {
  ensureDataDirectory();
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempFile, DB_FILE);
  dbCache = data;
}

/* Crypto helpers */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

export function createToken(payload: { userId: string; email: string; role: string }): string {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/* Database Operations */
export const db = {
  // Users
  getUserByEmail(email: string): User | undefined {
    const d = loadDatabase();
    return d.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  },

  getUserById(id: string): User | undefined {
    const d = loadDatabase();
    return d.users.find((u) => u.id === id);
  },

  createCustomer(name: string, email: string, password: string, phone?: string): User {
    const d = loadDatabase();
    const cleanEmail = email.trim().toLowerCase();

    // Prevent customer from registering with CEO email or granting admin
    if (cleanEmail === AUTHORIZED_CEO_EMAIL.toLowerCase()) {
      throw new Error('This email is reserved for authorized administrator login.');
    }

    if (d.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email address already exists.');
    }

    const { hash, salt } = hashPassword(password);
    const newUser: User = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      email: cleanEmail,
      name: name.trim(),
      phone: phone?.trim(),
      role: 'customer', // strictly customer
      passwordHash: hash,
      salt,
      isPasswordSet: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    d.users.push(newUser);
    this.addAuditLog('Customer', 'REGISTER_ACCOUNT', `New customer registered: ${cleanEmail}`);
    this.addNotification({
      recipient: cleanEmail,
      channel: 'email',
      event: 'account_registered',
      message: `Welcome to VANTÉRA, ${name}! Your customer account has been created.`,
    });
    this.addCustomerEvent({
      type: 'customer_registered',
      customerId: newUser.id,
      customerEmail: newUser.email,
      customerName: newUser.name,
      status: 'success',
      metadata: { role: 'customer' },
    });
    saveDatabase(d);
    return newUser;
  },

  setAdminPassword(password: string): User {
    const d = loadDatabase();
    let ceo = d.users.find((u) => u.email.toLowerCase() === AUTHORIZED_CEO_EMAIL.toLowerCase());
    if (!ceo) {
      ceo = {
        id: 'usr_ceo_adnuel',
        email: AUTHORIZED_CEO_EMAIL,
        name: AUTHORIZED_CEO_NAME,
        role: 'admin',
        isPasswordSet: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      d.users.push(ceo);
    }

    const { hash, salt } = hashPassword(password);
    ceo.passwordHash = hash;
    ceo.salt = salt;
    ceo.isPasswordSet = true;
    ceo.updatedAt = new Date().toISOString();

    this.addAuditLog('CEO Adnuel', 'ADMIN_PASSWORD_ESTABLISHED', 'CEO established administrative access credentials.');
    saveDatabase(d);
    return ceo;
  },

  // Products
  getProducts(): Product[] {
    const d = loadDatabase();
    return d.products;
  },

  getProductBySlug(slug: string): Product | undefined {
    const d = loadDatabase();
    return d.products.find((p) => p.slug === slug || p.id === slug);
  },

  updateProduct(id: string, updates: Partial<Product>, actor: string): Product {
    const d = loadDatabase();
    const idx = d.products.findIndex((p) => p.id === id || p.slug === id);
    if (idx === -1) throw new Error('Product not found');
    const existing = d.products[idx];
    const updated = { ...existing, ...updates };
    d.products[idx] = updated;
    this.addAuditLog(actor, 'UPDATE_PRODUCT', `Updated product: ${updated.title} (${updated.slug})`);
    saveDatabase(d);
    return updated;
  },

  addProduct(productData: Omit<Product, 'id'>, actor: string): Product {
    const d = loadDatabase();
    const slug = productData.slug || productData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (d.products.some((p) => p.slug === slug)) {
      throw new Error(`A product with slug "${slug}" already exists.`);
    }
    const newProd: Product = {
      ...productData,
      id: slug,
      slug,
    };
    d.products.push(newProd);
    this.addAuditLog(actor, 'ADD_PRODUCT', `Added new product: ${newProd.title}`);
    saveDatabase(d);
    return newProd;
  },

  // Orders
  getOrders(): Order[] {
    const d = loadDatabase();
    return d.orders;
  },

  getCustomerOrders(userId: string, email: string): Order[] {
    const d = loadDatabase();
    return d.orders.filter(
      (o) => (o.customerId && o.customerId === userId) || o.customerEmail.toLowerCase() === email.toLowerCase()
    );
  },

  getOrderByReference(reference: string): Order | undefined {
    const d = loadDatabase();
    return d.orders.find((o) => o.orderReference.toUpperCase() === reference.trim().toUpperCase());
  },

  getOrderById(id: string): Order | undefined {
    const d = loadDatabase();
    return d.orders.find((o) => o.id === id);
  },

  createOrder(orderData: {
    customerId: string | null;
    customerEmail: string;
    customerName: string;
    customerPhone: string;
    shippingAddress: Order['shippingAddress'];
    cartItems: Array<{ productId: string; quantity: number }>;
    currency?: 'USD' | 'NGN';
    paymentMethod?: 'bank_transfer' | 'card_online';
    couponCode?: string;
    notes?: string;
  }): Order {
    const d = loadDatabase();
    const productsMap = new Map(d.products.map((p) => [p.id, p]));

    const computedItems: OrderItem[] = [];
    let subtotal = 0;

    for (const item of orderData.cartItems) {
      const product = productsMap.get(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      if (!product.isAvailable) throw new Error(`Product ${product.title} is not available`);

      const qty = Math.max(1, Math.min(99, item.quantity));
      const lineTotal = product.retailPriceCents * qty;

      computedItems.push({
        productId: product.id,
        slug: product.slug,
        title: product.title,
        unitPriceCents: product.retailPriceCents,
        quantity: qty,
        totalCents: lineTotal,
        supplierCostCents: product.supplierCostCents,
        image: product.image,
      });

      subtotal += lineTotal;
    }

    let discountCents = 0;
    let appliedCoupon: string | null = null;
    if (orderData.couponCode) {
      const v = this.validateCoupon(orderData.couponCode, subtotal);
      if (v.valid && v.coupon) {
        if (v.coupon.type === 'percentage') {
          discountCents = Math.round((subtotal * v.coupon.discountValue) / 100);
        } else {
          discountCents = Math.min(subtotal, v.coupon.discountValue);
        }
        v.coupon.usedCount += 1;
        appliedCoupon = v.coupon.code;
      }
    }

    const shippingFee = subtotal >= 5000 ? 0 : 500; // Free shipping over $50
    const total = Math.max(0, subtotal - discountCents + shippingFee);
    const currency = orderData.currency === 'NGN' ? 'NGN' : 'USD';
    const rate = d.currencySettings?.ngnExchangeRate || 1500;

    // Generate unique order reference
    let reference = '';
    do {
      reference = `VAN-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (d.orders.some((o) => o.orderReference === reference));

    const newOrder: Order = {
      id: `ord_${crypto.randomBytes(8).toString('hex')}`,
      orderReference: reference,
      customerId: orderData.customerId,
      customerEmail: orderData.customerEmail.trim(),
      customerName: orderData.customerName.trim(),
      customerPhone: orderData.customerPhone.trim(),
      shippingAddress: orderData.shippingAddress,
      items: computedItems,
      subtotalCents: subtotal,
      discountCents,
      couponCode: appliedCoupon,
      shippingFeeCents: shippingFee,
      totalCents: total,
      currency,
      exchangeRateUsed: rate,
      paymentMethod: orderData.paymentMethod || 'bank_transfer',
      paymentStatus: 'pending',
      paymentProofNotes: null,
      paymentVerifiedAt: null,
      paymentVerifiedBy: null,
      fulfilmentStatus: 'unfulfilled',
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      supplierOrderId: null,
      supplierName: null,
      supplierCostTotalCents: null,
      notes: orderData.notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    d.orders.unshift(newOrder);
    this.addAuditLog('System', 'ORDER_CREATED', `Order ${reference} placed by ${newOrder.customerEmail} ($${(total / 100).toFixed(2)})`);

    // Notify customer
    this.addNotification({
      orderId: newOrder.id,
      recipient: newOrder.customerEmail,
      channel: 'email',
      event: 'order_created',
      message: `Your VANTÉRA order ${reference} has been received! Please complete your bank transfer referencing ${reference}.`,
    });

    this.addCustomerEvent({
      type: 'order_placed',
      customerId: newOrder.customerId,
      customerEmail: newOrder.customerEmail,
      customerName: newOrder.customerName,
      status: 'success',
      metadata: {
        orderId: newOrder.id,
        orderReference: newOrder.orderReference,
        amountCents: newOrder.totalCents,
        itemCount: newOrder.items.reduce((s, i) => s + i.quantity, 0),
      },
    });

    saveDatabase(d);
    return newOrder;
  },

  submitPaymentProof(orderReference: string, notes: string): Order {
    const d = loadDatabase();
    const order = d.orders.find((o) => o.orderReference.toUpperCase() === orderReference.trim().toUpperCase());
    if (!order) throw new Error('Order not found');

    order.paymentStatus = 'awaiting_verification';
    order.paymentProofNotes = notes.trim();
    order.updatedAt = new Date().toISOString();

    this.addAuditLog('Customer', 'PAYMENT_PROOF_SUBMITTED', `Customer submitted bank transfer notes for order ${order.orderReference}`);

    // Notify CEO via WhatsApp/Email simulation
    this.addNotification({
      orderId: order.id,
      recipient: AUTHORIZED_CEO_EMAIL,
      channel: 'email',
      event: 'order_created',
      message: `NEW PAYMENT PROOF: Customer for order ${order.orderReference} transferred $${(order.totalCents / 100).toFixed(2)}. Notes: "${notes}". Check bank statement to verify.`,
    });

    this.addCustomerEvent({
      type: 'payment_initiated',
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      status: 'pending',
      metadata: {
        orderId: order.id,
        orderReference: order.orderReference,
        amountCents: order.totalCents,
        notes: notes.trim(),
      },
    });

    saveDatabase(d);
    return order;
  },

  verifyPayment(orderId: string, verifierActor: string): Order {
    const d = loadDatabase();
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    order.paymentStatus = 'paid';
    order.paymentVerifiedAt = new Date().toISOString();
    order.paymentVerifiedBy = verifierActor;
    if (order.fulfilmentStatus === 'unfulfilled') {
      order.fulfilmentStatus = 'processing';
    }
    order.updatedAt = new Date().toISOString();

    this.addAuditLog(verifierActor, 'VERIFY_PAYMENT', `Payment verified for order ${order.orderReference} ($${(order.totalCents / 100).toFixed(2)})`);

    // Notify customer
    this.addNotification({
      orderId: order.id,
      recipient: order.customerEmail,
      channel: 'email',
      event: 'payment_verified',
      message: `Great news! Your bank transfer for VANTÉRA order ${order.orderReference} has been verified. We are preparing your order for dispatch.`,
    });

    this.addCustomerEvent({
      type: 'payment_confirmed',
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      status: 'completed',
      metadata: {
        orderId: order.id,
        orderReference: order.orderReference,
        amountCents: order.totalCents,
        verifiedBy: verifierActor,
      },
    });

    saveDatabase(d);
    return order;
  },

  updateShipping(
    orderId: string,
    data: { carrier: string; trackingNumber: string; trackingUrl: string; status?: Order['fulfilmentStatus'] },
    actor: string
  ): Order {
    const d = loadDatabase();
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    order.carrier = data.carrier.trim();
    order.trackingNumber = data.trackingNumber.trim();
    order.trackingUrl = data.trackingUrl.trim();
    if (data.status) {
      order.fulfilmentStatus = data.status;
    } else {
      order.fulfilmentStatus = 'shipped';
    }
    order.updatedAt = new Date().toISOString();

    this.addAuditLog(actor, 'UPDATE_SHIPPING', `Tracking added for ${order.orderReference}: ${order.carrier} ${order.trackingNumber}`);

    this.addNotification({
      orderId: order.id,
      recipient: order.customerEmail,
      channel: 'email',
      event: 'order_shipped',
      message: `Your VANTÉRA order ${order.orderReference} has shipped via ${order.carrier}! Tracking Number: ${order.trackingNumber}`,
    });

    saveDatabase(d);
    return order;
  },

  updateOrderStatus(orderId: string, status: Order['fulfilmentStatus'], actor: string): Order {
    const d = loadDatabase();
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    order.fulfilmentStatus = status;
    order.updatedAt = new Date().toISOString();
    this.addAuditLog(actor, 'UPDATE_FULFILMENT_STATUS', `Order ${order.orderReference} status updated to ${status}`);

    if (status === 'cancelled') {
      this.addCustomerEvent({
        type: 'order_cancelled',
        customerId: order.customerId,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        status: 'completed',
        metadata: {
          orderId: order.id,
          orderReference: order.orderReference,
          amountCents: order.totalCents,
          actor,
        },
      });
    }

    saveDatabase(d);
    return order;
  },

  updateOrderDetails(
    orderId: string,
    updates: {
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      shippingAddress?: Partial<Order['shippingAddress']>;
      paymentStatus?: Order['paymentStatus'];
      fulfilmentStatus?: Order['fulfilmentStatus'];
      carrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
      notes?: string;
      adminNotes?: string;
    },
    actor: string
  ): Order {
    const d = loadDatabase();
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    if (updates.customerName !== undefined) order.customerName = updates.customerName.trim();
    if (updates.customerEmail !== undefined) order.customerEmail = updates.customerEmail.trim();
    if (updates.customerPhone !== undefined) order.customerPhone = updates.customerPhone.trim();
    if (updates.shippingAddress) {
      order.shippingAddress = {
        ...order.shippingAddress,
        ...updates.shippingAddress,
      };
    }
    if (updates.paymentStatus !== undefined) {
      order.paymentStatus = updates.paymentStatus;
      if (updates.paymentStatus === 'paid' && !order.paymentVerifiedAt) {
        order.paymentVerifiedAt = new Date().toISOString();
        order.paymentVerifiedBy = actor;
      }
    }
    if (updates.fulfilmentStatus !== undefined) {
      order.fulfilmentStatus = updates.fulfilmentStatus;
    }
    if (updates.carrier !== undefined) order.carrier = updates.carrier.trim();
    if (updates.trackingNumber !== undefined) order.trackingNumber = updates.trackingNumber.trim();
    if (updates.trackingUrl !== undefined) order.trackingUrl = updates.trackingUrl.trim();
    if (updates.notes !== undefined) order.notes = updates.notes;
    if (updates.adminNotes !== undefined) order.adminNotes = updates.adminNotes;

    order.updatedAt = new Date().toISOString();

    this.addAuditLog(actor, 'UPDATE_ORDER_DETAILS', `CEO updated order details for ${order.orderReference}.`);

    this.addCustomerEvent({
      type: 'order_status_updated',
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      status: 'completed',
      metadata: {
        orderId: order.id,
        orderReference: order.orderReference,
        paymentStatus: order.paymentStatus,
        fulfilmentStatus: order.fulfilmentStatus,
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        updatedBy: actor,
      },
    });

    saveDatabase(d);
    return order;
  },

  // Bank Settings
  getBankSettings(): BankSettings {
    const d = loadDatabase();
    return d.bankSettings;
  },

  updateBankSettings(settings: Partial<BankSettings>, actor: string): BankSettings {
    const d = loadDatabase();
    d.bankSettings = { ...d.bankSettings, ...settings };
    this.addAuditLog(actor, 'UPDATE_BANK_SETTINGS', 'Updated business bank transfer details.');
    saveDatabase(d);
    return d.bankSettings;
  },

  // Payment Gateway Settings (Paystack & Cards)
  getPaymentSettings(): PaymentGatewaySettings {
    const d = loadDatabase();
    if (!d.paymentSettings) {
      d.paymentSettings = {
        paystackEnabled: true,
        paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_sample_vantera_key',
        paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || 'sk_test_sample_vantera_key',
        paystackTestMode: true,
        bankTransferEnabled: true,
        activeCurrencies: ['NGN', 'USD'],
        updatedAt: new Date().toISOString(),
      };
      saveDatabase(d);
    }
    return d.paymentSettings;
  },

  updatePaymentSettings(settings: Partial<PaymentGatewaySettings>, actor: string): PaymentGatewaySettings {
    const d = loadDatabase();
    d.paymentSettings = {
      ...(d.paymentSettings || {
        paystackEnabled: true,
        paystackPublicKey: 'pk_test_sample_vantera_key',
        paystackSecretKey: 'sk_test_sample_vantera_key',
        paystackTestMode: true,
        bankTransferEnabled: true,
        activeCurrencies: ['NGN', 'USD'],
        updatedAt: new Date().toISOString(),
      }),
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    this.addAuditLog(actor, 'UPDATE_PAYMENT_GATEWAY_SETTINGS', 'Updated Paystack payment gateway configurations.');
    saveDatabase(d);
    return d.paymentSettings;
  },

  markOrderPaidOnline(orderReference: string, paystackReference: string, channel = 'paystack_card'): Order {
    const d = loadDatabase();
    const order = d.orders.find((o) => o.orderReference.toUpperCase() === orderReference.toUpperCase());
    if (!order) throw new Error('Order not found');

    order.paymentStatus = 'paid';
    order.paymentVerifiedAt = new Date().toISOString();
    order.paymentVerifiedBy = `Paystack Online (${channel})`;
    order.paymentProofNotes = `Paystack Reference: ${paystackReference}`;
    order.updatedAt = new Date().toISOString();

    this.addAuditLog('System:Paystack', 'PAYMENT_VERIFIED', `Order ${order.orderReference} paid via Paystack (${paystackReference})`);

    this.addCustomerEvent({
      type: 'payment_confirmed',
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      status: 'completed',
      metadata: {
        orderId: order.id,
        orderReference: order.orderReference,
        paystackReference,
        totalCents: order.totalCents,
        channel,
      },
    });

    saveDatabase(d);
    return order;
  },

  // Suppliers
  getSuppliers(): Supplier[] {
    const d = loadDatabase();
    return d.suppliers;
  },

  updateSupplier(id: string, updates: Partial<Supplier>, actor: string): Supplier {
    const d = loadDatabase();
    const supplier = d.suppliers.find((s) => s.id === id);
    if (!supplier) throw new Error('Supplier not found');
    Object.assign(supplier, updates);
    this.addAuditLog(actor, 'UPDATE_SUPPLIER', `Updated supplier ${supplier.name}`);
    saveDatabase(d);
    return supplier;
  },

  // Audit Logs
  addAuditLog(actor: string, action: string, details: string): void {
    const d = loadDatabase();
    d.auditLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      details,
    });
    if (d.auditLogs.length > 500) d.auditLogs.pop();
  },

  getAuditLogs(): AuditLog[] {
    const d = loadDatabase();
    return d.auditLogs;
  },

  // Notifications
  addNotification(record: Omit<NotificationRecord, 'id' | 'timestamp' | 'status'> & { status?: 'dispatched' | 'simulated' }): void {
    const d = loadDatabase();
    const item: NotificationRecord = {
      ...record,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: record.status || 'dispatched',
      timestamp: new Date().toISOString(),
    };
    d.notifications.unshift(item);
    if (d.notifications.length > 300) d.notifications.pop();
    console.log(`[VANTÉRA Notification to ${item.recipient} via ${item.channel}]: ${item.message}`);
  },

  getNotifications(): NotificationRecord[] {
    const d = loadDatabase();
    return d.notifications;
  },

  // Customer Events
  addCustomerEvent(data: {
    type: CustomerEvent['type'];
    customerId?: string | null;
    customerEmail?: string | null;
    customerName?: string | null;
    sessionId?: string | null;
    status?: 'success' | 'pending' | 'failed' | 'completed';
    metadata?: Record<string, any>;
  }): CustomerEvent {
    const d = loadDatabase();
    d.events = d.events || [];
    const event: CustomerEvent = {
      id: `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      type: data.type,
      timestamp: new Date().toISOString(),
      customerId: data.customerId || null,
      customerEmail: data.customerEmail || null,
      customerName: data.customerName || null,
      sessionId: data.sessionId || null,
      status: data.status || 'success',
      metadata: data.metadata || {},
    };
    d.events.unshift(event);
    if (d.events.length > 2500) d.events.pop();
    saveDatabase(d);
    notifyEventListeners(event);
    return event;
  },

  getCustomerEvents(filter?: { type?: string; limit?: number; since?: string }): CustomerEvent[] {
    const d = loadDatabase();
    let res = d.events || [];
    if (filter?.type) {
      res = res.filter((e) => e.type === filter.type);
    }
    if (filter?.since) {
      const sinceMs = new Date(filter.since).getTime();
      res = res.filter((e) => new Date(e.timestamp).getTime() > sinceMs);
    }
    const limit = filter?.limit || 100;
    return res.slice(0, limit);
  },

  // Visitor Session Tracking
  recordVisitorSession(sessionId: string, userId?: string | null): void {
    if (!sessionId) return;
    const d = loadDatabase();
    d.visitorSessions = d.visitorSessions || [];
    const nowIso = new Date().toISOString();
    const existing = d.visitorSessions.find((s) => s.sessionId === sessionId);
    if (existing) {
      existing.lastActive = nowIso;
      existing.pageViews += 1;
      if (userId) existing.authenticatedUserId = userId;
    } else {
      d.visitorSessions.unshift({
        sessionId,
        firstSeen: nowIso,
        lastActive: nowIso,
        authenticatedUserId: userId || null,
        pageViews: 1,
      });
      if (d.visitorSessions.length > 3000) d.visitorSessions.pop();
    }
    saveDatabase(d);
  },

  // Active Cart Tracking & Abandonment
  syncCart(cartData: {
    id: string;
    customerId?: string | null;
    customerEmail?: string | null;
    sessionId?: string | null;
    items: any[];
    itemCount: number;
    subtotalCents: number;
  }): void {
    if (!cartData.id) return;
    const d = loadDatabase();
    d.carts = d.carts || [];
    const nowIso = new Date().toISOString();
    const idx = d.carts.findIndex((c) => c.id === cartData.id);
    if (idx > -1) {
      d.carts[idx] = {
        ...d.carts[idx],
        customerId: cartData.customerId !== undefined ? cartData.customerId : d.carts[idx].customerId,
        customerEmail: cartData.customerEmail !== undefined ? cartData.customerEmail : d.carts[idx].customerEmail,
        sessionId: cartData.sessionId !== undefined ? cartData.sessionId : d.carts[idx].sessionId,
        items: cartData.items,
        itemCount: cartData.itemCount,
        subtotalCents: cartData.subtotalCents,
        updatedAt: nowIso,
      };
    } else {
      d.carts.unshift({
        id: cartData.id,
        customerId: cartData.customerId || null,
        customerEmail: cartData.customerEmail || null,
        sessionId: cartData.sessionId || null,
        items: cartData.items,
        itemCount: cartData.itemCount,
        subtotalCents: cartData.subtotalCents,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      if (d.carts.length > 1000) d.carts.pop();
    }
    saveDatabase(d);
  },

  // Refund Order (CEO Verified)
  refundOrder(orderId: string, actor: string, reason?: string): Order {
    const d = loadDatabase();
    const order = d.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    order.paymentStatus = 'refunded';
    order.fulfilmentStatus = 'cancelled';
    order.updatedAt = new Date().toISOString();

    this.addAuditLog(actor, 'CONFIRM_REFUND', `Order ${order.orderReference} ($${(order.totalCents / 100).toFixed(2)}) refunded. Reason: ${reason || 'Verified by CEO'}`);
    this.addCustomerEvent({
      type: 'refund_confirmed',
      customerId: order.customerId,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      status: 'completed',
      metadata: {
        orderId: order.id,
        orderReference: order.orderReference,
        amountCents: order.totalCents,
        reason: reason || 'Customer refund verified by CEO Adnuel',
      },
    });

    this.addNotification({
      orderId: order.id,
      recipient: order.customerEmail,
      channel: 'email',
      event: 'payment_verified',
      message: `Your refund for VANTÉRA order ${order.orderReference} ($${(order.totalCents / 100).toFixed(2)}) has been confirmed.`,
    });

    saveDatabase(d);
    return order;
  },

  // Real Analytics Calculator
  getRealAnalytics(range: AnalyticsTimeRange, customStart?: string, customEnd?: string) {
    const d = loadDatabase();
    return calculateRealAnalytics({
      range,
      customStart,
      customEnd,
      now: new Date(),
      users: d.users as any,
      orders: d.orders as any,
      events: d.events || [],
      carts: (d.carts || []) as any,
      visitorSessions: d.visitorSessions || [],
    });
  },

  // Dual Currency Settings
  getCurrencySettings(): CurrencySettings {
    const d = loadDatabase();
    return d.currencySettings;
  },

  updateCurrencySettings(updates: Partial<CurrencySettings>, actor: string): CurrencySettings {
    const d = loadDatabase();
    d.currencySettings = {
      ...d.currencySettings,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };
    this.addAuditLog(actor, 'UPDATE_CURRENCY_SETTINGS', `Updated currency settings (Rate: ${d.currencySettings.ngnExchangeRate} NGN/USD)`);
    saveDatabase(d);
    return d.currencySettings;
  },

  // Custom Domain & Hosting Settings
  getDomainSettings(): CustomDomainSettings {
    const d = loadDatabase();
    return (
      d.customDomainSettings || {
        domain: '',
        status: 'not_configured',
        primaryRegistrar: 'Cloudflare / Namecheap / Whogohost',
        targetCname: 'ais-pre-mya5tkvgiwvj2cq7n3u4lg-518971387912.europe-west2.run.app',
        sslStatus: 'provisioning',
      }
    );
  },

  updateDomainSettings(updates: Partial<CustomDomainSettings>, actor: string): CustomDomainSettings {
    const d = loadDatabase();
    const current = d.customDomainSettings || {
      domain: '',
      status: 'not_configured',
      primaryRegistrar: 'Cloudflare / Namecheap / Whogohost',
      targetCname: 'ais-pre-mya5tkvgiwvj2cq7n3u4lg-518971387912.europe-west2.run.app',
      sslStatus: 'provisioning',
    };
    d.customDomainSettings = {
      ...current,
      ...updates,
      configuredAt: current.configuredAt || new Date().toISOString(),
      lastChecked: new Date().toISOString(),
    };
    this.addAuditLog(actor, 'UPDATE_DOMAIN_SETTINGS', `Configured custom domain: ${d.customDomainSettings.domain || 'Cleared'}`);
    saveDatabase(d);
    return d.customDomainSettings;
  },

  // Bank Account Destinations (Separate NGN and USD)
  getBankDestinations(): BankAccountDestination[] {
    const d = loadDatabase();
    return d.bankDestinations || [];
  },

  getActiveBankDestination(currency: 'USD' | 'NGN'): BankAccountDestination | undefined {
    const d = loadDatabase();
    return (d.bankDestinations || []).find((dest) => dest.currency === currency && dest.isActive);
  },

  addBankDestination(data: Omit<BankAccountDestination, 'id' | 'updatedAt'>, actor: string): BankAccountDestination {
    const d = loadDatabase();
    const newDest: BankAccountDestination = {
      ...data,
      id: `dest_${data.currency.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      updatedAt: new Date().toISOString(),
    };
    // If setting active, deactivate existing ones in that currency
    if (newDest.isActive) {
      d.bankDestinations.forEach((item) => {
        if (item.currency === newDest.currency) item.isActive = false;
      });
    }
    d.bankDestinations.push(newDest);
    this.addAuditLog(actor, 'ADD_BANK_DESTINATION', `Added new ${newDest.currency} account destination: ${newDest.bankName}`);
    saveDatabase(d);
    return newDest;
  },

  updateBankDestination(id: string, updates: Partial<BankAccountDestination>, actor: string): BankAccountDestination {
    const d = loadDatabase();
    const dest = d.bankDestinations.find((b) => b.id === id);
    if (!dest) throw new Error('Bank destination not found');

    if (updates.isActive) {
      d.bankDestinations.forEach((item) => {
        if (item.currency === dest.currency && item.id !== id) item.isActive = false;
      });
    }

    Object.assign(dest, updates, { updatedAt: new Date().toISOString() });
    this.addAuditLog(actor, 'UPDATE_BANK_DESTINATION', `Updated ${dest.currency} destination: ${dest.bankName}`);
    saveDatabase(d);
    return dest;
  },

  deleteBankDestination(id: string, actor: string): boolean {
    const d = loadDatabase();
    const idx = d.bankDestinations.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    const item = d.bankDestinations[idx];
    d.bankDestinations.splice(idx, 1);
    this.addAuditLog(actor, 'DELETE_BANK_DESTINATION', `Deleted ${item.currency} destination: ${item.bankName}`);
    saveDatabase(d);
    return true;
  },

  // Password Recovery & Cryptographic Verification Codes (5-min expiry)
  requestPasswordReset(email: string): { success: boolean; message: string } {
    const d = loadDatabase();
    const cleanEmail = email.trim().toLowerCase();
    const user = d.users.find((u) => u.email.toLowerCase() === cleanEmail);

    // Rate limit check: ensure 60s cooldown since last code
    const recent = d.verificationCodes
      .filter((c) => c.email.toLowerCase() === cleanEmail)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (recent && Date.now() - new Date(recent.createdAt).getTime() < 60000) {
      return {
        success: true,
        message: 'A verification code was recently generated. Please check your inbox or wait 60 seconds before requesting another.',
      };
    }

    if (user) {
      // Invalidate any previous codes
      d.verificationCodes.forEach((c) => {
        if (c.email.toLowerCase() === cleanEmail) c.used = true;
      });

      // Generate cryptographically secure 6-digit one-time code
      const code = crypto.randomInt(100000, 999999).toString();
      const salt = crypto.randomBytes(16).toString('hex');
      const codeHash = crypto.pbkdf2Sync(code, salt, 10000, 32, 'sha256').toString('hex');

      d.verificationCodes.unshift({
        id: `vcode_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        email: cleanEmail,
        codeHash,
        salt,
        expiresAt: Date.now() + 5 * 60 * 1000, // Strictly 5 minutes
        attempts: 0,
        used: false,
        createdAt: new Date().toISOString(),
      });

      // Dispatch notification
      this.addNotification({
        recipient: cleanEmail,
        channel: 'email',
        event: 'account_registered',
        message: `Your VANTÉRA security verification code is: ${code}. This code expires in 5 minutes. If you did not request this, please secure your account immediately.`,
      });

      this.addCustomerEvent({
        type: 'contact_form_submitted',
        customerId: user.id,
        customerEmail: cleanEmail,
        customerName: user.name,
        status: 'success',
        metadata: { action: 'password_reset_code_requested' },
      });

      saveDatabase(d);
    }

    // Always return generic response to prevent user enumeration
    return {
      success: true,
      message: 'If an account exists with this email address, a secure 6-digit verification code has been dispatched. The code will expire in 5 minutes.',
    };
  },

  verifyPasswordResetCode(email: string, code: string): { success: boolean; resetToken?: string; error?: string } {
    const d = loadDatabase();
    const cleanEmail = email.trim().toLowerCase();
    const now = Date.now();

    const record = d.verificationCodes
      .filter((c) => c.email.toLowerCase() === cleanEmail && !c.used)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!record) {
      return { success: false, error: 'No active verification code found for this account. Please request a new code.' };
    }

    if (now > record.expiresAt) {
      record.used = true;
      saveDatabase(d);
      return { success: false, error: 'The verification code has expired (5-minute limit). Please request a new one.' };
    }

    if (record.attempts >= 5) {
      record.used = true;
      saveDatabase(d);
      return { success: false, error: 'Too many invalid attempts. This code has been invalidated for security.' };
    }

    record.attempts += 1;
    const testHash = crypto.pbkdf2Sync(code.trim(), record.salt, 10000, 32, 'sha256').toString('hex');

    if (testHash !== record.codeHash) {
      saveDatabase(d);
      return { success: false, error: `Invalid verification code. ${5 - record.attempts} attempts remaining.` };
    }

    // Code is valid: mark as used and generate secure reset token
    record.used = true;
    const resetToken = `rst_${crypto.randomBytes(24).toString('hex')}`;
    const user = d.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (user) {
      user.resetToken = resetToken;
      user.resetTokenExpiry = Date.now() + 15 * 60 * 1000; // 15 mins to set password
    }

    saveDatabase(d);
    return { success: true, resetToken };
  },

  resetPasswordWithToken(resetToken: string, newPassword: string): { success: boolean; message: string } {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    const d = loadDatabase();
    const user = d.users.find((u) => u.resetToken === resetToken);

    if (!user || !user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
      throw new Error('Invalid or expired password reset session. Please request a new code.');
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    user.isPasswordSet = true;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    user.updatedAt = new Date().toISOString();

    this.addAuditLog(user.email, 'PASSWORD_RESET', 'Customer reset password via verified 6-digit one-time code.');
    this.addNotification({
      recipient: user.email,
      channel: 'email',
      event: 'account_registered',
      message: 'Your VANTÉRA password was updated successfully. You may now sign in with your new credentials.',
    });

    saveDatabase(d);
    return { success: true, message: 'Password has been updated successfully. Please sign in.' };
  },

  // Customer Profile & Saved Delivery Addresses
  getDeliveryAddresses(userId: string): DeliveryAddress[] {
    const d = loadDatabase();
    return (d.deliveryAddresses || []).filter((a) => a.userId === userId);
  },

  addDeliveryAddress(userId: string, data: Omit<DeliveryAddress, 'id' | 'userId' | 'createdAt'>): DeliveryAddress {
    const d = loadDatabase();
    d.deliveryAddresses = d.deliveryAddresses || [];

    if (data.isDefault) {
      d.deliveryAddresses.forEach((a) => {
        if (a.userId === userId) a.isDefault = false;
      });
    }

    const newAddress: DeliveryAddress = {
      ...data,
      id: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      createdAt: new Date().toISOString(),
    };

    d.deliveryAddresses.unshift(newAddress);
    saveDatabase(d);
    return newAddress;
  },

  updateDeliveryAddress(id: string, userId: string, updates: Partial<DeliveryAddress>): DeliveryAddress {
    const d = loadDatabase();
    const addr = (d.deliveryAddresses || []).find((a) => a.id === id && a.userId === userId);
    if (!addr) throw new Error('Address not found');

    if (updates.isDefault) {
      d.deliveryAddresses.forEach((a) => {
        if (a.userId === userId && a.id !== id) a.isDefault = false;
      });
    }

    Object.assign(addr, updates);
    saveDatabase(d);
    return addr;
  },

  deleteDeliveryAddress(id: string, userId: string): boolean {
    const d = loadDatabase();
    const idx = (d.deliveryAddresses || []).findIndex((a) => a.id === id && a.userId === userId);
    if (idx === -1) return false;
    d.deliveryAddresses.splice(idx, 1);
    saveDatabase(d);
    return true;
  },

  updateUserProfile(userId: string, data: { name?: string; phone?: string }): User {
    const d = loadDatabase();
    const user = d.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');

    if (data.name && data.name.trim()) user.name = data.name.trim();
    if (data.phone !== undefined) user.phone = data.phone.trim();
    user.updatedAt = new Date().toISOString();

    saveDatabase(d);
    return user;
  },

  // Promotions & Discounts (Coupons)
  getCoupons(): CouponRecord[] {
    const d = loadDatabase();
    return d.coupons || [];
  },

  addCoupon(data: Omit<CouponRecord, 'id' | 'usedCount' | 'createdAt'>, actor: string): CouponRecord {
    const d = loadDatabase();
    const cleanCode = data.code.trim().toUpperCase();
    if (d.coupons.some((c) => c.code === cleanCode)) {
      throw new Error(`Coupon code ${cleanCode} already exists`);
    }

    const newCoupon: CouponRecord = {
      ...data,
      id: `cpn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      code: cleanCode,
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };

    d.coupons.unshift(newCoupon);
    this.addAuditLog(actor, 'CREATE_COUPON', `Created coupon ${newCoupon.code} (${newCoupon.discountValue}${newCoupon.type === 'percentage' ? '%' : ' off'})`);
    saveDatabase(d);
    return newCoupon;
  },

  updateCoupon(id: string, updates: Partial<CouponRecord>, actor: string): CouponRecord {
    const d = loadDatabase();
    const coupon = d.coupons.find((c) => c.id === id);
    if (!coupon) throw new Error('Coupon not found');
    Object.assign(coupon, updates);
    this.addAuditLog(actor, 'UPDATE_COUPON', `Updated coupon ${coupon.code}`);
    saveDatabase(d);
    return coupon;
  },

  deleteCoupon(id: string, actor: string): boolean {
    const d = loadDatabase();
    const idx = d.coupons.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    const c = d.coupons[idx];
    d.coupons.splice(idx, 1);
    this.addAuditLog(actor, 'DELETE_COUPON', `Deleted coupon ${c.code}`);
    saveDatabase(d);
    return true;
  },

  validateCoupon(code: string, subtotalCents: number) {
    const d = loadDatabase();
    const coupon = (d.coupons || []).find((c) => c.code.toUpperCase() === code.trim().toUpperCase() && c.isActive);
    if (!coupon) return { valid: false, message: 'Invalid or inactive promo code.' };

    if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) {
      return { valid: false, message: 'This promo code has expired.' };
    }

    if (coupon.maxUsageCount && coupon.usedCount >= coupon.maxUsageCount) {
      return { valid: false, message: 'This promo code has reached its maximum usage limit.' };
    }

    if (coupon.minSpendCents && subtotalCents < coupon.minSpendCents) {
      return {
        valid: false,
        message: `This promo requires a minimum purchase of $${(coupon.minSpendCents / 100).toFixed(2)}.`,
      };
    }

    return { valid: true, coupon };
  },

  // Customer Support Ticketing System
  createSupportTicket(data: {
    customerId?: string | null;
    customerEmail: string;
    customerName: string;
    orderReference?: string | null;
    subject: string;
    category: SupportTicketRecord['category'];
    message: string;
  }): SupportTicketRecord {
    const d = loadDatabase();
    d.supportTickets = d.supportTickets || [];

    const ticketNumber = `TIK-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();

    const ticket: SupportTicketRecord = {
      id: `tkt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      ticketNumber,
      customerId: data.customerId || null,
      customerEmail: data.customerEmail.trim(),
      customerName: data.customerName.trim(),
      orderReference: data.orderReference?.trim() || null,
      subject: data.subject.trim(),
      category: data.category,
      status: 'open',
      messages: [
        {
          id: `msg_${Date.now()}`,
          sender: 'customer',
          senderName: data.customerName.trim(),
          message: data.message.trim(),
          timestamp: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    d.supportTickets.unshift(ticket);

    this.addNotification({
      recipient: AUTHORIZED_CEO_EMAIL,
      channel: 'email',
      event: 'order_created',
      message: `NEW SUPPORT TICKET ${ticketNumber} from ${ticket.customerName} (${ticket.customerEmail}): "${ticket.subject}"`,
    });

    saveDatabase(d);
    return ticket;
  },

  getSupportTickets(customerId?: string): SupportTicketRecord[] {
    const d = loadDatabase();
    d.supportTickets = d.supportTickets || [];
    if (customerId) {
      return d.supportTickets.filter((t) => t.customerId === customerId);
    }
    return d.supportTickets;
  },

  addTicketReply(ticketId: string, reply: { sender: 'customer' | 'ceo' | 'support'; senderName: string; message: string }): SupportTicketRecord {
    const d = loadDatabase();
    const ticket = (d.supportTickets || []).find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');

    const nowIso = new Date().toISOString();
    ticket.messages.push({
      id: `msg_${Date.now()}`,
      sender: reply.sender,
      senderName: reply.senderName,
      message: reply.message.trim(),
      timestamp: nowIso,
    });
    ticket.updatedAt = nowIso;
    if (reply.sender === 'ceo' || reply.sender === 'support') {
      ticket.status = 'in_progress';
      this.addNotification({
        recipient: ticket.customerEmail,
        channel: 'email',
        event: 'order_created',
        message: `Reply to VANTÉRA Support Ticket ${ticket.ticketNumber}: "${reply.message.slice(0, 100)}..."`,
      });
    }

    saveDatabase(d);
    return ticket;
  },

  updateTicketStatus(ticketId: string, status: SupportTicketRecord['status'], actor: string): SupportTicketRecord {
    const d = loadDatabase();
    const ticket = (d.supportTickets || []).find((t) => t.id === ticketId);
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    this.addAuditLog(actor, 'UPDATE_TICKET_STATUS', `Ticket ${ticket.ticketNumber} marked as ${status}`);
    saveDatabase(d);
    return ticket;
  },

  // Product Image Audit & Auto-Repair Engine
  getImageAudit(): ImageAuditSummary {
    const d = loadDatabase();
    const total = d.products.length;
    const working = d.products.filter((p) => p.image && !p.imageNeedsReview).length;
    const missing = d.products.filter((p) => !p.image).length;
    const awaitingReview = d.products.filter((p) => p.imageNeedsReview).length;
    const repaired = d.products.filter((p) => p.image && p.image.startsWith('https://images.unsplash.com')).length;

    return {
      lastScannedAt: new Date().toISOString(),
      totalProducts: total,
      withWorkingImages: working,
      missingImages: missing,
      repairedImages: repaired,
      awaitingReview,
    };
  },

  autoRepairProductImages(actor: string): { repairedCount: number; updatedProducts: Product[]; audit: ImageAuditSummary } {
    const d = loadDatabase();
    let repairedCount = 0;
    const updatedProducts: Product[] = [];

    for (const product of d.products) {
      const match = CURATED_PRODUCT_IMAGES[product.slug] || CURATED_PRODUCT_IMAGES[product.id];
      if (match) {
        if (!product.image || product.imageNeedsReview) {
          product.image = match.image;
          product.imageAlt = match.alt;
          product.imageNeedsReview = false;
          repairedCount += 1;
          updatedProducts.push(product);
        }
      }
    }

    const audit = this.getImageAudit();
    d.imageAudit = audit;
    this.addAuditLog(actor, 'AUTO_REPAIR_IMAGES', `Automated repair completed for ${repairedCount} product images.`);
    saveDatabase(d);

    return { repairedCount, updatedProducts, audit };
  },

  updateProductImage(productId: string, imageUrl: string, alt: string, actor: string): Product {
    const d = loadDatabase();
    const product = d.products.find((p) => p.id === productId || p.slug === productId);
    if (!product) throw new Error('Product not found');

    product.image = imageUrl;
    product.imageAlt = alt;
    product.imageNeedsReview = false;
    this.addAuditLog(actor, 'UPDATE_PRODUCT_IMAGE', `Updated image for ${product.title}`);
    saveDatabase(d);
    return product;
  },

  // Developer & Technical Operations Portal Backups
  getSystemHealth() {
    const d = loadDatabase();
    const mem = process.memoryUsage();
    return {
      status: 'operational',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      counts: {
        users: d.users.length,
        products: d.products.length,
        orders: d.orders.length,
        events: (d.events || []).length,
        carts: (d.carts || []).length,
        visitorSessions: (d.visitorSessions || []).length,
        auditLogs: d.auditLogs.length,
        coupons: (d.coupons || []).length,
        supportTickets: (d.supportTickets || []).length,
      },
      databaseSizeBytes: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
      nodeVersion: process.version,
    };
  },

  createDatabaseBackup(actor: string): { filename: string; sizeBytes: number; timestamp: string } {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vantera_backup_${timestamp}.json`;
    const targetPath = path.join(backupDir, filename);

    const d = loadDatabase();
    fs.writeFileSync(targetPath, JSON.stringify(d, null, 2), 'utf8');
    const sizeBytes = fs.statSync(targetPath).size;

    this.addAuditLog(actor, 'CREATE_DATABASE_BACKUP', `Snapshot saved to ${filename} (${Math.round(sizeBytes / 1024)} KB)`);
    return { filename, sizeBytes, timestamp };
  },

  listDatabaseBackups(): Array<{ filename: string; sizeBytes: number; createdAt: string }> {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) return [];

    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json'));
    return files
      .map((f) => {
        const stat = fs.statSync(path.join(backupDir, f));
        return {
          filename: f,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  restoreDatabaseBackup(filename: string, actor: string): boolean {
    const backupDir = path.join(DATA_DIR, 'backups');
    const targetPath = path.join(backupDir, filename);
    if (!fs.existsSync(targetPath)) throw new Error('Backup file not found');

    const content = fs.readFileSync(targetPath, 'utf8');
    const parsed = JSON.parse(content);
    saveDatabase(parsed);
    this.addAuditLog(actor, 'RESTORE_DATABASE_BACKUP', `Restored database from ${filename}`);
    return true;
  },

  verifyDatabaseIntegrity(): { status: 'healthy' | 'warning' | 'error'; tableCounts: Record<string, number>; issues: string[] } {
    const d = loadDatabase();
    const issues: string[] = [];

    if (!Array.isArray(d.products) || d.products.length === 0) issues.push('Products table empty');
    if (!Array.isArray(d.users)) issues.push('Users table missing');
    if (!d.currencySettings) issues.push('Currency settings unconfigured');
    if (!d.bankDestinations || d.bankDestinations.length === 0) issues.push('No bank destinations active');

    return {
      status: issues.length === 0 ? 'healthy' : 'warning',
      tableCounts: {
        products: d.products.length,
        users: d.users.length,
        orders: d.orders.length,
        events: (d.events || []).length,
        carts: (d.carts || []).length,
        auditLogs: d.auditLogs.length,
        coupons: (d.coupons || []).length,
        supportTickets: (d.supportTickets || []).length,
      },
      issues,
    };
  },
};

type EventListener = (event: CustomerEvent) => void;
const eventListeners: EventListener[] = [];

export function subscribeToEvents(listener: EventListener): () => void {
  eventListeners.push(listener);
  return () => {
    const idx = eventListeners.indexOf(listener);
    if (idx > -1) eventListeners.splice(idx, 1);
  };
}

function notifyEventListeners(event: CustomerEvent) {
  for (const listener of eventListeners) {
    try {
      listener(event);
    } catch (e) {
      console.error('Error in event listener:', e);
    }
  }
}
