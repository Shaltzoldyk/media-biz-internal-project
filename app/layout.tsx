import "./globals.css"
import Sidebar from "@/components/Sidebar"

export const metadata = {
  title: "Lead OS",
  description: "Internal CRM System",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-100">
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-10">{children}</main>
        </div>
      </body>
    </html>
  )
}
