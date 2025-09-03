import Link from "next/link"
import { Cpu, Database, Layers, PlayCircle, FileBarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  { href: "/dashboard", label: "Projects", icon: Layers },
  { href: "/dashboard/models", label: "Models", icon: Cpu },
  { href: "/dashboard/datasets", label: "Datasets", icon: Database },
  { href: "/dashboard/training", label: "Training Jobs", icon: PlayCircle },
  { href: "/dashboard/inference", label: "Inference Logs", icon: FileBarChart2 },
]

export function Sidebar({ active = "/dashboard" }: { active?: string }) {
  return (
    <aside className="w-full border-b md:w-64 md:border-b-0 md:border-r">
      <nav className="flex overflow-x-auto md:block">
        <ul className="flex w-full items-center gap-2 p-2 md:flex-col md:gap-1 md:p-4">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  active === it.href && "bg-muted text-foreground",
                )}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
