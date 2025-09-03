import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function AutoTrainPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">AutoTrain</h1>
        <p className="mt-2 text-muted-foreground">Upload data, configure, and train LLMs automatically.</p>
      </section>
      <Footer />
    </main>
  )
}
