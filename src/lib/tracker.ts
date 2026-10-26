/**
 * VANTÉRA First-Party Real-Time Event & Session Tracker
 * Collects genuine user interactions with zero fake or simulated data.
 */

const SESSION_STORAGE_KEY = 'vantera_session_id_v1';
const CUSTOMER_TOKEN_KEY = 'vantera_customer_token';

export function getOrCreateSessionId(): string {
  try {
    let sid = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sid) {
      sid = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(SESSION_STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return `ses_fallback_${Date.now()}`;
  }
}

export async function trackEvent(
  type: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId();
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-vantera-session': sessionId,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch('/api/track', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type,
        sessionId,
        metadata,
      }),
    });
  } catch (err) {
    // Non-blocking telemetry
    console.debug('[VANTÉRA Telemetry]', type, err);
  }
}

export async function syncCartWithServer(
  cartId: string,
  items: any[],
  itemCount: number,
  subtotalCents: number
): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId();
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-vantera-session': sessionId,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch('/api/cart/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: cartId,
        items,
        itemCount,
        subtotalCents,
        sessionId,
      }),
    });
  } catch {
    // Non-blocking cart state sync
  }
}
