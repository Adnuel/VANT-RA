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

const CUSTOMER_TOKEN_KEY = 'vantera_customer_token';
const ADMIN_TOKEN_KEY = 'vantera_admin_token';

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
      if (storedCustomerToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedCustomerToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setToken(storedCustomerToken);
          } else {
            localStorage.removeItem(CUSTOMER_TOKEN_KEY);
          }
        } catch {
          // Offline or network error
        }
      }

      // 2. Check Admin Token
      const storedAdminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
      if (storedAdminToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedAdminToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user && data.user.role === 'admin') {
              setAdminUser(data.user);
              setAdminToken(storedAdminToken);
            } else {
              localStorage.removeItem(ADMIN_TOKEN_KEY);
            }
          } else {
            localStorage.removeItem(ADMIN_TOKEN_KEY);
          }
        } catch {
          // Offline or network error
        }
      }

      setIsLoading(false);
    }

    loadSessions();
  }, []);

  const loginCustomer = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logoutCustomer = () => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const loginAdmin = (newToken: string, newAdmin: AuthUser) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, newToken);
    setAdminToken(newToken);
    setAdminUser(newAdmin);
  };

  const logoutAdmin = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
    setAdminUser(null);
  };

  const updateUser = (updated: AuthUser) => {
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
