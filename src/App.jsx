import { useState, useEffect, useCallback } from 'react';
import {
  getCredentials,
  saveCredentials,
  clearCredentials,
  listTransactions,
  addTransaction,
  deleteTransaction,
  renameBorrower as renameBorrowerApi,
  addProduct,
  deleteProduct,
  listProducts,
  listSettlements,
  settleMonth as settleMonthApi,
  reopenMonth as reopenMonthApi,
} from './api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import BorrowerSettings from './components/BorrowerSettings';
import TransactionForm from './components/TransactionForm';
import ProductForm from './components/ProductForm';
import SyncIndicator from './components/SyncIndicator';
import { normalizeBorrowerName, todayStr } from './utils';

export default function App() {
  const [auth, setAuth] = useState(getCredentials);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | failed
  const [showForm, setShowForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productBorrowerDefault, setProductBorrowerDefault] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [formDefaults, setFormDefaults] = useState(null);
  const [pendingOps, setPendingOps] = useState([]); // for retry on failure

  // Fetch transactions, products & settlements
  const fetchData = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setSyncStatus('syncing');
    setError(null);
    try {
      const [txData, prodData, settleData] = await Promise.all([
        listTransactions(auth.username, auth.password),
        listProducts(auth.username, auth.password),
        listSettlements(auth.username, auth.password),
      ]);
      setTransactions(txData || []);
      setProducts(prodData || []);
      setSettlements(settleData || []);
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
      const [txData, prodData, settleData] = await Promise.all([
        listTransactions(username, password),
        listProducts(username, password),
        listSettlements(username, password),
      ]);
      if (stayLoggedIn) {
        saveCredentials(username, password);
      }
      setAuth({ username, password });
      setTransactions(txData || []);
      setProducts(prodData || []);
      setSettlements(settleData || []);
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
    setProducts([]);
    setSettlements([]);
    setError(null);
    setSyncStatus('idle');
  };

  // Add transaction with optimistic UI
  const handleAdd = async (txn) => {
    const id = crypto.randomUUID();
    const newTxn = { ...txn, id };

    // Optimistic add
    setTransactions((prev) => [newTxn, ...prev]);
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
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setSyncStatus('failed');
      setPendingOps((prev) => [...prev, { type: 'add', data: newTxn }]);
      throw err;
    }
  };

  // Delete transaction with optimistic UI
  const handleDelete = async (id) => {
    const removed = transactions.find((t) => t.id === id);

    // Optimistic delete
    setTransactions((prev) => prev.filter((t) => t.id !== id));
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
      if (removed) {
        setTransactions((prev) => [...prev, removed]);
      }
      setSyncStatus('failed');
      if (err.message === 'month_settled' || err.code === 'month_settled') {
        setError('ខែនេះត្រូវបានទូទាត់បិទរួចហើយ មិនអាចលុបប្រតិបត្តិការបានទេ (This month is settled and locked)');
      } else {
        setError('មិនអាចលុបបាន (Delete failed): ' + err.message);
      }
    }
  };

  // Add product with optimistic UI
  const handleAddProduct = async (productData) => {
    const id = crypto.randomUUID();
    const newProduct = { ...productData, id };

    // Optimistic add
    setProducts((prev) => [newProduct, ...prev]);
    setSyncStatus('syncing');

    try {
      await addProduct(auth.username, auth.password, newProduct);
      setSyncStatus('synced');
      return true;
    } catch (err) {
      if (err.code === 'unauthorized') {
        clearCredentials();
        setAuth(null);
        return false;
      }
      // Revert optimistic update
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSyncStatus('failed');
      throw err;
    }
  };

  // Delete product with optimistic UI
  const handleDeleteProduct = async (id) => {
    const removed = products.find((p) => p.id === id);

    setProducts((prev) => prev.filter((p) => p.id !== id));
    setSyncStatus('syncing');

    try {
      await deleteProduct(auth.username, auth.password, id);
      setSyncStatus('synced');
    } catch (err) {
      if (err.code === 'unauthorized') {
        clearCredentials();
        setAuth(null);
        return;
      }
      if (removed) {
        setProducts((prev) => [...prev, removed]);
      }
      setSyncStatus('failed');
      if (err.message === 'month_settled' || err.code === 'month_settled') {
        setError('ខែនេះត្រូវបានទូទាត់បិទរួចហើយ មិនអាចលុបទំនិញបានទេ (This month is settled and locked)');
      } else {
        setError('មិនអាចលុបទំនិញបានទេ (Delete product failed): ' + err.message);
      }
    }
  };

  // Settle month handler
  const handleSettleMonth = async (settlementData) => {
    setSyncStatus('syncing');
    try {
      await settleMonthApi(auth.username, auth.password, settlementData);
      setSyncStatus('synced');
      await fetchData();
    } catch (err) {
      setSyncStatus('failed');
      throw err;
    }
  };

  // Reopen month handler
  const handleReopenMonth = async ({ month, borrower }) => {
    setSyncStatus('syncing');
    try {
      await reopenMonthApi(auth.username, auth.password, { month, borrower });
      setSyncStatus('synced');
      await fetchData();
    } catch (err) {
      setSyncStatus('failed');
      throw err;
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
      setTransactions((prev) =>
        prev.map((transaction) =>
          normalizeBorrowerName(transaction.borrower).toLowerCase() === fromKey
            ? { ...transaction, borrower: normalizedTo }
            : transaction,
        ),
      );
      setProducts((prev) =>
        prev.map((product) =>
          normalizeBorrowerName(product.borrower).toLowerCase() === fromKey
            ? { ...product, borrower: normalizedTo }
            : product,
        ),
      );
      setSettlements((prev) =>
        prev.map((settle) =>
          normalizeBorrowerName(settle.borrower).toLowerCase() === fromKey
            ? { ...settle, borrower: normalizedTo }
            : settle,
        ),
      );
      setPendingOps((prev) =>
        prev.map((operation) =>
          operation.type === 'add' &&
          normalizeBorrowerName(operation.data.borrower).toLowerCase() === fromKey
            ? { ...operation, data: { ...operation.data, borrower: normalizedTo } }
            : operation,
        ),
      );
      if (
        normalizeBorrowerName(localStorage.getItem('lms_last_borrower')).toLowerCase() === fromKey
      ) {
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
            <span className="block text-sm font-medium opacity-80">ប្រព័ន្ធគ្រប់គ្រងការខ្ចីប្រាក់ និងទំនិញ</span>
            <span className="text-xs opacity-60">Lending & Product Settlement</span>
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
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 max-w-4xl mx-auto mt-2 mx-4 rounded-r-lg shadow-sm">
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

      {/* Main content with pb-36 padding so FAB buttons never overlap content */}
      <main className="mx-auto max-w-4xl px-3 py-3 pb-36 sm:px-4 sm:py-4 sm:pb-32">
        {loading && transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200 border-t-primary-600 mb-4"></div>
            <p className="text-slate-500">កំពុងផ្ទុក... (Loading...)</p>
          </div>
        ) : (
          <Dashboard
            transactions={transactions}
            products={products}
            settlements={settlements}
            onDeleteTransaction={handleDelete}
            onDeleteProduct={handleDeleteProduct}
            onSettleMonth={handleSettleMonth}
            onReopenMonth={handleReopenMonth}
            onRepaymentShortcut={handleRepaymentShortcut}
            onOpenForm={handleOpenForm}
            onOpenProductForm={(borrower = '') => {
              setProductBorrowerDefault(borrower);
              setShowProductForm(true);
            }}
          />
        )}
      </main>

      {/* Floating Action Buttons */}
      {!showForm && !showProductForm && (
        <div className="safe-area-fab fixed z-20 flex flex-col items-end gap-2.5">
          <button
            onClick={() => {
              setProductBorrowerDefault('');
              setShowProductForm(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-transform hover:bg-emerald-700 active:scale-95"
            aria-label="កត់ត្រាទិញទំនិញ (Add Product)"
            title="កត់ត្រាទិញទំនិញ (Add Product)"
          >
            <span>📦</span>
            <span>+ ទិញទំនិញ</span>
          </button>
          <button
            onClick={() => handleOpenForm()}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-3xl font-light text-white shadow-lg transition-transform hover:bg-primary-700 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            aria-label="បន្ថែមប្រតិបត្តិការកម្ចី (Add Loan Transaction)"
            title="បន្ថែមប្រតិបត្តិការកម្ចី (Add Loan Transaction)"
          >
            +
          </button>
        </div>
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

      {/* Product Form Modal */}
      {showProductForm && (
        <ProductForm
          transactions={transactions}
          products={products}
          defaultBorrower={productBorrowerDefault}
          onSave={handleAddProduct}
          onClose={() => {
            setShowProductForm(false);
            setProductBorrowerDefault('');
          }}
        />
      )}
    </div>
  );
}
