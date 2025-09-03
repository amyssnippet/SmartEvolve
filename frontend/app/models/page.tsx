import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function ModelsPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Models</h1>
        <p className="mt-2 text-muted-foreground">Browse and manage models.</p>
      </section>
      <Footer />
    </main>
  )
}
