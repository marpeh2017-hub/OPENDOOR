/** Keep search/filter state and in-page anchors when next-intl changes locale. */
export function localeLocation(pathname: string, search: string, hash: string): string {
  return `${pathname}${search}${hash}`
}
