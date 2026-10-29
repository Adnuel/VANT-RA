/**
 * VANTÉRA Client-Side Customer Account Synchronization
 * Ensures login, account creation, delivery addresses, and personal order tracking
 * work seamlessly across static hosting (Cloudflare Pages / GitHub Pages) and offline PWA mode.
 */

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'customer' | 'admin';
  createdAt: string;
}

interface StoredAccount {
  user: ClientUser;
  passwordHash: string;
}

const STORAGE_ACCOUNTS_KEY = 'vantera_customer_registry_v1';
const STORAGE_ORDERS_PREFIX = 'vantera_customer_orders_';
const STORAGE_ADDRESSES_PREFIX = 'vantera_customer_addresses_';

// Simple fast client-side hashing
function clientHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + input.length;
}

function getStoredRegistry(): Record<string, StoredAccount> {
  try {
    const raw = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredRegistry(registry: Record<string, StoredAccount>) {
  try {
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn('Failed to save customer registry to localStorage', err);
  }
}

export const clientAuthFallback = {
  register(name: string, email: string, password: string, phone?: string): { success: boolean; token?: string; user?: ClientUser; error?: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const registry = getStoredRegistry();

    if (registry[normalizedEmail]) {
      return {
        success: false,
        error: 'An account with this email address already exists. Please sign in.',
      };
    }

    const newUser: ClientUser = {
      id: 'usr_clt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || '',
      role: 'customer',
      createdAt: new Date().toISOString(),
    };

    registry[normalizedEmail] = {
      user: newUser,
      passwordHash: clientHash(password),
    };

    saveStoredRegistry(registry);

    const token = 'vantera_tok_' + btoa(JSON.stringify({ id: newUser.id, email: newUser.email, exp: Date.now() + 86400000 * 30 }));
    return {
      success: true,
      token,
      user: newUser,
    };
  },

  login(email: string, password: string): { success: boolean; token?: string; user?: ClientUser; error?: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const registry = getStoredRegistry();
    const account = registry[normalizedEmail];

    if (!account) {
      return {
        success: false,
        error: 'Invalid email or password. If you are new to VANTÉRA, please create an account.',
      };
    }

    if (account.passwordHash !== clientHash(password)) {
      return {
        success: false,
        error: 'Invalid email or password.',
      };
    }

    const token = 'vantera_tok_' + btoa(JSON.stringify({ id: account.user.id, email: account.user.email, exp: Date.now() + 86400000 * 30 }));
    return {
      success: true,
      token,
      user: account.user,
    };
  },

  updateProfile(userId: string, updates: { name?: string; phone?: string }): ClientUser | null {
    const registry = getStoredRegistry();
    for (const email of Object.keys(registry)) {
      if (registry[email].user.id === userId) {
        if (updates.name) registry[email].user.name = updates.name.trim();
        if (updates.phone !== undefined) registry[email].user.phone = updates.phone.trim();
        saveStoredRegistry(registry);
        return registry[email].user;
      }
    }
    return null;
  },

  getAddresses(userId: string): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_ADDRESSES_PREFIX + userId);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveAddress(userId: string, address: any): any[] {
    const addresses = this.getAddresses(userId);
    const newAddr = {
      ...address,
      id: 'addr_' + Date.now().toString(36),
    };
    addresses.push(newAddr);
    try {
      localStorage.setItem(STORAGE_ADDRESSES_PREFIX + userId, JSON.stringify(addresses));
    } catch {}
    return addresses;
  },

  deleteAddress(userId: string, addressId: string): any[] {
    let addresses = this.getAddresses(userId);
    addresses = addresses.filter((a) => a.id !== addressId);
    try {
      localStorage.setItem(STORAGE_ADDRESSES_PREFIX + userId, JSON.stringify(addresses));
    } catch {}
    return addresses;
  },

  getOrders(userId: string, email: string): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_ORDERS_PREFIX + userId) || localStorage.getItem(STORAGE_ORDERS_PREFIX + email.toLowerCase());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addOrder(userId: string, email: string, order: any) {
    const orders = this.getOrders(userId, email);
    orders.unshift(order);
    try {
      localStorage.setItem(STORAGE_ORDERS_PREFIX + userId, JSON.stringify(orders));
      localStorage.setItem(STORAGE_ORDERS_PREFIX + email.toLowerCase(), JSON.stringify(orders));
    } catch {}
  },
};
