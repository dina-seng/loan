# 📋 Manual QA Checklist: Security & Real-Device Mobile Verification
**Project:** Lending Management System (ប្រព័ន្ធគ្រប់គ្រងការខ្ចីប្រាក់)  
**Target User:** Non-technical loan lender (Dad) using iOS/Android smartphone in Cambodia (UTC+7)  
**Target Backend:** Google Sheets + Google Apps Script Web App  

---

## Part I: Category 6 — Security & Access Control Verification

| # | Test Scenario | Step-by-Step Execution | Expected Result | Pass/Fail | Notes |
|---|---------------|------------------------|-----------------|-----------|-------|
| **6.1** | **Wrong Password Rejection** | 1. Enter valid username (`admin`).<br>2. Enter wrong password (`incorrect123`).<br>3. Tap **ចូល (Login)**. | - Error banner appears: `ពាក្យសម្ងាត់មិនត្រឹមត្រូវ (Wrong username or password)`.<br>- No transactions or borrower names leaked.<br>- App remains on login screen. | `[ ]` | |
| **6.2** | **Empty / Missing Credentials** | 1. Leave username or password blank.<br>2. Tap **ចូល (Login)**. | - Client-side validation triggers: `សូមបញ្ចូលឈ្មោះ និង ពាក្យសម្ងាត់`.<br>- No HTTP request sent to Google Apps Script. | `[ ]` | |
| **6.3** | **Unset Script Properties** | 1. In Apps Script, temporarily rename or delete `APP_PASS`.<br>2. Attempt login with previously valid password. | - Web app returns `{"ok": false, "error": "unauthorized"}`.<br>- UI displays unauthorized error. No spreadsheet data is exposed. | `[ ]` | Restore property after test. |
| **6.4** | **Google Sheets Formula Injection Prevention (CSV/Spreadsheet Injection)** | 1. Log in to web app.<br>2. Create a loan with Borrower: `=1+1` or Note: `=SUM(A1:A100)` or `@cmd|' /C calc'!A0` or `-5000`.<br>3. Save transaction.<br>4. Open Google Sheet directly. | - In Google Sheet cell, formula is NOT executed.<br>- Cell stores content as raw text (or prefixed with `'` e.g., `'=SUM(A1:A100)`).<br>- No formula warning or arbitrary code execution. | `[ ]` | Critical security check for shared sheets. |
| **6.5** | **Password Leakage Prevention** | 1. Open DevTools (F12) → **Network** tab.<br>2. Filter by `exec`.<br>3. Check Request URL.<br>4. Check Page Source & Console logs. | - Password is NEVER passed as URL query param (`?password=...`).<br>- Password only exists in encrypted POST payload body.<br>- Console logs do not print credentials.<br>- `view-source:` does not contain hardcoded passwords. | `[ ]` | |
| **6.6** | **Session Logout & Persistence Purge** | 1. Log in with "Stay logged in" checked.<br>2. Verify `lms_credentials` exists in browser `localStorage`.<br>3. Tap logout button icon.<br>4. Inspect `localStorage`.<br>5. Press browser back button. | - `lms_credentials` key is completely removed.<br>- In-memory state (transactions, totals) is wiped clean to empty.<br>- Browser back button does NOT display cached financial data. | `[ ]` | |

---

## Part II: Category 8 — Manual End-to-End Field Checks on a Real Phone

> **Device Prerequisites:** Test on physical iPhone (Safari) and Android (Chrome) using local Wi-Fi or 4G LTE.

### 8.1 Transaction Flow & Three-Way Reconciliation
- [ ] **Step 1:** Log into the app on a mobile device.
- [ ] **Step 2:** Add 3 separate loans:
  - Loan A: `1,500,000៛` on borrower "សុខ គង់"
  - Loan B: `3,000,000៛` on borrower "សុខ គង់"
  - Loan C: `500,000៛` on borrower "ចាន់ ណារី"
- [ ] **Step 3:** Record a repayment of `2,000,000៛` from "សុខ គង់".
- [ ] **Step 4: Three-Way Math Verification:**
  - **Website Dashboard:** Total Lent = `5,000,000៛`, Total Repaid = `2,000,000៛`, Net Outstanding = `3,000,000៛`.
  - **Google Sheet "Transactions" Tab:** 4 corresponding rows exist with identical timestamps, amounts, and IDs.
  - **Physical Calculator:** $(1,500,000 + 3,000,000 + 500,000) - 2,000,000 = 3,000,000៛$. All three reconcile with 0 difference.

### 8.2 Native Khmer Keyboard Testing
- [ ] **Borrower Names:** Type with native iOS / Android Khmer keyboard:
  - Consonants + Subscripts (ជើង): `កញ្ញា`, `សម្បត្តិ`, `ស្រីពៅ`.
  - Verify characters render cleanly without dotted circles (◌) or broken glyph stacking.
- [ ] **Khmer Numerals:**
  - Type Khmer digits `១៥០០០០០` into the amount box.
  - Verify app automatically translates to `1,500,000៛` without throwing an invalid number error.

### 8.3 Offline & Airplane Mode Mid-Flight Test
- [ ] **Step 1:** Open Add Transaction form and fill: Borrower = `តេស្ត ដាច់បណ្តាញ`, Amount = `750,000៛`.
- [ ] **Step 2:** Turn on **Airplane Mode** on the phone.
- [ ] **Step 3:** Tap **រក្សាទុក (Save)**.
- [ ] **Step 4: Observe Failure State:**
  - Form does NOT discard what was typed.
  - Sync indicator displays `បរាជ័យ (Failed)`.
  - Error banner displays `រក្សាទុកមិនបានសម្រេច (Save failed)`.
- [ ] **Step 5: Recovery:**
  - Turn off **Airplane Mode** (re-enable Wi-Fi/Cellular).
  - Tap **រក្សាទុក (Save)** or Retry icon.
  - Transaction succeeds, row appears in list, and sync indicator turns green (`ធ្វើសមកាលកម្មរួច`).

### 8.4 Multi-Device Concurrency & Dual Login
- [ ] **Step 1:** Open app on Device 1 (Dad's Phone) and Device 2 (Laptop/Tablet).
- [ ] **Step 2:** Log in with same credentials on both devices.
- [ ] **Step 3:** On Device 1, record repayment of `500,000៛`.
- [ ] **Step 4:** On Device 2, tap **ផ្ទុកឡើងវិញ (Refresh)** icon.
- [ ] **Step 5:** Verify Device 2 updates immediately to reflect the repayment recorded by Device 1 with no row duplication or lock collision.

### 8.5 App Lifecycle & Refresh Persistence
- [ ] **Step 1:** Close mobile browser tab completely or force-kill the browser process.
- [ ] **Step 2:** Re-open browser and navigate back to the site.
- [ ] **Step 3:** Verify user is still authenticated (bypass login screen).
- [ ] **Step 4:** Last used borrower name is remembered in the Add Transaction form.

### 8.6 Delete Flow with Safety Modal
- [ ] **Step 1:** On mobile screen, locate a transaction in the transaction log table.
- [ ] **Step 2:** Tap the red trash icon.
- [ ] **Step 3:** Verify full-screen confirmation modal appears: `បញ្ជាក់ការលុប (Confirm Delete)`.
- [ ] **Step 4:** Tap outside or tap `បោះបង់ (Cancel)` -> item is NOT removed.
- [ ] **Step 5:** Tap trash icon again and tap `លុប (Delete)` -> item disappears immediately via optimistic UI, and Google Sheet row is deleted.

### 8.7 Production HTTPS & PWA Mobile Feel
- [ ] Deployed on custom domain/subdomain with valid SSL certificate (`https://`).
- [ ] Viewport `<meta name="viewport" content="width=device-width, initial-scale=1.0">` prevents awkward auto-zoom on input focus in iOS Safari.
- [ ] Touch targets are at least $44 \times 44\text{px}$ for comfortable single-thumb operation.
