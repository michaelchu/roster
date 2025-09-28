import { FullConfig } from '@playwright/test';
import { cleanupTestData } from './test-data';

async function globalTeardown(config: FullConfig) {
  console.log('Running global teardown...');

  // Clean up test data
  await cleanupTestData();

  console.log('Global teardown completed');
}

export default globalTeardown;
