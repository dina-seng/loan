import { useState } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('សូមបញ្ចូលឈ្មោះ និង ពាក្យសម្ងាត់ (Please enter username and password)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onLogin(username.trim(), password, stayLoggedIn);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-2xl text-3xl font-bold mb-4 shadow-lg">
            ៛
          </div>
          <h1 className="text-xl font-bold text-primary-600">
            ប្រព័ន្ធគ្រប់គ្រងការខ្ចីប្រាក់
          </h1>
          <p className="text-sm text-slate-500 mt-1">Lending Management System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-lg font-semibold text-center text-slate-700">
            ចូលប្រើប្រាស់ (Login)
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-600 mb-1">
              ឈ្មោះអ្នកប្រើ (Username)
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-600 mb-1">
              ពាក្យសម្ងាត់ (Password)
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer" style={{ minHeight: '44px' }}>
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-primary-600 
                         focus:ring-primary-500 cursor-pointer"
              disabled={loading}
            />
            <span className="text-sm text-slate-600">
              ចងចាំការចូល (Stay logged in)
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                កំពុងចូល...
              </span>
            ) : (
              'ចូល (Login)'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
