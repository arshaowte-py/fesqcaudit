'use client';

import { useState } from 'react';
import styles from './login.module.css';

const EMAIL_STEP = 'email';
const CODE_STEP = 'code';

export default function LoginForm() {
  const [step, setStep] = useState(EMAIL_STEP);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      setNotice(data.message || 'If that address has an account, a code is on its way.');
      setStep(CODE_STEP);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'That code is not valid.'); return; }
      window.location.assign('/');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.brand}>frido</div>
        <h1 className={styles.title}>QC Portal</h1>

        {step === EMAIL_STEP ? (
          <form onSubmit={requestCode} className={styles.form}>
            <p className={styles.lede}>Sign in with your work email. We&rsquo;ll send you a 6-digit code.</p>
            <label className={styles.label} htmlFor="email">Work email</label>
            <input
              id="email" type="email" autoComplete="email" required autoFocus
              className={styles.input} placeholder="you@myfrido.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <button className={styles.button} type="submit" disabled={busy || !email}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className={styles.form}>
            <p className={styles.lede}>{notice}</p>
            <label className={styles.label} htmlFor="code">6-digit code</label>
            <input
              id="code" type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              required autoFocus autoComplete="one-time-code"
              className={`${styles.input} ${styles.codeInput}`} placeholder="000000"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button className={styles.button} type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Sign in'}
            </button>
            <button
              type="button" className={styles.linkButton}
              onClick={() => { setStep(EMAIL_STEP); setCode(''); setError(''); }}
            >
              Use a different address
            </button>
          </form>
        )}

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </div>
    </main>
  );
}
