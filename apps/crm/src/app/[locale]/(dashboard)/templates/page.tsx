import { TemplatesPageContent } from '@/components/templates/templates-page-content'

export const metadata = { title: 'תבניות הודעה' }

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">תבניות הודעה</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            נוסחי ההודעות הנשלחות לדיירים ב-SMS, וואטסאפ ואימייל
          </p>
        </div>
      </div>

      <TemplatesPageContent />
    </div>
  )
}
