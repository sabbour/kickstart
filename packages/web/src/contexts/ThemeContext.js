import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
const STORAGE_KEY = 'kickstart-theme';
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved === 'dark' ? 'dark' : 'light';
    });
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);
    const toggleTheme = useCallback(() => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    }, []);
    return (<ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>);
}
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx)
        throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
}
//# sourceMappingURL=ThemeContext.js.map