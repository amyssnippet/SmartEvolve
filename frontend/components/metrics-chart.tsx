"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const data = [
  { step: 0, loss: 2.1, acc: 0.12 },
  { step: 100, loss: 1.8, acc: 0.22 },
  { step: 200, loss: 1.5, acc: 0.31 },
  { step: 300, loss: 1.3, acc: 0.39 },
  { step: 400, loss: 1.15, acc: 0.45 },
  { step: 500, loss: 1.02, acc: 0.5 },
]

export function MetricsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Metrics</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="step" stroke="currentColor" tickLine={false} axisLine={false} />
            <YAxis stroke="currentColor" tickLine={false} axisLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="loss" stroke="#2563eb" strokeWidth={2} dot={false} name="Loss" />
            <Line type="monotone" dataKey="acc" stroke="#7c3aed" strokeWidth={2} dot={false} name="Accuracy" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
