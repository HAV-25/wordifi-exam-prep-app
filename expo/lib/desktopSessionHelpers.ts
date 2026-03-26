import { supabase } from '@/lib/supabaseClient';

const DESKTOP_FUNCTIONS_BASE = 'https://wwfiauhsbssjowaxmqyn.supabase.co/functions/v1';
const DESKTOP_REST_BASE = 'https://wwfiauhsbssjowaxmqyn.supabase.co/rest/v1';
const DESKTOP_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZmlhdWhzYnNzam93YXhtcXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MTQxMzUsImV4cCI6MjA4Njk5MDEzNX0.lSPPEQCtdigdXpwB2X5hUTrC2dThil6qleQtqcUEKAE';

export const DESKTOP_PLAYER_URL = 'https://wwfiauhsbssjowaxmqyn.supabase.co/functions/v1/desktop-test-player';

export type DesktopSessionStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'expired' | 'cancelled';

export interface DesktopSession {
  id: string;
  code: string;
  expires_at: string;
  status: DesktopSessionStatus;
  current_section?: string | null;
  section_scores?: Record<string, number> | null;
  completed_at?: string | null;
}

export interface CreateDesktopSessionResult {
  code: string;
  session_id: string;
  expires_at: string;
}

export interface PollResult {
  status: DesktopSessionStatus;
  current_section: string | null;
  section_scores: Record<string, number> | null;
  completed_at: string | null;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

export async function createDesktopSession(
  level: string,
  examType: string
): Promise<CreateDesktopSessionResult> {
  const token = await getAccessToken();
  console.log('[DesktopSession] Creating session for', level, examType);

  const res = await fetch(`${DESKTOP_FUNCTIONS_BASE}/create-desktop-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': DESKTOP_ANON_KEY,
    },
    body: JSON.stringify({ level, exam_type: examType }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.log('[DesktopSession] Create failed:', res.status, text);
    throw new Error(`Failed to create desktop session: ${res.status}`);
  }

  const data = await res.json();
  console.log('[DesktopSession] Created session:', data.session_id, data.code);
  return data as CreateDesktopSessionResult;
}

export async function approveDesktopSession(sessionId: string): Promise<void> {
  const token = await getAccessToken();
  console.log('[DesktopSession] Approving session:', sessionId);

  const res = await fetch(`${DESKTOP_FUNCTIONS_BASE}/approve-desktop-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': DESKTOP_ANON_KEY,
    },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.log('[DesktopSession] Approve failed:', res.status, text);
    throw new Error(`Failed to approve desktop session: ${res.status}`);
  }

  console.log('[DesktopSession] Session approved');
}

export async function pollDesktopSession(sessionId: string): Promise<PollResult | null> {
  const token = await getAccessToken();

  const res = await fetch(
    `${DESKTOP_REST_BASE}/desktop_sessions?id=eq.${sessionId}&select=status,current_section,section_scores,completed_at`,
    {
      headers: {
        'apikey': DESKTOP_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    console.log('[DesktopSession] Poll failed:', res.status);
    return null;
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return rows[0] as PollResult;
}

export async function cancelDesktopSession(sessionId: string): Promise<void> {
  const token = await getAccessToken();
  console.log('[DesktopSession] Cancelling session:', sessionId);

  const res = await fetch(
    `${DESKTOP_REST_BASE}/desktop_sessions?id=eq.${sessionId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': DESKTOP_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ status: 'cancelled' }),
    }
  );

  if (!res.ok) {
    console.log('[DesktopSession] Cancel failed:', res.status);
  } else {
    console.log('[DesktopSession] Session cancelled');
  }
}

export function formatDesktopCode(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length <= 4) return upper;
  const first = upper.slice(0, 4);
  const second = upper.slice(4);
  return `${first} · ${second}`;
}
