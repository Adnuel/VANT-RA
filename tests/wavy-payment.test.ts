import test from 'node:test';
import assert from 'node:assert/strict';
import { wavy } from '../server/wavy.ts';
import { paystack } from '../server/paystack.ts';

test('Wavy Service: provides live credentials and multi-currency checkout initialization', async () => {
  const pubKey = wavy.getPublicKey();
  const secKey = wavy.getSecretKey();

  assert.ok(pubKey.startsWith('wavy_pk_live_'), 'Wavy public key must be live format');
  assert.ok(secKey.startsWith('wavy_sk_live_'), 'Wavy secret key must be live format');

  assert.equal(pubKey, 'wavy_pk_live_64e762e61f597be9bfcc4228f2751672');
  assert.equal(secKey, 'wavy_sk_live_cc203228f83a6039c1001b9b24a8ff513346bc49a37db3cb');

  // Verify checkout initialize returns a structured reference
  const init = await wavy.initializeCheckout({
    email: 'client@vantera.luxury',
    amount: 3800,
    currency: 'NGN',
    merchantReference: 'VAN_TEST_REF_001',
  });

  assert.ok(init.status, 'Checkout initialization must succeed');
  assert.equal(init.reference, 'VAN_TEST_REF_001');

  // Verify transaction verification contract handles reference query
  const verify = await wavy.verifyTransaction('VAN_TEST_REF_001');
  assert.equal(typeof verify.status, 'boolean', 'Verification must return a boolean status');
  assert.ok(verify.data?.reference === 'VAN_TEST_REF_001' || verify.message);
});

test('Paystack Bridge: delegates to Wavy live credentials without breaking legacy callers', async () => {
  const pubKey = paystack.getPublicKey();
  assert.equal(pubKey, 'wavy_pk_live_64e762e61f597be9bfcc4228f2751672');

  const init = await paystack.initializeTransaction({
    email: 'client@vantera.luxury',
    amountKobo: 380000,
    reference: 'VAN_BRIDGE_REF_002',
    currency: 'NGN',
  });

  assert.ok(init.status);
  assert.equal(init.data?.reference, 'VAN_BRIDGE_REF_002');
});
