import { ProjectsList } from '@/components/site/project/projects-list'

/**
 * The projects the CMS manages.
 *
 * Backed by `cms_content` rather than by fixtures, so what this screen lists
 * is what the system actually holds. A project appears on the website only
 * when it is published, and even then only the parts that were verified.
 */
export default function SiteProjectsPage() {
  return <ProjectsList />
}
