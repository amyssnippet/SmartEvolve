import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function LandingContent() {
  return (
    <section className="w-full border-t">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <div className="flex flex-col gap-2">
          <h2 className="text-balance text-2xl font-semibold md:text-3xl">How it works</h2>
          <p className="max-w-2xl text-muted-foreground">
            Go from idea to production with a streamlined workflow designed for modern AI apps.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Step
            number="01"
            title="Design prompts"
            desc="Author prompts with inputs, variables, and test fixtures. Save versions you can compare."
          />
          <Step
            number="02"
            title="Evaluate quality"
            desc="Run automatic evals on accuracy, toxicity, and latency. Add human labeled checks where needed."
          />
          <Step
            number="03"
            title="Ship with confidence"
            desc="Deploy changes with clear deltas and guardrails. Monitor real traffic with rich traces."
          />
        </div>

        <LogosRow />
      </div>
    </section>
  )
}

function Step({
  number,
  title,
  desc,
}: {
  number: string
  title: string
  desc: string
}) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="text-sm font-medium text-muted-foreground">{number}</div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  )
}

function LogosRow() {
  return (
    <div className="mt-10 grid grid-cols-2 items-center gap-6 md:grid-cols-6">
      <Logo text="OpenAI" />
      <Logo text="Anthropic" />
      <Logo text="Cohere" />
      <Logo text="Google" />
      <Logo text="xAI" />
      <Logo text="Meta" />
    </div>
  )
}

function Logo({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      {text}
    </div>
  )
}
