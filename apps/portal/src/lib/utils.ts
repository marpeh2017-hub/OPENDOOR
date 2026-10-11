import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The Israeli ID number's check digit, as the gateway checks it. */
export function isValidIsraeliId(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (!/^\d{5,9}$/.test(digits)) return false
  const padded = digits.padStart(9, '0')
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const product = Number(padded[i]) * ((i % 2) + 1)
    sum += product > 9 ? product - 9 : product
  }
  return sum % 10 === 0
}
