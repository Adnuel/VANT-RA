/**
 * VANTÉRA Robust API & Safe Fetch Engine
 * Prevents "Unexpected end of JSON input" and "Unexpected token <" errors.
 * Safely handles empty response bodies, non-JSON HTML error pages, and network failures.
 */

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any = null;

    if (text && text.trim().length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        // Non-JSON payload received (e.g., HTML 404/500 page or proxy error)
        const isHtml =
          text.trim().toLowerCase().startsWith('<!doctype') ||
          text.trim().toLowerCase().startsWith('<html');

        const fallbackMsg = isHtml
          ? `Server returned an HTML status page (${res.status} ${res.statusText || 'Error'}).`
          : `Server response could not be parsed (${res.status}).`;

        return {
          ok: false,
          status: res.status,
          data: null,
          error: fallbackMsg,
        };
      }
    } else {
      // Empty response body (e.g. 204 No Content or empty 404)
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: `Request failed with status ${res.status} (${res.statusText || 'No response body'}).`,
        };
      }
      return {
        ok: true,
        status: res.status,
        data: {} as T,
      };
    }

    if (!res.ok) {
      const errorMsg =
        data?.error ||
        data?.message ||
        `Request failed with status ${res.status} (${res.statusText || 'Error'})`;

      return {
        ok: false,
        status: res.status,
        data,
        error: errorMsg,
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || 'Network connection error. Please verify your connection.',
    };
  }
}
