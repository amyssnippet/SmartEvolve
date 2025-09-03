import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cpu, Cloud, Users, Shield } from "lucide-react"

const features = [
  {
    icon: Cpu,
    title: "AutoTrain",
    desc: "Upload data, configure, and train LLMs automatically.",
    badge: "Automation",
  },
  {
    icon: Cloud,
    title: "Inference API",
    desc: "Deploy models with one endpoint.",
    badge: "Production",
  },
  {
    icon: Users,
    title: "Community Hub",
    desc: "Share, discover, and collaborate on models/datasets.",
    badge: "Collaborate",
  },
  {
    icon: Shield,
    title: "Enterprise-ready",
    desc: "Secure, scalable, and optimized infrastructure.",
    badge: "Security",
  },
]

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title} className="border-muted">
            <CardHeader>
              <div className="flex items-center gap-3">
                <f.icon className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                <Badge variant="secondary">{f.badge}</Badge>
              </div>
              <CardTitle className="mt-2">{f.title}</CardTitle>
              <CardDescription>{f.desc}</CardDescription>
            </CardHeader>
            <CardContent></CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
