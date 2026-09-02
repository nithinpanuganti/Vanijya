'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

export interface User {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role: 'FARMER' | 'BUYER' | 'ADMIN';
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  district?: string | null;
  state?: string | null;
  village?: string | null;
  location?: string | null;
  primaryCrop?: string | null;
  farmSize?: number | null;
  preferredLanguage?: string | null;
  organization?: string | null;
  contactPerson?: string | null;
  businessType?: string | null;
  warehouseLocation?: string | null;
  gstin?: string | null;
  fssai?: string | null;
  kccNumber?: string | null;
  apmcLicense?: string | null;
  geoPoint?: { type: string; coordinates: [number, number] } | null;
  profilePhoto?: { url?: string; fileId?: string; filename?: string; mimeType?: string; sizeBytes?: number } | null;
  isVerified?: boolean;
  profileCompletionPercentage?: number;
  profileCompletionStatus?: 'COMPLETE' | 'INCOMPLETE';
  missingFields?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    identifier: string,
    password: string,
    selectedRole?: 'FARMER' | 'BUYER' | 'ADMIN',
  ) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({} as User),
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadSession = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem('vanijya_token');
      const storedUser = localStorage.getItem('vanijya_user');

      if (storedToken) {
        setToken(storedToken);
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {}
        }

        // Validate token against backend /auth/me
        try {
          const freshUser = await api.get<User>('/auth/me');
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem('vanijya_user', JSON.stringify(freshUser));
          }
        } catch (err: any) {
          // Token expired or invalid
          if (err.statusCode === 401 || err.message?.includes('401') || err.message?.includes('expired')) {
            localStorage.removeItem('vanijya_token');
            localStorage.removeItem('vanijya_user');
            setToken(null);
            setUser(null);
          }
        }
      }
    } catch {
      localStorage.removeItem('vanijya_token');
      localStorage.removeItem('vanijya_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = async (
    identifier: string,
    password: string,
    selectedRole?: 'FARMER' | 'BUYER' | 'ADMIN',
  ): Promise<User> => {
    try {
      const res = await api.post<{ accessToken: string; user: User }>('/auth/login', {
        identifier,
        password,
        role: selectedRole,
      });

      const loggedInUser = res.user;

      setToken(res.accessToken);
      setUser(loggedInUser);

      localStorage.setItem('vanijya_token', res.accessToken);
      localStorage.setItem('vanijya_user', JSON.stringify(loggedInUser));

      return loggedInUser;
    } catch (err: any) {
      throw new Error(err.message || 'Login failed. Please check credentials.');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vanijya_token');
    localStorage.removeItem('vanijya_user');
    router.push('/login');
  };

  const refreshUser = async () => {
    try {
      const updatedUser = await api.get<User>('/users/me');
      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem('vanijya_user', JSON.stringify(updatedUser));
      }
    } catch {
      // Ignore if offline
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
