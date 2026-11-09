import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('paypilot_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('paypilot_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUser = async () => {
      const storedToken = localStorage.getItem('paypilot_token');
      if (storedToken) {
        try {
          const response = await api.get('/me');
          setUser(response.data.user);
          localStorage.setItem('paypilot_user', JSON.stringify(response.data.user));
        } catch {
          setUser(null);
          setToken(null);
          localStorage.removeItem('paypilot_token');
          localStorage.removeItem('paypilot_user');
        }
      }
      setIsLoading(false);
    };

    fetchUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/login', { email, password });
    const { token: authToken, user: authUser } = response.data;
    setToken(authToken);
    setUser(authUser);
    localStorage.setItem('paypilot_token', authToken);
    localStorage.setItem('paypilot_user', JSON.stringify(authUser));
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await api.post('/register', { name, email, password });
    const { token: authToken, user: authUser } = response.data;
    setToken(authToken);
    setUser(authUser);
    localStorage.setItem('paypilot_token', authToken);
    localStorage.setItem('paypilot_user', JSON.stringify(authUser));
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/logout');
      }
    } catch {
      // Continue cleanup on network error
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('paypilot_token');
      localStorage.removeItem('paypilot_user');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
