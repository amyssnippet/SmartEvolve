import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const tiers = [
  { name: "Starter", price: "$0", features: ["Community access", "Hosted inference (shared)", "Public models"] },
  { name: "Pro", price: "$49/mo", features: ["AutoTrain", "Faster inference", "Private projects"] },
  { name: "Enterprise", price: "Contact", features: ["SLA & SSO", "VPC deploy", "Custom scaling"] },
]

export default function PricingPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Pricing</h1>
        <p className="mt-2 text-muted-foreground">Simple, transparent plans.</p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((t) => (
            <Card key={t.name}>
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
                <div className="text-3xl font-semibold">{t.price}</div>
              </CardHeader>
              <CardContent>
                <ul className="mb-4 list-disc pl-5 text-sm text-muted-foreground">
                  {t.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Button className="w-full">Choose {t.name}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  )
}
