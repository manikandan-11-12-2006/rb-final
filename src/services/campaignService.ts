/**
 * campaignService.ts
 *
 * Mock implementation for campaign / reminder monitoring.
 *
 * Integration boundary:
 *   Actual reminders are sent via Make.com automation.
 *   This frontend only reads campaign status from the backend.
 *   Frontend → campaignService → (later) backend → Make webhook status
 */

import type { Campaign } from '../types/campaign';
import { mockCampaign } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Get all campaigns
// ---------------------------------------------------------------------------
export async function getCampaigns(): Promise<Campaign[]> {
  await delay(400);
  return [mockCampaign];
}

// ---------------------------------------------------------------------------
// Get a single campaign by ID
// ---------------------------------------------------------------------------
export async function getCampaignById(id: string): Promise<Campaign | null> {
  await delay(300);
  return mockCampaign.id === id ? mockCampaign : null;
}
