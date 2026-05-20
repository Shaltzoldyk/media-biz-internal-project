import "./globals.css"
import Sidebar from "@/components/Sidebar"
import { CurrencyProvider } from "@/context/CurrencyContext"
import { getExchangeRate } from "@/lib/currency"

export const metadata = {
  title: "Lead OS",
  description: "Internal CRM",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetch rate once at layout level — cached 1hr by Next.js fetch
  const rate = await getExchangeRate()

  return (
    <html lang="en">
      <body>
        {/*
          CurrencyProvider is a client component wrapping the entire app.
          All pages and components can call useCurrency() to get fmt() and toggle().
          The rate is fetched server-side and passed down — no client fetch needed.
        */}
        <CurrencyProvider exchangeRate={rate}>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <main style={{
              flex: 1,
              minWidth: 0,
              padding: "40px 44px",
            }}>
              {children}
            </main>
          </div>
        </CurrencyProvider>
      </body>
    </html>
  )
}