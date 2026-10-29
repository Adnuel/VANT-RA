import test from 'node:test';
import assert from 'node:assert/strict';
import { safeFetchJson } from '../src/lib/safeFetch.ts';
import { clientAuthFallback } from '../src/lib/clientAuthFallback.ts';

// Mock mockFetch
function createMockFetch(status: number, statusText: string, bodyText: string, headers: Record<string, string> = {}) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get: (h: string) => headers[h.toLowerCase()] || null,
    },
    text: async () => bodyText,
  } as unknown as Response);
}

test('safeFetchJson handles empty response body without throwing SyntaxError', async () => {
  const originalFetch = global.fetch;
  try {
    // Simulate 204 No Content
    global.fetch = createMockFetch(204, 'No Content', '') as any;
    const res204 = await safeFetchJson('/test-empty');
    assert.equal(res204.ok, true);
    assert.deepEqual(res204.data, {});

    // Simulate empty 404
    global.fetch = createMockFetch(404, 'Not Found', '') as any;
    const res404 = await safeFetchJson('/test-404');
    assert.equal(res404.ok, false);
    assert.equal(res404.status, 404);
    assert.ok(res404.error?.includes('404'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('safeFetchJson handles HTML error responses gracefully without JSON parse crash', async () => {
  const originalFetch = global.fetch;
  try {
    // Simulate Cloudflare HTML 404 or Vite SPA fallback
    global.fetch = createMockFetch(404, 'Not Found', '<!DOCTYPE html><html><body>Error 404</body></html>') as any;
    const res = await safeFetchJson('/api/missing');
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.ok(res.error?.includes('HTML status page') || res.error?.includes('404'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('safeFetchJson parses valid JSON correctly', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = createMockFetch(200, 'OK', JSON.stringify({ token: 'abc123xyz', user: { id: 'usr_1', email: 'test@vantera.co' } })) as any;
    const res = await safeFetchJson('/api/auth/login');
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(res.data?.token, 'abc123xyz');
    assert.equal(res.data?.user?.email, 'test@vantera.co');
  } finally {
    global.fetch = originalFetch;
  }
});

test('clientAuthFallback handles customer registration, duplicate prevention, and login', () => {
  // Mock localStorage for test environment
  const store: Record<string, string> = {};
  global.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (i: number) => Object.keys(store)[i] || null,
    length: Object.keys(store).length,
  };

  // Register new customer
  const regResult = clientAuthFallback.register('Adnuel Client', 'client@vantera.co', 'luxurySecret123', '+2348011223344');
  assert.equal(regResult.success, true);
  assert.ok(regResult.token);
  assert.equal(regResult.user?.email, 'client@vantera.co');
  assert.equal(regResult.user?.role, 'customer');

  // Prevent duplicate registration
  const dupResult = clientAuthFallback.register('Duplicate', 'client@vantera.co', 'otherSecret');
  assert.equal(dupResult.success, false);
  assert.ok(dupResult.error?.includes('already exists'));

  // Successful login
  const loginSuccess = clientAuthFallback.login('client@vantera.co', 'luxurySecret123');
  assert.equal(loginSuccess.success, true);
  assert.ok(loginSuccess.token);
  assert.equal(loginSuccess.user?.email, 'client@vantera.co');

  // Failed login: Wrong password
  const loginWrongPass = clientAuthFallback.login('client@vantera.co', 'wrongPassword');
  assert.equal(loginWrongPass.success, false);
  assert.ok(loginWrongPass.error?.includes('Invalid email or password'));

  // Address book management
  const addresses = clientAuthFallback.saveAddress(regResult.user!.id, {
    fullName: 'Adnuel Client',
    phone: '+2348011223344',
    streetAddress: '12 Victoria Island',
    city: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
  });
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0].city, 'Lagos');
});
