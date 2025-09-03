"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Search, Menu } from "lucide-react"

const links = [
  { href: "/", label: "Home" },
  { href: "/models", label: "Models" },
  { href: "/autotrain", label: "AutoTrain" },
  { href: "/datasets", label: "Datasets" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/community", label: "Community" },
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger className="md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <nav className="mt-6 flex flex-col gap-3">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {l.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/" className="font-semibold">
            <span className="sr-only">AI Platform</span>
            <span className="text-lg">AI Platform</span>
          </Link>
          <nav className="hidden md:flex items-center gap-5">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden md:flex flex-1 items-center justify-center max-w-xl">
          <div className="relative w-full">
            <Input type="search" placeholder="Search models and datasets..." aria-label="Search models and datasets" />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Submit search"
              type="button"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="hidden sm:inline-flex">
                Docs
              </Button>
            </DropdownMenuTrigger>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/signin">Sign In</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard">Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
