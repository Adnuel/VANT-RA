import { useState, useEffect, useCallback } from 'react';

export interface RouteState {
  path: string;
  category?: string;
  productSlug?: string;
  filter?: string;
  searchQuery?: string;
}

export function parsePath(rawUrl: string): RouteState {
  let pathname = rawUrl;
  let search = '';
  const qIdx = rawUrl.indexOf('?');
  if (qIdx !== -1) {
    pathname = rawUrl.slice(0, qIdx);
    search = rawUrl.slice(qIdx);
  }
  const clean = pathname.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(search);
  const filter = searchParams.get('filter') || undefined;
  const searchQuery = searchParams.get('q') || undefined;

  if (clean === '/' || clean === '') {
    return { path: '/', filter, searchQuery };
  }
  if (clean === '/shop') {
    return { path: '/shop', filter, searchQuery };
  }
  if (clean.startsWith('/category/')) {
    const category = clean.replace('/category/', '');
    return { path: '/category', category, filter, searchQuery };
  }
  if (clean.startsWith('/product/')) {
    const productSlug = clean.replace('/product/', '');
    return { path: '/product', productSlug, filter, searchQuery };
  }
  if (['/about', '/contact', '/faq', '/shipping', '/returns', '/privacy', '/terms'].includes(clean)) {
    return { path: clean, filter, searchQuery };
  }
  if (clean === '/account') {
    return { path: '/account', filter, searchQuery };
  }
  if (clean === '/track') {
    return { path: '/track', filter, searchQuery };
  }
  if (clean === '/admin/login' || clean === '/ceo/login') {
    return { path: '/admin/login' };
  }
  if (clean === '/admin/dashboard' || clean === '/admin' || clean === '/ceo' || clean === '/ceo/dashboard') {
    return { path: '/admin/dashboard' };
  }

  return { path: clean, filter, searchQuery };
}

export function appNavigate(url: string) {
  window.history.pushState({}, '', url);
  window.dispatchEvent(new CustomEvent('vantera:navigate', { detail: { url } }));
  window.scrollTo(0, 0);
}

export function useNavigation() {
  const [route, setRoute] = useState<RouteState>(() =>
    parsePath(window.location.pathname + window.location.search)
  );

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parsePath(window.location.pathname + window.location.search));
      window.scrollTo(0, 0);
    };
    const handleCustomNavigate = (e: any) => {
      if (e.detail?.url) {
        setRoute(parsePath(e.detail.url));
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('vantera:navigate', handleCustomNavigate);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('vantera:navigate', handleCustomNavigate);
    };
  }, []);

  const navigate = useCallback((url: string) => {
    appNavigate(url);
  }, []);

  return { route, navigate };
}
