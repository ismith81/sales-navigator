// Dunne wrapper rond supabase.auth — éen plek voor session-state,
// sign-in (wachtwoord + magic link), sign-out en password reset.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// React hook: geeft { session, user, loading } terug en luistert op auth-changes.
export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session || null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s || null);
    });
    return () => {
      cancelled = true;
      sub.subscription?.unsubscribe();
    };
  }, []);

  return { session, user: session?.user || null, loading };
}

export async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithMagicLink(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}

export async function sendPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/?reset=1',
  });
}

export async function updatePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// Haalt de huidige access token op — gebruikt door /api/* fetch-calls.
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

// Fetch-wrapper: zet Authorization-header er automatisch op.
export async function authedFetch(url, init = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
