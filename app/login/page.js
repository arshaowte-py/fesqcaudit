import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '../../lib/auth-rules';
import { readSession } from '../../lib/session';
import LoginForm from './login-form';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in — Frido QC Portal',
};

export default async function LoginPage() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token && (await readSession(token))) {
    redirect('/');
  }
  return <LoginForm />;
}
