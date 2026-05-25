"use client"

/**
 * CurrencyValue — renders a single INR amount using the active currency context.
 * Use this in server-rendered pages where you can't call useCurrency() directly.
 *
 * <CurrencyValue amount={totalMRR} />
 * <CurrencyValue amount={totalMRR} compact />
 */

import { useCurrency } from "@/context/CurrencyContext"

export default function CurrencyValue({
  amount,
  compact = false,
}: {
  amount: number | null | undefined
  compact?: boolean
}) {
  const { fmt, fmtCompact } = useCurrency()
  return <>{compact ? fmtCompact(amount) : fmt(amount)}</>
}
