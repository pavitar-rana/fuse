"use client";
import { ThemeProvider as BaseThemeProvider } from "next-themes";
import { ReactNode } from "react";

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  return (
    <BaseThemeProvider enableSystem defaultTheme="system" attribute={"class"}>
      {children}
    </BaseThemeProvider>
  );
};
