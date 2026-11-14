import { useState, useEffect, useCallback } from "react";
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
} from "./api";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import SettingsModal from "./components/SettingsModal";
import UnifiedEntryModal from "./components/UnifiedEntryModal";
import SyncIndicator from "./components/SyncIndicator";
import { normalizeBorrowerName, normalizeDate, todayStr, exportToCsv } from "./utils";
import { SettingsIcon, LogOutIcon, AlertCircleIcon, XIcon } from "./components/Icons";

export default function App() {
  const [auth, setAuth] = useState(getCredentials);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | failed

  // Unified Entry Modal state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryModalDefaults, setEntryModalDefaults] = useState({
    borrower: "",
    tab: "lend",
  });

  // Settings Modal state
  const [showSettings, setShowSettings] = useState(false);
  const [pendingOps, setPendingOps] = useState([]); // for retry on failure

  // Fetch transactions, products & settlements
  const fetchData = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setSyncStatus("syncing");
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
      setSyncStatus("synced");
      setPendingOps([]);
    } catch (err) {
      if (err.code === "unauthorized") {
        clearCredentials();
        setAuth(null);
        return;
      }
      setError(err.message);
      setSyncStatus("failed");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Login handler
  const handleLogin = async (username, password, stayLoggedIn) => {
    setSyncStatus("syncing");
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
      setSyncStatus("synced");
      setError(null);
    } catch (err) {
      if (err.code === "unauthorized") {
        throw new Error("ពាក្យសម្ងាត់មិនត្រឹមត្រូវ");
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
    setSyncStatus("idle");
  };

  // Add transaction with optimistic UI
  const handleAddTransaction = async (txn) => {
    const id = crypto.randomUUID();
    const newTxn = { ...txn, id };

    // Optimistic add
    setTransactions((prev) => [newTxn, ...prev]);
    setSyncStatus("syncing");

    try {
      await addTransaction(auth.username, auth.password, newTxn);
      setSyncStatus("synced");
      return true;
    } catch (err) {
      if (err.code === "unauthorized") {
        clearCredentials();
        setAuth(null);
        return false;
      }
      // Revert optimistic update
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setSyncStatus("failed");
      setPendingOps((prev) => [...prev, { type: "add", data: newTxn }]);
      throw err;
    }
  };

  // Delete transaction with optimistic UI
  const handleDeleteTransaction = async (id) => {
    const removed = transactions.find((t) => t.id === id);

    // Optimistic delete
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setSyncStatus("syncing");

    try {
      await deleteTransaction(auth.username, auth.password, id);
      setSyncStatus("synced");
    } catch (err) {
      if (err.code === "unauthorized") {
        clearCredentials();
        setAuth(null);
        return;
      }
      if (removed) {
        setTransactions((prev) => [...prev, removed]);
      }
      setSyncStatus("failed");
      if (err.message === "month_settled" || err.code === "month_settled") {
        setError("ខែនេះត្រូវបានទូទាត់បិទរួចហើយ មិនអាចលុបប្រតិបត្តិការបានទេ");
      } else {
        setError("មិនអាចលុបបានទេ: " + err.message);
      }
    }
  };

  // Add product with optimistic UI
  const handleAddProduct = async (productData) => {
    const id = crypto.randomUUID();
    const newProduct = { ...productData, id };

    // Optimistic add
    setProducts((prev) => [newProduct, ...prev]);
    setSyncStatus("syncing");

    try {
      await addProduct(auth.username, auth.password, newProduct);
      setSyncStatus("synced");
      return true;
    } catch (err) {
      if (err.code === "unauthorized") {
        clearCredentials();
        setAuth(null);
        return false;
      }
      // Revert optimistic update
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSyncStatus("failed");
      throw err;
    }
  };

  // Delete product with optimistic UI
  const handleDeleteProduct = async (id) => {
    const removed = products.find((p) => p.id === id);

    setProducts((prev) => prev.filter((p) => p.id !== id));
    setSyncStatus("syncing");

    try {
      await deleteProduct(auth.username, auth.password, id);
      setSyncStatus("synced");
    } catch (err) {
      if (err.code === "unauthorized") {
        clearCredentials();
        setAuth(null);
        return;
      }
      if (removed) {
        setProducts((prev) => [...prev, removed]);
      }
      setSyncStatus("failed");
      if (err.message === "month_settled" || err.code === "month_settled") {
        setError("ខែនេះត្រូវបានទូទាត់បិទរួចហើយ មិនអាចលុបទំនិញបានទេ");
      } else {
        setError("មិនអាចលុបទំនិញបានទេ: " + err.message);
      }
    }
  };

  // Settle month handler
  const handleSettleMonth = async (settlementData) => {
    setSyncStatus("syncing");
    const id = settlementData.id || crypto.randomUUID();
    const newSettlement = {
      ...settlementData,
      id,
      status: settlementData.status || "ទូទាត់រួចរាល់",
    };

    // Optimistically record settlement summary
    setSettlements((prev) => [newSettlement, ...prev]);

    // Mark current active loan and goods records for that borrower as settled: true
    const sMonth = String(settlementData.month || "");
    const sBorrower = normalizeBorrowerName(settlementData.borrower).toLowerCase();
    const isAll = !sBorrower || sBorrower === "all" || sBorrower === "__all__" || sBorrower === "បង្ហាញទាំងអស់" || sBorrower === "ទាំងអស់";

    setTransactions((prev) =>
      prev.map((t) => {
        const tMonth = normalizeDate(t.date).slice(0, 7);
        const tBorrower = normalizeBorrowerName(t.borrower).toLowerCase();
        if (
          (isAll || tBorrower === sBorrower) &&
          (!sMonth || tMonth === sMonth)
        ) {
          return { ...t, status: `Settled:${id}`, settled: true };
        }
        return t;
      }),
    );

    setProducts((prev) =>
      prev.map((p) => {
        const pMonth = normalizeDate(p.date).slice(0, 7);
        const pBorrower = normalizeBorrowerName(p.borrower).toLowerCase();
        if (
          (isAll || pBorrower === sBorrower) &&
          (!sMonth || pMonth === sMonth)
        ) {
          return { ...p, status: `Settled:${id}`, settled: true };
        }
        return p;
      }),
    );

    try {
      await settleMonthApi(auth.username, auth.password, newSettlement);
      setSyncStatus("synced");
      await fetchData();
    } catch (err) {
      setSyncStatus("failed");
      setSettlements((prev) => prev.filter((s) => s.id !== id));
      await fetchData().catch(() => {});
      throw err;
    }
  };

  // Reopen month handler
  const handleReopenMonth = async ({ id, month, borrower }) => {
    setSyncStatus("syncing");
    const sMonth = String(month || "");
    const sBorrower = normalizeBorrowerName(borrower).toLowerCase();
    const isAll = !sBorrower || sBorrower === "all" || sBorrower === "__all__" || sBorrower === "បង្ហាញទាំងអស់" || sBorrower === "ទាំងអស់";

    // Optimistically un-settle records
    setSettlements((prev) =>
      prev.filter(
        (s) =>
          !(
            (id && s.id === id) ||
            (String(s.month) === sMonth &&
              (isAll || normalizeBorrowerName(s.borrower).toLowerCase() === sBorrower))
          ),
      ),
    );

    setTransactions((prev) =>
      prev.map((t) => {
        const tMonth = normalizeDate(t.date).slice(0, 7);
        const tBorrower = normalizeBorrowerName(t.borrower).toLowerCase();
        if (
          (id && t.status === `Settled:${id}`) ||
          ((isAll || tBorrower === sBorrower) && (!sMonth || tMonth === sMonth))
        ) {
          return { ...t, status: "Active", settled: false };
        }
        return t;
      }),
    );

    setProducts((prev) =>
      prev.map((p) => {
        const pMonth = normalizeDate(p.date).slice(0, 7);
        const pBorrower = normalizeBorrowerName(p.borrower).toLowerCase();
        if (
          (id && p.status === `Settled:${id}`) ||
          ((isAll || pBorrower === sBorrower) && (!sMonth || pMonth === sMonth))
        ) {
          return { ...p, status: "Active", settled: false };
        }
        return p;
      }),
    );

    try {
      await reopenMonthApi(auth.username, auth.password, { id, month, borrower });
      setSyncStatus("synced");
      await fetchData();
    } catch (err) {
      setSyncStatus("failed");
      await fetchData().catch(() => {});
      throw err;
    }
  };

  const handleRenameBorrower = async (from, to) => {
    const normalizedFrom = normalizeBorrowerName(from);
    const normalizedTo = normalizeBorrowerName(to);
    if (!normalizedFrom || !normalizedTo) {
      throw new Error("Borrower names cannot be empty.");
    }

    setSyncStatus("syncing");
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
          operation.type === "add" &&
          normalizeBorrowerName(operation.data.borrower).toLowerCase() ===
            fromKey
            ? {
                ...operation,
                data: { ...operation.data, borrower: normalizedTo },
              }
            : operation,
        ),
      );
      if (
        normalizeBorrowerName(
          localStorage.getItem("lms_last_borrower"),
        ).toLowerCase() === fromKey
      ) {
        localStorage.setItem("lms_last_borrower", normalizedTo);
      }
      setSyncStatus("synced");
      return result.updated;
    } catch (err) {
      if (err.code === "unauthorized") {
        clearCredentials();
        setAuth(null);
        setShowSettings(false);
      }
      setSyncStatus("failed");
      throw err;
    }
  };

  // Retry pending operations
  const handleRetry = async () => {
    if (pendingOps.length > 0) {
      for (const op of pendingOps) {
        if (op.type === "add") {
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

  // Open unified entry modal with custom defaults
  const handleOpenEntryModal = (borrower = "", tab = "lend") => {
    setEntryModalDefaults({
      borrower,
      tab,
    });
    setShowEntryModal(true);
  };

  // CSV Export Handlers
  const handleExportTransactions = () => {
    const headers = [
      { key: "date", label: "Date" },
      { key: "borrower", label: "Borrower" },
      { key: "type", label: "Type" },
      { key: "amount", label: "Amount" },
      { key: "note", label: "Note" },
      { key: "id", label: "ID" },
    ];
    exportToCsv(`transactions_${todayStr()}`, transactions, headers);
  };

  const handleExportProducts = () => {
    const headers = [
      { key: "date", label: "Date" },
      { key: "borrower", label: "Borrower" },
      { key: "item", label: "Item" },
      { key: "quantity", label: "Quantity" },
      { key: "unitPrice", label: "Unit Price" },
      { key: "total", label: "Total" },
      { key: "note", label: "Note" },
      { key: "id", label: "ID" },
    ];
    exportToCsv(`products_${todayStr()}`, products, headers);
  };

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-primary-600 text-white sticky top-0 z-30 shadow-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3.5">
          <h1 className="text-lg sm:text-xl font-black tracking-tight">
            កត់ត្រាការខ្ចីប្រាក់ និងទិញទំនិញ
          </h1>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <SyncIndicator
              status={syncStatus}
              onRefresh={fetchData}
              onRetry={handleRetry}
            />
            {/* Settings Button with Vector Icon */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-primary-700 hover:bg-primary-800 transition-colors"
              title="ការកំណត់"
              aria-label="ការកំណត់"
            >
              <SettingsIcon className="w-5 h-5 text-white" />
            </button>
            {/* Logout Button with Vector Icon */}
            <button
              onClick={handleLogout}
              className="min-h-[44px] min-w-[44px] rounded-2xl bg-primary-700 hover:bg-primary-800 
                         transition-colors flex items-center justify-center text-sm font-bold"
              title="ចាកចេញ"
              aria-label="ចាកចេញ"
            >
              <LogOutIcon className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Modal (CSV Export & Borrower Management) */}
      {showSettings && (
        <SettingsModal
          transactions={transactions}
          products={products}
          onRename={handleRenameBorrower}
          onExportTransactions={handleExportTransactions}
          onExportProducts={handleExportProducts}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Error banner with vector icon */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 max-w-4xl mx-auto mt-3 mx-4 rounded-r-2xl shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircleIcon className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-bold">{error}</p>
              <button
                onClick={handleRetry}
                className="text-sm font-semibold underline mt-1 hover:text-red-900"
              >
                ព្យាយាមម្តងទៀត
              </button>
            </div>
            <button
              onClick={() => setError(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-slate-400 hover:text-slate-600"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-3 py-4 pb-28 sm:px-4 sm:py-5 sm:pb-24">
        {loading && transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200 border-t-primary-600 mb-4"></div>
            <p className="text-slate-600 font-bold text-base">កំពុងផ្ទុក...</p>
          </div>
        ) : (
          <Dashboard
            transactions={transactions}
            products={products}
            settlements={settlements}
            onDeleteTransaction={handleDeleteTransaction}
            onDeleteProduct={handleDeleteProduct}
            onSettleMonth={handleSettleMonth}
            onReopenMonth={handleReopenMonth}
            onOpenEntryModal={handleOpenEntryModal}
          />
        )}
      </main>

      {/* Unified Daily Entry Modal with Multi-Row Support */}
      <UnifiedEntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        transactions={transactions}
        products={products}
        defaultBorrower={entryModalDefaults.borrower}
        defaultTab={entryModalDefaults.tab}
        onSaveTransaction={handleAddTransaction}
        onSaveProduct={handleAddProduct}
      />
    </div>
  );
}
