import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function SettingsPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your account and preferences.</p>
      </section>
      <Footer />
    </main>
  )
}
