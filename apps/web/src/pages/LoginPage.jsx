import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { labels } from '../i18n/labels.js';
import { errorMessage } from '../i18n/labels.js';
import { Field, InlineError } from '../components/Ui.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-800 to-brand-950 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Business Ledger</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">បញ្ជីហិរញ្ញវត្ថុ</h1>
          <p className="mt-1 text-sm text-slate-500">រវាងប៉ា និងអ៊ូដុំ</p>
        </div>
        <div className="space-y-4">
          <Field label={labels.username}>
            <input className="input" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          </Field>
          <Field label={labels.password}>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
          <InlineError message={error} />
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? labels.loading : labels.login}</button>
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">សូមប្រើគណនីដែលបានកំណត់ឱ្យប៉ា</p>
      </form>
    </div>
  );
}
