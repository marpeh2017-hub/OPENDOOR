import { ArticleEditorLoader } from '@/components/site/article-editor-loader'

export default async function SiteArticleEditorRoute({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ArticleEditorLoader slug={slug} />
}
