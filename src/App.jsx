import { useState, useEffect, useCallback } from 'react';
import {
  getCredentials,
  saveCredentials,
  clearCredentials,
  listTransactions,
  addTransaction,
  deleteTransaction,
  renameBorrower as renameBorrowerApi,
} from './api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import BorrowerSettings from './components/BorrowerSettings';
import TransactionForm from './components/TransactionForm';
import SyncIndicator from './components/SyncIndicator';
import { normalizeBorrowerName, todayStr } from './utils';

export default function App() {
  const [auth, setAuth] = useState(getCredentials);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | failed
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [formDefaults, setFormDefaults] = useState(null);
  const [pendingOps, setPendingOps] = useState([]); // for retry on failure

  // Fetch transactions
  const fetchData = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setSyncStatus('syncing');
    setError(null);
    try {
      const data = await listTransactions(auth.username, auth.password);
      setTransactions(data || []);
      setSyncStatus('synced');
      setPendingOps([]);
    } catch (err) {
      if (err.code === 'unauthorized') {
        clearCredentials();
        setAuth(null);
        return;
      }
      setError(err.message);
      setSyncStatus('failed');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Login handler
  const handleLogin = async (username, password, stayLoggedIn) => {
    setSyncStatus('syncing');
    try {
      const data = await listTransactions(username, password);
      if (stayLoggedIn) {
        saveCredentials(username, password);
      }
      setAuth({ username, password });
      setTransactions(data || []);
      setSyncStatus('synced');
      setError(null);
    } catch (err) {
      if (err.code === 'unauthorized') {
        throw new Error('ពាក្យសម្ងាត់មិនត្រឹមត្រូវ (Wrong username or password)');
      }
      throw err;
    }
  };

  // Logout handler
  const handleLogout = () => {
    clearCredentials();
    setAuth(null);
    setTransactions([]);
    setError(null);
    setSyncStatus('idle');
  };

  // Add transaction with optimistic UI
  const handleAdd = async (txn) => {
    const id = crypto.randomUUID();
    const newTxn = { ...txn, id };

    // Optimistic add
    setTransactions(prev => [newTxn, ...prev]);
    setSyncStatus('syncing');

    try {
      await addTransaction(auth.username, auth.password, newTxn);
      setSyncStatus('synced');
      return true;
    } catch (err) {
      if (err.code === 'unauthorized') {
        clearCredentials();
        setAuth(null);
        return false;
      }
      // Revert optimistic update
      setTransactions(prev => prev.filter(t => t.id !== id));
      setSyncStatus('failed');
      setPendingOps(prev => [...prev, { type: 'add', data: newTxn }]);
      throw err;
    }
  };

  // Delete transaction with optimistic UI
  const handleDelete = async (id) => {
    const removed = transactions.find(t => t.id === id);
    
    // Optimistic delete
    setTransactions(prev => prev.filter(t => t.id !== id));
    setSyncStatus('syncing');

    try {
      await deleteTransaction(auth.username, auth.password, id);
      setSyncStatus('synced');
    } catch (err) {
      if (err.code === 'unauthorized') {
        clearCredentials();
        setAuth(null);
        return;
      }
      // Revert optimistic delete
      if (removed) {
        setTransactions(prev => [...prev, removed]);
      }
      setSyncStatus('failed');
      setError('មិនអាចលុបបាន (Delete failed): ' + err.message);
    }
  };

  const handleRenameBorrower = async (from, to) => {
    const normalizedFrom = normalizeBorrowerName(from);
    const normalizedTo = normalizeBorrowerName(to);
    if (!normalizedFrom || !normalizedTo) {
      throw new Error('Borrower names cannot be empty.');
    }

    setSyncStatus('syncing');
    try {
      const result = await renameBorrowerApi(
        auth.username,
        auth.password,
        normalizedFrom,
        normalizedTo,
      );
      const fromKey = normalizedFrom.toLowerCase();
      setTransactions(prev => prev.map(transaction =>
        normalizeBorrowerName(transaction.borrower).toLowerCase() === fromKey
          ? { ...transaction, borrower: normalizedTo }
          : transaction,
      ));
      setPendingOps(prev => prev.map(operation =>
        operation.type === 'add' &&
        normalizeBorrowerName(operation.data.borrower).toLowerCase() === fromKey
          ? { ...operation, data: { ...operation.data, borrower: normalizedTo } }
          : operation,
      ));
      if (normalizeBorrowerName(localStorage.getItem('lms_last_borrower')).toLowerCase() === fromKey) {
        localStorage.setItem('lms_last_borrower', normalizedTo);
      }
      setSyncStatus('synced');
      return result.updated;
    } catch (err) {
      if (err.code === 'unauthorized') {
        clearCredentials();
        setAuth(null);
        setShowSettings(false);
      }
      setSyncStatus('failed');
      throw err;
    }
  };

  // Retry pending operations
  const handleRetry = async () => {
    if (pendingOps.length > 0) {
      for (const op of pendingOps) {
        if (op.type === 'add') {
          try {
            await addTransaction(auth.username, auth.password, op.data);
          } catch {
            // Will be retried next time
          }
        }
      }
    }
    fetchData();
  };

  // Open form with defaults for repayment shortcut
  const handleRepaymentShortcut = (borrower, amount) => {
    setFormDefaults({
      date: todayStr(),
      borrower,
      type: 'Repay',
      amount,
      note: '',
    });
    setShowForm(true);
  };

  const handleOpenForm = (defaults = null) => {
    setFormDefaults(defaults);
    setShowForm(true);
  };

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-primary-600 text-white sticky top-0 z-30 shadow-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <h1 className="min-w-0 text-base font-bold leading-tight sm:text-lg">
            <span className="block text-sm font-medium opacity-80">ប្រព័ន្ធគ្រប់គ្រងការខ្ចីប្រាក់</span>
            <span className="text-xs opacity-60">Lending Management</span>
          </h1>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <SyncIndicator status={syncStatus} onRefresh={fetchData} onRetry={handleRetry} />
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-primary-700 transition-colors hover:bg-primary-800"
              title="ការកំណត់អ្នកខ្ចី (Borrower settings)"
              aria-label="ការកំណត់អ្នកខ្ចី (Borrower settings)"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M11.983 1.904a1.75 1.75 0 00-3.966 0l-.17.51a1.75 1.75 0 01-2.475 1.01l-.48-.25a1.75 1.75 0 00-2.81 2.81l.25.48a1.75 1.75 0 01-1.01 2.475l-.51.17a1.75 1.75 0 000 3.966l.51.17a1.75 1.75 0 011.01 2.475l-.25.48a1.75 1.75 0 002.81 2.81l.48-.25a1.75 1.75 0 012.475 1.01l.17.51a1.75 1.75 0 003.966 0l.17-.51a1.75 1.75 0 012.475-1.01l.48.25a1.75 1.75 0 002.81-2.81l-.25-.48a1.75 1.75 0 011.01-2.475l.51-.17a1.75 1.75 0 000-3.966l-.51-.17a1.75 1.75 0 01-1.01-2.475l.25-.48a1.75 1.75 0 00-2.81-2.81l-.48.25a1.75 1.75 0 01-2.475-1.01l-.17-.51zM10 13.25a3.25 3.25 0 110-6.5 3.25 3.25 0 010 6.5z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-2 rounded-lg bg-primary-700 hover:bg-primary-800 
                         active:bg-primary-900 transition-colors min-h-[44px] min-w-[44px]
                         flex items-center justify-center"
              title="ចាកចេញ (Logout)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h6a1 1 0 100-2H4V5h5a1 1 0 100-2H3z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M13.293 9.293a1 1 0 010 1.414l-2 2a1 1 0 01-1.414-1.414L11.586 10l-1.707-1.293a1 1 0 011.414-1.414l2 2zM7 10a1 1 0 011-1h8a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <BorrowerSettings
          transactions={transactions}
          onRename={handleRenameBorrower}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 max-w-4xl mx-auto mt-2 mx-4 rounded-r-lg">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium">{error}</p>
              <button onClick={handleRetry} className="text-sm underline mt-1 hover:text-red-900">
                ព្យាយាមម្តងទៀត (Retry)
              </button>
            </div>
            <button onClick={() => setError(null)} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-4 pb-24">
        {loading && transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200 border-t-primary-600 mb-4"></div>
            <p className="text-slate-500">កំពុងផ្ទុក... (Loading...)</p>
          </div>
        ) : (
          <Dashboard
            transactions={transactions}
            onDelete={handleDelete}
            onRepaymentShortcut={handleRepaymentShortcut}
            onOpenForm={handleOpenForm}
          />
        )}
      </main>

      {/* Floating Add Button */}
      {!showForm && (
        <button
          onClick={() => handleOpenForm()}
          className="safe-area-fab fixed z-20 bg-primary-600 text-white rounded-full w-14 h-14 
                     shadow-lg hover:bg-primary-700 active:bg-primary-800 transition-colors
                     flex items-center justify-center text-3xl font-light
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          aria-label="បន្ថែមប្រតិបត្តិការ (Add Transaction)"
        >
          +
        </button>
      )}

      {/* Transaction Form Bottom Sheet */}
      {showForm && (
        <TransactionForm
          transactions={transactions}
          defaults={formDefaults}
          onSave={handleAdd}
          onClose={() => {
            setShowForm(false);
            setFormDefaults(null);
          }}
        />
      )}
    </div>
  );
}
