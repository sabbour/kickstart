import React, { ReactNode } from 'react';
export type ThemeMode = 'light' | 'dark';
interface ThemeContextValue {
    theme: ThemeMode;
    toggleTheme: () => void;
}
export declare function ThemeProvider({ children }: {
    children: ReactNode;
}): React.JSX.Element;
export declare function useTheme(): ThemeContextValue;
export {};
//# sourceMappingURL=ThemeContext.d.ts.map