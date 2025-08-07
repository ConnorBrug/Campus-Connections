
'use server';

// --- TEMPORARILY MODIFIED FOR INITIAL DEPLOYMENT ---
// This file is simplified to allow the first build to pass without secrets.
// It will be restored after the environment variables are set.

// Export null values to ensure no part of the Admin SDK is initialized.
export const admin = null;
export const adminDb = null;
export const adminAuth = null;
export const adminStorage = null;
