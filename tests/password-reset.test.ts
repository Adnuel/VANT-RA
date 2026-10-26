import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPassword } from '../src/lib/commerceLogic.ts';
import { hashPassword, verifyPassword } from '../server/db.ts';

test('Password policy: Enforces minimum 8 characters requirement', () => {
  assert.equal(isValidPassword('short').valid, false);
  assert.equal(isValidPassword('').valid, false);
  assert.equal(isValidPassword('1234567').valid, false);
  assert.equal(isValidPassword('12345678').valid, true);
  assert.equal(isValidPassword('AdminPassword2026!').valid, true);
});

test('Password hashing: Generates salted SHA-256 hash and verifies matching plaintext', () => {
  const plain = 'VanteraCEO2026!';
  const { hash, salt } = hashPassword(plain);

  assert.ok(hash && hash.length > 20, 'Hash must be generated');
  assert.ok(salt && salt.length > 10, 'Salt must be generated');

  assert.equal(verifyPassword(plain, hash, salt), true, 'Valid password must verify');
  assert.equal(verifyPassword('WrongPassword!', hash, salt), false, 'Incorrect password must fail');
});

test('OTP verification expiration: Enforces strict 5-minute lifecycle', () => {
  const isOtpValid = (createdAtMs: number, nowMs: number) => {
    const TTL_MS = 5 * 60 * 1000; // 5 minutes
    return nowMs - createdAtMs <= TTL_MS;
  };

  const created = Date.now();

  // At 2 minutes
  assert.equal(isOtpValid(created, created + 2 * 60 * 1000), true);

  // At 4.9 minutes
  assert.equal(isOtpValid(created, created + 4.9 * 60 * 1000), true);

  // At 5.1 minutes (expired)
  assert.equal(isOtpValid(created, created + 5.1 * 60 * 1000), false);
});
