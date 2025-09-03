"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import Link from "next/link"

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle animated background per brief */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        initial={{ opacity: 0.25 }}
        animate={{ opacity: [0.22, 0.32, 0.22] }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(600px 300px at 10% 20%, rgba(37,99,235,0.22), transparent 60%), radial-gradient(500px 250px at 90% 30%, rgba(124,58,237,0.16), transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Train, Fine-Tune, and Deploy LLMs with One Click
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">
          From training to inference, accelerate your AI workflows in the cloud.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/signup">Get Started</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/docs">Docs</Link>
          </Button>
        </div>
        <div className="mt-10">
          <p className="text-sm text-muted-foreground">Trusted by teams at</p>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            <div className="flex items-center justify-center rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              OpenAI
            </div>
            <div className="flex items-center justify-center rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Anthropic
            </div>
            <div className="flex items-center justify-center rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Cohere
            </div>
            <div className="flex items-center justify-center rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Google
            </div>
            <div className="flex items-center justify-center rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              xAI
            </div>
            <div className="flex items-center justify-center rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Meta
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
