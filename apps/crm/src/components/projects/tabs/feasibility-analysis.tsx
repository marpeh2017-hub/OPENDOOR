'use client'

import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CircleDollarSign, LineChart as LineChartIcon, Scale } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FeasibilityCalculation, FeasibilitySensitivity } from '@/hooks/use-feasibility'

const currency = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat('he-IL', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })

function toNumber(value: string | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat('he-IL', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function TooltipValue({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return <div className="rounded-md border border-border bg-popover px-3 py-2 text-right text-xs shadow-md">
    {label && <p className="mb-1 text-muted-foreground">{label}</p>}
    {payload.map((entry: any) => <p key={entry.dataKey} className="font-medium" style={{ color: entry.color }}>{entry.name}: {currency.format(entry.value)}</p>)}
  </div>
}

function Metric({ label, value, tone = 'default', hint }: { label: string; value: string; tone?: 'default' | 'good' | 'risk'; hint?: string }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'risk' ? 'text-rose-700' : 'text-foreground'
  return <div className="min-w-0 border-s border-border ps-3 first:border-s-0 first:ps-0">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`mt-1 truncate text-base font-semibold tabular-nums ${color}`}>{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
  </div>
}

export function FeasibilityAnalysis({ calculation }: { calculation: FeasibilityCalculation }) {
  const revenue = toNumber(calculation.revenue.total)
  const costs = toNumber(calculation.costs.total)
  const profit = toNumber(calculation.profitability.profit)
  const margin = calculation.profitability.profitMargin ? toNumber(calculation.profitability.profitMargin) : null
  const profitOnCost = calculation.profitability.profitOnCost ? toNumber(calculation.profitability.profitOnCost) : null
  /*
   * In a combination deal the cost base includes flats handed to the seller,
   * so `profitOnCost` already divides by more than the cash costs shown above
   * it. Without saying so the two figures look inconsistent on screen — the
   * ratio does not match revenue-minus-costs — and the reader has no way to
   * tell why. Shown only when there IS consideration in kind; a cash purchase
   * gains nothing from the extra line.
   */
  const inKind = toNumber(calculation.costs.considerationInKind ?? '0')
  const comparison = calculation.valuation.comparison
  const cashflow = calculation.cashFlow.periods.map((period) => ({
    period: new Date(period.periodStart).toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }),
    cumulative: toNumber(period.cumulative),
    net: toNumber(period.net),
  }))
  const summary = [
    { name: 'הכנסות', amount: revenue, fill: '#2563eb' },
    { name: 'עלויות', amount: costs, fill: '#ea580c' },
    { name: 'רווח', amount: profit, fill: profit >= 0 ? '#059669' : '#e11d48' },
  ]
  const critical = calculation.validation.filter((issue) => issue.severity === 'CRITICAL')
  const warnings = calculation.validation.filter((issue) => issue.severity === 'WARNING')

  return <section className="mt-5 space-y-5 border-t border-border pt-5" aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 className="flex items-center gap-2 font-semibold"><BarChart3 size={17} />ניתוח כלכלי חי</h4>
        <p className="mt-1 text-xs text-muted-foreground">הגרפים מציגים את תוצאת המנוע בלבד; כל חישוב נשאר בצד השרת ובדיוק עשרוני.</p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${critical.length ? 'bg-rose-50 text-rose-800' : warnings.length ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
        {critical.length ? `${critical.length} שגיאות קריטיות` : warnings.length ? `${warnings.length} אזהרות` : 'ללא חריגות'}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
      <Metric label="הכנסות" value={currency.format(revenue)} hint="לפני מע״מ" />
      <Metric label="עלויות" value={currency.format(costs)} hint="לפני מע״מ" />
      <Metric label="רווח" value={currency.format(profit)} tone={profit >= 0 ? 'good' : 'risk'} />
      <Metric label="מרווח רווח" value={margin === null ? 'חסר תזרים' : percent.format(margin)} tone={margin !== null && margin < 0 ? 'risk' : 'default'} />
    </div>

    <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Metric label="IRR פרויקט" value={calculation.returns.projectIrrAnnual === null ? 'לא זמין' : percent.format(toNumber(calculation.returns.projectIrrAnnual))} />
      <Metric label="NPV פרויקט" value={calculation.returns.projectNpv === null ? 'לא זמין' : currency.format(toNumber(calculation.returns.projectNpv))} />
      <Metric label="שווי קרקע שיורי" value={calculation.valuation.residualLandValue === null ? 'חסרה הנחת רווח יזמי' : currency.format(toNumber(calculation.valuation.residualLandValue))} />
      <Metric label="שווי בגישת השוואה" value={comparison.value === null ? 'חסרים שטח נושא או עסקאות' : currency.format(toNumber(comparison.value))} hint={comparison.comparableCount ? `${comparison.comparableCount} עסקאות · ${comparison.averageAdjustedPricePerSqm ? `${currency.format(toNumber(comparison.averageAdjustedPricePerSqm))}/מ״ר` : 'ללא מחיר מתואם'}` : 'טרם הוזנו עסקאות'} />
      <Metric label="מצב כדאיות" value={{ DATA_INCOMPLETE: 'נתונים חסרים', FEASIBLE: 'כדאי', CONDITIONAL: 'כדאי בתנאים', NOT_FEASIBLE: 'לא כדאי' }[calculation.feasibility.status]} tone={calculation.feasibility.status === 'NOT_FEASIBLE' || calculation.feasibility.status === 'DATA_INCOMPLETE' ? 'risk' : calculation.feasibility.status === 'FEASIBLE' ? 'good' : 'default'} />
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <figure className="rounded-lg border border-border bg-background p-4">
        <figcaption className="mb-3 flex items-center gap-2 text-sm font-medium"><CircleDollarSign size={16} />הכנסות, עלויות ורווח</figcaption>
        <div className="h-56" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={compactCurrency} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<TooltipValue />} cursor={{ fill: 'rgba(148,163,184,.12)' }} />
              <Bar dataKey="amount" name="סכום" radius={[4, 4, 0, 0]}>{summary.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <figure className="rounded-lg border border-border bg-background p-4">
        <figcaption className="mb-3 flex items-center gap-2 text-sm font-medium"><LineChartIcon size={16} />תזרים מצטבר</figcaption>
        {cashflow.length ? <div className="h-56" dir="ltr"><ResponsiveContainer width="100%" height="100%"><LineChart data={cashflow} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="period" tickLine={false} axisLine={false} /><YAxis tickFormatter={compactCurrency} tickLine={false} axisLine={false} width={52} /><ReferenceLine y={0} stroke="#64748b" /><Tooltip content={<TooltipValue />} /><Line type="monotone" dataKey="cumulative" name="מצטבר" stroke="#0f766e" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /></LineChart></ResponsiveContainer></div> : <div className="flex h-56 items-center justify-center rounded-md bg-muted/45 px-6 text-center text-sm text-muted-foreground">הזינו הקצאות חודשיות להכנסות ולעלויות כדי לראות תזרים מצטבר ושיא צורך בהון.</div>}
      </figure>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="דרישת הון שיא" value={currency.format(toNumber(calculation.cashFlow.peakFundingRequirement))} />
      <Metric label="חוב שיא" value={currency.format(toNumber(calculation.financing.peakDebt))} />
      <Metric label="ריבית שנצברה" value={currency.format(toNumber(calculation.financing.accumulatedInterest))} />
      <Metric label="עמלות מימון" value={currency.format(toNumber(calculation.financing.financingFees))} hint="סידור וערבויות" />
      <Metric
        label="רווח על עלות"
        value={profitOnCost === null ? 'לא זמין' : percent.format(profitOnCost)}
        hint={inKind > 0
          ? `כולל תמורה בשווה־כסף של ₪${inKind.toLocaleString('he-IL', { maximumFractionDigits: 0 })} בבסיס העלות`
          : undefined}
      />
      <Metric label="מכפיל הון" value={calculation.returns.equityMultiple === null ? 'לא זמין' : `${toNumber(calculation.returns.equityMultiple).toFixed(2)}x`} />
      <Metric label="הון שהושקע" value={currency.format(toNumber(calculation.returns.equityInvested))} />
      <Metric label="התאמת תזרים" value={calculation.cashFlow.reconciliationComplete ? 'תואם' : 'נדרשת השלמה'} tone={calculation.cashFlow.reconciliationComplete ? 'good' : 'risk'} />
      <Metric label="אמינות נתונים" value={`${calculation.dataQuality.confidenceScore}%`} hint="מקור או אישור מקצועי" />
    </div>

    <details className="rounded-lg border border-border bg-background p-4">
      <summary className="cursor-pointer text-sm font-semibold">עקיבות נוסחאות ומרכיבי חישוב</summary>
      <p className="mt-1 text-xs text-muted-foreground">הפירוט נוצר על ידי המנוע בצד השרת ונשמר עם צילום החישוב; אין כאן חישוב בדפדפן.</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TraceTable title="הכנסות" trace={calculation.traceability.revenue} />
        <TraceTable title="עלויות" trace={calculation.traceability.costs} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric label="נוסחת רווח" value={calculation.traceability.profit.formula} hint={currency.format(toNumber(calculation.traceability.profit.amount))} />
        <Metric label="נוסחת שווי שיורי" value={calculation.traceability.residualLandValue?.formula ?? 'חסרה הנחת יעד רווח יזמי'} hint={calculation.traceability.residualLandValue ? currency.format(toNumber(calculation.traceability.residualLandValue.amount)) : undefined} />
      </div>
      <div className="mt-3">
        <Metric label="שיטת ההשוואה" value={calculation.traceability.comparison?.formula ?? 'הזינו עסקאות השוואה ושטח נושא שומה'} hint={calculation.traceability.comparison ? `${calculation.traceability.comparison.comparableCount} עסקאות · שטח נושא: ${calculation.traceability.comparison.subjectAreaSqm} מ״ר` : undefined} />
      </div>
    </details>

    {(critical.length > 0 || warnings.length > 0) && <div className={`rounded-lg border p-4 ${critical.length ? 'border-rose-200 bg-rose-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
      <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} />בקרת איכות החישוב</div>
      <ul className="mt-2 space-y-1.5 text-sm">{[...critical, ...warnings].map((issue, index) => <li className="flex gap-2" key={`${issue.code}-${index}`}>{issue.severity === 'CRITICAL' ? <ArrowDownRight className="mt-0.5 shrink-0 text-rose-700" size={15} /> : <ArrowUpRight className="mt-0.5 shrink-0 text-amber-700" size={15} />}<span>{issue.message}</span></li>)}</ul>
    </div>}
  </section>
}

function TraceTable({ title, trace }: { title: string; trace: { formula: string; amount: string; inputs: Array<{ id: string; label: string; category: string; amount: string; formula: string }> } }) {
  return <section><div className="flex items-baseline justify-between gap-3"><h5 className="text-sm font-semibold">{title}</h5><span className="text-sm font-semibold tabular-nums">{currency.format(toNumber(trace.amount))}</span></div><p className="mt-1 text-xs text-muted-foreground">{trace.formula}</p>{trace.inputs.length ? <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">{trace.inputs.map((line) => <li key={line.id} className="flex items-start justify-between gap-3 px-3 py-2"><span><span className="block font-medium">{line.label}</span><span className="block text-xs text-muted-foreground">{line.formula}</span></span><span className="shrink-0 tabular-nums">{currency.format(toNumber(line.amount))}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">אין שורות מחושבות.</p>}</section>
}

export function FeasibilityScenarioComparison({ scenarios }: { scenarios: Array<{ name: string; calculation: FeasibilityCalculation }> }) {
  if (scenarios.length < 2) return null
  const data = scenarios.map(({ name, calculation }) => ({
    name,
    הכנסות: toNumber(calculation.revenue.total),
    עלויות: toNumber(calculation.costs.total),
    רווח: toNumber(calculation.profitability.profit),
  }))
  const statusLabel = { DATA_INCOMPLETE: 'נתונים חסרים', FEASIBLE: 'כדאי', CONDITIONAL: 'כדאי בתנאים', NOT_FEASIBLE: 'לא כדאי' } as const
  return <section className="card-surface p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-semibold"><Scale size={17} />השוואת תרחישים</h3><p className="mt-1 text-xs text-muted-foreground">השוואה בין תוצאות שרצתם בפועל. שינוי תרחיש אינו משנה תרחיש אחר.</p></div><span className="text-xs text-muted-foreground">כל הסכומים לפני מע״מ</span></div>
    <div className="mt-4 h-72" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 2 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis tickFormatter={compactCurrency} tickLine={false} axisLine={false} width={52} /><Tooltip content={<TooltipValue />} /><Bar dataKey="הכנסות" fill="#2563eb" radius={[3, 3, 0, 0]} /><Bar dataKey="עלויות" fill="#ea580c" radius={[3, 3, 0, 0]} /><Bar dataKey="רווח" fill="#059669" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
    <div className="mt-4 overflow-x-auto"><table className="min-w-full text-right text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="px-2 py-2 font-medium">תרחיש</th><th className="px-2 py-2 font-medium">IRR פרויקט</th><th className="px-2 py-2 font-medium">NPV</th><th className="px-2 py-2 font-medium">הון שיא</th><th className="px-2 py-2 font-medium">שווי שיורי</th><th className="px-2 py-2 font-medium">כדאיות</th></tr></thead><tbody>{scenarios.map(({ name, calculation }) => <tr className="border-b border-border/70 last:border-0" key={name}><td className="px-2 py-2 font-medium">{name}</td><td className="px-2 py-2 tabular-nums">{calculation.returns.projectIrrAnnual === null ? '—' : percent.format(toNumber(calculation.returns.projectIrrAnnual))}</td><td className="px-2 py-2 tabular-nums">{calculation.returns.projectNpv === null ? '—' : currency.format(toNumber(calculation.returns.projectNpv))}</td><td className="px-2 py-2 tabular-nums">{currency.format(toNumber(calculation.cashFlow.peakFundingRequirement))}</td><td className="px-2 py-2 tabular-nums">{calculation.valuation.residualLandValue === null ? '—' : currency.format(toNumber(calculation.valuation.residualLandValue))}</td><td className="px-2 py-2">{statusLabel[calculation.feasibility.status]}</td></tr>)}</tbody></table></div>
  </section>
}

export function FeasibilitySensitivityMatrix({ result }: { result: FeasibilitySensitivity }) {
  const isMatrix = Boolean(result.secondaryVariable)
  const labels: Record<string, string> = { SALE_PRICE: 'מחיר מכירה', CONSTRUCTION_COST: 'עלות בנייה', LAND_COST: 'עלות קרקע', INTEREST_RATE: 'ריבית מימון', DISCOUNT_RATE: 'שיעור היוון' }
  return <section className="mt-5 rounded-lg border border-border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="flex items-center gap-2 text-sm font-semibold"><Scale size={16} />רגישות: {labels[result.primaryVariable]}{result.secondaryVariable ? ` × ${labels[result.secondaryVariable]}` : ''}</h4><p className="mt-1 text-xs text-muted-foreground">כל תא מחושב בצד השרת ואינו משנה את הנחות התרחיש.</p></div><span className="text-xs text-muted-foreground">רווח, IRR, NPV והון עצמי</span></div>
    <div className="mt-4 overflow-x-auto"><table className="min-w-full border-separate border-spacing-1 text-center text-xs tabular-nums"><thead><tr><th className="sticky right-0 bg-background p-2 text-right font-medium text-muted-foreground">שינוי</th>{isMatrix && result.rows[0]?.values?.map((cell) => <th key={cell.secondaryChangePercent} className="min-w-24 p-2 font-medium text-muted-foreground">{cell.secondaryChangePercent}%</th>)}{!isMatrix && <th className="p-2 font-medium text-muted-foreground">רווח / IRR</th>} </tr></thead><tbody>{result.rows.map((row) => <tr key={row.primaryChangePercent}><th className="sticky right-0 bg-background p-2 text-right font-medium">{row.primaryChangePercent}%</th>{isMatrix ? row.values?.map((cell) => <SensitivityCell key={cell.secondaryChangePercent} value={cell.profit} irr={cell.projectIrrAnnual} npv={cell.projectNpv} equity={cell.equityRequirement} />) : <SensitivityCell value={row.profit ?? '0'} irr={row.projectIrrAnnual} npv={row.projectNpv} equity={row.equityRequirement} />}</tr>)}</tbody></table></div>
    <p className="mt-3 text-xs text-muted-foreground">{result.notes.join(' ')}</p>
  </section>
}

function SensitivityCell({ value, irr, npv, equity }: { value: string; irr?: string | null; npv?: string | null; equity?: string }) {
  const numeric = toNumber(value)
  const npvValue = npv === null || npv === undefined ? null : toNumber(npv)
  const color = numeric < 0 || (npvValue !== null && npvValue < 0) ? 'bg-rose-100 text-rose-900' : numeric === 0 ? 'bg-slate-100 text-slate-800' : 'bg-emerald-100 text-emerald-900'
  return <td className={`rounded-sm p-2 ${color}`}><span className="block">{compactCurrency(numeric)}</span><span className="mt-0.5 block text-[10px] opacity-80">{irr === null || irr === undefined ? 'IRR —' : `IRR ${percent.format(toNumber(irr))}`}</span>{npvValue !== null && <span className="mt-0.5 block text-[10px] opacity-80">NPV {compactCurrency(npvValue)}</span>}{equity && <span className="mt-0.5 block text-[10px] opacity-80">הון {compactCurrency(toNumber(equity))}</span>}</td>
}
