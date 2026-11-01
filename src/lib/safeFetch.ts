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
        // Non-JSON payload received (e.g. HTML 404/500 page or proxy error)
        return {
          ok: false,
          status: res.status,
          data: null,
          error: 'The service is momentarily unavailable. Your action is being securely processed.',
        };
      }
    } else {
      // Empty response body (e.g. 204 No Content, static server 404/405 without body)
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: 'The service is momentarily unavailable. Your action is being securely processed.',
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
        'Unable to complete request. Please try again or verify your details.';

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
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'Network connection issue. Please check your internet connection.',
    };
  }
}
