import { DocumentsLibrary } from '@/components/documents/documents-library'

export const metadata = { title: 'מסמכים' }

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">מסמכים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ספריית המסמכים של כל הפרויקטים — הורדה מאובטחת בקישור זמני
          </p>
        </div>
      </div>

      <DocumentsLibrary />
    </div>
  )
}
