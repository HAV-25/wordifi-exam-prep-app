/**
 * Onboarding Launch — Paywall redirect.
 * This file exists only to handle any deep links or bookmarks that still target this route.
 */
import { Redirect } from 'expo-router';
import React from 'react';

export default function PaywallScreen() {
  return <Redirect href="/onboarding_launch/start" />;
}
