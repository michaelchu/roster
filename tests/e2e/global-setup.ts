import { execSync } from 'child_process';

/**
 * Playwright global setup - ensures Supabase is running before tests
 */
async function globalSetup() {
  console.log('Checking if Supabase is running...');

  // Check if Supabase API is accessible
  const isRunning = await checkSupabaseRunning();

  if (isRunning) {
    console.log('Supabase is already running.');
    return;
  }

  console.log('Supabase is not running. Starting...');

  try {
    // Start Supabase (this command exits after containers are up)
    execSync('npx supabase start', {
      stdio: 'inherit',
      timeout: 120000, // 2 minute timeout for containers to start
    });
    console.log('Supabase started successfully.');
  } catch (error) {
    console.error('Failed to start Supabase:', error);
    throw new Error(
      'Failed to start Supabase. Please ensure Docker is running and try again.'
    );
  }
}

async function checkSupabaseRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:54321/rest/v1/', {
      method: 'HEAD',
      headers: {
        apikey: process.env.VITE_SUPABASE_ANON_KEY || '',
      },
    });
    return response.ok || response.status === 400; // 400 means it's running but no table specified
  } catch {
    return false;
  }
}

export default globalSetup;
