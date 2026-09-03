import { ProjectEditorLoader } from '@/components/site/project/project-editor-loader'

/**
 * One project's editor.
 *
 * Addressed by SLUG rather than database id, because the slug is what an
 * editor knows and what the website URL already uses.
 */
export default async function SiteProjectEditorRoute({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ProjectEditorLoader slug={slug} />
}
