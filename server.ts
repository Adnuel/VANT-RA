import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dns from 'dns';
import {
  db,
  createToken,
  verifyToken,
  verifyPassword,
  hashPassword,
  AUTHORIZED_CEO_EMAIL,
  AUTHORIZED_CEO_NAME,
  subscribeToEvents,
  type User,
} from './server/db.ts';
import { calculateBusinessProfits } from './src/lib/commerceLogic.ts';
import type { AnalyticsTimeRange } from './src/lib/analyticsLogic.ts';
import { paystack } from './server/paystack.ts';
import { wavy } from './server/wavy.ts';
import { fetchLiveExchangeRate, setManualRateOverride, clearManualRateOverride } from './server/currency.ts';
import { sendTransactionalEmail, emailTemplates, getDomainDnsRecords } from './server/mailer.ts';
import { calculateDeliveryFee, validateNigerianPhone, NIGERIAN_STATES } from './src/data/nigerianStates.ts';
import { cjService } from './server/cj.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = process.cwd();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

// Strict Production Security Headers & HTTPS Enforcement
app.use((req: Request, res: Response, next: NextFunction) => {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const host = String(req.headers.host || '').toLowerCase();
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (
    process.env.NODE_ENV === 'production' &&
    proto === 'http' &&
    !isLocalHost &&
    !req.path.includes('/webhook')
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// Rate limiter for authentication attempts (max 5 failed attempts per 15 mins)
const loginAttemptTracker = new Map<string, { attempts: number; lockedUntil: number }>();

function checkLoginRateLimit(key: string): { allowed: boolean; waitMinutes?: number } {
  const now = Date.now();
  const record = loginAttemptTracker.get(key);
  if (!record) return { allowed: true };
  if (record.lockedUntil > now) {
    const waitMinutes = Math.ceil((record.lockedUntil - now) / 60000);
    return { allowed: false, waitMinutes };
  }
  if (record.lockedUntil <= now && record.attempts >= 5) {
    loginAttemptTracker.delete(key);
  }
  return { allowed: true };
}

function recordFailedLoginAttempt(key: string) {
  const now = Date.now();
  const record = loginAttemptTracker.get(key) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15-minute lock
  }
  loginAttemptTracker.set(key, record);
}

function clearFailedLoginAttempts(key: string) {
  loginAttemptTracker.delete(key);
}

// Serve static assets from public
app.use(express.static(path.resolve(ROOT_DIR, 'public')));
app.use('/products', express.static(path.resolve(ROOT_DIR, 'public/products')));
app.use('/manus-storage', express.static(path.resolve(ROOT_DIR, 'public/manus-storage')));

/* Auth Middleware */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    phone?: string;
    isEmailVerified?: boolean;
  };
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (payload) {
    const user = db.getUserById(payload.userId);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified ?? true,
      };
    }
  }
  next();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (
    !req.user ||
    req.user.role !== 'admin' ||
    req.user.email.toLowerCase() !== AUTHORIZED_CEO_EMAIL.toLowerCase()
  ) {
    return res.status(403).json({
      error: 'Access denied. Administrative actions are restricted exclusively to authorized CEO Adnuel.',
    });
  }
  next();
}

function requireDevOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const isCeo = req.user.role === 'admin' && req.user.email.toLowerCase() === AUTHORIZED_CEO_EMAIL.toLowerCase();
  const isDev = req.user.role === 'developer';
  if (!isCeo && !isDev) {
    return res.status(403).json({ error: 'Developer or Administrative privileges required.' });
  }
  next();
}

app.use(authMiddleware);

// Record first-party visitor session on every request
app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const sessionId = (req.headers['x-vantera-session'] as string) || (req.query.sid as string);
  if (sessionId) {
    db.recordVisitorSession(sessionId, req.user?.id || null);
  }
  next();
});

/* ========================================================================== */
/* PUBLIC STOREFRONT & CUSTOMER AUTH API                                      */
/* ========================================================================== */

// Register customer (requires mandatory verification code)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, state, lga, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    let formattedPhone = phone ? String(phone).trim() : '';
    if (formattedPhone) {
      const phoneValidation = validateNigerianPhone(formattedPhone);
      if (!phoneValidation.valid) {
        return res.status(400).json({ error: phoneValidation.error });
      }
      formattedPhone = phoneValidation.formatted;
    }

    const newUser = db.createCustomer(name, email, password, formattedPhone);

    if (address && String(address).trim() && state && String(state).trim()) {
      db.addDeliveryAddress(newUser.id, {
        fullName: name.trim(),
        phone: formattedPhone || '',
        streetAddress: String(address).trim(),
        city: (lga ? String(lga).trim() : '') || 'Lagos',
        state: String(state).trim(),
        postalCode: '100001',
        country: 'Nigeria',
        isDefault: true,
      });
    }

    const token = createToken({ userId: newUser.id, email: newUser.email, role: newUser.role });

    // Send verification email
    if (newUser.emailVerificationCode) {
      await sendTransactionalEmail(emailTemplates.signupVerificationCode(newUser.email, newUser.name, newUser.emailVerificationCode));
    }

    res.json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        isEmailVerified: newUser.isEmailVerified ?? false,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// Login customer with rate limiting protection
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const clientKey = `${req.ip}_${cleanEmail}`;
    const rateLimit = checkLoginRateLimit(clientKey);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Account temporarily locked due to repeated failed login attempts. Please wait ${rateLimit.waitMinutes || 15} minutes before retrying.`,
      });
    }

    const user = db.getUserByEmail(cleanEmail);
    if (!user || !user.passwordHash || !user.salt || !verifyPassword(password, user.passwordHash, user.salt)) {
      recordFailedLoginAttempt(clientKey);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    clearFailedLoginAttempts(clientKey);
    const token = createToken({ userId: user.id, email: user.email, role: user.role });

    db.addCustomerEvent({
      type: 'customer_login',
      customerId: user.id,
      customerEmail: user.email,
      customerName: user.name,
      status: 'success',
      metadata: { role: user.role },
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified ?? true,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Verify email address with 6-digit OTP code
app.post('/api/auth/verify-email', (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and 6-digit code are required.' });
  }
  const result = db.verifyEmail(email, code);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  const verifiedUser = db.getUserByEmail(email);
  res.json({
    success: true,
    message: 'Email verified successfully.',
    user: verifiedUser
      ? {
          id: verifiedUser.id,
          name: verifiedUser.name,
          email: verifiedUser.email,
          phone: verifiedUser.phone,
          role: verifiedUser.role,
          isEmailVerified: true,
        }
      : undefined,
  });
});

// Resend email verification code
app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });
  const result = db.resendVerificationCode(email);
  if (result.code) {
    const user = db.getUserByEmail(email);
    await sendTransactionalEmail(emailTemplates.signupVerificationCode(email, user?.name || 'Client', result.code));
  }
  res.json({ success: true, message: 'Verification code sent.' });
});

// Change account password (authenticated)
app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  const result = db.changePassword(req.user!.id, currentPassword, newPassword);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true, message: 'Password updated successfully.' });
});

// Request return or cancellation (authenticated)
app.post(['/api/customer/orders/:id/return', '/api/customer/orders/:id/return-request'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason, notes, type } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'Reason for return or cancellation is required.' });
    }
    const cleanReason = type
      ? `[${String(type).toUpperCase()}] ${String(reason).trim()}`
      : String(reason).trim();
    const order = db.requestOrderReturn(req.params.id, req.user!.id, cleanReason, notes ? String(notes).trim() : '');
    await sendTransactionalEmail(emailTemplates.returnRequestSubmitted(order, cleanReason));
    res.json({ success: true, order, message: 'Return request submitted. Our concierge team will review promptly.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to submit return request' });
  }
});

// Logout customer
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const verified = verifyToken(authHeader.substring(7));
    if (verified) {
      const user = db.getUserById(verified.userId);
      db.addCustomerEvent({
        type: 'customer_logout',
        customerId: verified.userId,
        customerEmail: verified.email,
        customerName: user?.name,
        status: 'success',
      });
    }
  }
  res.json({ success: true });
});

// Get current user profile
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// Update customer profile
app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phone } = req.body;
    if (phone) {
      const phoneCheck = validateNigerianPhone(String(phone));
      if (!phoneCheck.valid) {
        return res.status(400).json({ error: phoneCheck.error });
      }
    }
    const updated = db.updateUserProfile(req.user!.id, {
      name,
      phone: phone ? validateNigerianPhone(String(phone)).formatted : phone,
    });
    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
        isEmailVerified: updated.isEmailVerified ?? true,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Cryptographically secure password reset request (5-min verification code)
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address required.' });
  }
  const result = db.requestPasswordReset(email);
  if (result.dispatchedCode && result.recipientEmail) {
    await sendTransactionalEmail(emailTemplates.passwordResetOTP(result.recipientEmail, result.dispatchedCode));
  }
  res.json({
    success: result.success,
    message: result.message,
  });
});

// Verify 6-digit one-time verification code
app.post('/api/auth/verify-reset-code', (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and 6-digit code are required.' });
  }
  const result = db.verifyPasswordResetCode(email, code);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// Complete password reset with verified token
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }
  try {
    const result = db.resetPasswordWithToken(resetToken, newPassword);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Customer Delivery Addresses
app.get('/api/customer/addresses', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const addresses = db.getDeliveryAddresses(req.user!.id);
  res.json({ addresses });
});

app.post('/api/customer/addresses', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const address = db.addDeliveryAddress(req.user!.id, req.body);
    res.json({ address });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/customer/addresses/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const address = db.updateDeliveryAddress(req.params.id, req.user!.id, req.body);
    res.json({ address });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/customer/addresses/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteDeliveryAddress(req.params.id, req.user!.id);
  res.json({ success });
});

// Customer Isolated Orders
app.get('/api/customer/orders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const orders = db.getCustomerOrders(req.user!.id, req.user!.email);
  res.json({ orders });
});

app.get('/api/customer/orders/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // STRICT DATA ISOLATION
  const isOwner =
    (order.customerId && order.customerId === req.user!.id) ||
    order.customerEmail.toLowerCase() === req.user!.email.toLowerCase();
  const isAdmin = req.user!.role === 'admin' && req.user!.email === AUTHORIZED_CEO_EMAIL;

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Unauthorized to view this order.' });
  }

  res.json({ order });
});

// Customer-Isolated Persistent Cart
app.get('/api/customer/cart', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const cart = db.getCustomerCart(req.user!.id);
  res.json({ cart: cart || { items: [], itemCount: 0, subtotalCents: 0 } });
});

app.post('/api/customer/cart', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { items, subtotalCents } = req.body;
  const cart = db.saveCustomerCart(
    req.user!.id,
    req.user!.email,
    Array.isArray(items) ? items : [],
    typeof subtotalCents === 'number' ? subtotalCents : 0
  );
  res.json({ success: true, cart });
});

app.delete('/api/customer/cart', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  db.clearCustomerCart(req.user!.id);
  res.json({ success: true });
});

/* ========================================================================== */
/* STOREFRONT PRODUCTS & CHECKOUT API                                         */
/* ========================================================================== */

// Get all products
app.get('/api/products', (_req: Request, res: Response) => {
  const products = db.getProducts();
  res.json({ products });
});

// Get product by slug
app.get('/api/products/:slug', (req: Request, res: Response) => {
  const product = db.getProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

// Visitor Geo-Location Currency Auto-Detection
app.get('/api/geo', (req: Request, res: Response) => {
  const countryHeader =
    (req.headers['cf-ipcountry'] as string) ||
    (req.headers['x-vercel-ip-country'] as string) ||
    (req.headers['x-appengine-country'] as string) ||
    '';
  const normalized = countryHeader.trim().toUpperCase();
  const isNigeria = normalized === 'NG';
  res.json({
    countryCode: normalized || null,
    isNigeria,
    currency: isNigeria ? 'NGN' : normalized ? 'USD' : null,
  });
});

// Nigerian State Delivery Fee Calculator
app.post('/api/shipping/calculate', async (req: Request, res: Response) => {
  const { state, country, subtotalCents, subtotalNgn } = req.body;
  const fx = await fetchLiveExchangeRate();
  const safeSubtotalCents = typeof subtotalCents === 'number' ? subtotalCents : 0;
  const safeSubtotalNgn =
    typeof subtotalNgn === 'number' ? subtotalNgn : Math.round((safeSubtotalCents / 100) * fx.usdToNgnRate);
  const calc = calculateDeliveryFee(state || 'Lagos', country || 'Nigeria', safeSubtotalCents, safeSubtotalNgn);
  res.json({
    ...calc,
    statesCount: NIGERIAN_STATES.length,
  });
});

// Create Order (Checkout — Strictly Authenticated Client Accounts Only)
app.post('/api/orders', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Client account required. Please sign in or create an account before placing an order.',
        requiresAuth: true,
      });
    }

    const {
      customerEmail,
      customerName,
      customerPhone,
      shippingAddress,
      cartItems,
      notes,
      currency,
      couponCode,
      paymentMethod,
      paymentReference,
    } = req.body;

    if (!customerEmail || !customerName || !shippingAddress || !cartItems || !cartItems.length) {
      return res.status(400).json({ error: 'Incomplete order checkout details' });
    }

    const rawPhone = String(customerPhone || shippingAddress.phone || '').trim();
    const isNigeria = !shippingAddress.country || String(shippingAddress.country).trim().toLowerCase() === 'nigeria';
    let normalizedPhone = rawPhone;
    if (isNigeria) {
      const phoneCheck = validateNigerianPhone(rawPhone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ error: phoneCheck.error || 'Please provide a valid Nigerian +234 phone number.' });
      }
      normalizedPhone = phoneCheck.formatted;
    }

    const fx = await fetchLiveExchangeRate();

    // Compute authoritative item subtotal to derive real state-based delivery fee
    const catalog = new Map(db.getProducts().map((p) => [p.id, p]));
    let subtotalCents = 0;
    for (const item of cartItems) {
      const prod = catalog.get(item.productId || item.id);
      if (prod) {
        subtotalCents += prod.retailPriceCents * Math.max(1, Math.min(99, item.quantity || 1));
      }
    }
    const subtotalNgn = Math.round((subtotalCents / 100) * fx.usdToNgnRate);
    const shippingCalc = calculateDeliveryFee(
      shippingAddress.state || 'Lagos',
      shippingAddress.country || 'Nigeria',
      subtotalCents,
      subtotalNgn
    );

    const order = db.createOrder({
      customerId: req.user.id,
      customerEmail: customerEmail || req.user.email,
      customerName: customerName || req.user.name,
      customerPhone: normalizedPhone,
      shippingAddress: {
        ...shippingAddress,
        phone: normalizedPhone,
      },
      cartItems,
      currency: currency === 'NGN' ? 'NGN' : 'USD',
      shippingFeeCents: shippingCalc.feeCents,
      estimatedTransitTime: shippingCalc.transitTime,
      couponCode,
      notes,
      paymentMethod: paymentMethod === 'card_online' ? 'card_online' : 'bank_transfer',
      paymentReference: paymentReference || null,
      paymentGateway: paymentMethod === 'card_online' ? 'wavy' : null,
      paymentStatus: 'pending',
      exchangeRateUsed: fx.usdToNgnRate,
      exchangeRateProvider: fx.provider,
      exchangeRateTimestamp: fx.lastUpdated,
    });

    await sendTransactionalEmail(emailTemplates.orderConfirmation(order));

    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to place order' });
  }
});

// Public Order Tracking & Payment Status Confirmation by Reference
app.get(['/api/orders/track/:reference', '/api/orders/status/:reference'], (req: AuthenticatedRequest, res: Response) => {
  const order = db.getOrderByReference(req.params.reference);
  if (!order) return res.status(404).json({ error: 'Order not found with that reference' });

  const isOwnerOrAdmin =
    req.user &&
    ((order.customerId && order.customerId === req.user.id) ||
      order.customerEmail.toLowerCase() === req.user.email.toLowerCase() ||
      (req.user.role === 'admin' && req.user.email.toLowerCase() === AUTHORIZED_CEO_EMAIL.toLowerCase()));

  const safeOrder = {
    orderReference: order.orderReference,
    createdAt: order.createdAt,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    paymentVerifiedAt: order.paymentVerifiedAt,
    fulfilmentStatus: order.fulfilmentStatus,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    items: order.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.totalCents,
      image: item.image,
    })),
    itemCount: order.items.reduce((acc, i) => acc + i.quantity, 0),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents || 0,
    couponCode: order.couponCode || null,
    shippingFeeCents: order.shippingFeeCents,
    totalCents: order.totalCents,
    currency: order.currency || 'USD',
    exchangeRateUsed: order.exchangeRateUsed || 1500,
    estimatedTransitTime: order.estimatedTransitTime || '1–4 business days',
    returnRequested: order.returnRequested || false,
    returnStatus: order.returnStatus,
    shippingAddress: {
      city: order.shippingAddress?.city,
      state: order.shippingAddress?.state,
      country: order.shippingAddress?.country,
      ...(isOwnerOrAdmin
        ? {
            fullName: order.shippingAddress?.fullName,
            streetAddress: order.shippingAddress?.streetAddress,
            phone: order.shippingAddress?.phone,
          }
        : {}),
    },
  };

  res.json({
    ...safeOrder,
    order: safeOrder,
  });
});

// Customer submits bank transfer payment reference
app.post('/api/orders/payment-proof', (req: Request, res: Response) => {
  try {
    const { orderReference, notes } = req.body;
    if (!orderReference || !notes) {
      return res.status(400).json({ error: 'Order reference and transfer details are required' });
    }
    const order = db.submitPaymentProof(orderReference, notes);
    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Dual Currency Settings (Public Live FX Rates)
app.get('/api/currency-settings', async (_req: Request, res: Response) => {
  const fxData = await fetchLiveExchangeRate();
  const dbSettings = db.getCurrencySettings();
  res.json({
    settings: {
      defaultCurrency: dbSettings.defaultCurrency || 'USD',
      ngnExchangeRate: fxData.usdToNgnRate,
      usdToNgnRate: fxData.usdToNgnRate,
      ngnToUsdRate: fxData.ngnToUsdRate,
      provider: fxData.provider,
      lastUpdated: fxData.lastUpdated,
      isLive: fxData.isLive,
      isStale: fxData.isStale,
      isManualOverride: fxData.isManualOverride,
      manualOverrideBy: fxData.manualOverrideBy || null,
      manualOverrideReason: fxData.manualOverrideReason || null,
      enableNgn: true,
      enableUsd: true,
    },
  });
});

// Bank settings & destinations for checkout instructions (Public)
app.get('/api/bank-details', (_req: Request, res: Response) => {
  const bank = db.getBankSettings();
  const destinations = db.getBankDestinations();
  const activeNgn = db.getActiveBankDestination('NGN');
  const activeUsd = db.getActiveBankDestination('USD');
  res.json({ bankSettings: bank, destinations, activeNgn, activeUsd });
});

app.get('/api/bank-destinations', (_req: Request, res: Response) => {
  const destinations = db.getBankDestinations();
  const activeNgn = db.getActiveBankDestination('NGN');
  const activeUsd = db.getActiveBankDestination('USD');
  res.json({ destinations, activeNgn, activeUsd });
});

// Public Payment Gateway Settings (Wavy & Bank Transfer)
app.get('/api/payment-settings', (_req: Request, res: Response) => {
  const settings = db.getPaymentSettings();
  res.json({
    wavyEnabled: settings.wavyEnabled ?? true,
    wavyPublicKey: wavy.getPublicKey(),
    paystackEnabled: settings.paystackEnabled,
    paystackPublicKey: wavy.getPublicKey(),
    bankTransferEnabled: settings.bankTransferEnabled,
    isTestMode: wavy.isTestMode(),
  });
});

// Wavy & Paystack: Initialize Online Card Checkout
app.post(['/api/payments/wavy/initialize', '/api/payments/paystack/initialize'], async (req: Request, res: Response) => {
  try {
    const { email, amount, amountKobo, reference, orderReference, currency } = req.body;
    const finalAmount = amount || (amountKobo ? amountKobo / 100 : 100);
    const trackingRef = orderReference || reference;

    if (!email || !reference) {
      return res.status(400).json({ error: 'Email and order reference are required' });
    }

    const baseAppUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const initResult = await wavy.initializeCheckout({
      email,
      amount: finalAmount,
      reference,
      merchantReference: trackingRef,
      currency: currency || 'NGN',
      callbackUrl: `${baseAppUrl}/order-confirmed?reference=${encodeURIComponent(reference)}&orderReference=${encodeURIComponent(trackingRef)}`,
      description: `VANTÉRA Order #${trackingRef}`,
    });

    res.json(initResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Wavy initialization error' });
  }
});

// Wavy & Paystack: Authoritative Server-Side Payment Verification
app.post(['/api/payments/wavy/verify', '/api/payments/paystack/verify'], async (req: Request, res: Response) => {
  try {
    const { reference, orderReference } = req.body;
    const targetRef = orderReference || reference;

    if (!reference) {
      return res.status(400).json({ error: 'Payment reference is required' });
    }

    // 1. Check if webhook has already verified & marked the order paid
    const existingOrder = db.getOrderByReference(targetRef) || db.getOrderByReference(reference);
    if (existingOrder && existingOrder.paymentStatus === 'paid') {
      return res.json({
        success: true,
        order: existingOrder,
        verifyData: { status: 'success', reference, channel: 'webhook_verified' },
      });
    }

    if (existingOrder && existingOrder.paymentStatus === 'failed') {
      return res.status(400).json({
        success: false,
        failed: true,
        pending: false,
        error: existingOrder.paymentProofNotes || 'Transaction was declined or cancelled.',
      });
    }

    // 2. Query Wavy gateway server-side
    const verifyResult = await wavy.verifyTransaction(reference);
    const txStatus = String(verifyResult.data?.status || '').toLowerCase();

    if (verifyResult.status && (txStatus === 'success' || txStatus === 'successful')) {
      const order = db.markOrderPaidOnline(
        existingOrder ? existingOrder.orderReference : targetRef,
        reference,
        verifyResult.data?.channel || 'wavy_card'
      );
      await sendTransactionalEmail(emailTemplates.paymentVerified(order));
      return res.json({ success: true, order, verifyData: verifyResult.data });
    }

    if (['failed', 'cancelled', 'abandoned', 'declined'].includes(txStatus)) {
      if (existingOrder) {
        db.failOrderPayment(existingOrder.orderReference, verifyResult.message || `Gateway status: ${txStatus}`);
      }
      return res.status(400).json({
        success: false,
        failed: true,
        pending: false,
        error: verifyResult.message || 'Payment failed or was cancelled at the gateway.',
      });
    }

    return res.status(202).json({
      success: false,
      failed: false,
      pending: true,
      error: verifyResult.message || 'Awaiting gateway confirmation.',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Payment verification failed' });
  }
});

// Mark failed / cancelled online checkout & release reserved stock
app.post('/api/payments/wavy/fail', (req: Request, res: Response) => {
  const { orderReference, reference, reason } = req.body;
  const target = orderReference || reference;
  if (!target) {
    return res.status(400).json({ error: 'Order reference required' });
  }
  const order = db.failOrderPayment(target, reason || 'Payment cancelled by customer or declined by bank.');
  res.json({ success: true, order });
});

// Wavy & Paystack Verified Webhook Handler (Signature Verification + Idempotency)
app.post(['/api/payments/wavy/webhook', '/api/payments/paystack/webhook'], async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-wavy-signature'] || req.headers['x-paystack-signature'] || '') as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (!signature || !paystack.validateWebhookSignature(rawBody, signature)) {
      return res.status(400).send('Invalid webhook signature');
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const data = event?.data || event;
    const txRef = String(data?.reference || data?.tx_ref || data?.id || '');
    const orderRef = String(data?.metadata?.orderReference || data?.merchantReference || txRef);
    const eventName = String(event?.event || '').toLowerCase();
    const txStatus = String(data?.status || '').toLowerCase();

    if (txRef && db.isWebhookProcessed(txRef)) {
      return res.sendStatus(200);
    }

    if (eventName === 'charge.success' || eventName === 'payment.success' || txStatus === 'success' || txStatus === 'successful') {
      try {
        const order = db.markOrderPaidOnline(orderRef, txRef || orderRef, data?.channel || 'wavy_webhook');
        if (txRef) db.recordProcessedWebhook(txRef, event);
        await sendTransactionalEmail(emailTemplates.paymentVerified(order));
      } catch (err) {
        console.error('[PAYMENT WEBHOOK ERROR]', err);
      }
    } else if (eventName === 'charge.failed' || eventName === 'payment.failed' || txStatus === 'failed' || txStatus === 'cancelled') {
      try {
        db.failOrderPayment(orderRef, data?.gateway_response || 'Payment failed via gateway webhook');
        if (txRef) db.recordProcessedWebhook(txRef, event);
      } catch (err) {
        console.error('[PAYMENT WEBHOOK FAIL ERROR]', err);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(400);
  }
});

// Coupon validation (Checkout)
app.post('/api/coupons/apply', (req: Request, res: Response) => {
  const { code, subtotalCents } = req.body;
  if (!code) return res.status(400).json({ valid: false, message: 'Coupon code required' });
  const result = db.validateCoupon(code, typeof subtotalCents === 'number' ? subtotalCents : 0);
  res.json(result);
});

/* ========================================================================== */
/* CLOUDFLARE PAGES EQUIVALENT CORE HANDLER: WAVY & ZENDROP                   */
/* ========================================================================== */
app.post('/api/vantera-core-handler', async (req: Request, res: Response) => {
  try {
    const { gateway, reference, customer, items, totalAmount, currency = 'USD' } = req.body;

    if (!gateway || !reference) {
      return res.status(400).json({ success: false, error: 'Missing gateway or transaction reference ID.' });
    }
    if (!customer || !customer.email || !customer.fullName) {
      return res.status(400).json({ success: false, error: 'Incomplete customer shipping details.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order line items cannot be empty.' });
    }

    // 1. Payment Verification exclusively via Wavy (wavy.ng)
    let verifiedPayment: any = null;
    const lowerGateway = (gateway || 'wavy').toLowerCase();

    if (lowerGateway === 'wavy' || lowerGateway === 'paystack' || lowerGateway === 'card') {
      const verifyResult = await wavy.verifyTransaction(reference);
      const txStatus = String(verifyResult.data?.status || '').toLowerCase();
      if (verifyResult.status && (txStatus === 'success' || txStatus === 'successful')) {
        verifiedPayment = {
          id: verifyResult.data?.reference || reference,
          amount: verifyResult.data?.amount || totalAmount,
          currency: verifyResult.data?.currency || currency,
          status: 'paid',
          gateway: 'wavy',
        };
      }

      if (!verifiedPayment) {
        return res.status(402).json({
          success: false,
          error: verifyResult.message || 'Transaction could not be confirmed as paid by Wavy.',
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: `Unsupported gateway: ${gateway}. VANTÉRA processes transactions exclusively through Wavy.`,
      });
    }

    // 2. Automated Zendrop Dropshipping Dispatch
    const zendropApiKey = process.env.ZENDROP_API_KEY;
    const nameParts = (customer.fullName || '').trim().split(' ');
    const firstName = nameParts[0] || 'Client';
    const lastName = nameParts.slice(1).join(' ') || 'VANTÉRA';

    const zendropOrderPayload = {
      order: {
        external_id: `VAN-${reference.slice(0, 16)}`,
        email: customer.email,
        shipping_address: {
          first_name: firstName,
          last_name: lastName,
          address1: customer.streetAddress,
          address2: customer.apartment || '',
          city: customer.city,
          province: customer.state || '',
          zip: customer.postalCode || '100001',
          country: customer.country || 'Nigeria',
          phone: customer.phone || '',
        },
        line_items: items.map((item: any) => ({
          variant_id: item.variantId || item.id,
          quantity: item.quantity || 1,
          price: item.price || 0,
        })),
        notes: `VANTÉRA Atelier Direct Order via ${gateway.toUpperCase()}`,
      },
    };

    let zendropResult = {
      success: true,
      status: 'dispatched_to_fulfillment_pipeline',
      message: 'Order verified and routed to automated Zendrop logistics.',
    };

    if (zendropApiKey) {
      try {
        const zRes = await fetch('https://api.zendrop.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${zendropApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(zendropOrderPayload),
        });
        const zData = await zRes.json();
        zendropResult = {
          success: zRes.ok,
          status: zRes.ok ? 'forwarded_to_warehouse' : 'queued_fulfillment',
          message: zData.message || (zRes.ok ? 'Dispatched to Zendrop warehouse' : 'Zendrop queued'),
        };
      } catch (err: any) {
        console.error('[Core Handler] Zendrop dispatch error:', err);
      }
    }

    // Record order in local DB for CEO dashboard tracking
    try {
      db.createOrder({
        customerId: null,
        customerEmail: customer.email,
        customerName: customer.fullName,
        customerPhone: customer.phone || '',
        shippingAddress: {
          fullName: customer.fullName,
          phone: customer.phone || '',
          streetAddress: customer.streetAddress,
          apartment: customer.apartment || '',
          city: customer.city,
          state: customer.state,
          postalCode: customer.postalCode || '100001',
          country: customer.country,
        },
        cartItems: items.map((i: any) => ({
          productId: i.id,
          quantity: i.quantity || 1,
        })),
        currency: currency === 'NGN' ? 'NGN' : 'USD',
        notes: `Gateway: ${gateway} | Ref: ${reference} | Zendrop Status: ${zendropResult.status}`,
      });
    } catch (dbErr) {
      console.warn('[Core Handler] Database order record notice:', dbErr);
    }

    return res.json({
      success: true,
      orderReference: reference,
      orderId: `VAN-${Date.now().toString(36).toUpperCase()}`,
      payment: verifiedPayment,
      fulfillment: zendropResult,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Core Handler] Execution error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal handler error' });
  }
});

// Customer Support Tickets
app.post('/api/support/tickets', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, subject, category, message, orderReference } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject, and message are required.' });
    }
    const ticket = db.createSupportTicket({
      customerId: req.user?.id || null,
      customerEmail: email,
      customerName: name,
      orderReference,
      subject,
      category: category || 'general',
      message,
    });
    res.json({ ticket, message: `Your support ticket ${ticket.ticketNumber} has been submitted.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customer/support/tickets', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const tickets = db.getSupportTickets(req.user!.id);
  res.json({ tickets });
});

app.post('/api/support/tickets/:id/reply', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, senderName } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const isCeo = req.user?.role === 'admin' && req.user.email.toLowerCase() === AUTHORIZED_CEO_EMAIL.toLowerCase();
    const sender = isCeo ? 'ceo' : 'customer';
    const name = senderName || req.user?.name || (isCeo ? 'CEO Adnuel' : 'Client');

    const ticket = db.addTicketReply(req.params.id, {
      sender,
      senderName: name,
      message,
    });
    res.json({ ticket });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Client Telemetry & Event Tracking
app.post('/api/track', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, metadata, sessionId } = req.body;
    if (!type) return res.status(400).json({ error: 'Event type required' });

    const customerId = req.user?.id || null;
    const customerEmail = req.user?.email || null;
    const customerName = req.user?.name || null;

    if (sessionId) {
      db.recordVisitorSession(sessionId, customerId);
    }

    const event = db.addCustomerEvent({
      type,
      customerId,
      customerEmail,
      customerName,
      sessionId: sessionId || null,
      status: 'success',
      metadata: metadata || {},
    });

    res.json({ success: true, eventId: event.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Active Cart Sync (Stores customer cart state & detects abandonment)
app.post('/api/cart/sync', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, items, itemCount, subtotalCents, sessionId } = req.body;
    if (!id) return res.status(400).json({ error: 'Cart ID required' });

    db.syncCart({
      id,
      customerId: req.user?.id || null,
      customerEmail: req.user?.email || null,
      sessionId: sessionId || null,
      items: Array.isArray(items) ? items : [],
      itemCount: typeof itemCount === 'number' ? itemCount : 0,
      subtotalCents: typeof subtotalCents === 'number' ? subtotalCents : 0,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Newsletter & Privé Registry Subscription
app.post('/api/newsletter', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, category, sessionId } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const enrollmentCode = `VP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    db.addCustomerEvent({
      type: 'newsletter_subscribed',
      customerId: req.user?.id || null,
      customerEmail: cleanEmail,
      customerName: (name ? String(name).trim() : null) || req.user?.name || null,
      sessionId: sessionId || null,
      status: 'success',
      metadata: {
        source: name || category ? 'vip_registry' : 'footer_signup',
        category: category || null,
        enrollmentCode,
      },
    });
    db.addNotification({
      recipient: cleanEmail,
      channel: 'email',
      event: 'account_registered',
      message: `Thank you for registering with VANTÉRA. Priority Reference: ${enrollmentCode}.`,
    });
    res.json({
      success: true,
      enrollmentCode,
      message: 'Thank you for subscribing to VANTÉRA.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Real Customer Reviews (Stored in DB — no fabricated quotes)
app.get('/api/reviews', (_req: Request, res: Response) => {
  res.json({ reviews: db.getReviews() });
});

app.post('/api/reviews', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rating, comment, productTitle, location } = req.body;
    if (!comment || typeof comment !== 'string' || comment.trim().length < 8) {
      return res.status(400).json({ error: 'Please write a brief review (at least 8 characters).' });
    }
    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }
    const review = db.addReview({
      customerId: req.user!.id,
      customerEmail: req.user!.email,
      customerName: req.user!.name,
      location: location ? String(location) : 'Nigeria',
      rating: numRating,
      comment,
      productTitle: productTitle ? String(productTitle) : undefined,
    });
    res.status(201).json({ review, success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unable to save review' });
  }
});

// Customer Contact Form
app.post('/api/contact', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, subject, message, phone, sessionId } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    db.addCustomerEvent({
      type: 'contact_form_submitted',
      customerId: req.user?.id || null,
      customerEmail: cleanEmail,
      customerName: name.trim(),
      sessionId: sessionId || null,
      status: 'success',
      metadata: {
        subject: subject?.trim() || 'General Inquiry',
        phone: phone?.trim(),
        messagePreview: message.slice(0, 150),
      },
    });
    db.addNotification({
      recipient: AUTHORIZED_CEO_EMAIL,
      channel: 'email',
      event: 'order_created',
      message: `NEW CLIENT INQUIRY from ${name} (${cleanEmail}): "${subject || 'General Inquiry'} - ${message.slice(0, 100)}"`,
    });
    res.json({ success: true, message: 'Your message has been sent to CEO Adnuel. We will reply promptly.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ========================================================================== */
/* PRIVATE CEO DASHBOARD API (STRICT AUTHORIZATION: Adnuel)                   */
/* ========================================================================== */

// Check if CEO has set password
app.get('/api/admin/setup-status', (_req: Request, res: Response) => {
  const ceo = db.getUserByEmail(AUTHORIZED_CEO_EMAIL);
  res.json({
    authorizedEmail: AUTHORIZED_CEO_EMAIL,
    authorizedName: AUTHORIZED_CEO_NAME,
    isPasswordSet: !!(ceo && ceo.isPasswordSet),
  });
});

// Initial secure setup for CEO password
app.post('/api/admin/setup-password', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || email.trim().toLowerCase() !== AUTHORIZED_CEO_EMAIL.toLowerCase()) {
      return res.status(403).json({
        error: `Only the authorized CEO email (${AUTHORIZED_CEO_EMAIL}) can establish administrative credentials.`,
      });
    }

    const ceo = db.getUserByEmail(AUTHORIZED_CEO_EMAIL);
    if (ceo && ceo.isPasswordSet) {
      return res.status(400).json({ error: 'Administrator password is already established. Please sign in.' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Administrator password must be at least 8 characters long.' });
    }

    const updatedCeo = db.setAdminPassword(password);
    const token = createToken({ userId: updatedCeo.id, email: updatedCeo.email, role: updatedCeo.role });

    res.json({
      success: true,
      token,
      user: {
        id: updatedCeo.id,
        name: updatedCeo.name,
        email: updatedCeo.email,
        role: updatedCeo.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CEO Login (rate-limited)
app.post('/api/admin/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const clientKey = `admin_${req.ip}_${cleanEmail}`;
    const rateLimit = checkLoginRateLimit(clientKey);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Admin login temporarily locked after repeated failures. Wait ${rateLimit.waitMinutes || 15} minutes.`,
      });
    }

    if (cleanEmail !== AUTHORIZED_CEO_EMAIL.toLowerCase()) {
      recordFailedLoginAttempt(clientKey);
      return res.status(403).json({
        error: 'Access denied. Only the authorized CEO account can access this administrative portal.',
      });
    }

    const user = db.getUserByEmail(cleanEmail);
    if (!user || !user.isPasswordSet || !user.passwordHash || !user.salt) {
      return res.status(401).json({
        error: 'Administrator credentials not yet established. Please complete setup.',
        requiresSetup: true,
      });
    }

    if (!verifyPassword(password, user.passwordHash, user.salt)) {
      recordFailedLoginAttempt(clientKey);
      return res.status(401).json({ error: 'Invalid administrator password.' });
    }

    clearFailedLoginAttempts(clientKey);
    const token = createToken({ userId: user.id, email: user.email, role: 'admin' });
    db.addAuditLog('CEO Adnuel', 'ADMIN_LOGIN', 'CEO signed into private dashboard.');

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CEO Admin Dashboard Metrics
app.get('/api/admin/dashboard-stats', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const orders = db.getOrders();
  const products = db.getProducts();
  const allUsers = (db as any).getUserById ? db.getOrders() : [];
  const notifications = db.getNotifications();

  // Metrics calculation
  const totalOrders = orders.length;
  const newOrders = orders.filter((o) => o.paymentStatus === 'pending' || o.paymentStatus === 'awaiting_verification').length;
  const paidOrders = orders.filter((o) => o.paymentStatus === 'paid').length;
  const unpaidOrders = orders.filter((o) => o.paymentStatus !== 'paid' && o.paymentStatus !== 'refunded').length;
  const awaitingFulfilment = orders.filter((o) => o.paymentStatus === 'paid' && o.fulfilmentStatus !== 'delivered' && o.fulfilmentStatus !== 'cancelled').length;
  const shippedOrders = orders.filter((o) => o.fulfilmentStatus === 'shipped').length;
  const deliveredOrders = orders.filter((o) => o.fulfilmentStatus === 'delivered').length;
  const cancelledOrders = orders.filter((o) => o.fulfilmentStatus === 'cancelled').length;
  const pendingRefunds = orders.filter((o) => o.paymentStatus === 'refunded').length;

  const totalProducts = products.length;
  const availableProducts = products.filter((p) => p.isAvailable && p.stockQuantity > 0).length;
  const lowStockProducts = products.filter((p) => p.isAvailable && p.stockQuantity > 0 && p.stockQuantity <= 5).length;
  const outOfStockProducts = products.filter((p) => !p.isAvailable || p.stockQuantity === 0).length;

  // Real profit metrics
  const profitMetrics = calculateBusinessProfits(orders);

  // Registered customers count from real DB
  const rawDb = (db as any).getOrders ? JSON.parse(fs.readFileSync(path.join(__dirname, 'data/vantera_db.json'), 'utf8')) : { users: [] };
  const registeredCustomers = rawDb.users.filter((u: User) => u.role === 'customer').length;

  res.json({
    orders: {
      total: totalOrders,
      new: newOrders,
      paid: paidOrders,
      unpaid: unpaidOrders,
      awaitingFulfilment,
      shipped: shippedOrders,
      delivered: deliveredOrders,
      cancelled: cancelledOrders,
      pendingRefunds,
    },
    products: {
      total: totalProducts,
      available: availableProducts,
      lowStock: lowStockProducts,
      outOfStock: outOfStockProducts,
    },
    finances: profitMetrics,
    customers: {
      registered: registeredCustomers,
    },
    recentNotifications: notifications.slice(0, 10),
  });
});

// Real-Time Database-Backed CEO Analytics with filters
app.get('/api/admin/analytics', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const range = (req.query.range as AnalyticsTimeRange) || 'today';
  const customStart = req.query.start as string | undefined;
  const customEnd = req.query.end as string | undefined;
  const analytics = db.getRealAnalytics(range, customStart, customEnd);
  res.json({ analytics });
});

// Live Customer Event Feed (Genuine Database Logs)
app.get('/api/admin/events', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const type = req.query.type as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const since = req.query.since as string | undefined;
  const events = db.getCustomerEvents({ type, limit, since });
  res.json({ events });
});

// Real-Time Server-Sent Events (SSE) Stream for Instant Activity Feed Updates
app.get('/api/admin/events/stream', (req: Request, res: Response) => {
  const token = (req.headers.authorization?.replace(/^Bearer\s+/i, '')) || (req.query.token as string);
  if (!token) {
    return res.status(401).send('Unauthorized');
  }
  const verified = verifyToken(token);
  if (!verified || verified.role !== 'admin' || verified.email.toLowerCase() !== AUTHORIZED_CEO_EMAIL.toLowerCase()) {
    return res.status(403).send('Forbidden');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Initial heartbeat
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribeToEvents((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});

// CEO Orders Management
app.get('/api/admin/orders', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  let orders = db.getOrders();
  const { paymentStatus, fulfilmentStatus, search } = req.query;

  if (paymentStatus && typeof paymentStatus === 'string') {
    orders = orders.filter((o) => o.paymentStatus === paymentStatus);
  }
  if (fulfilmentStatus && typeof fulfilmentStatus === 'string') {
    orders = orders.filter((o) => o.fulfilmentStatus === fulfilmentStatus);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    orders = orders.filter(
      (o) =>
        o.orderReference.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q)
    );
  }

  res.json({ orders });
});

// CEO Verify Payment
app.post('/api/admin/orders/:id/verify-payment', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = db.verifyPayment(req.params.id, `${AUTHORIZED_CEO_NAME} (${AUTHORIZED_CEO_EMAIL})`);
    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CEO Confirm Refund
app.post('/api/admin/orders/:id/refund', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const order = db.refundOrder(req.params.id, `${AUTHORIZED_CEO_NAME} (${AUTHORIZED_CEO_EMAIL})`, reason);
    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CEO Update Shipping & Tracking
app.post('/api/admin/orders/:id/shipping', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { carrier, trackingNumber, trackingUrl, status } = req.body;
    if (!carrier || !trackingNumber) {
      return res.status(400).json({ error: 'Carrier and tracking number are required' });
    }
    const order = db.updateShipping(
      req.params.id,
      {
        carrier,
        trackingNumber,
        trackingUrl: trackingUrl || `https://www.google.com/search?q=${encodeURIComponent(trackingNumber)}`,
        status,
      },
      `${AUTHORIZED_CEO_NAME}`
    );
    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CEO Update Fulfilment Status
app.post('/api/admin/orders/:id/status', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    const order = db.updateOrderStatus(req.params.id, status, AUTHORIZED_CEO_NAME);
    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CEO Full Order Editing (Real-Time)
app.put('/api/admin/orders/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user?.name || AUTHORIZED_CEO_NAME;
    const order = db.updateOrderDetails(req.params.id, req.body, actor);
    res.json({ order, success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update order' });
  }
});

// CEO Approve / Decline Customer Return or Cancellation Request
app.post('/api/admin/orders/:id/return-status', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { returnStatus, adminNotes } = req.body;
    if (!['approved', 'rejected', 'completed'].includes(returnStatus)) {
      return res.status(400).json({ error: 'Invalid return status.' });
    }
    const order = db.updateOrderReturnStatus(
      req.params.id,
      returnStatus,
      req.user?.name || AUTHORIZED_CEO_NAME,
      adminNotes
    );
    res.json({ order, success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update return status' });
  }
});

// CEO Email Deliverability DNS Records (SPF, DKIM, DMARC, MX)
app.get('/api/admin/email-dns-records', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const domainSettings = db.getDomainSettings();
  const domain = domainSettings.domain || 'vantera.com.ng';
  res.json({ domain, records: getDomainDnsRecords(domain) });
});

// CEO Products Management
app.get('/api/admin/products', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const products = db.getProducts();
  res.json({ products });
});

app.put('/api/admin/products/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateProduct(req.params.id, req.body, AUTHORIZED_CEO_NAME);
    res.json({ product: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/products', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const added = db.addProduct(req.body, AUTHORIZED_CEO_NAME);
    res.json({ product: added });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CEO Customer Management
app.get('/api/admin/customers', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const rawDb = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/vantera_db.json'), 'utf8'));
  const customers = rawDb.users
    .filter((u: User) => u.role === 'customer')
    .map((u: User) => {
      const orders = db.getCustomerOrders(u.id, u.email);
      const totalSpent = orders.filter((o) => o.paymentStatus === 'paid').reduce((acc, o) => acc + o.totalCents, 0);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        createdAt: u.createdAt,
        orderCount: orders.length,
        totalSpentCents: totalSpent,
      };
    });

  res.json({ customers });
});

// CEO Suppliers Management
app.get('/api/admin/suppliers', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ suppliers: db.getSuppliers() });
});

app.put('/api/admin/suppliers/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateSupplier(req.params.id, req.body, AUTHORIZED_CEO_NAME);
    res.json({ supplier: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CJ Dropshipping API 2.0 Authentication Status & Connection Test (CEO Only — never exposes keys or tokens)
app.get('/api/admin/suppliers/cj/status', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const cjStatus = await cjService.getStatus();
    res.json({ cj: cjStatus });
  } catch {
    res.status(500).json({
      cj: {
        status: 'Connection unavailable',
        message: 'Unable to check CJ Dropshipping connection status.',
        configured: cjService.isConfigured(),
        hasAccessToken: false,
        hasRefreshToken: false,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTestedAt: new Date().toISOString(),
        lastRefreshedAt: null,
        accountInfo: null,
      },
    });
  }
});

app.post('/api/admin/suppliers/cj/test', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const cjStatus = await cjService.testConnection();
    res.json({ cj: cjStatus });
  } catch {
    res.status(500).json({
      cj: {
        status: 'Connection unavailable',
        message: 'Unable to complete CJ Dropshipping connection test.',
        configured: cjService.isConfigured(),
        hasAccessToken: false,
        hasRefreshToken: false,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastTestedAt: new Date().toISOString(),
        lastRefreshedAt: null,
        accountInfo: null,
      },
    });
  }
});

// CEO Bank Settings
app.get('/api/admin/bank-settings', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ bankSettings: db.getBankSettings() });
});

app.put('/api/admin/bank-settings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updateBankSettings(req.body, AUTHORIZED_CEO_NAME);
  res.json({ bankSettings: updated });
});

// CEO Audit Logs
app.get('/api/admin/audit-logs', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ auditLogs: db.getAuditLogs() });
});

// CEO Notifications
app.get('/api/admin/notifications', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ notifications: db.getNotifications() });
});

// CEO Payment Gateway Settings (Paystack & Cards)
app.get('/api/admin/payment-settings', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ paymentSettings: db.getPaymentSettings() });
});

app.put('/api/admin/payment-settings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updatePaymentSettings(req.body, AUTHORIZED_CEO_NAME);
    res.json({ paymentSettings: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CEO Currency Settings & Live FX Engine
app.get('/api/admin/currency/status', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const fxData = await fetchLiveExchangeRate();
  res.json({ fxData, dbSettings: db.getCurrencySettings() });
});

app.post('/api/admin/currency/refresh', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const fxData = await fetchLiveExchangeRate();
    res.json({ success: true, fxData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/currency/manual-override', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rate, reason } = req.body;
    if (!rate || isNaN(Number(rate)) || Number(rate) <= 0) {
      return res.status(400).json({ error: 'Valid positive exchange rate required' });
    }
    const fxData = setManualRateOverride(
      Number(rate),
      req.user!.name || AUTHORIZED_CEO_NAME,
      reason || 'CEO Verified Rate Override'
    );
    res.json({ success: true, fxData });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/currency/clear-override', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fxData = await clearManualRateOverride(req.user!.name || AUTHORIZED_CEO_NAME);
    res.json({ success: true, fxData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/currency-settings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateCurrencySettings(req.body, AUTHORIZED_CEO_NAME);
    res.json({ settings: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Custom Domain & Hosting Settings
app.get('/api/admin/domain-settings', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ domainSettings: db.getDomainSettings() });
});

app.put('/api/admin/domain-settings', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateDomainSettings(req.body, AUTHORIZED_CEO_NAME);
    res.json({ domainSettings: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/public/domain-info', (_req: Request, res: Response) => {
  const settings = db.getDomainSettings();
  res.json({
    activeDomain: settings.domain || null,
    targetCname: settings.targetCname,
    status: settings.status,
  });
});

// CEO Bank Account Destinations (Separate NGN and USD)
app.get('/api/admin/bank-destinations', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ destinations: db.getBankDestinations() });
});

app.post('/api/admin/bank-destinations', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const created = db.addBankDestination(req.body, AUTHORIZED_CEO_NAME);
    res.json({ destination: created });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/bank-destinations/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateBankDestination(req.params.id, req.body, AUTHORIZED_CEO_NAME);
    res.json({ destination: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/bank-destinations/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteBankDestination(req.params.id, AUTHORIZED_CEO_NAME);
  res.json({ success });
});

// CEO Coupons & Promotions Management
app.get('/api/admin/coupons', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ coupons: db.getCoupons() });
});

app.post('/api/admin/coupons', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const coupon = db.addCoupon(req.body, AUTHORIZED_CEO_NAME);
    res.json({ coupon });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/admin/coupons/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateCoupon(req.params.id, req.body, AUTHORIZED_CEO_NAME);
    res.json({ coupon: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/coupons/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteCoupon(req.params.id, AUTHORIZED_CEO_NAME);
  res.json({ success });
});

// CEO Support Tickets Management
app.get('/api/admin/support/tickets', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ tickets: db.getSupportTickets() });
});

app.put('/api/admin/support/tickets/:id/status', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    const ticket = db.updateTicketStatus(req.params.id, status, AUTHORIZED_CEO_NAME);
    res.json({ ticket });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CEO Product Image Audit & Auto-Repair Engine
app.get('/api/admin/image-audit', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ audit: db.getImageAudit() });
});

app.post('/api/admin/image-audit/auto-repair', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = db.autoRepairProductImages(AUTHORIZED_CEO_NAME);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/products/:id/image', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imageUrl, alt } = req.body;
    const updated = db.updateProductImage(req.params.id, imageUrl, alt || '', AUTHORIZED_CEO_NAME);
    res.json({ product: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Developer & Technical Operations Portal Routes
app.get('/api/dev/health', requireDevOrAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ health: db.getSystemHealth() });
});

app.get('/api/dev/backups', requireDevOrAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ backups: db.listDatabaseBackups() });
});

app.post('/api/dev/backups', requireDevOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user?.name || AUTHORIZED_CEO_NAME;
    const backup = db.createDatabaseBackup(actor);
    res.json({ backup, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dev/backups/:filename/restore', requireDevOrAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user?.name || AUTHORIZED_CEO_NAME;
    const success = db.restoreDatabaseBackup(req.params.filename, actor);
    res.json({ success, message: `Database successfully restored from ${req.params.filename}` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/dev/integrity', requireDevOrAdmin, (_req: AuthenticatedRequest, res: Response) => {
  res.json(db.verifyDatabaseIntegrity());
});

// Live DNS Propagation & Domain Connectivity Checker
app.post('/api/dev/check-domain', async (req: Request, res: Response) => {
  const { domain } = req.body;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Valid domain name required (e.g. vantera.store)' });
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const targetHost = 'ais-pre-mya5tkvgiwvj2cq7n3u4lg-518971387912.europe-west2.run.app';

  try {
    let resolvedCnames: string[] = [];
    let resolvedA: string[] = [];
    let isCnameMatched = false;
    let isReachable = false;

    // Check CNAME (cleanDomain or www.cleanDomain)
    try {
      resolvedCnames = await dns.promises.resolveCname(cleanDomain);
      isCnameMatched = resolvedCnames.some(
        (c) => c.toLowerCase().includes('run.app') || c.toLowerCase().includes(targetHost.toLowerCase())
      );
    } catch {
      // If root domain, also test www
      if (!cleanDomain.startsWith('www.')) {
        try {
          const wwwCnames = await dns.promises.resolveCname(`www.${cleanDomain}`);
          resolvedCnames = [...resolvedCnames, ...wwwCnames.map((c) => `www: ${c}`)];
          if (wwwCnames.some((c) => c.toLowerCase().includes('run.app') || c.toLowerCase().includes(targetHost.toLowerCase()))) {
            isCnameMatched = true;
          }
        } catch {}
      }
    }

    // Check A records
    try {
      resolvedA = await dns.promises.resolve4(cleanDomain);
    } catch {}

    // Check HTTPS response
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const testRes = await fetch(`https://${cleanDomain}`, {
        method: 'HEAD',
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);
      if (testRes && testRes.status < 500) {
        isReachable = true;
      }
    } catch {}

    const isConfigured = isCnameMatched || isReachable;
    const hasDns = resolvedA.length > 0 || resolvedCnames.length > 0;

    res.json({
      domain: cleanDomain,
      resolvedCnames,
      resolvedA,
      targetHost,
      isCnameMatched,
      isReachable,
      status: isConfigured ? 'active' : hasDns ? 'propagating' : 'dns_pending',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.json({
      domain: cleanDomain,
      resolvedCnames: [],
      resolvedA: [],
      targetHost,
      isCnameMatched: false,
      isReachable: false,
      status: 'dns_pending',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Direct ZIP download endpoint with forced binary attachment headers
app.get('/api/download-zip', async (_req: Request, res: Response) => {
  try {
    const zipPath = path.resolve(ROOT_DIR, 'public/vantera-project.zip');
    if (fs.existsSync(zipPath)) {
      const stat = fs.statSync(zipPath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="vantera-project.zip"');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      const readStream = fs.createReadStream(zipPath);
      return readStream.pipe(res);
    }

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    const addFilesRecursively = (dir: string, currentZip: any) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (
          item === 'node_modules' ||
          item === 'dist' ||
          item === 'dev-dist' ||
          item === '.git' ||
          item === '.aistudio' ||
          item === '.playwright-cli' ||
          item === 'aistudio' ||
          item.endsWith('.zip') ||
          item === '.DS_Store'
        ) {
          continue;
        }
        const full = path.join(dir, item);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          addFilesRecursively(full, currentZip.folder(item));
        } else {
          currentZip.file(item, fs.readFileSync(full));
        }
      }
    };

    addFilesRecursively(ROOT_DIR, zip);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="vantera-project.zip"');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.end(buffer);
  } catch (err: any) {
    console.error('ZIP generation error:', err);
    return res.status(500).json({ error: 'Failed to generate project archive' });
  }
});

// Direct Android Project ZIP download endpoint with atomic binary buffer headers
app.get('/api/download-android-project', async (_req: Request, res: Response) => {
  try {
    const zipPath = path.resolve(ROOT_DIR, 'public/vantera-android-project.zip');
    let fileBuffer: Buffer;

    if (fs.existsSync(zipPath)) {
      fileBuffer = fs.readFileSync(zipPath);
    } else {
      // Dynamically generate the lightweight Android project ZIP if missing
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      const addDirToZip = (dirPath: string, zipFolder: any) => {
        if (!fs.existsSync(dirPath)) return;
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          if (
            item === 'node_modules' ||
            item === '.git' ||
            item === 'build' ||
            item === 'products' ||
            item === 'manus-storage' ||
            item.endsWith('.zip') ||
            item.startsWith('mobile_')
          ) {
            continue;
          }
          const fullPath = path.join(dirPath, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            addDirToZip(fullPath, zipFolder.folder(item));
          } else {
            zipFolder.file(item, fs.readFileSync(fullPath));
          }
        }
      };

      addDirToZip(path.resolve(ROOT_DIR, 'android'), zip.folder('android'));

      const capConfigPath = path.resolve(ROOT_DIR, 'capacitor.config.json');
      if (fs.existsSync(capConfigPath)) {
        zip.file('capacitor.config.json', fs.readFileSync(capConfigPath));
      }

      const readmePath = path.resolve(ROOT_DIR, 'README_ANDROID.md');
      if (fs.existsSync(readmePath)) {
        zip.file('README_ANDROID.md', fs.readFileSync(readmePath, 'utf8'));
      }

      fileBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      fs.writeFileSync(zipPath, fileBuffer);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="vantera-android-project.zip"');
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.end(fileBuffer);
  } catch (err: any) {
    console.error('Android ZIP download error in server:', err);
    res.status(500).json({ error: 'Failed to deliver Android project package' });
  }
});

// Explicit API 404 handler to guarantee all unhandled /api/* routes return JSON rather than SPA HTML
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global API error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err?.status || 500).json({ error: err?.message || 'Internal server error' });
});

/* ========================================================================== */
/* VITE MIDDLEWARE & SERVER STARTUP                                           */
/* ========================================================================== */

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production build static serving
    app.use(express.static(path.resolve(ROOT_DIR, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(ROOT_DIR, 'dist/index.html'));
    });
  }

  cjService.startAutoRefreshScheduler();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VANTÉRA Engine] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[VANTÉRA Engine] Storefront: http://localhost:${PORT}/`);
    console.log(`[VANTÉRA Engine] CEO Dashboard: http://localhost:${PORT}/admin/dashboard`);
    console.log(`[VANTÉRA Engine] CEO Login: http://localhost:${PORT}/admin/login`);
  });
}

startServer();
