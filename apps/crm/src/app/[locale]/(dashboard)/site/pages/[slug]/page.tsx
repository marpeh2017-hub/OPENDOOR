import { PageEditorLoader } from '@/components/site/page-editor-loader'

/**
 * One page's editor.
 *
 * The route is addressed by SLUG rather than by database id, because the slug
 * is what an editor knows and what the website URL already uses. Resolving it
 * to an id happens client-side against the list the user is permitted to see,
 * so an unauthorised or wrong slug produces "not found" from data the caller
 * could already read, rather than a lookup that reveals whether the id exists.
 */
export default async function SitePageEditorRoute({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <PageEditorLoader slug={slug} />
}
