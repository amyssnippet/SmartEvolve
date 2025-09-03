import Link from "next/link"
import { ThemeToggle } from "./theme-toggle"
import { Github, Linkedin, Twitter } from "lucide-react"

const links = [
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/careers", label: "Careers" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact" },
]

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a
              aria-label="Twitter"
              className="text-muted-foreground hover:text-foreground"
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              aria-label="GitHub"
              className="text-muted-foreground hover:text-foreground"
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              aria-label="LinkedIn"
              className="text-muted-foreground hover:text-foreground"
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
            >
              <Linkedin className="h-5 w-5" />
            </a>
            <ThemeToggle />
          </div>
        </div>
        <div className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} AI Platform. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
