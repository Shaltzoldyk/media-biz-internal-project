"use client"

/**
 * CurrencyContext — session-level ₹ / $ toggle.
 *
 * Wrap the app in <CurrencyProvider> (done in layout.tsx).
 * Any component calls useCurrency() to get:
 *   - currency: "INR" | "USD"
 *   - toggle(): flip between them
 *   - fmt(inrAmount): formats a stored ₹ value for the current currency
 *   - rate: live exchange rate (set by server, passed as prop)
 *
 * Storage: sessionStorage so the toggle persists across page navigations
 * but resets on a new tab / browser session.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"

type Currency = "INR" | "USD"

interface CurrencyCtx {
  currency: Currency
  toggle: () => void
  fmt: (inrAmount: number | null | undefined) => string
  fmtCompact: (inrAmount: number | null | undefined) => string
  rate: number
}

const Ctx = createContext<CurrencyCtx | null>(null)

const SESSION_KEY = "lead_os_currency"

export function CurrencyProvider({
  children,
  exchangeRate,
}: {
  children: ReactNode
  exchangeRate: number
}) {
  const [currency, setCurrency] = useState<Currency>("INR")

  // Restore from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored === "USD" || stored === "INR") setCurrency(stored)
  }, [])

  const toggle = useCallback(() => {
    setCurrency((prev) => {
      const next = prev === "INR" ? "USD" : "INR"
      sessionStorage.setItem(SESSION_KEY, next)
      return next
    })
  }, [])

  const fmt = useCallback(
    (inrAmount: number | null | undefined): string => {
      if (inrAmount == null) return "—"
      const n = Number(inrAmount)
      if (isNaN(n)) return "—"
      if (currency === "INR") {
        return `₹${n.toLocaleString("en-IN")}`
      }
      const usd = Math.round(n / exchangeRate)
      return `$${usd.toLocaleString("en-US")}`
    },
    [currency, exchangeRate]
  )

  // Compact variant for tight spaces (e.g. table cells)
  const fmtCompact = useCallback(
    (inrAmount: number | null | undefined): string => {
      if (inrAmount == null) return "—"
      const n = Number(inrAmount)
      if (isNaN(n)) return "—"
      if (currency === "INR") {
        if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`
        if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)}L`
        if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`
        return `₹${n}`
      }
      const usd = Math.round(n / exchangeRate)
      if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
      if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(1)}K`
      return `$${usd}`
    },
    [currency, exchangeRate]
  )

  return (
    <Ctx.Provider value={{ currency, toggle, fmt, fmtCompact, rate: exchangeRate }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCurrency(): CurrencyCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>")
  return ctx
}