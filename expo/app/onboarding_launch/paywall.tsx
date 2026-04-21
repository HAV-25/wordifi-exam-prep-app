/**
 * Onboarding Launch — Paywall redirect.
 * The blocking Adapty paywall has been replaced by the non-blocking
 * "Ready to start?" screen. This file exists only to handle any
 * deep links or bookmarks that still target this route.
 */
import { Redirect } from 'expo-router';
import React from 'react';

export default function PaywallScreen() {
  return <Redirect href="/onboarding_launch/start" />;
}
