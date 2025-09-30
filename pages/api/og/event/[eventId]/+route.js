import { createCanvas } from 'canvas'
import { serverEventService } from '@/services/server-services.js'
import { formatEventDateTime } from '@/lib/utils.js'

async function GET(pageContext) {
  try {
    const { eventId } = pageContext.routeParams

    // Fetch event data
    const event = await serverEventService.getEventById(eventId)
    if (!event) {
      return new Response('Event not found', { status: 404 })
    }

    // Create canvas with OG image dimensions (1200x630)
    const canvas = createCanvas(1200, 630)
    const ctx = canvas.getContext('2d')

    // Fill background with light gray (WeChat-style)
    ctx.fillStyle = '#F5F5F5'
    ctx.fillRect(0, 0, 1200, 630)

    // Add white card container with rounded corners effect
    ctx.fillStyle = 'white'
    ctx.fillRect(40, 40, 1120, 550)

    // Add subtle border
    ctx.strokeStyle = '#E5E5E5'
    ctx.lineWidth = 1
    ctx.strokeRect(40, 40, 1120, 550)

    // Configure text styles
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    // Event title (large, bold)
    ctx.fillStyle = '#333333'
    ctx.font = 'bold 64px Arial, sans-serif'
    const maxTitleLength = 30
    const titleText = event.name.length > maxTitleLength
      ? event.name.substring(0, maxTitleLength) + '...'
      : event.name
    ctx.fillText(titleText, 80, 100)

    // Event date/time (medium)
    ctx.font = '48px Arial, sans-serif'
    const dateText = formatEventDateTime(event.datetime)
    ctx.fillText(dateText, 80, 190)

    // Location (with text label)
    ctx.font = '36px Arial, sans-serif'
    if (event.location) {
      const locationText = `Location: ${event.location}`
      ctx.fillText(locationText, 80, 270)
    }

    // Cost (with text label)
    const costText = `Cost: ${event.cost || 'Free'}`
    ctx.fillText(costText, 80, 320)

    // Organizer info (if available)
    ctx.font = '28px Arial, sans-serif'
    ctx.fillStyle = '#666666'
    ctx.fillText('Organized by Roster Community', 80, 380)

    // Green "Click to Join" button
    const buttonX = 80
    const buttonY = 450
    const buttonWidth = 300
    const buttonHeight = 80
    const cornerRadius = 25

    // Button background (manual rounded rectangle for node-canvas compatibility)
    ctx.fillStyle = '#4CAF50'
    ctx.beginPath()
    ctx.moveTo(buttonX + cornerRadius, buttonY)
    ctx.lineTo(buttonX + buttonWidth - cornerRadius, buttonY)
    ctx.arcTo(buttonX + buttonWidth, buttonY, buttonX + buttonWidth, buttonY + cornerRadius, cornerRadius)
    ctx.lineTo(buttonX + buttonWidth, buttonY + buttonHeight - cornerRadius)
    ctx.arcTo(buttonX + buttonWidth, buttonY + buttonHeight, buttonX + buttonWidth - cornerRadius, buttonY + buttonHeight, cornerRadius)
    ctx.lineTo(buttonX + cornerRadius, buttonY + buttonHeight)
    ctx.arcTo(buttonX, buttonY + buttonHeight, buttonX, buttonY + buttonHeight - cornerRadius, cornerRadius)
    ctx.lineTo(buttonX, buttonY + cornerRadius)
    ctx.arcTo(buttonX, buttonY, buttonX + cornerRadius, buttonY, cornerRadius)
    ctx.closePath()
    ctx.fill()

    // Button text
    ctx.fillStyle = 'white'
    ctx.font = 'bold 36px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Click to Join', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2)

    // Add small Roster branding in bottom right
    ctx.fillStyle = '#999999'
    ctx.font = '24px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('Roster', 1160, 570)

    // Convert canvas to PNG buffer
    const buffer = canvas.toBuffer('image/png')

    // Return image response with appropriate headers
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Content-Length': buffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Error generating event OG image:', error)
    return new Response('Error generating image', { status: 500 })
  }
}

export const route = GET