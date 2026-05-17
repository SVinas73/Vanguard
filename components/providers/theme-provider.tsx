'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { initErrorTracking } from '@/lib/error-tracking';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', toggleTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Inicializa el error tracking global (silencioso si SENTRY_DSN no está set)
    initErrorTracking();
    const saved = localStorage.getItem('vanguard-theme') as Theme;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('vanguard-theme', theme);
    document.documentElement.classList.toggle('light-mode', theme === 'light');
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
