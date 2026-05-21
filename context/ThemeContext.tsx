"use client"

/**
 * ThemeContext — system-aware dark/light mode with manual override.
 *
 * Priority order:
 *   1. localStorage override (user explicitly toggled)
 *   2. prefers-color-scheme (OS setting)
 *
 * Applied as .dark / .light class on <html> — CSS handles the rest.
 * The class is set by an inline script in layout.tsx BEFORE hydration
 * to prevent any flash of wrong theme.
 */

import {
  createContext, useContext, useState, useEffect,
  useCallback, type ReactNode,
} from "react"

type Theme = "light" | "dark"

interface ThemeCtx {
  theme: Theme
  toggle: () => void
  isSystem: boolean   // true = following OS, false = manually overridden
  reset: () => void   // go back to following OS
}

const Ctx = createContext<ThemeCtx | null>(null)
const LS_KEY = "lead_os_theme"

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.classList.remove("light", "dark")
  html.classList.add(theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme,    setTheme]    = useState<Theme>("light")
  const [isSystem, setIsSystem] = useState(true)

  // On mount: read localStorage or fall back to system
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY) as Theme | null
    if (stored === "light" || stored === "dark") {
      setTheme(stored)
      setIsSystem(false)
      applyTheme(stored)
    } else {
      const sys = getSystemTheme()
      setTheme(sys)
      setIsSystem(true)
      applyTheme(sys)
    }

    // Listen for system changes while in "system" mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(LS_KEY)) {
        const next = e.matches ? "dark" : "light"
        setTheme(next)
        applyTheme(next)
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light"
      localStorage.setItem(LS_KEY, next)
      setIsSystem(false)
      applyTheme(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    const sys = getSystemTheme()
    setTheme(sys)
    setIsSystem(true)
    applyTheme(sys)
  }, [])

  return (
    <Ctx.Provider value={{ theme, toggle, isSystem, reset }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}