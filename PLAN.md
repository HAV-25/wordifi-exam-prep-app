# Fix Google OAuth redirect to use dynamic origin

**What's changing**

The Google sign-in redirect logic will be updated to ensure it works seamlessly across all environments (production, preview, localhost).

**Current state**: The code already detects the current domain dynamically — this part is correct. However, a few small refinements will make it more robust:

1. **Redirect to root instead of `/auth`**: After Google authentication completes, redirect to `/` instead of `/auth` — this prevents a brief flash of the login screen and lets the auth listener handle navigation naturally.

2. **Add fallback for the reset password redirect**: The "Forgot Password" flow currently hardcodes `wordifi.app` — this will also use the dynamic origin so it works in all environments.

3. **Add console logs for easier debugging**: Extra logging around the redirect URL being used, so you can verify in browser console which URL is being sent to Google/Supabase.

**Files to update**
- Auth helpers (redirect logic for Google sign-in and password reset)