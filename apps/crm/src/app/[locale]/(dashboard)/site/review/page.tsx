import { ReviewQueue } from '@/components/site/review-queue'

/**
 * The IN_REVIEW workflow, made visible.
 *
 * `setState(id, 'IN_REVIEW')` has existed since Pass 4C — an editor could
 * always move content into review — but nothing ever showed what was
 * waiting there. A workflow with an entrance and no room behind the door is
 * not a workflow.
 */
export default function SiteReviewPage() {
  return <ReviewQueue />
}
