import { createCanvas, loadImage } from 'canvas'
import { serverGroupService } from '../../../../../src/services/server-services.js'

async function GET(pageContext) {
  try {
    const { groupId } = pageContext.routeParams

    // Fetch group data
    const group = await serverGroupService.getGroupById(groupId)
    if (!group) {
      return new Response('Group not found', { status: 404 })
    }

    // Get enhanced group statistics
    const memberCount = group.participant_count || 0
    const eventCount = group.event_count || 0

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

    // Group title (large, bold)
    ctx.fillStyle = '#333333'
    ctx.font = 'bold 64px Arial, sans-serif'
    const titleText = group.name
    ctx.fillText(titleText, 80, 100)

    // Group stats (medium)
    ctx.font = '48px Arial, sans-serif'
    const memberText = `👥 ${memberCount} member${memberCount !== 1 ? 's' : ''}`
    ctx.fillText(memberText, 80, 190)

    // Event count
    const eventText = `🎯 ${eventCount} event${eventCount !== 1 ? 's' : ''}`
    ctx.fillText(eventText, 80, 250)

    // Group description (if available)
    ctx.font = '36px Arial, sans-serif'
    ctx.fillStyle = '#666666'
    if (group.description) {
      // Truncate description if too long
      const maxDescLength = 80
      const description = group.description.length > maxDescLength
        ? group.description.substring(0, maxDescLength) + '...'
        : group.description
      ctx.fillText(description, 80, 320)
    } else {
      ctx.fillText('Join our active community!', 80, 320)
    }

    // Community label
    ctx.font = '28px Arial, sans-serif'
    ctx.fillStyle = '#888888'
    ctx.fillText('Community • Roster', 80, 380)

    // Green "Join Group" button
    const buttonX = 80
    const buttonY = 450
    const buttonWidth = 300
    const buttonHeight = 80
    const cornerRadius = 25

    // Button background
    ctx.fillStyle = '#4CAF50'
    ctx.beginPath()
    ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, cornerRadius)
    ctx.fill()

    // Button text
    ctx.fillStyle = 'white'
    ctx.font = 'bold 36px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Join Group', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2)

    // Add group icon/avatar placeholder (circle)
    const avatarX = 950
    const avatarY = 120
    const avatarRadius = 60

    ctx.fillStyle = '#E0E0E0'
    ctx.beginPath()
    ctx.arc(avatarX, avatarY, avatarRadius, 0, 2 * Math.PI)
    ctx.fill()

    // Avatar icon (simple group symbol)
    ctx.fillStyle = '#999999'
    ctx.font = 'bold 48px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('👥', avatarX, avatarY)

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
    console.error('Error generating group OG image:', error)
    return new Response('Error generating image', { status: 500 })
  }
}

export const route = GET