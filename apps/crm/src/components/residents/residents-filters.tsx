'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ResidentsFilters() {
  return (
    <div className="flex flex-wrap gap-3 p-4 border-b border-border">
      <div className="relative flex-1 min-w-52">
        <Search size={15} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי שם, טלפון, כתובת..."
          className="pe-9 h-9 text-sm"
          dir="rtl"
        />
      </div>

      <Select>
        <SelectTrigger className="h-9 w-40 text-sm">
          <SelectValue placeholder="סטטוס" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הסטטוסים</SelectItem>
          <SelectItem value="SIGNED">חתם</SelectItem>
          <SelectItem value="INTERESTED">מעוניין</SelectItem>
          <SelectItem value="UNDECIDED">לא החליט</SelectItem>
          <SelectItem value="OBJECTING">מתנגד</SelectItem>
          <SelectItem value="DECEASED">נפטר</SelectItem>
        </SelectContent>
      </Select>

      <Select>
        <SelectTrigger className="h-9 w-44 text-sm">
          <SelectValue placeholder="פרויקט" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הפרויקטים</SelectItem>
          <SelectItem value="tlv-001">הרצל 45, ת"א</SelectItem>
          <SelectItem value="tlv-002">ביאליק 12, רמת גן</SelectItem>
          <SelectItem value="tlv-003">בן יהודה 88, ת"א</SelectItem>
        </SelectContent>
      </Select>

      <Select>
        <SelectTrigger className="h-9 w-36 text-sm">
          <SelectValue placeholder="רמת סיכון" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הסיכונים</SelectItem>
          <SelectItem value="HIGH">גבוה</SelectItem>
          <SelectItem value="MEDIUM">בינוני</SelectItem>
          <SelectItem value="LOW">נמוך</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
