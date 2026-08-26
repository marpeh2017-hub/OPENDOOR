/**
 * Title-only layout.
 *
 * `page.tsx` here is a client component, and Next.js refuses a `metadata`
 * export from one. A server layout is the supported way to give a client page a
 * document title, which matters for browser tabs, bookmarks and history.
 */
export const metadata = { title: 'פרויקטים' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
