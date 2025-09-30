import { usePageContext } from 'vike-react/usePageContext'
import { formatEventDateTime } from '../../../src/lib/utils.js'

export default function Head() {
  const pageContext = usePageContext()
  const { event } = pageContext.data

  if (!event) {
    return null
  }

  const eventTitle = `${event.name} - Let's play!`
  const eventDescription = `Join us! ${event.location ? `📍 ${event.location}` : ''} ${event.cost ? `💰 ${event.cost}` : '💰 Free'}`
  const baseUrl = process.env.VITE_APP_URL || 'http://localhost:3000'
  const eventImage = `${baseUrl}/api/og/event/${event.id}`
  const eventUrl = `${baseUrl}/signup/${event.id}`

  return (
    <>
      {/* Open Graph meta tags for rich social media previews */}
      <meta property="og:title" content={eventTitle} />
      <meta property="og:description" content={eventDescription} />
      <meta property="og:image" content={eventImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:type" content="event" />
      <meta property="og:url" content={eventUrl} />
      <meta property="og:site_name" content="Roster" />

      {/* Twitter Card meta tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={eventTitle} />
      <meta name="twitter:description" content={eventDescription} />
      <meta name="twitter:image" content={eventImage} />

      {/* Event-specific structured data */}
      <meta property="event:start_time" content={event.datetime} />
      {event.end_datetime && (
        <meta property="event:end_time" content={event.end_datetime} />
      )}
      {event.location && (
        <meta property="event:location" content={event.location} />
      )}
    </>
  )
}