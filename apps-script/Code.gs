/**
 * Khmer Lending Management System & Product Offset Tracker Backend
 * Google Apps Script (Code.gs)
 */

const TAB_TX = "Transactions";
const TAB_PROD = "Products";
const TAB_SETTLE = "Settlements";

const HEAD_TX = [
  "ល.រ",
  "កាលបរិច្ឆេទ",
  "ឈ្មោះអ្នកខ្ចី",
  "ប្រភេទប្រតិបត្តិការ",
  "ចំនួនទឹកប្រាក់",
  "កំណត់សម្គាល់",
  "ID",
];

const HEAD_PROD = [
  "ID",
  "Date",
  "Borrower",
  "Item",
  "Quantity",
  "Unit price",
  "Total",
  "Note",
];

const HEAD_SETTLE = [
  "ID",
  "Month",
  "Borrower",
  "Balance before",
  "Paid",
  "Direction",
  "Carried over",
  "Date",
];

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function sheetTx_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(TAB_TX);
  if (!s) {
    s = ss.insertSheet(TAB_TX);
    s.appendRow(HEAD_TX);
    s.setFrozenRows(1);
    s.getRange("B:B").setNumberFormat("@");
    s.getRange("E:E").setNumberFormat('#,##0"៛"');
  }
  return s;
}

function sheetProd_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(TAB_PROD);
  if (!s) {
    s = ss.insertSheet(TAB_PROD);
    s.appendRow(HEAD_PROD);
    s.setFrozenRows(1);
    s.getRange("A:D").setNumberFormat("@");
    s.getRange("E:E").setNumberFormat("#,##0.##");
    s.getRange("F:G").setNumberFormat('#,##0"៛"');
    s.getRange("H:H").setNumberFormat("@");
  }
  return s;
}

function sheetSettle_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(TAB_SETTLE);
  if (!s) {
    s = ss.insertSheet(TAB_SETTLE);
    s.appendRow(HEAD_SETTLE);
    s.setFrozenRows(1);
    s.getRange("A:C").setNumberFormat("@");
    s.getRange("D:E").setNumberFormat('#,##0"៛"');
    s.getRange("F:F").setNumberFormat("@");
    s.getRange("G:G").setNumberFormat('#,##0"៛"');
    s.getRange("H:H").setNumberFormat("@");
  }
  return s;
}

function normalizeBorrowerName_(value) {
  return String(value || "")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCell_(val) {
  if (typeof val === "string") {
    if (/^[=+\-@]/.test(val)) {
      return "'" + val;
    }
    return val;
  }
  return val == null ? "" : val;
}

function formatDateStr_(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Phnom_Penh", "yyyy-MM-dd");
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, "Asia/Phnom_Penh", "yyyy-MM-dd");
  }
  return str.slice(0, 10);
}

function isValidDateStr_(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parts = dateStr.split("-");
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (y < 2000 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  return d >= 1 && d <= daysInMonth;
}

function isMonthSettled_(borrower, dateStr) {
  if (!borrower || !dateStr) return false;
  const month = formatDateStr_(dateStr).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return false;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = ss.getSheetByName(TAB_SETTLE);
  if (!s || s.getLastRow() <= 1) return false;

  const rows = s.getRange(2, 1, s.getLastRow() - 1, 3).getValues();
  const normB = normalizeBorrowerName_(borrower).toLowerCase();

  return rows.some(
    (r) =>
      String(r[1]) === month &&
      normalizeBorrowerName_(r[2]).toLowerCase() === normB,
  );
}

/**
 * Health check endpoint (never exposes data)
 */
function doGet(e) {
  return out_({ ok: true, message: "online" });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const d = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    const appUser = props.getProperty("APP_USER");
    const appPass = props.getProperty("APP_PASS");

    if (!appUser || !appPass || !appUser.trim() || !appPass.trim()) {
      return out_({ ok: false, error: "server_misconfigured" });
    }

    if (d.username !== appUser || d.password !== appPass) {
      return out_({ ok: false, error: "unauthorized" });
    }

    // 1. LIST TRANSACTIONS
    if (d.action === "list") {
      const s = sheetTx_();
      if (s.getLastRow() <= 1) {
        return out_({ ok: true, transactions: [] });
      }
      const rows = s
        .getDataRange()
        .getValues()
        .slice(1)
        .filter((r) => r[6] !== "");

      return out_({
        ok: true,
        transactions: rows.map((r) => ({
          id: String(r[6]),
          date: formatDateStr_(r[1]),
          borrower: r[2],
          type: r[3],
          amount: Number(r[4]) || 0,
          note: r[5] || "",
        })),
      });
    }

    // 2. ADD TRANSACTION
    if (d.action === "add") {
      const s = sheetTx_();
      const borrower = normalizeBorrowerName_(d.borrower);
      if (!borrower) return out_({ ok: false, error: "invalid_borrower" });

      const allowedTypes = ["Lend", "Repay", "Refund"];
      if (!allowedTypes.includes(d.type)) {
        return out_({ ok: false, error: "invalid_type" });
      }

      const amount = Number(d.amount);
      if (
        !Number.isInteger(amount) ||
        amount <= 0 ||
        amount > 1000000000000
      ) {
        return out_({ ok: false, error: "invalid_amount" });
      }

      const dateStr = formatDateStr_(d.date);
      if (!isValidDateStr_(dateStr)) {
        return out_({ ok: false, error: "invalid_date" });
      }

      if (isMonthSettled_(borrower, dateStr)) {
        return out_({ ok: false, error: "month_settled" });
      }

      const id = String(d.id || Utilities.getUuid());

      // Idempotency: check if ID exists
      if (s.getLastRow() > 1) {
        const ids = s
          .getRange(2, 7, s.getLastRow() - 1, 1)
          .getValues()
          .map((r) => String(r[0]));
        if (ids.includes(id)) {
          return out_({ ok: true, duplicate: true });
        }
      }

      s.appendRow([
        s.getLastRow(),
        dateStr,
        sanitizeCell_(borrower),
        d.type,
        amount,
        sanitizeCell_(d.note || ""),
        id,
      ]);

      return out_({ ok: true, id });
    }

    // 3. DELETE TRANSACTION
    if (d.action === "delete") {
      const s = sheetTx_();
      if (s.getLastRow() <= 1) return out_({ ok: false, error: "not_found" });

      const rows = s.getRange(2, 1, s.getLastRow() - 1, 7).getValues();
      const targetId = String(d.id);
      let targetRowIndex = -1;
      let targetRow = null;

      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][6]) === targetId) {
          targetRowIndex = i + 2;
          targetRow = rows[i];
          break;
        }
      }

      if (targetRowIndex < 2) return out_({ ok: false, error: "not_found" });

      // Month lock check
      const rowDate = formatDateStr_(targetRow[1]);
      const rowBorrower = targetRow[2];
      if (isMonthSettled_(rowBorrower, rowDate)) {
        return out_({ ok: false, error: "month_settled" });
      }

      s.deleteRow(targetRowIndex);
      return out_({ ok: true });
    }

    // 4. LIST PRODUCTS
    if (d.action === "list_products") {
      const s = sheetProd_();
      if (s.getLastRow() <= 1) {
        return out_({ ok: true, products: [] });
      }
      const rawRows = s
        .getDataRange()
        .getValues()
        .slice(1)
        .filter((r) => r[0] !== "");

      return out_({
        ok: true,
        products: rawRows.map((r) => {
          // Backward compatibility for 6-column sheet
          const hasItemCol = r.length >= 8;
          return {
            id: String(r[0]),
            date: formatDateStr_(r[1]),
            borrower: r[2],
            item: hasItemCol ? (r[3] || "") : "",
            quantity: Number(hasItemCol ? r[4] : r[3]) || 0,
            unitPrice: Number(hasItemCol ? r[5] : r[4]) || 0,
            total: Number(hasItemCol ? r[6] : r[5]) || 0,
            note: hasItemCol ? (r[7] || "") : "",
          };
        }),
      });
    }

    // 5. ADD PRODUCT
    if (d.action === "add_product") {
      const s = sheetProd_();
      const borrower = normalizeBorrowerName_(d.borrower);
      if (!borrower) return out_({ ok: false, error: "invalid_borrower" });

      const quantity = Math.round(Number(d.quantity) * 100) / 100;
      if (isNaN(quantity) || quantity <= 0 || quantity > 1000000) {
        return out_({ ok: false, error: "invalid_quantity" });
      }

      const unitPrice = Number(d.unitPrice);
      if (
        !Number.isInteger(unitPrice) ||
        unitPrice <= 0 ||
        unitPrice > 1000000000000
      ) {
        return out_({ ok: false, error: "invalid_unit_price" });
      }

      const dateStr = formatDateStr_(d.date);
      if (!isValidDateStr_(dateStr)) {
        return out_({ ok: false, error: "invalid_date" });
      }

      if (isMonthSettled_(borrower, dateStr)) {
        return out_({ ok: false, error: "month_settled" });
      }

      const total = Math.round(quantity * unitPrice);
      const id = String(d.id || Utilities.getUuid());

      // Idempotency: check if product ID exists
      if (s.getLastRow() > 1) {
        const ids = s
          .getRange(2, 1, s.getLastRow() - 1, 1)
          .getValues()
          .map((r) => String(r[0]));
        if (ids.includes(id)) {
          return out_({ ok: true, duplicate: true, total });
        }
      }

      s.appendRow([
        id,
        dateStr,
        sanitizeCell_(borrower),
        sanitizeCell_(d.item || ""),
        quantity,
        unitPrice,
        total,
        sanitizeCell_(d.note || ""),
      ]);

      return out_({ ok: true, id, total });
    }

    // 6. DELETE PRODUCT
    if (d.action === "delete_product") {
      const s = sheetProd_();
      if (s.getLastRow() <= 1) return out_({ ok: false, error: "not_found" });

      const rows = s.getRange(2, 1, s.getLastRow() - 1, 4).getValues();
      const targetId = String(d.id);
      let targetRowIndex = -1;
      let targetRow = null;

      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][0]) === targetId) {
          targetRowIndex = i + 2;
          targetRow = rows[i];
          break;
        }
      }

      if (targetRowIndex < 2) return out_({ ok: false, error: "not_found" });

      const rowDate = formatDateStr_(targetRow[1]);
      const rowBorrower = targetRow[2];
      if (isMonthSettled_(rowBorrower, rowDate)) {
        return out_({ ok: false, error: "month_settled" });
      }

      s.deleteRow(targetRowIndex);
      return out_({ ok: true });
    }

    // 7. LIST SETTLEMENTS
    if (d.action === "list_settlements") {
      const s = sheetSettle_();
      if (s.getLastRow() <= 1) {
        return out_({ ok: true, settlements: [] });
      }
      const rawRows = s
        .getDataRange()
        .getValues()
        .slice(1)
        .filter((r) => r[0] !== "");

      return out_({
        ok: true,
        settlements: rawRows.map((r) => ({
          id: String(r[0]),
          month: String(r[1]),
          borrower: r[2],
          balanceBefore: Number(r[3]) || 0,
          paid: Number(r[4]) || 0,
          direction: String(r[5]),
          carriedOver: Number(r[6]) || 0,
          date: formatDateStr_(r[7]),
        })),
      });
    }

    // 8. SETTLE MONTH
    if (d.action === "settle_month") {
      const sSettle = sheetSettle_();
      const sTx = sheetTx_();

      const borrower = normalizeBorrowerName_(d.borrower);
      const month = String(d.month || "").trim();
      const dateStr = formatDateStr_(d.date);
      const paid = Number(d.paid) || 0;
      const balanceBefore = Number(d.balanceBefore) || 0;
      const carriedOver = Number(d.carriedOver) || 0;
      const direction = String(d.direction || "cleared");
      const id = String(d.id || Utilities.getUuid());

      if (!borrower || !/^\d{4}-\d{2}$/.test(month) || !isValidDateStr_(dateStr)) {
        return out_({ ok: false, error: "invalid_settlement_data" });
      }

      // Record in Settlements sheet
      sSettle.appendRow([
        id,
        month,
        sanitizeCell_(borrower),
        balanceBefore,
        paid,
        direction,
        carriedOver,
        dateStr,
      ]);

      // If paid amount > 0, record corresponding Repay / Refund row in Transactions
      if (paid > 0) {
        const txType =
          direction === "borrower_pays_dad"
            ? "Repay"
            : direction === "dad_pays_borrower"
            ? "Refund"
            : "Repay";

        const txId = Utilities.getUuid();
        sTx.appendRow([
          sTx.getLastRow(),
          dateStr,
          sanitizeCell_(borrower),
          txType,
          paid,
          sanitizeCell_("Month settlement " + month),
          txId,
        ]);
      }

      return out_({ ok: true, id });
    }

    // 9. REOPEN MONTH
    if (d.action === "reopen_month") {
      const sSettle = sheetSettle_();
      const sTx = sheetTx_();
      const borrower = normalizeBorrowerName_(d.borrower);
      const month = String(d.month || "").trim();

      if (!borrower || !month) {
        return out_({ ok: false, error: "invalid_reopen_data" });
      }

      // Delete from Settlements
      if (sSettle.getLastRow() > 1) {
        const rows = sSettle
          .getRange(2, 1, sSettle.getLastRow() - 1, 3)
          .getValues();
        for (let i = rows.length - 1; i >= 0; i--) {
          if (
            String(rows[i][1]) === month &&
            normalizeBorrowerName_(rows[i][2]).toLowerCase() ===
              borrower.toLowerCase()
          ) {
            sSettle.deleteRow(i + 2);
          }
        }
      }

      // Delete automatic settlement transaction if present
      if (sTx.getLastRow() > 1) {
        const txRows = sTx
          .getRange(2, 1, sTx.getLastRow() - 1, 6)
          .getValues();
        const expectedNote = "Month settlement " + month;
        for (let i = txRows.length - 1; i >= 0; i--) {
          if (
            normalizeBorrowerName_(txRows[i][2]).toLowerCase() ===
              borrower.toLowerCase() &&
            String(txRows[i][5]).trim() === expectedNote
          ) {
            sTx.deleteRow(i + 2);
          }
        }
      }

      return out_({ ok: true });
    }

    // 10. RENAME BORROWER
    if (d.action === "rename_borrower") {
      const from = normalizeBorrowerName_(d.from);
      const to = normalizeBorrowerName_(d.to);
      if (!from || !to) return out_({ ok: false, error: "invalid_names" });

      let count = 0;
      const fromKey = from.toLowerCase();

      // Update Transactions
      const sTx = sheetTx_();
      if (sTx.getLastRow() > 1) {
        const vals = sTx.getRange(2, 3, sTx.getLastRow() - 1, 1).getValues();
        for (let i = 0; i < vals.length; i++) {
          if (normalizeBorrowerName_(vals[i][0]).toLowerCase() === fromKey) {
            vals[i][0] = sanitizeCell_(to);
            count++;
          }
        }
        sTx.getRange(2, 3, vals.length, 1).setValues(vals);
      }

      // Update Products
      const sProd = sheetProd_();
      if (sProd.getLastRow() > 1) {
        const vals = sProd
          .getRange(2, 3, sProd.getLastRow() - 1, 1)
          .getValues();
        for (let i = 0; i < vals.length; i++) {
          if (normalizeBorrowerName_(vals[i][0]).toLowerCase() === fromKey) {
            vals[i][0] = sanitizeCell_(to);
            count++;
          }
        }
        sProd.getRange(2, 3, vals.length, 1).setValues(vals);
      }

      // Update Settlements
      const sSettle = sheetSettle_();
      if (sSettle.getLastRow() > 1) {
        const vals = sSettle
          .getRange(2, 3, sSettle.getLastRow() - 1, 1)
          .getValues();
        for (let i = 0; i < vals.length; i++) {
          if (normalizeBorrowerName_(vals[i][0]).toLowerCase() === fromKey) {
            vals[i][0] = sanitizeCell_(to);
            count++;
          }
        }
        sSettle.getRange(2, 3, vals.length, 1).setValues(vals);
      }

      return out_({ ok: true, updated: count });
    }

    return out_({ ok: false, error: "unknown_action" });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Setup Summary Sheet with formula:
 * Settlement = Lend - Repay - ProductValue + Refund
 * Non-private name so it can be run directly from Apps Script run menu.
 */
function setupSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const t = sheetTx_();
  const p = sheetProd_();

  let s = ss.getSheetByName("Summary");
  if (!s) s = ss.insertSheet("Summary");
  s.clear();

  const T = "Transactions!";
  const P = "Products!";
  const lent = `SUMIFS(${T}E:E,${T}D:D,"Lend")`;
  const paid = `SUMIFS(${T}E:E,${T}D:D,"Repay")`;
  const refund = `SUMIFS(${T}E:E,${T}D:D,"Refund")`;
  const prodVal = `SUM(${P}G:G)`;

  s.getRange("A1").setValue("📊 សង្ខេបបំណុល និងការទូទាត់ទំនិញ (Summary)");
  s.getRange("A3:B8").setValues([
    ["ប្រាក់បានឱ្យខ្ចីសរុប (Total Lent)", "=" + lent],
    ["ប្រាក់បានទទួលសងសរុប (Total Repaid)", "=" + paid],
    ["ប្រាក់បានសងត្រឡប់ (Total Refunded)", "=" + refund],
    ["តម្លៃទំនិញបានផ្គត់ផ្គង់ (Total Products)", "=" + prodVal],
    [
      "សមតុល្យទូទាត់សរុប (Net Settlement = Lend - Repay - Prod + Refund)",
      "=B3-B4-B6+B5",
    ],
    [
      "កាលបរិច្ឆេទទទួលសងចុងក្រោយ (Last Repayment)",
      `=IFERROR(INDEX(SORT(FILTER(${T}B2:B,${T}D2:D="Repay"),1,FALSE),1),"-")`,
    ],
  ]);

  // Borrower Summary Header
  s.getRange("A10:H10").setValues([
    [
      "ឈ្មោះអ្នកខ្ចី (Borrower)",
      "ប្រាក់បានខ្ចី (Lent)",
      "ប្រាក់បានសង (Repaid)",
      "ប្រាក់បានសងត្រឡប់ (Refunded)",
      "តម្លៃទំនិញ (Products)",
      "សមតុល្យទូទាត់ (Settlement)",
      "ស្ថានភាព (Status)",
      "ចំនួនដង (Count)",
    ],
  ]);

  s.getRange("A11").setFormula(
    `=IFERROR(UNIQUE(FILTER(${T}C2:C,${T}C2:C<>"")),"")`,
  );
  s.getRange("B11").setFormula(
    `=ARRAYFORMULA(IF(A11:A="","",SUMIFS(${T}E:E,${T}D:D,"Lend",${T}C:C,A11:A)))`,
  );
  s.getRange("C11").setFormula(
    `=ARRAYFORMULA(IF(A11:A="","",SUMIFS(${T}E:E,${T}D:D,"Repay",${T}C:C,A11:A)))`,
  );
  s.getRange("D11").setFormula(
    `=ARRAYFORMULA(IF(A11:A="","",SUMIFS(${T}E:E,${T}D:D,"Refund",${T}C:C,A11:A)))`,
  );
  s.getRange("E11").setFormula(
    `=ARRAYFORMULA(IF(A11:A="","",SUMIF(${P}C:C,A11:A,${P}G:G)))`,
  );
  // Settlement = Lend - Repay - Prod + Refund = B - C - E + D
  s.getRange("F11").setFormula(
    `=ARRAYFORMULA(IF(A11:A="","",B11:B-C11:C-E11:E+D11:D))`,
  );
  s.getRange("G11").setFormula(
    `=ARRAYFORMULA(IF(A11:A="","",IF(F11:F>0,"ជំពាក់ប៉ា (Borrower owes)",IF(F11:F<0,"ប៉ាសងវិញ (Dad owes)","ទូទាត់រួច (Cleared)"))))`,
  );
  s.getRange("H11").setFormula(
    `=ARRAYFORMULA(IF(A11:A="","",COUNTIF(${T}C:C,A11:A)))`,
  );

  // Monthly Table Header
  s.getRange("J10:P10").setValues([
    [
      "ខែ (Month)",
      "ឱ្យខ្ចី (Lent)",
      "ទទួលសង (Repaid)",
      "ទំនិញ (Products)",
      "សងត្រឡប់ (Refunded)",
      "សមតុល្យខែ (Net Month)",
      "សមតុល្យបន្ត (Running)",
    ],
  ]);

  s.getRange("J11").setFormula(
    `=IFERROR(SORT(UNIQUE(ARRAYFORMULA(LEFT(FILTER(${T}B2:B,${T}B2:B<>""),7))),1,FALSE),"")`,
  );
  s.getRange("K11").setFormula(
    `=ARRAYFORMULA(IF(J11:J="","",SUMIFS(${T}E:E,${T}D:D,"Lend",${T}B:B,J11:J&"*")))`,
  );
  s.getRange("L11").setFormula(
    `=ARRAYFORMULA(IF(J11:J="","",SUMIFS(${T}E:E,${T}D:D,"Repay",${T}B:B,J11:J&"*")))`,
  );
  s.getRange("M11").setFormula(
    `=ARRAYFORMULA(IF(J11:J="","",SUMIFS(${P}G:G,${P}B:B,J11:J&"*")))`,
  );
  s.getRange("N11").setFormula(
    `=ARRAYFORMULA(IF(J11:J="","",SUMIFS(${T}E:E,${T}D:D,"Refund",${T}B:B,J11:J&"*")))`,
  );
  s.getRange("O11").setFormula(
    `=ARRAYFORMULA(IF(J11:J="","",K11:K-L11:L-M11:M+N11:N))`,
  );

  // Styling & Formatting
  s.getRange("A1").setFontSize(16).setFontWeight("bold");
  s.getRange("A3:A8").setFontWeight("bold");
  s.getRange("B3:B7")
    .setNumberFormat('#,##0" ៛"')
    .setFontSize(12)
    .setFontWeight("bold");
  s.getRange("B7").setFontColor("#b45309");

  s.getRange("A10:H10")
    .setBackground("#163a5f")
    .setFontColor("#fff")
    .setFontWeight("bold");
  s.getRange("J10:P10")
    .setBackground("#163a5f")
    .setFontColor("#fff")
    .setFontWeight("bold");

  s.getRange("B11:F").setNumberFormat('#,##0" ៛"');
  s.getRange("K11:O").setNumberFormat('#,##0" ៛"');

  // Transactions validation with Refund
  t.getRange("D2:D").setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["Lend", "Repay", "Refund"], true)
      .build(),
  );

  // Conditional format rules on Transactions
  t.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$D2="Repay"')
      .setBackground("#e6f4ec")
      .setRanges([t.getRange("A2:G")])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$D2="Lend"')
      .setBackground("#fff4e0")
      .setRanges([t.getRange("A2:G")])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$D2="Refund"')
      .setBackground("#e0f2fe")
      .setRanges([t.getRange("A2:G")])
      .build(),
  ]);
}
