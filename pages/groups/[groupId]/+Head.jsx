import { usePageContext } from 'vike-react/usePageContext'

export default function Head() {
  const pageContext = usePageContext()
  const { group, memberCount, eventCount } = pageContext.data

  if (!group) {
    return null
  }

  const groupTitle = `${group.name} - Join our group!`
  const groupDescription = `👥 ${memberCount} member${memberCount !== 1 ? 's' : ''} • ${eventCount} event${eventCount !== 1 ? 's' : ''} • ${group.description || 'Active community'}`
  const groupImage = `/api/og/group/${group.id}`
  const groupUrl = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/groups/${group.id}`

  return (
    <>
      {/* Open Graph meta tags for rich social media previews */}
      <meta property="og:title" content={groupTitle} />
      <meta property="og:description" content={groupDescription} />
      <meta property="og:image" content={groupImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={groupUrl} />
      <meta property="og:site_name" content="Roster" />

      {/* Twitter Card meta tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={groupTitle} />
      <meta name="twitter:description" content={groupDescription} />
      <meta name="twitter:image" content={groupImage} />

      {/* Group-specific structured data */}
      <meta property="group:member_count" content={memberCount.toString()} />
      <meta property="group:event_count" content={eventCount.toString()} />
      {group.created_at && (
        <meta property="group:created_at" content={group.created_at} />
      )}
    </>
  )
}