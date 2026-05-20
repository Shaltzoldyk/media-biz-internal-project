/**
 * Server-side currency utility.
 * - getExchangeRate(): fetches live rate, cached 1hr by Next.js
 * - Used only in layout.tsx to seed the CurrencyProvider.
 *
 * For formatting in components, use useCurrency() from CurrencyContext instead.
 */

const FALLBACK_RATE = 84 // ₹ per $1 USD

export async function getExchangeRate(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return FALLBACK_RATE
    const data = await res.json()
    return data?.rates?.INR ?? FALLBACK_RATE
  } catch {
    return FALLBACK_RATE
  }
}