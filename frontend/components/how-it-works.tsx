"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Settings, Rocket } from "lucide-react"

const steps = [
  {
    icon: Upload,
    title: "1. Bring Your Data",
    desc: "Connect a dataset or upload your files. We handle preprocessing and splitting automatically.",
  },
  {
    icon: Settings,
    title: "2. Configure Training",
    desc: "Pick a base model, set hyperparameters, and choose resources. Start with sensible defaults.",
  },
  {
    icon: Rocket,
    title: "3. Deploy in One Click",
    desc: "Get a production-ready inference endpoint and SDK snippets to integrate instantly.",
  },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <h2 className="text-balance text-2xl font-semibold sm:text-3xl">How It Works</h2>
        <p className="mt-2 text-muted-foreground">A streamlined path from raw data to a deployed model.</p>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {steps.map((s) => (
          <Card key={s.title} className="border-muted">
            <CardHeader>
              <div className="flex items-center gap-3">
                <s.icon className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                <CardTitle className="text-base">{s.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
