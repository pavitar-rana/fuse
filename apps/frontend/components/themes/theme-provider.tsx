"use client";
import { ThemeProvider as BaseThemeProvider } from "next-themes";
import { ReactNode } from "react";

// Fuse is dark-only, like most infra consoles.
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return (
    <BaseThemeProvider forcedTheme="dark" defaultTheme="dark" attribute={"class"}>
      {children}
    </BaseThemeProvider>
  );
};
