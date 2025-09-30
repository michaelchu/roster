import { createCanvas } from 'canvas';

/**
 * Shared OG image generation utilities
 */

// OG image dimensions
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Common styling constants
const COLORS = {
  background: '#F5F5F5',
  cardBackground: 'white',
  border: '#E5E5E5',
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#888888',
  textMuted: '#999999',
  buttonBackground: '#4CAF50',
  buttonText: 'white',
  avatarBackground: '#E0E0E0',
  avatarIcon: '#999999',
};

const CARD_PADDING = 40;
const CARD_WIDTH = OG_WIDTH - CARD_PADDING * 2;
const CARD_HEIGHT = OG_HEIGHT - CARD_PADDING * 2;

/**
 * Creates a base canvas with common background styling
 */
function createBaseCanvas() {
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Fill background with light gray (WeChat-style)
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

  // Add white card container
  ctx.fillStyle = COLORS.cardBackground;
  ctx.fillRect(CARD_PADDING, CARD_PADDING, CARD_WIDTH, CARD_HEIGHT);

  // Add subtle border
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(CARD_PADDING, CARD_PADDING, CARD_WIDTH, CARD_HEIGHT);

  // Configure default text styles
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  return { canvas, ctx };
}

/**
 * Truncates text to a maximum length with ellipsis
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Draws a rounded rectangle button
 */
function drawRoundedButton(
  ctx,
  x,
  y,
  width,
  height,
  cornerRadius,
  backgroundColor,
  textColor,
  text
) {
  // Button background (manual rounded rectangle for node-canvas compatibility)
  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  ctx.moveTo(x + cornerRadius, y);
  ctx.lineTo(x + width - cornerRadius, y);
  ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
  ctx.lineTo(x + width, y + height - cornerRadius);
  ctx.arcTo(x + width, y + height, x + width - cornerRadius, y + height, cornerRadius);
  ctx.lineTo(x + cornerRadius, y + height);
  ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
  ctx.lineTo(x, y + cornerRadius);
  ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
  ctx.closePath();
  ctx.fill();

  // Button text
  ctx.fillStyle = textColor;
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + height / 2);
}

/**
 * Draws the Roster branding in bottom right
 */
function drawBranding(ctx) {
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = '24px Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Roster', OG_WIDTH - CARD_PADDING, OG_HEIGHT - CARD_PADDING);
}

/**
 * Converts canvas to PNG buffer with appropriate headers
 */
function createImageResponse(canvas) {
  const buffer = canvas.toBuffer('image/png');

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'Content-Length': buffer.length.toString(),
    },
  });
}

/**
 * Generates an OG image for an event
 */
export function generateEventOGImage(event, formatEventDateTime) {
  // Validate required fields and provide fallbacks
  if (!event) {
    throw new Error('Event object is required for OG image generation');
  }

  const { canvas, ctx } = createBaseCanvas();

  // Event title (large, bold) - with fallback for missing name
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = 'bold 64px Arial, sans-serif';
  const titleText = truncateText(event.name || 'Untitled Event', 30);
  ctx.fillText(titleText, 80, 100);

  // Event date/time (medium) - with fallback for missing datetime
  ctx.font = '48px Arial, sans-serif';
  const dateText = event.datetime ? formatEventDateTime(event.datetime) : 'Date TBD';
  ctx.fillText(dateText, 80, 190);

  // Location (with text label)
  ctx.font = '36px Arial, sans-serif';
  if (event.location) {
    const locationText = `Location: ${event.location}`;
    ctx.fillText(locationText, 80, 270);
  }

  // Cost (with text label)
  const costText = `Cost: ${event.cost || 'Free'}`;
  ctx.fillText(costText, 80, 320);

  // Organizer info
  ctx.font = '28px Arial, sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText('Organized by Roster Community', 80, 380);

  // Green "Click to Join" button
  drawRoundedButton(
    ctx,
    80,
    450,
    300,
    80,
    25,
    COLORS.buttonBackground,
    COLORS.buttonText,
    'Click to Join'
  );

  // Roster branding
  drawBranding(ctx);

  return createImageResponse(canvas);
}

/**
 * Generates an OG image for a group
 */
export function generateGroupOGImage(group, memberCount = 0, eventCount = 0) {
  // Validate required fields and provide fallbacks
  if (!group) {
    throw new Error('Group object is required for OG image generation');
  }

  const { canvas, ctx } = createBaseCanvas();

  // Group title (large, bold) - with fallback for missing name
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = 'bold 64px Arial, sans-serif';
  const titleText = truncateText(group.name || 'Untitled Group', 30);
  ctx.fillText(titleText, 80, 100);

  // Group stats (medium)
  ctx.font = '48px Arial, sans-serif';
  const memberText = `Members: ${memberCount}`;
  ctx.fillText(memberText, 80, 190);

  // Event count
  const eventText = `Events: ${eventCount}`;
  ctx.fillText(eventText, 80, 250);

  // Group description (if available)
  ctx.font = '36px Arial, sans-serif';
  ctx.fillStyle = COLORS.textSecondary;
  if (group.description) {
    const description = truncateText(group.description, 80);
    ctx.fillText(description, 80, 320);
  } else {
    ctx.fillText('Join our active community!', 80, 320);
  }

  // Community label
  ctx.font = '28px Arial, sans-serif';
  ctx.fillStyle = COLORS.textTertiary;
  ctx.fillText('Community • Roster', 80, 380);

  // Green "Join Group" button
  drawRoundedButton(
    ctx,
    80,
    450,
    300,
    80,
    25,
    COLORS.buttonBackground,
    COLORS.buttonText,
    'Join Group'
  );

  // Add group avatar placeholder (circle)
  const avatarX = 950;
  const avatarY = 120;
  const avatarRadius = 60;

  ctx.fillStyle = COLORS.avatarBackground;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, 2 * Math.PI);
  ctx.fill();

  // Avatar icon (simple group symbol)
  ctx.fillStyle = COLORS.avatarIcon;
  ctx.font = 'bold 48px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G', avatarX, avatarY);

  // Roster branding
  drawBranding(ctx);

  return createImageResponse(canvas);
}
