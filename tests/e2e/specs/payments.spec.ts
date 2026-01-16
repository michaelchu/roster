import { test, expect } from '@playwright/test';
import { register, clearAuth, getUserId } from '../fixtures/auth';
import {
  generateTestEmail,
  generateTestName,
  createTestEvent,
  getAdminDb,
} from '../fixtures/database';

test.describe('Payment Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test.describe('Payment Status Display', () => {
    test('organizer sees payment summary card', async ({ page }) => {
      // Create organizer and event
      const testUser = {
        email: generateTestEmail('organizer-payment'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Payment Event'),
      });

      // Add participants with different payment statuses
      await getAdminDb().from('participants').insert([
        {
          event_id: event.id,
          name: 'Paid User',
          email: generateTestEmail('paid'),
          payment_status: 'paid',
        },
        {
          event_id: event.id,
          name: 'Pending User',
          email: generateTestEmail('pending'),
          payment_status: 'pending',
        },
        {
          event_id: event.id,
          name: 'Waived User',
          email: generateTestEmail('waived'),
          payment_status: 'waived',
        },
      ]);

      // Navigate to event detail page
      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify Payment Status card is visible
      await expect(page.getByText('Payment Status')).toBeVisible();

      // Verify summary counts
      await expect(page.getByText('Paid').first()).toBeVisible();
      await expect(page.getByText('Pending').first()).toBeVisible();
      await expect(page.getByText('Waived').first()).toBeVisible();

      // Verify the numbers are correct
      const paidCount = page.locator('.text-green-600').filter({ hasText: '1' });
      await expect(paidCount).toBeVisible();

      const pendingCount = page.locator('.text-gray-600').filter({ hasText: '1' });
      await expect(pendingCount).toBeVisible();

      const waivedCount = page.locator('.text-blue-600').filter({ hasText: '1' });
      await expect(waivedCount).toBeVisible();
    });

    test('non-organizer does not see payment summary card', async ({ page }) => {
      // Create organizer and event
      const organizer = {
        email: generateTestEmail('organizer'),
        password: 'TestPassword123!',
      };
      await register(page, organizer);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Event'),
      });

      // Add a participant
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Paid User',
        email: generateTestEmail('paid'),
        payment_status: 'paid',
      });

      // Logout and register as different user
      await clearAuth(page);
      const participant = {
        email: generateTestEmail('participant'),
        password: 'TestPassword123!',
      };
      await register(page, participant);

      // Navigate to event detail page
      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify Payment Status card is NOT visible
      const paymentStatusVisible = await page
        .getByText('Payment Status')
        .isVisible()
        .catch(() => false);
      expect(paymentStatusVisible).toBe(false);
    });

    test('non-organizer does not see payment badges in participant list', async ({ page }) => {
      // Create organizer and event
      const organizer = {
        email: generateTestEmail('organizer-badges'),
        password: 'TestPassword123!',
      };
      await register(page, organizer);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Badge Event'),
      });

      // Add participants with different payment statuses that organizer would see badges for
      await getAdminDb().from('participants').insert([
        {
          event_id: event.id,
          name: 'Paid User',
          email: generateTestEmail('paid-badge'),
          payment_status: 'paid',
        },
        {
          event_id: event.id,
          name: 'Waived User',
          email: generateTestEmail('waived-badge'),
          payment_status: 'waived',
        },
      ]);

      // Logout and register as different user
      await clearAuth(page);
      const participant = {
        email: generateTestEmail('participant-viewer'),
        password: 'TestPassword123!',
      };
      await register(page, participant);

      // Navigate to event detail page
      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Verify participant names are visible (non-organizers can see the list)
      await expect(page.getByRole('button', { name: 'Paid User' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Waived User' })).toBeVisible();

      // Verify payment badges are NOT visible for any participant
      const paidBadgeVisible = await page
        .locator('span:has-text("Paid")')
        .isVisible()
        .catch(() => false);
      expect(paidBadgeVisible).toBe(false);

      const waivedBadgeVisible = await page
        .locator('span:has-text("Waived")')
        .isVisible()
        .catch(() => false);
      expect(waivedBadgeVisible).toBe(false);
    });
  });

  test.describe('Payment Status Updates', () => {
    test('organizer can mark participant as paid', async ({ page }) => {
      // Create organizer and event
      const testUser = {
        email: generateTestEmail('organizer-mark-paid'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Mark Paid Event'),
      });

      // Add a pending participant
      const { data: participant } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Pending User',
          email: generateTestEmail('pending2'),
          payment_status: 'pending',
        })
        .select()
        .single();

      // Navigate to event detail page
      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Click on the participant to open detail sheet
      await page.getByRole('button', { name: 'Pending User' }).click();
      await page.waitForTimeout(500);

      // Verify Payment Status section is visible (use role heading to be specific)
      await expect(page.getByRole('heading', { name: 'Payment Status' }).last()).toBeVisible();

      // Click "Mark as Paid" button
      await page.getByRole('button', { name: /mark as paid/i }).click();
      await page.waitForTimeout(1000);

      // Verify sheet is closed (participant name in sheet should not be visible)
      const sheetVisible = await page
        .locator('[role="dialog"]')
        .isVisible()
        .catch(() => false);
      expect(sheetVisible).toBe(false);

      // Verify payment status updated in database
      const { data: updatedParticipant } = await getAdminDb()
        .from('participants')
        .select('payment_status')
        .eq('id', participant!.id)
        .single();

      expect(updatedParticipant?.payment_status).toBe('paid');
    });

    test('organizer can mark participant as pending', async ({ page }) => {
      // Create organizer and event
      const testUser = {
        email: generateTestEmail('organizer-mark-pending'),
        password: 'TestPassword123!',
      };
      await register(page, testUser);
      const userId = await getUserId(page);

      const event = await createTestEvent(userId!, {
        name: generateTestName('Mark Pending Event'),
      });

      // Add a paid participant
      const { data: participant } = await getAdminDb()
        .from('participants')
        .insert({
          event_id: event.id,
          name: 'Paid User',
          email: generateTestEmail('paid3'),
          payment_status: 'paid',
        })
        .select()
        .single();

      // Navigate to event detail page
      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Click on the participant to open detail sheet
      await page.getByRole('button', { name: 'Paid User' }).click();
      await page.waitForTimeout(500);

      // Click "Mark as Pending" button
      await page.getByRole('button', { name: /mark as pending/i }).click();
      await page.waitForTimeout(1000);

      // Verify sheet is closed
      const sheetVisible = await page
        .locator('[role="dialog"]')
        .isVisible()
        .catch(() => false);
      expect(sheetVisible).toBe(false);

      // Verify payment status updated in database
      const { data: updatedParticipant } = await getAdminDb()
        .from('participants')
        .select('payment_status')
        .eq('id', participant!.id)
        .single();

      expect(updatedParticipant?.payment_status).toBe('pending');
    });

    test('non-organizer cannot change payment status', async ({ page }) => {
      // Create organizer and event
      const organizer = {
        email: generateTestEmail('organizer3'),
        password: 'TestPassword123!',
      };
      await register(page, organizer);
      const organizerId = await getUserId(page);

      const event = await createTestEvent(organizerId!, {
        name: generateTestName('Non-Org Payment Event'),
      });

      // Add a pending participant
      await getAdminDb().from('participants').insert({
        event_id: event.id,
        name: 'Pending User',
        email: generateTestEmail('pending3'),
        payment_status: 'pending',
      });

      // Logout and register as different user
      await clearAuth(page);
      const participant = {
        email: generateTestEmail('participant3'),
        password: 'TestPassword123!',
      };
      await register(page, participant);

      // Navigate to event detail page
      await page.goto(`/signup/${event.id}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Click on the participant to open detail sheet
      await page.getByText('Pending User').click();
      await page.waitForTimeout(500);

      // Verify Payment Status section is NOT visible
      const paymentStatusVisible = await page
        .getByText('Payment Status')
        .isVisible()
        .catch(() => false);
      expect(paymentStatusVisible).toBe(false);

      // Verify "Mark as Paid" button is NOT visible
      const markPaidButtonVisible = await page
        .getByRole('button', { name: /mark as paid/i })
        .isVisible()
        .catch(() => false);
      expect(markPaidButtonVisible).toBe(false);
    });
  });
});
