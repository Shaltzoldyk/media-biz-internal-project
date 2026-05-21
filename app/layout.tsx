import "./globals.css"
import Sidebar from "@/components/Sidebar"
import { CurrencyProvider } from "@/context/CurrencyContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { getExchangeRate } from "@/lib/currency"

export const metadata = {
  title: "Lead OS",
  description: "Internal CRM",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const rate = await getExchangeRate()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Anti-flash script: runs synchronously before React hydrates.
          Reads localStorage and applies .dark or .light to <html>
          so there's never a flash of the wrong theme on load.
          suppressHydrationWarning on <html> prevents the React mismatch warning.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('lead_os_theme');
                  if (stored === 'dark' || stored === 'light') {
                    document.documentElement.classList.add(stored);
                  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.add('light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <CurrencyProvider exchangeRate={rate}>
            <div style={{ display: "flex", minHeight: "100vh" }}>
              <Sidebar />
              <main style={{ flex: 1, minWidth: 0, padding: "40px 44px" }}>
                {children}
              </main>
            </div>
          </CurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}