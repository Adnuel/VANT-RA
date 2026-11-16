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
import { calculateBusinessProfits, convertUsdCentsToNgn } from './src/lib/commerceLogic.ts';
import type { AnalyticsTimeRange } from './src/lib/analyticsLogic.ts';
import type { Product, ProductVariant } from './src/data/catalog.ts';
import {
  calculateSellingPriceCents,
  calculateProductDependentPricingCents,
  suggestVanteraCategory,
  type CjPricingMode,
} from './src/lib/cjPricing.ts';
import {
  CURATED_CATEGORIES,
  getCuratedCategoryById,
  matchesCuratedSpec,
  findMatchingCuratedSpec,
  type CuratedProductTypeSpec,
} from './src/lib/curatedCjCatalog.ts';
import { paystack } from './server/paystack.ts';
import { wavy } from './server/wavy.ts';
import { fetchLiveExchangeRate, setManualRateOverride, clearManualRateOverride } from './server/currency.ts';
import { sendTransactionalEmail, emailTemplates, getDomainDnsRecords } from './server/mailer.ts';
import { calculateDeliveryFee, validateNigerianPhone, NIGERIAN_STATES } from './src/data/nigerianStates.ts';
import {
  cjService,
  CjApiRequestError,
  CjAuthError,
  CjConnectionUnavailableError,
} from './server/cj.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = process.cwd();

const app = express();
function resolveServerPort(argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env): number {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' || arg === '-p') {
      const next = argv[i + 1];
      const parsed = next ? parseInt(next, 10) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } else if (arg.startsWith('--port=')) {
      const parsed = parseInt(arg.slice('--port='.length), 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }

  const envPort = env.PORT ? parseInt(env.PORT, 10) : NaN;
  const nginxPort = env.NGINX_PORT ? parseInt(env.NGINX_PORT, 10) : NaN;
  const defaultAppPort = env.DEFAULT_APP_PORT ? parseInt(env.DEFAULT_APP_PORT, 10) : NaN;

  if (Number.isFinite(envPort) && envPort > 0) {
    // Avoid colliding with the container's reverse-proxy NGINX_PORT (e.g. 8080) during dev preview
    if (Number.isFinite(nginxPort) && envPort === nginxPort) {
      return Number.isFinite(defaultAppPort) && defaultAppPort > 0 ? defaultAppPort : 3000;
    }
    return envPort;
  }

  if (Number.isFinite(defaultAppPort) && defaultAppPort > 0) {
    return defaultAppPort;
  }

  return 3000;
}

const PORT = resolveServerPort();

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

// Serve product media and, in development, public static assets
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.resolve(ROOT_DIR, 'public')));
}
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

// Register customer (requires mandatory email verification code before session token is issued)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, state, lga, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (String(password).length < 6) {
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

    const newUser = db.createCustomer(String(name), cleanEmail, String(password), formattedPhone);

    if (address && String(address).trim() && state && String(state).trim()) {
      db.addDeliveryAddress(newUser.id, {
        fullName: String(name).trim(),
        phone: formattedPhone || '',
        streetAddress: String(address).trim(),
        city: (lga ? String(lga).trim() : '') || 'Lagos',
        state: String(state).trim(),
        postalCode: '100001',
        country: 'Nigeria',
        isDefault: true,
      });
    }

    // Dispatch 6-digit verification code to customer email
    let mailChannel: 'smtp' | 'resend' | 'system_queue' = 'system_queue';
    let mailSuccess = true;
    let mailError: string | undefined;
    if (newUser.emailVerificationCode) {
      const mailResult = await sendTransactionalEmail(
        emailTemplates.signupVerificationCode(newUser.email, newUser.name, newUser.emailVerificationCode)
      );
      mailChannel = mailResult.channel;
      mailSuccess = mailResult.success;
      mailError = mailResult.error;
    }

    const emailSent = mailSuccess && mailChannel !== 'system_queue';

    return res.status(201).json({
      requiresVerification: true,
      email: newUser.email,
      emailSent,
      deliveryChannel: mailChannel,
      message: emailSent
        ? `A 6-digit verification code has been sent to ${newUser.email}. Enter it below to confirm your new account.`
        : mailError
        ? `Pending account created for ${newUser.email}, but email delivery failed (${mailError}). Check SMTP settings and click Resend Code.`
        : `Pending account created for ${newUser.email}. Live email transport (SMTP or Resend API) is not configured on the server yet, so an email could not be delivered to your inbox.`,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// Login customer with rate limiting protection (blocks unverified new accounts until OTP confirmed)
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

    // Enforce verification code confirmation for NEW accounts only (existing accounts where isEmailVerified is true or undefined pass straight through)
    if (user.isEmailVerified === false) {
      return res.status(403).json({
        error: 'Please enter the 6-digit verification code sent to your email to confirm your new account before signing in.',
        requiresVerification: true,
        email: user.email,
      });
    }

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

// Verify email address with 6-digit OTP code and activate session for newly registered accounts
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
  const token = verifiedUser
    ? createToken({ userId: verifiedUser.id, email: verifiedUser.email, role: verifiedUser.role })
    : undefined;

  if (verifiedUser) {
    db.addCustomerEvent({
      type: 'customer_registered',
      customerId: verifiedUser.id,
      customerEmail: verifiedUser.email,
      customerName: verifiedUser.name,
      status: 'success',
      metadata: { role: verifiedUser.role, emailVerified: true },
    });
  }

  res.json({
    success: true,
    message: 'Email verified and account confirmed!',
    token,
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

// Resend email verification code (only for unverified new accounts)
app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required.' });
  const result = db.resendVerificationCode(email);
  if (!result.success || !result.code) {
    return res.status(400).json({ error: result.error || 'Unable to resend verification code.' });
  }
  const user = db.getUserByEmail(email);
  const mailResult = await sendTransactionalEmail(
    emailTemplates.signupVerificationCode(email, user?.name || 'Client', result.code)
  );
  const emailSent = mailResult.success && mailResult.channel !== 'system_queue';
  res.json({
    success: true,
    emailSent,
    deliveryChannel: mailResult.channel,
    message: emailSent
      ? `A fresh 6-digit verification code has been sent to ${email}.`
      : mailResult.error
      ? `Code regenerated, but SMTP delivery failed (${mailResult.error}).`
      : 'Code regenerated, but live email transport (SMTP or Resend API) is not configured on the server yet.',
  });
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

function sanitizeProductForStorefront(product: Product): Product {
  const {
    supplierName: _supplierName,
    supplierLink: _supplierLink,
    supplierSource: _supplierSource,
    cjPid: _cjPid,
    cjProductSku: _cjProductSku,
    cjCategoryName: _cjCategoryName,
    pricingConfig: _pricingConfig,
    variants,
    ...rest
  } = product;

  const sanitizedVariants: ProductVariant[] | undefined = Array.isArray(variants)
    ? variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        color: v.color,
        size: v.size,
        variantKey: v.variantKey,
        image: v.image,
        supplierCostCents: null,
        retailPriceCents: v.retailPriceCents,
        stockQuantity: v.stockQuantity,
        isAvailable: v.isAvailable && v.stockQuantity > 0,
      }))
    : undefined;

  return {
    ...rest,
    supplierCostCents: null,
    variants: sanitizedVariants,
  };
}

// Lightweight readiness & pre-warming health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, status: 'ready' });
});

// Get all products (supplier costs, keys & CJ internal identifiers stripped)
app.get('/api/products', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const products = db.getProducts().map(sanitizeProductForStorefront);
  res.json({ products });
});

// Get product by slug (supplier costs, keys & CJ internal identifiers stripped)
app.get('/api/products/:slug', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const product = db.getProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: sanitizeProductForStorefront(product) });
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

// Real-Time CJ Dropshipping Freight Quote for Customer Cart (never fabricates quotes)
app.post('/api/shipping/cj-quote', async (req: Request, res: Response) => {
  try {
    const { destinationCountryCode, items, zip } = req.body || {};
    const endCountry = String(destinationCountryCode || 'NG').trim().toUpperCase();
    const rawItems = Array.isArray(items) ? items : [];
    const catalogMap = new Map(db.getProducts().map((p) => [p.id, p]));

    const cjLines = new Map<string, number>();
    for (const item of rawItems) {
      const prod = catalogMap.get(String(item?.productId || ''));
      if (!prod || !Array.isArray(prod.variants) || prod.variants.length === 0) continue;
      const variant = item.variantId
        ? prod.variants.find((v) => v.id === item.variantId)
        : prod.variants.find((v) => v.isAvailable && v.stockQuantity > 0) || prod.variants[0];
      if (!variant?.cjVid) continue;
      const qty = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
      cjLines.set(variant.cjVid, (cjLines.get(variant.cjVid) || 0) + qty);
    }

    if (cjLines.size === 0) {
      return res.json({ hasCjItems: false, destinationCountryCode: endCountry, options: [] });
    }

    const products = Array.from(cjLines.entries()).map(([vid, quantity]) => ({ vid, quantity }));
    const [freight, fx] = await Promise.all([
      cjService.calculateFreight({
        startCountryCode: 'CN',
        endCountryCode: endCountry,
        products,
        zip: zip ? String(zip) : undefined,
      }),
      fetchLiveExchangeRate(),
    ]);

    const options = freight.options.map((opt) => ({
      ...opt,
      totalPostageFeeNgn: convertUsdCentsToNgn(opt.totalPostageFeeCents, fx.usdToNgnRate),
      logisticPriceNgn: convertUsdCentsToNgn(opt.logisticPriceCents, fx.usdToNgnRate),
    }));

    return res.json({
      hasCjItems: true,
      startCountryCode: freight.startCountryCode,
      endCountryCode: freight.endCountryCode,
      usdToNgnRate: fx.usdToNgnRate,
      options,
    });
  } catch (err: any) {
    const status =
      err instanceof CjAuthError
        ? 502
        : err instanceof CjConnectionUnavailableError
        ? 503
        : err instanceof CjApiRequestError
        ? err.httpStatus
        : 400;
    return res.status(status).json({
      hasCjItems: true,
      error: err?.message || 'Unable to retrieve CJ shipping rates for this destination.',
      options: [],
    });
  }
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
        const variant =
          item.variantId && Array.isArray(prod.variants)
            ? prod.variants.find((v) => v.id === item.variantId)
            : undefined;
        const unitPrice = variant ? variant.retailPriceCents : prod.retailPriceCents;
        subtotalCents += unitPrice * Math.max(1, Math.min(99, item.quantity || 1));
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
    res.json({ product: added, success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Explicitly remove a product (CEO Only — products are never removed unless explicitly deleted here)
app.delete('/api/admin/products/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = db.deleteProduct(req.params.id, AUTHORIZED_CEO_NAME);
    res.json({
      success: true,
      deletedId: result.deleted.id,
      deletedTitle: result.deleted.title,
      remainingCount: result.remainingCount,
    });
  } catch (err: any) {
    const status = /not found/i.test(String(err?.message)) ? 404 : 400;
    res.status(status).json({ error: err?.message || 'Failed to remove product.' });
  }
});

// Remove all legacy/non-CJ products while preserving CJdropshipping products (CEO Only)
app.post('/api/admin/products/prune-non-cj', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = db.removeNonCjProducts(AUTHORIZED_CEO_NAME);
    res.json({
      success: true,
      removedCount: result.removedCount,
      remainingCount: result.remainingCount,
      products: db.getProducts(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to remove non-CJ products.' });
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
function syncCjSupplierStatus(cjStatus: {
  status: 'Connected' | 'Authentication failed' | 'Connection unavailable';
  message: string;
  lastTestedAt: string | null;
}) {
  try {
    const cjSupplier = db.getSuppliers().find((s) => s.integrationType === 'cjdropshipping_api');
    if (!cjSupplier) return;
    const mappedStatus =
      cjStatus.status === 'Connected'
        ? 'operational'
        : cjStatus.status === 'Authentication failed'
        ? 'credentials_required'
        : 'pending_setup';
    if (
      cjSupplier.status !== mappedStatus ||
      cjSupplier.notes !== cjStatus.message ||
      (cjStatus.lastTestedAt && cjSupplier.lastSyncedAt !== cjStatus.lastTestedAt)
    ) {
      db.updateSupplier(
        cjSupplier.id,
        {
          status: mappedStatus,
          notes: cjStatus.message,
          lastSyncedAt: cjStatus.lastTestedAt || new Date().toISOString(),
        },
        'CJ API 2.0 Auth Monitor'
      );
    }
  } catch {
    // Non-fatal sync update
  }
}

app.get('/api/admin/suppliers/cj/status', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const cjStatus = await cjService.getStatus();
    syncCjSupplierStatus(cjStatus);
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
    syncCjSupplierStatus(cjStatus);
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

function handleCjRouteError(res: Response, err: any, fallback: string) {
  if (err instanceof CjAuthError) {
    return res.status(401).json({ error: err.message });
  }
  if (err instanceof CjConnectionUnavailableError) {
    return res.status(503).json({ error: err.message });
  }
  if (err instanceof CjApiRequestError) {
    return res.status(err.httpStatus || 400).json({ error: err.message });
  }
  return res.status(500).json({ error: err?.message || fallback });
}

// CJ Catalogue Search (CEO Only — GET /product/listV2)
app.get('/api/admin/suppliers/cj/products/search', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.max(1, Math.min(50, Number(req.query.size) || 12));
    const countryCode = req.query.countryCode ? String(req.query.countryCode).trim().toUpperCase() : undefined;
    const categoryId = req.query.categoryId ? String(req.query.categoryId).trim() : undefined;

    const [searchResult, fx] = await Promise.all([
      cjService.searchProducts({ keyword, page, size, countryCode, categoryId }),
      fetchLiveExchangeRate(),
    ]);

    const importedByPid = new Map(
      db
        .getProducts()
        .filter((p) => p.cjPid)
        .map((p) => [p.cjPid!, p])
    );

    const enrichedProducts = searchResult.products.map((item) => {
      const existing = importedByPid.get(item.pid);
      return {
        ...item,
        supplierPriceNgn:
          item.supplierPriceCents !== null ? convertUsdCentsToNgn(item.supplierPriceCents, fx.usdToNgnRate) : null,
        supplierPriceMaxNgn:
          item.supplierPriceMaxCents !== null ? convertUsdCentsToNgn(item.supplierPriceMaxCents, fx.usdToNgnRate) : null,
        alreadyImported: Boolean(existing),
        importedProductId: existing?.id || null,
        importedProductSlug: existing?.slug || null,
      };
    });

    res.json({
      ...searchResult,
      products: enrichedProducts,
      fx: {
        usdToNgnRate: fx.usdToNgnRate,
        provider: fx.provider,
        lastUpdated: fx.lastUpdated,
      },
    });
  } catch (err: any) {
    handleCjRouteError(res, err, 'Failed to search CJ Dropshipping product catalogue.');
  }
});

// CJ Product Details, Variants, Specifications & Real Stock (CEO Only)
app.get('/api/admin/suppliers/cj/products/detail', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pid = String(req.query.pid || '').trim();
    if (!pid) {
      return res.status(400).json({ error: 'CJ Product ID (pid) query parameter is required.' });
    }
    const countryCode = req.query.countryCode ? String(req.query.countryCode).trim().toUpperCase() : undefined;

    const [detail, fx] = await Promise.all([
      cjService.getProductDetail(pid, { countryCode, includeInventory: true }),
      fetchLiveExchangeRate(),
    ]);

    const existingProduct = db.getProducts().find((p) => p.cjPid === detail.pid) || null;
    const suggestedCategory = suggestVanteraCategory(detail.categoryName, detail.productNameEn);

    const variantsWithNgn = detail.variants.map((v) => ({
      ...v,
      supplierPriceNgn:
        v.supplierPriceCents !== null ? convertUsdCentsToNgn(v.supplierPriceCents, fx.usdToNgnRate) : null,
    }));

    res.json({
      product: {
        ...detail,
        supplierPriceNgn:
          detail.supplierPriceCents !== null ? convertUsdCentsToNgn(detail.supplierPriceCents, fx.usdToNgnRate) : null,
        supplierPriceMaxNgn:
          detail.supplierPriceMaxCents !== null
            ? convertUsdCentsToNgn(detail.supplierPriceMaxCents, fx.usdToNgnRate)
            : null,
        variants: variantsWithNgn,
      },
      existingProduct,
      suggestedCategory,
      fx: {
        usdToNgnRate: fx.usdToNgnRate,
        provider: fx.provider,
        lastUpdated: fx.lastUpdated,
      },
    });
  } catch (err: any) {
    handleCjRouteError(res, err, 'Failed to retrieve CJ product details.');
  }
});

// CJ Live Shipping Freight Calculation by Destination (CEO Only — POST /logistic/freightCalculate)
app.post('/api/admin/suppliers/cj/freight/calculate', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startCountryCode, endCountryCode, products, zip } = req.body || {};
    const [freight, fx] = await Promise.all([
      cjService.calculateFreight({
        startCountryCode: startCountryCode || 'CN',
        endCountryCode: String(endCountryCode || '').trim().toUpperCase(),
        products: Array.isArray(products) ? products : [],
        zip: zip ? String(zip) : undefined,
      }),
      fetchLiveExchangeRate(),
    ]);

    const options = freight.options.map((opt) => ({
      ...opt,
      logisticPriceNgn: convertUsdCentsToNgn(opt.logisticPriceCents, fx.usdToNgnRate),
      taxesFeeNgn: convertUsdCentsToNgn(opt.taxesFeeCents, fx.usdToNgnRate),
      clearanceOperationFeeNgn: convertUsdCentsToNgn(opt.clearanceOperationFeeCents, fx.usdToNgnRate),
      totalPostageFeeNgn: convertUsdCentsToNgn(opt.totalPostageFeeCents, fx.usdToNgnRate),
    }));

    res.json({
      ...freight,
      options,
      fx: {
        usdToNgnRate: fx.usdToNgnRate,
        provider: fx.provider,
        lastUpdated: fx.lastUpdated,
      },
    });
  } catch (err: any) {
    handleCjRouteError(res, err, 'Failed to calculate CJ shipping freight.');
  }
});

// CJ Selective Product & Variant Import into VANTÉRA Catalogue (CEO Only)
app.post('/api/admin/suppliers/cj/products/import', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const cjPid = String(body.cjPid || '').trim();
    const title = String(body.title || '').trim();
    const category = String(body.category || 'room-desk').trim();
    const description = String(body.description || '').trim();
    const pricingMode: CjPricingMode =
      body.pricingMode === 'margin_percent' || body.pricingMode === 'fixed_cents'
        ? body.pricingMode
        : 'markup_percent';
    const pricingValue = Number(body.pricingValue);

    if (!cjPid) {
      return res.status(400).json({ error: 'CJ Product ID (cjPid) is required.' });
    }
    if (!title) {
      return res.status(400).json({ error: 'Product title is required.' });
    }
    if (!Number.isFinite(pricingValue) || pricingValue < 0) {
      return res.status(400).json({ error: 'A valid non-negative pricing value is required.' });
    }
    if (pricingMode === 'fixed_cents' && pricingValue <= 0) {
      return res.status(400).json({ error: 'Fixed selling price must be greater than $0.00.' });
    }

    const rawVariants = Array.isArray(body.variants) ? body.variants : [];
    const selectedRawVariants = rawVariants.filter((v: any) => v && v.selected !== false);

    if (rawVariants.length > 0 && selectedRawVariants.length === 0) {
      return res.status(400).json({ error: 'Select at least one variant to import.' });
    }

    const mappedVariants: ProductVariant[] = selectedRawVariants.map((v: any, index: number) => {
      const vid = String(v.vid || v.id || `v_${index}`).trim();
      const supplierCost =
        typeof v.supplierCostCents === 'number' && Number.isFinite(v.supplierCostCents) && v.supplierCostCents >= 0
          ? Math.round(v.supplierCostCents)
          : typeof body.fallbackSupplierCostCents === 'number' && body.fallbackSupplierCostCents >= 0
          ? Math.round(body.fallbackSupplierCostCents)
          : null;

      const customRetail =
        typeof v.customRetailPriceCents === 'number' &&
        Number.isFinite(v.customRetailPriceCents) &&
        v.customRetailPriceCents > 0
          ? Math.round(v.customRetailPriceCents)
          : null;

      const calculatedRetail =
        customRetail ?? calculateSellingPriceCents(supplierCost, pricingMode, pricingValue);

      if (!calculatedRetail || calculatedRetail <= 0) {
        throw new Error(
          `Cannot determine retail selling price for variant "${v.name || v.sku || vid}" because supplier cost is missing.`
        );
      }

      const stockQty =
        typeof v.stockQuantity === 'number' && Number.isFinite(v.stockQuantity)
          ? Math.max(0, Math.round(v.stockQuantity))
          : 0;

      return {
        id: `cjv_${vid}`,
        cjVid: vid,
        sku: String(v.sku || ''),
        name: String(v.name || v.variantKey || `Variant ${index + 1}`).trim(),
        color: v.color ? String(v.color) : undefined,
        size: v.size ? String(v.size) : undefined,
        variantKey: v.variantKey ? String(v.variantKey) : undefined,
        image: v.image ? String(v.image) : null,
        supplierCostCents: supplierCost,
        retailPriceCents: calculatedRetail,
        stockQuantity: stockQty,
        isAvailable: stockQty > 0,
      };
    });

    const fallbackSupplierCost =
      typeof body.fallbackSupplierCostCents === 'number' &&
      Number.isFinite(body.fallbackSupplierCostCents) &&
      body.fallbackSupplierCostCents >= 0
        ? Math.round(body.fallbackSupplierCostCents)
        : null;

    const fallbackStock =
      typeof body.fallbackStockQuantity === 'number' && Number.isFinite(body.fallbackStockQuantity)
        ? Math.max(0, Math.round(body.fallbackStockQuantity))
        : 0;

    const totalStock =
      mappedVariants.length > 0
        ? mappedVariants.reduce((sum, v) => sum + v.stockQuantity, 0)
        : fallbackStock;

    const fallbackRetail =
      mappedVariants.length > 0
        ? Math.min(...mappedVariants.map((v) => v.retailPriceCents))
        : calculateSellingPriceCents(fallbackSupplierCost, pricingMode, pricingValue);

    if (!fallbackRetail || fallbackRetail <= 0) {
      return res.status(400).json({
        error: 'Unable to calculate a valid selling price. Specify a fixed USD price or ensure supplier price exists.',
      });
    }

    const result = db.upsertCjProduct(
      {
        cjPid,
        cjProductSku: body.cjProductSku ? String(body.cjProductSku) : null,
        cjCategoryName: body.cjCategoryName ? String(body.cjCategoryName) : null,
        title,
        category,
        description,
        image: body.image ? String(body.image) : null,
        galleryImages: Array.isArray(body.galleryImages) ? body.galleryImages.map(String) : [],
        cjSpecs: Array.isArray(body.cjSpecs)
          ? body.cjSpecs
              .filter((s: any) => s && s.label && s.value)
              .map((s: any) => ({ label: String(s.label), value: String(s.value) }))
          : [],
        retailPriceCents: fallbackRetail,
        supplierCostCents: fallbackSupplierCost,
        stockQuantity: totalStock,
        isAvailable: totalStock > 0,
        variants: mappedVariants,
        pricingConfig: {
          mode: pricingMode,
          value: pricingValue,
        },
        trending: Boolean(body.trending),
      },
      AUTHORIZED_CEO_NAME
    );

    res.json({
      success: true,
      created: result.created,
      product: result.product,
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to import CJ product.' });
  }
});

// CJ One-Click Curated Bulk Import (Strictly Restricted to CEO's 5 Curated Categories & Specific Product Types, Max 60% Profit Cap)
app.post('/api/admin/suppliers/cj/products/bulk-import', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const requestedMaxProfit = Number(body.maxProfitPercent);
    const maxProfitPercent = Number.isFinite(requestedMaxProfit)
      ? Math.min(60, Math.max(0, requestedMaxProfit))
      : 60;
    const countryCode = body.countryCode ? String(body.countryCode).trim().toUpperCase() : undefined;
    const curatedCategoryId = body.curatedCategoryId ? String(body.curatedCategoryId).trim() : '';
    const maxPerType = Math.max(1, Math.min(3, Number(body.maxPerType) || 1));

    const explicitPids: string[] = Array.isArray(body.pids)
      ? Array.from(new Set<string>(body.pids.map((p: any) => String(p || '').trim()).filter(Boolean))).slice(0, 50)
      : [];

    type ImportTarget = {
      pid: string;
      spec: CuratedProductTypeSpec | null;
    };

    const targets: ImportTarget[] = [];
    const seenPids = new Set<string>();
    const skippedCountReasons: Array<{ cjPid: string; reason: string }> = [];
    let preSkippedCount = 0;

    if (explicitPids.length > 0 && !curatedCategoryId) {
      for (const pid of explicitPids) {
        targets.push({ pid, spec: null });
      }
    } else {
      let categoriesToProcess = CURATED_CATEGORIES;
      if (curatedCategoryId) {
        const cat = getCuratedCategoryById(curatedCategoryId);
        if (!cat) {
          return res.status(400).json({ error: `Unknown curated category "${curatedCategoryId}".` });
        }
        categoriesToProcess = [cat];
      }

      for (const cat of categoriesToProcess) {
        for (const spec of cat.items) {
          let matchedForSpec = 0;
          for (const kw of spec.searchKeywords) {
            if (matchedForSpec >= maxPerType) break;
            try {
              const searchRes = await cjService.searchProducts({
                keyword: kw,
                page: 1,
                size: 8,
                countryCode,
              });

              const candidates = searchRes.products
                .filter((cand) => {
                  if (!cand.pid || seenPids.has(cand.pid)) return false;
                  if (!cand.supplierPriceCents || cand.supplierPriceCents <= 0) return false;
                  return matchesCuratedSpec(cand.productNameEn, cand.categoryName, spec);
                })
                .sort((a, b) => {
                  const aInStock = (a.warehouseInventoryNum ?? 1) > 0 ? 1 : 0;
                  const bInStock = (b.warehouseInventoryNum ?? 1) > 0 ? 1 : 0;
                  if (aInStock !== bInStock) return bInStock - aInStock;
                  const aImg = a.productImage ? 1 : 0;
                  const bImg = b.productImage ? 1 : 0;
                  return bImg - aImg;
                });

              for (const picked of candidates) {
                if (matchedForSpec >= maxPerType) break;
                seenPids.add(picked.pid);
                targets.push({ pid: picked.pid, spec });
                matchedForSpec += 1;
              }
            } catch (searchErr: any) {
              skippedCountReasons.push({
                cjPid: spec.label,
                reason: searchErr?.message || `CJ search failed for "${kw}"`,
              });
            }
          }

          if (matchedForSpec === 0) {
            preSkippedCount += 1;
            skippedCountReasons.push({
              cjPid: spec.label,
              reason: `No verified in-stock CJ match found for curated item "${spec.label}".`,
            });
          }
        }
      }
    }

    if (targets.length === 0 && preSkippedCount === 0) {
      return res.status(400).json({
        error: 'No matching curated CJ products were found to import.',
      });
    }

    const fx = await fetchLiveExchangeRate();
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = preSkippedCount;
    const items: Array<{
      cjPid: string;
      productId: string;
      title: string;
      category: string;
      curatedType: string;
      created: boolean;
      appliedProfitPercent: number;
      supplierCostCents: number;
      retailPriceCents: number;
      retailNgn: number;
      stockQuantity: number;
      variantCount: number;
    }> = [];
    const errors: Array<{ cjPid: string; reason: string }> = [...skippedCountReasons];

    for (const target of targets) {
      try {
        const detail = await cjService.getProductDetail(target.pid, {
          countryCode,
          includeInventory: true,
        });

        const matchedSpec =
          target.spec || findMatchingCuratedSpec(detail.productNameEn, detail.categoryName);
        if (!matchedSpec) {
          skippedCount += 1;
          errors.push({
            cjPid: target.pid,
            reason: `Skipped "${detail.productNameEn}" — not in VANTÉRA's 5 curated product specifications.`,
          });
          continue;
        }

        const category = matchedSpec.categoryId;
        const rawVariants = Array.isArray(detail.variants) ? detail.variants : [];

        // Keep in-stock variants when CJ reports stock; fall back to all variants if stock is null/unreported
        const hasAnyPositiveStock = rawVariants.some((v) => typeof v.stockQuantity === 'number' && v.stockQuantity > 0);
        const eligibleVariants = hasAnyPositiveStock
          ? rawVariants.filter((v) => v.stockQuantity === null || v.stockQuantity > 0)
          : rawVariants;

        const mappedVariants: ProductVariant[] = [];
        for (let i = 0; i < eligibleVariants.length; i++) {
          const v = eligibleVariants[i];
          const vCost =
            typeof v.supplierPriceCents === 'number' && Number.isFinite(v.supplierPriceCents) && v.supplierPriceCents > 0
              ? Math.round(v.supplierPriceCents)
              : typeof detail.supplierPriceCents === 'number' && detail.supplierPriceCents > 0
              ? Math.round(detail.supplierPriceCents)
              : null;

          if (!vCost || vCost <= 0) continue;

          const priced = calculateProductDependentPricingCents(vCost, {
            category,
            maxProfitPercent,
          });
          const stockQty =
            typeof v.stockQuantity === 'number' && Number.isFinite(v.stockQuantity)
              ? Math.max(0, Math.round(v.stockQuantity))
              : 0;

          mappedVariants.push({
            id: `cjv_${v.vid}`,
            cjVid: v.vid,
            sku: String(v.variantSku || ''),
            name: String(v.label || v.variantNameEn || `Variant ${i + 1}`).trim(),
            color: v.color,
            size: v.size,
            variantKey: v.variantKey,
            image: v.variantImage,
            supplierCostCents: vCost,
            retailPriceCents: priced.retailPriceCents,
            stockQuantity: stockQty,
            isAvailable: stockQty > 0,
          });
        }

        const baseSupplierCost =
          mappedVariants.length > 0
            ? Math.min(...mappedVariants.map((v) => v.supplierCostCents || 0).filter((c) => c > 0))
            : detail.supplierPriceCents;

        if (!baseSupplierCost || baseSupplierCost <= 0) {
          skippedCount += 1;
          errors.push({ cjPid: target.pid, reason: 'No verified supplier cost returned by CJ.' });
          continue;
        }

        const productPricing = calculateProductDependentPricingCents(baseSupplierCost, {
          category,
          maxProfitPercent,
        });

        const totalStock =
          mappedVariants.length > 0
            ? mappedVariants.reduce((sum, v) => sum + v.stockQuantity, 0)
            : Math.max(0, detail.totalInventory ?? 0);

        const retailPriceCents =
          mappedVariants.length > 0
            ? Math.min(...mappedVariants.map((v) => v.retailPriceCents))
            : productPricing.retailPriceCents;

        const saved = db.upsertCjProduct(
          {
            cjPid: detail.pid,
            cjProductSku: detail.productSku || null,
            cjCategoryName: detail.categoryName || null,
            title: detail.productNameEn,
            category,
            description: detail.description,
            image: detail.productImage,
            galleryImages: detail.productImageSet,
            cjSpecs: detail.specs,
            retailPriceCents,
            supplierCostCents: baseSupplierCost,
            stockQuantity: totalStock,
            isAvailable: totalStock > 0,
            variants: mappedVariants,
            pricingConfig: {
              mode: 'markup_percent',
              value: productPricing.markupPercent,
            },
            trending: category === 'trending-lifestyle-gadgets',
          },
          `${AUTHORIZED_CEO_NAME} (Curated Bulk Import · ${matchedSpec.label} <=${maxProfitPercent}%)`
        );

        if (saved.created) importedCount += 1;
        else updatedCount += 1;

        items.push({
          cjPid: detail.pid,
          productId: saved.product.id,
          title: saved.product.title,
          category,
          curatedType: matchedSpec.label,
          created: saved.created,
          appliedProfitPercent: productPricing.markupPercent,
          supplierCostCents: baseSupplierCost,
          retailPriceCents: saved.product.retailPriceCents,
          retailNgn: convertUsdCentsToNgn(saved.product.retailPriceCents, fx.usdToNgnRate),
          stockQuantity: saved.product.stockQuantity,
          variantCount: mappedVariants.length,
        });
      } catch (itemErr: any) {
        errors.push({
          cjPid: target.pid,
          reason: itemErr?.message || 'Unable to fetch or import CJ product.',
        });
      }
    }

    res.json({
      success: true,
      maxProfitPercent,
      curatedCategoryId: curatedCategoryId || 'all',
      totalRequested: targets.length,
      importedCount,
      updatedCount,
      skippedCount,
      failedCount: Math.max(0, errors.length - skippedCount),
      usdToNgnRate: fx.usdToNgnRate,
      items,
      errors,
    });
  } catch (err: any) {
    handleCjRouteError(res, err, 'Failed to bulk import curated CJ Dropshipping products.');
  }
});

// CJ Live Inventory Synchronisation (CEO Only — queries real CJ stock APIs sequentially)
app.post('/api/admin/suppliers/cj/inventory/sync', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetProductId = req.body?.productId ? String(req.body.productId).trim() : null;
    const cjProducts = db
      .getProducts()
      .filter((p) => p.cjPid && (!targetProductId || p.id === targetProductId || p.slug === targetProductId));

    if (targetProductId && cjProducts.length === 0) {
      return res.status(404).json({ error: 'CJ-imported product not found.' });
    }

    const results: Array<{
      productId: string;
      cjPid: string;
      title: string;
      success: boolean;
      stockQuantity?: number;
      isAvailable?: boolean;
      error?: string;
    }> = [];

    for (const prod of cjProducts) {
      try {
        const detail = await cjService.getProductDetail(prod.cjPid!, { includeInventory: true });
        const variantStocks = new Map<string, number | null>();
        for (const v of detail.variants) {
          if (v.vid) {
            variantStocks.set(v.vid, v.stockQuantity);
          }
        }
        const updated = db.syncCjProductStock(
          prod.id,
          {
            totalInventory: detail.totalInventory,
            variantStocks,
            supplierCostCents: detail.supplierPriceCents,
          },
          `${AUTHORIZED_CEO_NAME} (CJ Stock Sync)`
        );
        results.push({
          productId: updated.id,
          cjPid: prod.cjPid!,
          title: updated.title,
          success: true,
          stockQuantity: updated.stockQuantity,
          isAvailable: updated.isAvailable,
        });
      } catch (err: any) {
        results.push({
          productId: prod.id,
          cjPid: prod.cjPid!,
          title: prod.title,
          success: false,
          error: err?.message || 'Stock sync failed',
        });
      }
    }

    res.json({
      totalChecked: cjProducts.length,
      syncedCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    });
  } catch (err: any) {
    handleCjRouteError(res, err, 'Failed to synchronize CJ inventory.');
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
          item === 'cj_tokens.json' ||
          item === 'backups' ||
          (item.startsWith('.env') && item !== '.env.example') ||
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
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production build static serving (dist takes precedence over public, never cache entry/SW files)
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          const normalized = filePath.replace(/\\/g, '/');
          if (
            normalized.endsWith('/index.html') ||
            normalized.endsWith('/sw.js') ||
            normalized.endsWith('/registerSW.js') ||
            normalized.endsWith('/manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          } else if (normalized.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.use(express.static(path.resolve(ROOT_DIR, 'public')));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  cjService.startAutoRefreshScheduler();

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VANTÉRA Engine] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[VANTÉRA Engine] Storefront: http://localhost:${PORT}/`);
    console.log(`[VANTÉRA Engine] CEO Dashboard: http://localhost:${PORT}/admin/dashboard`);
    console.log(`[VANTÉRA Engine] CEO Login: http://localhost:${PORT}/admin/login`);
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    console.error('[VANTÉRA Engine] HTTP server error:', err.message);
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      process.exit(1);
    }
  });

  const gracefulShutdown = () => {
    cjService.stopAutoRefreshScheduler();
    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

process.on('unhandledRejection', (reason) => {
  console.error('[VANTÉRA Engine] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[VANTÉRA Engine] Uncaught exception:', err);
});

startServer().catch((err) => {
  console.error('[VANTÉRA Engine] Fatal startup error:', err);
  process.exit(1);
});
