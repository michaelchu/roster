import { chromium, FullConfig } from '@playwright/test';
import { seedTestData } from './test-data';

async function globalSetup(config: FullConfig) {
  console.log('Running global setup...');

  // Seed test data
  const success = await seedTestData();
  if (!success) {
    throw new Error('Failed to seed test data');
  }

  console.log('Global setup completed');
}

export default globalSetup;
