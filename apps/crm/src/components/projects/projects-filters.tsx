'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export function ProjectsFilters() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
      <div className="relative flex-1 min-w-48">
        <Search size={15} className="absolute top-1/2 -translate-y-1/2 end-3 text-muted-foreground" />
        <Input
          placeholder="חיפוש פרויקט, עיר, כתובת..."
          className="pe-9 text-right"
          dir="rtl"
        />
      </div>

      <Select defaultValue="all">
        <SelectTrigger className="w-40">
          <SelectValue placeholder="סטטוס" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הסטטוסים</SelectItem>
          <SelectItem value="ACTIVE">פעיל</SelectItem>
          <SelectItem value="ON_HOLD">מושהה</SelectItem>
          <SelectItem value="COMPLETED">הושלם</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="all">
        <SelectTrigger className="w-44">
          <SelectValue placeholder="שלב" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל השלבים</SelectItem>
          <SelectItem value="DISCOVERY">גילוי</SelectItem>
          <SelectItem value="SIGNATURES">חתימות</SelectItem>
          <SelectItem value="PLANNING">תכנון</SelectItem>
          <SelectItem value="CONSTRUCTION">בנייה</SelectItem>
          <SelectItem value="DELIVERY">מסירה</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="all">
        <SelectTrigger className="w-36">
          <SelectValue placeholder="עיר" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל הערים</SelectItem>
          <SelectItem value="tlv">תל אביב</SelectItem>
          <SelectItem value="jlm">ירושלים</SelectItem>
          <SelectItem value="hfa">חיפה</SelectItem>
          <SelectItem value="bnb">בני ברק</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" className="gap-2 ms-auto">
        <SlidersHorizontal size={14} />
        פילטרים נוספים
      </Button>
    </div>
  )
}
