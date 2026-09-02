import { PagesList } from '@/components/site/pages-list'

/**
 * The pages the CMS knows about.
 *
 * Only pages that have actually been MIGRATED appear here. The website has
 * eight fixed pages; one of them is in the database and the rest are still
 * rendered from code, and this screen says which is which rather than
 * pretending to manage all eight. A CMS that lists a page it cannot edit
 * teaches people that its buttons sometimes do nothing.
 */
export default function SitePagesPage() {
  return <PagesList />
}
