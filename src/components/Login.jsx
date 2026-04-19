import React, { useEffect, useState } from 'react';
import {
  signInWithPassword,
  signInWithMagicLink,
  sendPasswordReset,
  updatePassword,
} from '../lib/auth';
import { supabase } from '../lib/supabase';

// Login-scherm vóór de app. Drie modi:
//  - password:   e-mail + wachtwoord (default)
//  - magic:      magic-link verzenden
//  - reset:      reset-e-mail opvragen
// Plus een speciale "recovery"-modus die triggert wanneer Supabase terugkomt
// na klik op reset-link (event PASSWORD_RECOVERY) — dan kan de gebruiker een
// nieuw wachtwoord zetten.
export default function Login({ forceRecovery = false, onRecoveryDone }) {
  const [mode, setMode] = useState(forceRecovery ? 'recovery' : 'password'); // password | magic | reset | recovery
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok'|'error', text }

  // Detect recovery-flow: Supabase stuurt PASSWORD_RECOVERY als de gebruiker
  // via de reset-mail terugkomt.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('recovery');
    });
    return () => sub.subscription?.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'password') {
        const { error } = await signInWithPassword(email.trim(), password);
        if (error) throw error;
        // Geen feedback nodig — onAuthStateChange rendert de app.
      } else if (mode === 'magic') {
        const { error } = await signInWithMagicLink(email.trim());
        if (error) throw error;
        setMessage({ type: 'ok', text: 'Check je mail voor de login-link.' });
      } else if (mode === 'reset') {
        const { error } = await sendPasswordReset(email.trim());
        if (error) throw error;
        setMessage({ type: 'ok', text: 'Reset-link verstuurd. Check je mail.' });
      } else if (mode === 'recovery') {
        if (newPassword.length < 8) {
          throw new Error('Nieuw wachtwoord moet minstens 8 tekens zijn.');
        }
        const { error } = await updatePassword(newPassword);
        if (error) throw error;
        setMessage({ type: 'ok', text: 'Wachtwoord bijgewerkt. Je bent ingelogd.' });
        // Laat de recovery-mode los zodat Navigator kan renderen.
        if (onRecoveryDone) setTimeout(onRecoveryDone, 800);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Er ging iets mis.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-title">Sales <span className="login-title-accent">Navigator</span></span>
          <span className="login-subtitle">creates.</span>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode !== 'recovery' && (
            <label className="login-field">
              <span>E-mail</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@creates.nl"
                autoFocus
              />
            </label>
          )}

          {mode === 'password' && (
            <label className="login-field">
              <span>Wachtwoord</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          {mode === 'recovery' && (
            <label className="login-field">
              <span>Nieuw wachtwoord</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
            </label>
          )}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'Bezig…' : (
              mode === 'password' ? 'Inloggen' :
              mode === 'magic' ? 'Stuur login-link' :
              mode === 'reset' ? 'Stuur reset-link' :
              'Wachtwoord instellen'
            )}
          </button>

          {message && (
            <div className={`login-msg login-msg--${message.type}`}>{message.text}</div>
          )}
        </form>

        {mode !== 'recovery' && (
          <div className="login-switch">
            {mode !== 'password' && (
              <button type="button" className="login-link" onClick={() => { setMode('password'); setMessage(null); }}>
                Inloggen met wachtwoord
              </button>
            )}
            {mode !== 'magic' && (
              <button type="button" className="login-link" onClick={() => { setMode('magic'); setMessage(null); }}>
                Stuur mij een login-link
              </button>
            )}
            {mode !== 'reset' && (
              <button type="button" className="login-link" onClick={() => { setMode('reset'); setMessage(null); }}>
                Wachtwoord vergeten?
              </button>
            )}
          </div>
        )}

        <p className="login-footnote">
          Nog geen account? Vraag je beheerder om een uitnodiging.
        </p>
      </div>
    </div>
  );
}
