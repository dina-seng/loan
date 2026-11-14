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
      setError('សូមបញ្ចូលឈ្មោះ និងពាក្យសម្ងាត់');
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
          <h1 className="text-2xl font-bold text-slate-800">
            កត់ត្រាការខ្ចីប្រាក់ និងទិញទំនិញ
          </h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="card space-y-4 p-6 shadow-md rounded-2xl">
          <h2 className="text-xl font-bold text-center text-slate-800">
            ចូលប្រើប្រាស់
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-base font-semibold text-slate-700 mb-1">
              ឈ្មោះអ្នកប្រើ
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field text-base"
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-base font-semibold text-slate-700 mb-1">
              ពាក្យសម្ងាត់
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field text-base"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer" style={{ minHeight: '48px' }}>
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-primary-600 
                         focus:ring-primary-500 cursor-pointer"
              disabled={loading}
            />
            <span className="text-base text-slate-700">
              ចងចាំការចូល
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-lg font-bold min-h-[48px] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                កំពុងចូល...
              </span>
            ) : (
              'ចូលប្រព័ន្ធ'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
