import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function SignInPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input placeholder="Email" type="email" />
            <Input placeholder="Password" type="password" />
          </CardContent>
          <CardFooter>
            <Button className="w-full">Sign In</Button>
          </CardFooter>
        </Card>
      </section>
      <Footer />
    </main>
  )
}
