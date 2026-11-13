import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  CjDropshippingService,
  CJ_GET_ACCESS_TOKEN_URL,
  CJ_REFRESH_ACCESS_TOKEN_URL,
  CJ_SETTING_GET_URL,
  sanitizeCjErrorMessage,
} from '../server/cj.ts';

function makeTempTokenPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vantera-cj-test-'));
  return path.join(dir, 'cj_tokens.json');
}

function cleanupTempFile(filePath: string): void {
  try {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('CJ Auth: returns Authentication failed when CJ_API_KEY is missing', async () => {
  const tokenPath = makeTempTokenPath();
  let fetchCalled = false;

  const service = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => '',
    minRequestSpacingMs: 0,
    fetchImpl: async () => {
      fetchCalled = true;
      return jsonResponse({});
    },
  });

  try {
    const result = await service.testConnection();
    assert.equal(result.status, 'Authentication failed');
    assert.equal(result.configured, false);
    assert.equal(result.hasAccessToken, false);
    assert.equal(fetchCalled, false, 'Must not call CJ API when CJ_API_KEY is missing');
    assert.match(result.message, /CJ_API_KEY/);
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('CJ Auth: exchanges CJ_API_KEY via getAccessToken, encrypts tokens on disk, and verifies setting/get', async () => {
  const tokenPath = makeTempTokenPath();
  const fakeApiKey = 'CJ123456@api@supersecretkey999';
  const fakeAccessToken = 'access_token_secret_abc123';
  const fakeRefreshToken = 'refresh_token_secret_xyz789';
  const calls: Array<{ url: string; method: string; headers: any; body: any }> = [];

  const nowMs = Date.parse('2026-11-13T12:00:00.000Z');
  const accessExpiry = new Date(nowMs + 180 * 24 * 60 * 60 * 1000).toISOString();
  const refreshExpiry = new Date(nowMs + 180 * 24 * 60 * 60 * 1000).toISOString();

  const service = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => fakeApiKey,
    now: () => nowMs,
    minRequestSpacingMs: 0,
    fetchImpl: async (input, init) => {
      const url = String(input);
      const method = init?.method || 'GET';
      const headers = init?.headers || {};
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method, headers, body });

      if (url === CJ_GET_ACCESS_TOKEN_URL) {
        assert.equal(method, 'POST');
        assert.equal(body.apiKey, fakeApiKey);
        return jsonResponse({
          code: 200,
          result: true,
          message: 'Success',
          data: {
            openId: 987654321,
            accessToken: fakeAccessToken,
            accessTokenExpiryDate: accessExpiry,
            refreshToken: fakeRefreshToken,
            refreshTokenExpiryDate: refreshExpiry,
            createDate: new Date(nowMs).toISOString(),
          },
        });
      }

      if (url === CJ_SETTING_GET_URL) {
        assert.equal(method, 'GET');
        assert.equal((headers as Record<string, string>)['CJ-Access-Token'], fakeAccessToken);
        return jsonResponse({
          code: 200,
          result: true,
          message: 'Success',
          data: {
            openId: 987654321,
            isSandbox: false,
            qpsLimit: 1,
          },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    const result = await service.testConnection();
    assert.equal(result.status, 'Connected');
    assert.equal(result.configured, true);
    assert.equal(result.hasAccessToken, true);
    assert.equal(result.hasRefreshToken, true);
    assert.equal(result.accountInfo?.openId, 987654321);
    assert.equal(result.accountInfo?.qpsLimit, 1);

    // Ensure secrets never appear in public status DTO
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(fakeApiKey), false);
    assert.equal(serialized.includes(fakeAccessToken), false);
    assert.equal(serialized.includes(fakeRefreshToken), false);

    // Ensure token file exists and is encrypted (no plaintext tokens on disk)
    assert.equal(fs.existsSync(tokenPath), true);
    const diskContents = fs.readFileSync(tokenPath, 'utf8');
    assert.equal(diskContents.includes(fakeApiKey), false);
    assert.equal(diskContents.includes(fakeAccessToken), false);
    assert.equal(diskContents.includes(fakeRefreshToken), false);

    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, CJ_GET_ACCESS_TOKEN_URL);
    assert.equal(calls[1].url, CJ_SETTING_GET_URL);
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('CJ Auth: automatically refreshes access token before expiration using refreshAccessToken', async () => {
  const tokenPath = makeTempTokenPath();
  const fakeApiKey = 'CJ123456@api@rotatecheck111';
  const initialAccessToken = 'initial_access_token_111';
  const initialRefreshToken = 'initial_refresh_token_111';
  const refreshedAccessToken = 'refreshed_access_token_222';
  const refreshedRefreshToken = 'refreshed_refresh_token_222';

  let currentNowMs = Date.parse('2026-11-13T12:00:00.000Z');
  const soonExpiringAccess = new Date(currentNowMs + 48 * 60 * 60 * 1000).toISOString(); // 48h valid initially
  const longRefreshExpiry = new Date(currentNowMs + 180 * 24 * 60 * 60 * 1000).toISOString();
  const extendedAccessExpiry = new Date(currentNowMs + 180 * 24 * 60 * 60 * 1000).toISOString();

  const calledUrls: string[] = [];

  const service = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => fakeApiKey,
    now: () => currentNowMs,
    refreshBufferMs: 24 * 60 * 60 * 1000, // refresh when <= 24h left
    minRequestSpacingMs: 0,
    fetchImpl: async (input, init) => {
      const url = String(input);
      calledUrls.push(url);
      const body = init?.body ? JSON.parse(String(init.body)) : null;

      if (url === CJ_GET_ACCESS_TOKEN_URL) {
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            openId: 1001,
            accessToken: initialAccessToken,
            accessTokenExpiryDate: soonExpiringAccess,
            refreshToken: initialRefreshToken,
            refreshTokenExpiryDate: longRefreshExpiry,
          },
        });
      }

      if (url === CJ_REFRESH_ACCESS_TOKEN_URL) {
        assert.equal(body.refreshToken, initialRefreshToken);
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            openId: 1001,
            accessToken: refreshedAccessToken,
            accessTokenExpiryDate: extendedAccessExpiry,
            refreshToken: refreshedRefreshToken,
            refreshTokenExpiryDate: longRefreshExpiry,
          },
        });
      }

      if (url === CJ_SETTING_GET_URL) {
        const tokenHeader = (init?.headers as Record<string, string>)['CJ-Access-Token'];
        return jsonResponse({
          code: 200,
          result: true,
          data: { openId: 1001, activeTokenSeen: tokenHeader },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    // 1. Initial connection exchanges API key
    const first = await service.testConnection();
    assert.equal(first.status, 'Connected');
    assert.deepEqual(calledUrls, [CJ_GET_ACCESS_TOKEN_URL, CJ_SETTING_GET_URL]);

    // 2. Advance clock to 12 hours before accessToken expiry (inside 24h refresh buffer)
    currentNowMs += 36 * 60 * 60 * 1000;
    calledUrls.length = 0;

    // Next testConnection must proactively call refreshAccessToken BEFORE expiration
    const second = await service.testConnection();
    assert.equal(second.status, 'Connected');
    assert.deepEqual(calledUrls, [CJ_REFRESH_ACCESS_TOKEN_URL, CJ_SETTING_GET_URL]);
    assert.equal(second.accessTokenExpiresAt, extendedAccessExpiry);
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('CJ Auth: falls back to getAccessToken if refreshAccessToken is rejected', async () => {
  const tokenPath = makeTempTokenPath();
  const fakeApiKey = 'CJ999@api@fallbackkey';
  let currentNowMs = Date.parse('2026-11-13T12:00:00.000Z');
  let exchangeCount = 0;
  let refreshCount = 0;

  const service = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => fakeApiKey,
    now: () => currentNowMs,
    refreshBufferMs: 24 * 60 * 60 * 1000,
    minRequestSpacingMs: 0,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url === CJ_GET_ACCESS_TOKEN_URL) {
        exchangeCount += 1;
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            openId: 2002,
            accessToken: `access_${exchangeCount}`,
            accessTokenExpiryDate: new Date(currentNowMs + 30 * 60 * 60 * 1000).toISOString(),
            refreshToken: `refresh_${exchangeCount}`,
            refreshTokenExpiryDate: new Date(currentNowMs + 180 * 24 * 60 * 60 * 1000).toISOString(),
          },
        });
      }
      if (url === CJ_REFRESH_ACCESS_TOKEN_URL) {
        refreshCount += 1;
        return jsonResponse(
          {
            code: 1600001,
            result: false,
            message: 'Refresh token expired or invalid',
          },
          401
        );
      }
      if (url === CJ_SETTING_GET_URL) {
        return jsonResponse({ code: 200, result: true, data: { openId: 2002 } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    await service.testConnection();
    assert.equal(exchangeCount, 1);

    // Advance inside refresh buffer
    currentNowMs += 20 * 60 * 60 * 1000;
    const res = await service.testConnection();
    assert.equal(res.status, 'Connected');
    assert.equal(refreshCount, 1);
    assert.equal(exchangeCount, 2, 'Should fall back to getAccessToken after refresh auth error');
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('CJ Auth: reports Authentication failed and scrubs credentials on invalid API key', async () => {
  const tokenPath = makeTempTokenPath();
  const fakeApiKey = 'CJ888@api@badsecretkey888';

  const service = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => fakeApiKey,
    minRequestSpacingMs: 0,
    fetchImpl: async () =>
      jsonResponse(
        {
          code: 1600001,
          result: false,
          message: `Invalid apiKey: ${fakeApiKey}`,
        },
        401
      ),
  });

  try {
    const res = await service.testConnection();
    assert.equal(res.status, 'Authentication failed');
    assert.equal(res.configured, true);
    assert.equal(res.hasAccessToken, false);
    assert.equal(res.message.includes(fakeApiKey), false, 'Raw API key must be scrubbed from message');
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('CJ Auth: reports Connection unavailable on network failure or QPS rate limit', async () => {
  const tokenPath = makeTempTokenPath();
  const fakeApiKey = 'CJ777@api@networktestkey';

  const networkFailService = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => fakeApiKey,
    minRequestSpacingMs: 0,
    fetchImpl: async () => {
      throw new Error('getaddrinfo ENOTFOUND developers.cjdropshipping.com');
    },
  });

  const rateLimitService = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => fakeApiKey,
    minRequestSpacingMs: 0,
    fetchImpl: async () =>
      jsonResponse(
        {
          code: 1600200,
          result: false,
          message: 'Too Many Requests, QPS limit exceeded',
        },
        429
      ),
  });

  try {
    const netRes = await networkFailService.testConnection();
    assert.equal(netRes.status, 'Connection unavailable');
    assert.match(netRes.message, /Unable to reach CJ Dropshipping/);

    const rateRes = await rateLimitService.testConnection();
    assert.equal(rateRes.status, 'Connection unavailable');
    assert.match(rateRes.message, /rate limit/i);
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('CJ Auth: deduplicates concurrent testConnection calls and respects API key rotation', async () => {
  const tokenPath = makeTempTokenPath();
  let activeKey = 'CJ111@api@firstkey111';
  let exchangeCalls = 0;

  const nowMs = Date.parse('2026-11-13T12:00:00.000Z');

  const service = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => activeKey,
    now: () => nowMs,
    minRequestSpacingMs: 0,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url === CJ_GET_ACCESS_TOKEN_URL) {
        exchangeCalls += 1;
        const body = JSON.parse(String(init?.body));
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            openId: 3003,
            accessToken: `tok_${body.apiKey}`,
            accessTokenExpiryDate: new Date(nowMs + 180 * 24 * 60 * 60 * 1000).toISOString(),
            refreshToken: `ref_${body.apiKey}`,
            refreshTokenExpiryDate: new Date(nowMs + 180 * 24 * 60 * 60 * 1000).toISOString(),
          },
        });
      }
      if (url === CJ_SETTING_GET_URL) {
        return jsonResponse({ code: 200, result: true, data: { openId: 3003 } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    const [r1, r2, r3] = await Promise.all([
      service.testConnection(),
      service.testConnection(),
      service.testConnection(),
    ]);
    assert.equal(r1.status, 'Connected');
    assert.equal(r2.status, 'Connected');
    assert.equal(r3.status, 'Connected');
    assert.equal(exchangeCalls, 1, 'Concurrent calls must share one token exchange');

    // Rotate API key -> should exchange new key
    activeKey = 'CJ222@api@secondkey222';
    const rotated = await service.testConnection();
    assert.equal(rotated.status, 'Connected');
    assert.equal(exchangeCalls, 2, 'Key rotation must discard old tokens and re-exchange');
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('sanitizeCjErrorMessage removes CJ API key patterns and explicit secret strings', () => {
  const sanitized = sanitizeCjErrorMessage(
    'Auth failed for CJ12345@api@secret999 with CJ-Access-Token=mySecretTok123',
    ['mySecretTok123']
  );
  assert.equal(sanitized.includes('secret999'), false);
  assert.equal(sanitized.includes('mySecretTok123'), false);
});
