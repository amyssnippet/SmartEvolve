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
        animate={{
          opacity: [0.22, 0.32, 0.22],
          ["--c1" as any]: [
            "rgba(56,189,248,0.28)", // cyan-400
            "rgba(14,165,233,0.28)", // sky-500
            "rgba(56,189,248,0.28)", // cyan-400
          ],
          ["--c2" as any]: [
            "rgba(236,72,153,0.22)", // pink-500
            "rgba(244,63,94,0.22)", // rose-500
            "rgba(236,72,153,0.22)", // pink-500
          ],
        }}
        transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        style={{
          ["--c1" as any]: "rgba(56,189,248,0.28)",
          ["--c2" as any]: "rgba(236,72,153,0.22)",
          background:
            "radial-gradient(600px 300px at 10% 20%, var(--c1), transparent 60%), radial-gradient(500px 250px at 90% 30%, var(--c2), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-6 sm:px-10 py-14 sm:py-20 text-center rounded-2xl bg-background/40 dark:bg-background/20 backdrop-blur-xl shadow-xl overflow-hidden">
        {/* Decorative animated glow clipped to the glass panel */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-8 -z-10 blur-3xl"
          style={{
            background:
              "radial-gradient(50% 40% at 20% 10%, var(--gc1), transparent 60%), radial-gradient(45% 35% at 85% 35%, var(--gc2), transparent 60%)",
          }}
          animate={{
            ["--gc1" as any]: [
              "rgba(56,189,248,0.35)", // cyan-400
              "rgba(59,130,246,0.35)", // blue-500
              "rgba(56,189,248,0.35)", // cyan-400
            ],
            ["--gc2" as any]: [
              "rgba(236,72,153,0.28)", // pink-500
              "rgba(217,70,239,0.28)", // fuchsia-500
              "rgba(236,72,153,0.28)", // pink-500
            ],
          }}
          transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
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
            <div className="flex items-center justify-center rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              OpenAI
            </div>
            <div className="flex items-center justify-center rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              Anthropic
            </div>
            <div className="flex items-center justify-center rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              Cohere
            </div>
            <div className="flex items-center justify-center rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              Google
            </div>
            <div className="flex items-center justify-center rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              xAI
            </div>
            <div className="flex items-center justify-center rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground shadow-sm">
              Meta
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
