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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = process.cwd();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Serve static assets from public
app.use(express.static(path.resolve(ROOT_DIR, 'public')));
app.use('/products', express.static(path.resolve(ROOT_DIR, 'public/products')));
app.use('/src/assets/images', express.static(path.resolve(ROOT_DIR, 'src/assets/images')));
app.use('/manus-storage', express.static(path.resolve(ROOT_DIR, 'public/manus-storage')));

/* Auth Middleware */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
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

// Register customer
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const newUser = db.createCustomer(name, email, password, phone);
    const token = createToken({ userId: newUser.id, email: newUser.email, role: newUser.role });

    res.json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// Login customer
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.getUserByEmail(email);
    if (!user || !user.passwordHash || !user.salt) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!verifyPassword(password, user.passwordHash, user.salt)) {
      return res.status(401).json({ error: 'Invalid email or password' });
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
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
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
    const updated = db.updateUserProfile(req.user!.id, { name, phone });
    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Cryptographically secure password reset request (5-min verification code)
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address required.' });
  }
  const result = db.requestPasswordReset(email);
  res.json(result);
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

// Create Order (Checkout)
app.post('/api/orders', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customerEmail, customerName, customerPhone, shippingAddress, cartItems, notes, currency, couponCode } = req.body;

    if (!customerEmail || !customerName || !shippingAddress || !cartItems || !cartItems.length) {
      return res.status(400).json({ error: 'Incomplete order checkout details' });
    }

    const order = db.createOrder({
      customerId: req.user?.id || null,
      customerEmail,
      customerName,
      customerPhone: customerPhone || shippingAddress.phone || '',
      shippingAddress,
      cartItems,
      currency: currency === 'NGN' ? 'NGN' : 'USD',
      couponCode,
      notes,
    });

    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to place order' });
  }
});

// Public Order Tracking by Reference
app.get('/api/orders/track/:reference', (req: Request, res: Response) => {
  const order = db.getOrderByReference(req.params.reference);
  if (!order) return res.status(404).json({ error: 'Order not found with that reference' });

  // Redact customer address for public tracking, keep order milestones
  res.json({
    order: {
      orderReference: order.orderReference,
      createdAt: order.createdAt,
      paymentStatus: order.paymentStatus,
      paymentVerifiedAt: order.paymentVerifiedAt,
      fulfilmentStatus: order.fulfilmentStatus,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      itemCount: order.items.reduce((acc, i) => acc + i.quantity, 0),
      totalCents: order.totalCents,
      currency: order.currency || 'USD',
      exchangeRateUsed: order.exchangeRateUsed || 1500,
    },
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

// Dual Currency Settings (Public)
app.get('/api/currency-settings', (_req: Request, res: Response) => {
  const settings = db.getCurrencySettings();
  res.json({ settings });
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

// Public Payment Gateway Settings (Paystack & Bank Transfer)
app.get('/api/payment-settings', (_req: Request, res: Response) => {
  const settings = db.getPaymentSettings();
  res.json({
    paystackEnabled: settings.paystackEnabled,
    paystackPublicKey: paystack.getPublicKey(),
    bankTransferEnabled: settings.bankTransferEnabled,
    isTestMode: paystack.isTestMode(),
  });
});

// Paystack: Initialize Online Card Checkout
app.post('/api/payments/paystack/initialize', async (req: Request, res: Response) => {
  try {
    const { email, amountKobo, reference, currency, metadata } = req.body;
    if (!email || !amountKobo || !reference) {
      return res.status(400).json({ error: 'Email, amountKobo, and order reference are required' });
    }

    const initResult = await paystack.initializeTransaction({
      email,
      amountKobo,
      reference,
      currency: currency || 'NGN',
      callbackUrl: `${process.env.APP_URL || ''}/track/${encodeURIComponent(reference)}`,
      metadata: {
        orderReference: reference,
        ...metadata,
      },
    });

    res.json(initResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Paystack initialization error' });
  }
});

// Paystack: Verify Payment and Update Order
app.post('/api/payments/paystack/verify', async (req: Request, res: Response) => {
  try {
    const { reference, orderReference } = req.body;
    const targetRef = orderReference || reference;

    if (!reference) {
      return res.status(400).json({ error: 'Paystack reference is required' });
    }

    const verifyResult = await paystack.verifyTransaction(reference);

    if (verifyResult.status && verifyResult.data?.status === 'success') {
      const order = db.markOrderPaidOnline(
        targetRef,
        reference,
        verifyResult.data.channel || 'paystack_card'
      );
      return res.json({ success: true, order, verifyData: verifyResult.data });
    } else {
      return res.status(400).json({
        success: false,
        error: verifyResult.message || 'Payment verification was not successful',
      });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Paystack verification failed' });
  }
});

// Paystack: Webhook Handler
app.post('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }), (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (signature && !paystack.validateWebhookSignature(rawBody, signature)) {
      return res.status(400).send('Invalid signature');
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (event.event === 'charge.success') {
      const data = event.data;
      const orderReference = data.metadata?.orderReference || data.reference;
      try {
        db.markOrderPaidOnline(orderReference, data.reference, data.channel || 'webhook');
      } catch (err) {
        console.error('[PAYSTACK WEBHOOK ERROR]', err);
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

// Newsletter Subscription
app.post('/api/newsletter', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, sessionId } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    db.addCustomerEvent({
      type: 'newsletter_subscribed',
      customerId: req.user?.id || null,
      customerEmail: cleanEmail,
      customerName: req.user?.name || null,
      sessionId: sessionId || null,
      status: 'success',
      metadata: { source: 'footer_signup' },
    });
    db.addNotification({
      recipient: cleanEmail,
      channel: 'email',
      event: 'account_registered',
      message: 'Thank you for subscribing to VANTÉRA. You will receive private announcements regarding our elevated collections.',
    });
    res.json({ success: true, message: 'Thank you for subscribing to VANTÉRA.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

// CEO Login
app.post('/api/admin/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail !== AUTHORIZED_CEO_EMAIL.toLowerCase()) {
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
      return res.status(401).json({ error: 'Invalid administrator password.' });
    }

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

// CEO Currency Settings
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VANTÉRA Engine] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[VANTÉRA Engine] Storefront: http://localhost:${PORT}/`);
    console.log(`[VANTÉRA Engine] CEO Dashboard: http://localhost:${PORT}/admin/dashboard`);
    console.log(`[VANTÉRA Engine] CEO Login: http://localhost:${PORT}/admin/login`);
  });
}

startServer();
