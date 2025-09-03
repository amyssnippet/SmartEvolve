import { Navbar } from "@/components/navbar"
import { Sidebar } from "@/components/sidebar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, UploadCloud } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { MetricsChart } from "@/components/metrics-chart"

const projects = [
  { id: "proj_1", name: "Customer Support LLM", updated: "2h ago", status: "running" as const },
  { id: "proj_2", name: "Summarizer v2", updated: "1d ago", status: "finished" as const },
  { id: "proj_3", name: "Code Assistant", updated: "3d ago", status: "failed" as const },
]

export default function DashboardPage() {
  return (
    <main>
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
          <Sidebar active="/dashboard" />
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Active Projects</h2>
                <p className="text-sm text-muted-foreground">Manage your models, datasets, and training jobs.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button>
                  <Play className="mr-2 h-4 w-4" />
                  Start Training
                </Button>
                <Button variant="outline">
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Deploy Model
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Card key={p.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <CardDescription>Updated {p.updated}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <StatusBadge status={p.status} />
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <MetricsChart />
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
