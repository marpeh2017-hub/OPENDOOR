import { DqIssueDetail } from '@/components/data-quality/dq-issue-detail'

export const metadata = {
  title: 'פרטי בעיית איכות נתונים',
}

export default async function DataQualityIssuePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <DqIssueDetail issueId={id} />
}
