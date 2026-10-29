import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'customer';
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  adminUser: AuthUser | null;
  adminToken: string | null;
  isLoading: boolean;
  loginCustomer: (token: string, user: AuthUser) => void;
  logoutCustomer: () => void;
  loginAdmin: (token: string, user: AuthUser) => void;
  logoutAdmin: () => void;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { safeFetchJson } from '../lib/safeFetch.ts';

const CUSTOMER_TOKEN_KEY = 'vantera_customer_token';
const CUSTOMER_USER_KEY = 'vantera_customer_user';
const ADMIN_TOKEN_KEY = 'vantera_admin_token';
const ADMIN_USER_KEY = 'vantera_admin_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AuthUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSessions() {
      // 1. Check Customer Token
      const storedCustomerToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
      const storedCustomerUser = localStorage.getItem(CUSTOMER_USER_KEY);
      if (storedCustomerToken) {
        // Pre-populate with cached user for instant offline load
        if (storedCustomerUser) {
          try {
            setUser(JSON.parse(storedCustomerUser));
            setToken(storedCustomerToken);
          } catch {}
        }

        const res = await safeFetchJson<{ user: AuthUser }>('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedCustomerToken}` },
        });

        if (res.ok && res.data?.user) {
          setUser(res.data.user);
          setToken(storedCustomerToken);
          localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(res.data.user));
        } else if (res.status === 401) {
          // Token definitively rejected by server
          localStorage.removeItem(CUSTOMER_TOKEN_KEY);
          localStorage.removeItem(CUSTOMER_USER_KEY);
          setUser(null);
          setToken(null);
        }
      }

      // 2. Check Admin Token
      const storedAdminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
      const storedAdminUser = localStorage.getItem(ADMIN_USER_KEY);
      if (storedAdminToken) {
        if (storedAdminUser) {
          try {
            const parsed = JSON.parse(storedAdminUser);
            if (parsed.role === 'admin') {
              setAdminUser(parsed);
              setAdminToken(storedAdminToken);
            }
          } catch {}
        }

        const res = await safeFetchJson<{ user: AuthUser }>('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedAdminToken}` },
        });

        if (res.ok && res.data?.user && res.data.user.role === 'admin') {
          setAdminUser(res.data.user);
          setAdminToken(storedAdminToken);
          localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(res.data.user));
        } else if (res.status === 401) {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          localStorage.removeItem(ADMIN_USER_KEY);
          setAdminUser(null);
          setAdminToken(null);
        }
      }

      setIsLoading(false);
    }

    loadSessions();
  }, []);

  const loginCustomer = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, newToken);
    localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logoutCustomer = () => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_USER_KEY);
    setToken(null);
    setUser(null);
  };

  const loginAdmin = (newToken: string, newAdmin: AuthUser) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, newToken);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(newAdmin));
    setAdminToken(newToken);
    setAdminUser(newAdmin);
  };

  const logoutAdmin = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    setAdminToken(null);
    setAdminUser(null);
  };

  const updateUser = (updated: AuthUser) => {
    localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        adminUser,
        adminToken,
        isLoading,
        loginCustomer,
        logoutCustomer,
        loginAdmin,
        logoutAdmin,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
