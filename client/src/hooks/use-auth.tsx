import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  username: string;
  role: string;
  clinicName: string;
  clinicLocation: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isImpersonating: boolean;
  originalAdmin: string | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  impersonate: (userId: string) => Promise<void>;
  stopImpersonate: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdmin, setOriginalAdmin] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/tv/') || path.startsWith('/qr-auth/')) {
      setIsLoading(false);
      return;
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.status === 401) {
          console.log('[AUTH] Session expired - detected by periodic check');
          setUser(null);
          setIsImpersonating(false);
          setOriginalAdmin(null);
        }
      } catch (error) {
      }
    };

    const intervalId = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await apiRequest("GET", "/api/auth/me");
      const result = await response.json();
      if (result.user) {
        setUser(result.user);
        setIsImpersonating(!!result.impersonating);
        setOriginalAdmin(result.originalAdmin || null);
      }
    } catch (error) {
      setUser(null);
      setIsImpersonating(false);
      setOriginalAdmin(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setIsImpersonating(false);
      setOriginalAdmin(null);
    }
  };

  const impersonate = async (userId: string) => {
    try {
      const response = await apiRequest("POST", `/api/auth/impersonate/${userId}`);
      const result = await response.json();
      if (result.success) {
        setUser(result.user);
        setIsImpersonating(true);
        setOriginalAdmin(result.originalAdmin);
        window.location.href = '/';
      }
    } catch (error) {
      console.error("Impersonate error:", error);
      throw error;
    }
  };

  const stopImpersonate = async () => {
    try {
      const response = await apiRequest("POST", "/api/auth/stop-impersonate");
      const result = await response.json();
      if (result.success) {
        setUser(result.user);
        setIsImpersonating(false);
        setOriginalAdmin(null);
        window.location.href = '/administration';
      }
    } catch (error) {
      console.error("Stop impersonate error:", error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isImpersonating,
    originalAdmin,
    login,
    logout,
    checkAuth,
    impersonate,
    stopImpersonate,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}