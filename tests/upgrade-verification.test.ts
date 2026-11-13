import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { db } from '../server/db.ts';
import { paystack } from '../server/paystack.ts';
import { emailTemplates } from '../server/mailer.ts';
import { calculateDeliveryFee, validateNigerianPhone } from '../src/data/nigerianStates.ts';

test('VANTÉRA UPGRADE VERIFICATION SUITE', async (t) => {
  const email = `upgrade_test_${Date.now()}@example.com`;
  let userId = '';
  let orderRef = '';

  await t.test('1. Nigerian +234 Phone Validation & Normalization', () => {
    const validLocal = validateNigerianPhone('08031234567');
    assert.equal(validLocal.valid, true);
    assert.equal(validLocal.formatted, '+2348031234567');

    const validIntl = validateNigerianPhone('+234 913 279 3670');
    assert.equal(validIntl.valid, true);
    assert.equal(validIntl.formatted, '+2349132793670');

    const invalid = validateNigerianPhone('12345');
    assert.equal(invalid.valid, false);
  });

  await t.test('2. Signup Verification OTP & 3-Step Password Reset', () => {
    const user = db.createCustomer('Adaora Okafor', email, 'SecurePass123!', '+2348031234567');
    userId = user.id;
    assert.equal(user.isEmailVerified, false);
    assert.ok(user.emailVerificationCode);

    const verified = db.verifyEmail(email, user.emailVerificationCode!);
    assert.equal(verified.success, true);
    assert.equal(db.getUserByEmail(email)?.isEmailVerified, true);

    const resetReq = db.requestPasswordReset(email);
    assert.ok(resetReq.dispatchedCode);

    const checkCode = db.verifyPasswordResetCode(email, resetReq.dispatchedCode!);
    assert.equal(checkCode.success, true);
    assert.ok(checkCode.resetToken);

    const completed = db.resetPasswordWithToken(checkCode.resetToken!, 'UpdatedPass456!');
    assert.equal(completed.success, true);
  });

  await t.test('3. Nigerian State-Based Delivery Fee & Free Threshold Calculation', () => {
    const lagos = calculateDeliveryFee('Lagos', 'Nigeria', 1300, 20000); // ₦20,000 NGN (~$13 USD)
    assert.equal(lagos.feeNgn, 2500);
    assert.equal(lagos.transitTime, '1 – 2 Business Days');
    assert.equal(lagos.isFree, false);

    const abuja = calculateDeliveryFee('FCT - Abuja', 'Nigeria', 1300, 20000);
    assert.equal(abuja.feeNgn, 3500);
    assert.equal(abuja.transitTime, '2 – 3 Business Days');
    assert.equal(abuja.isFree, false);

    const freeDom = calculateDeliveryFee('Lagos', 'Nigeria', 5500, 82500); // > ₦75,000 / $50 free threshold
    assert.equal(freeDom.feeNgn, 0);
    assert.equal(freeDom.isFree, true);
  });

  await t.test('4. Atomic Stock Blocking, No Overselling, and Failure Restoration', () => {
    const limitedProduct = db.addProduct(
      {
        title: `Limited Edition MagSafe Dock ${Date.now()}`,
        slug: `limited-edition-magsafe-dock-${Date.now()}`,
        category: 'charging',
        retailPriceCents: 4500,
        supplierCostCents: 2000,
        stockQuantity: 1,
        isAvailable: true,
        availability: 'Ready for Order',
        description: 'Single-unit concurrency test item',
        image: '/products/charging-phone-stand.jpg',
        imageAlt: 'MagSafe Dock',
        imageNeedsReview: false,
        sourceTitle: 'MagSafe Dock',
        referencePriceCents: 5500,
        priceBasis: 'retail',
        sourceDescription: true,
        trending: false,
      },
      'Test Runner'
    );

    // First buyer reserves the last remaining item
    const order1 = db.createOrder({
      customerId: userId,
      customerEmail: email,
      customerName: 'Adaora Okafor',
      customerPhone: '+2348031234567',
      shippingAddress: {
        fullName: 'Adaora Okafor',
        phone: '+2348031234567',
        streetAddress: '12 Adeola Odeku',
        city: 'Eti-Osa',
        state: 'Lagos',
        postalCode: '101241',
        country: 'Nigeria',
      },
      cartItems: [{ productId: limitedProduct.id, quantity: 1 }],
      currency: 'NGN',
      shippingFeeCents: 200,
      paymentStatus: 'pending',
      paymentMethod: 'card_online',
      exchangeRateUsed: 1500,
      estimatedTransitTime: '1 – 2 Business Days',
    });
    orderRef = order1.orderReference;

    const afterOrder1 = db.getProducts().find((p) => p.id === limitedProduct.id);
    assert.equal(afterOrder1?.stockQuantity, 0);
    assert.equal(afterOrder1?.isAvailable, false);

    // Concurrent second buyer attempts to buy the same last item -> must throw Out of Stock error
    assert.throws(() => {
      db.createOrder({
        customerId: userId,
        customerEmail: email,
        customerName: 'Second Buyer',
        customerPhone: '+2348099999999',
        shippingAddress: {
          fullName: 'Second Buyer',
          phone: '+2348099999999',
          streetAddress: '45 Awolowo Rd',
          city: 'Ikoyi',
          state: 'Lagos',
          postalCode: '101233',
          country: 'Nigeria',
        },
        cartItems: [{ productId: limitedProduct.id, quantity: 1 }],
        currency: 'NGN',
        shippingFeeCents: 200,
        paymentStatus: 'pending',
        paymentMethod: 'card_online',
        exchangeRateUsed: 1500,
      });
    }, /Insufficient stock|currently out of stock|is not available/i);

    // Failed/cancelled payment restores stock cleanly
    db.failOrderPayment(orderRef, 'Card declined by issuer');
    const afterFail = db.getProducts().find((p) => p.id === limitedProduct.id);
    assert.equal(afterFail?.stockQuantity, 1);
    assert.equal(afterFail?.isAvailable, true);

    // Fresh retry order now succeeds in reserving the restored stock
    const retryOrder = db.createOrder({
      customerId: userId,
      customerEmail: email,
      customerName: 'Adaora Okafor',
      customerPhone: '+2348031234567',
      shippingAddress: {
        fullName: 'Adaora Okafor',
        phone: '+2348031234567',
        streetAddress: '12 Adeola Odeku',
        city: 'Eti-Osa',
        state: 'Lagos',
        postalCode: '101241',
        country: 'Nigeria',
      },
      cartItems: [{ productId: limitedProduct.id, quantity: 1 }],
      currency: 'NGN',
      shippingFeeCents: 200,
      paymentStatus: 'pending',
      paymentMethod: 'card_online',
      exchangeRateUsed: 1500,
      estimatedTransitTime: '1 – 2 Business Days',
    });
    orderRef = retryOrder.orderReference;
  });

  await t.test('5. Webhook HMAC Verification, Idempotent Paid Settlement & Currency Receipt Consistency', () => {
    const order = db.getOrderByReference(orderRef)!;
    assert.ok(order);

    const rawWebhook = JSON.stringify({
      event: 'charge.success',
      data: { reference: order.orderReference, status: 'success', amount: order.totalCents },
    });
    const secret = paystack.getSecretKey();
    const validSig = crypto.createHmac('sha512', secret).update(rawWebhook).digest('hex');

    assert.equal(paystack.validateWebhookSignature(rawWebhook, validSig), true);
    assert.equal(paystack.validateWebhookSignature(rawWebhook, 'forged_sig'), false);

    const paid = db.markOrderPaidOnline(order.orderReference, 'WAVY_TX_12345', 'wavy_webhook');
    assert.equal(paid.paymentStatus, 'paid');
    assert.equal(paid.fulfilmentStatus, 'processing');

    // Duplicate webhook replay is idempotent
    const paidReplay = db.markOrderPaidOnline(order.orderReference, 'WAVY_TX_12345', 'wavy_webhook');
    assert.equal(paidReplay.paymentStatus, 'paid');
    assert.equal(paidReplay.fulfilmentStatus, 'processing');

    const receipt = emailTemplates.orderConfirmation(paid);
    assert.ok(receipt.html.includes('₦'), 'NGN order receipt must format amounts in Naira');
    assert.ok(receipt.html.includes(paid.orderReference));
  });

  await t.test('6. Customer Return Request & CEO Approval', () => {
    const order = db.getOrderByReference(orderRef)!;
    const reqRet = db.requestOrderReturn(order.id, userId, 'Ordered wrong model size', 'Seal remains intact');
    assert.equal(reqRet.returnRequested, true);
    assert.equal(reqRet.returnStatus, 'pending');

    const approved = db.updateOrderReturnStatus(order.id, 'approved', 'CEO Adnuel');
    assert.equal(approved.returnStatus, 'approved');
    assert.equal(approved.fulfilmentStatus, 'cancelled');
  });
});
