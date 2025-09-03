import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function DocsPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Docs</h1>
        <p className="mt-2 text-muted-foreground">Learn how to integrate the platform.</p>
      </section>
      <Footer />
    </main>
  )
}
