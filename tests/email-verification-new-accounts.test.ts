import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { db } from '../server/db.ts';
import { getMailerStatus } from '../server/mailer.ts';

const DB_PATH = path.resolve(process.cwd(), 'data', 'vantera_db.json');

test('New-account-only email verification & CJ-only product pruning', async (t) => {
  const originalDbSnapshot = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH, 'utf8') : null;

  t.after(() => {
    if (originalDbSnapshot !== null) {
      fs.writeFileSync(DB_PATH, originalDbSnapshot, 'utf8');
    }
  });

  await t.test('New customer registration starts unverified with 6-digit OTP and can refresh pending OTP', () => {
    const email = `verify_new_${Date.now()}@gmail.com`;
    const created = db.createCustomer('Test New Client', email, 'secret123');
    assert.equal(created.isEmailVerified, false);
    assert.match(created.emailVerificationCode || '', /^\d{6}$/);

    // Wrong OTP is rejected
    const badVerify = db.verifyEmail(email, '000000');
    assert.equal(badVerify.success, false);

    // Resend generates a fresh 6-digit OTP
    const resent = db.resendVerificationCode(email);
    assert.equal(resent.success, true);
    assert.match(resent.code || '', /^\d{6}$/);

    // Valid OTP verifies the new account
    const okVerify = db.verifyEmail(email, resent.code!);
    assert.equal(okVerify.success, true);

    const after = db.getUserByEmail(email);
    assert.equal(after?.isEmailVerified, true);
    assert.equal(after?.emailVerificationCode, undefined);

    // Duplicate registration of verified account is blocked
    assert.throws(() => db.createCustomer('Dup', email, 'secret123'), /already exists/);

    // Resend for verified account is rejected
    const resendVerified = db.resendVerificationCode(email);
    assert.equal(resendVerified.success, false);
  });

  await t.test('Existing pre-verification accounts keep isEmailVerified !== false (exempt from new-account OTP lock)', () => {
    const existing = db.getUserByEmail('testregister@example.com');
    if (existing) {
      assert.notEqual(existing.isEmailVerified, false);
    }
  });

  await t.test('getMailerStatus accurately reports provider configuration without faking delivery', () => {
    const status = getMailerStatus();
    assert.ok(['resend', 'smtp', 'none'].includes(status.provider));
    assert.equal(typeof status.configured, 'boolean');
  });

  await t.test('removeNonCjProducts removes legacy catalog items while retaining CJdropshipping products', () => {
    const cjCountBefore = db
      .getProducts()
      .filter((p) => p.supplierSource === 'cjdropshipping' || Boolean(p.cjPid)).length;
    const result = db.removeNonCjProducts();
    assert.equal(result.remainingCount, cjCountBefore);
    const remaining = db.getProducts();
    assert.ok(remaining.every((p) => p.supplierSource === 'cjdropshipping' || Boolean(p.cjPid)));
  });
});
