export type ReplacementAllocation = {
  unitReference: string; ownerApartmentId: string; shareNumerator: number; shareDenominator: number
}

/** Integer fractions avoid rounding a fully allocated unit above or below 100%. */
export function replacementAllocationSummary(rows: ReplacementAllocation[]) {
  const units = new Map<string, { numerator: bigint; denominator: bigint; owners: Set<string> }>()
  let invalid = false
  for (const row of rows) {
    if (!row.unitReference?.trim() || !row.ownerApartmentId || !Number.isSafeInteger(row.shareNumerator) || !Number.isSafeInteger(row.shareDenominator)
      || row.shareNumerator <= 0 || row.shareDenominator <= 0 || row.shareNumerator > row.shareDenominator) { invalid = true; continue }
    const unit = units.get(row.unitReference) ?? { numerator: 0n, denominator: 1n, owners: new Set<string>() }
    if (unit.owners.has(row.ownerApartmentId)) invalid = true
    unit.owners.add(row.ownerApartmentId)
    unit.numerator = unit.numerator * BigInt(row.shareDenominator) + BigInt(row.shareNumerator) * unit.denominator
    unit.denominator *= BigInt(row.shareDenominator)
    units.set(row.unitReference, unit)
  }
  return {
    unitCount: units.size, invalid,
    overallocated: [...units.values()].some((unit) => unit.numerator > unit.denominator),
    incomplete: [...units.values()].some((unit) => unit.numerator < unit.denominator),
  }
}
