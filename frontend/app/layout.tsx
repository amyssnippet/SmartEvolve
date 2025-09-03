import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Suspense } from "react"
import "./globals.css"
import { Data } from "@/metadata"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: Data.title,
  description: Data.description,
  icons: Data.icons,
  openGraph: {
    title: Data.title,
    description: Data.description,
    url: Data.url,
    siteName: Data.title ,
    images: Data.ogImage,
    locale: Data.locale,
    type: Data.type,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 right-0 bottom-0 supports-[backdrop-filter]:backdrop-blur-xl backdrop-blur bg-background/40 dark:bg-background/20"
          style={{ top: "var(--nav-safe-area, 64px)", zIndex: -1 }}
        />
        <Suspense fallback={null}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
