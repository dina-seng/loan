/**
 * Khmer Lending Management System & Product Offset Tracker Backend
 * Google Apps Script (Code.gs) - Simplified 2-Feature & Monthly Clear Edition
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
  "Status",
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
  "Status",
];

const HEAD_SETTLE = [
  "ID",
  "Month",
  "Borrower",
  "Total Lent",
  "Total Goods",
  "Settled Amount",
  "Direction",
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
    s.getRange("H:H").setNumberFormat("@");
  } else if (s.getLastRow() >= 1) {
    // If sheet exists, ensure column H (Status) header exists
    if (s.getLastColumn() < HEAD_TX.length || !s.getRange(1, 8).getValue()) {
      s.getRange(1, 8).setValue("Status");
      s.getRange("H:H").setNumberFormat("@");
    }
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
    s.getRange("H:I").setNumberFormat("@");
  } else if (s.getLastRow() >= 1) {
    // If sheet exists, ensure column I (Status) header exists
    if (s.getLastColumn() < HEAD_PROD.length || !s.getRange(1, 9).getValue()) {
      s.getRange(1, 9).setValue("Status");
      s.getRange("I:I").setNumberFormat("@");
    }
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
    s.getRange("D:F").setNumberFormat('#,##0"៛"');
    s.getRange("G:H").setNumberFormat("@");
  } else if (s.getLastRow() >= 1) {
    // If header exists but is old schema, update header row seamlessly
    const currentHeaders = s.getRange(1, 1, 1, Math.min(s.getLastColumn(), HEAD_SETTLE.length)).getValues()[0];
    if (currentHeaders.length < HEAD_SETTLE.length || String(currentHeaders[3]).toLowerCase().includes("balance")) {
      s.getRange(1, 1, 1, HEAD_SETTLE.length).setValues([HEAD_SETTLE]);
    }
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

// Handles YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, and Date objects safely
function formatDateStr_(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Phnom_Penh", "yyyy-MM-dd");
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Match MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    let p1 = parseInt(slashMatch[1], 10);
    let p2 = parseInt(slashMatch[2], 10);
    const y = slashMatch[3];
    const m = p1 > 12 ? p2 : p1;
    const d = p1 > 12 ? p1 : p2;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

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
  const isAll =
    normB === "all" ||
    normB === "__all__" ||
    normB === "បង្ហាញទាំងអស់" ||
    normB === "ទាំងអស់";

  return rows.some((r) => {
    const rMonth = String(r[1]).trim();
    const rB = normalizeBorrowerName_(r[2]).toLowerCase();
    const rIsAll =
      rB === "all" ||
      rB === "__all__" ||
      rB === "បង្ហាញទាំងអស់" ||
      rB === "ទាំងអស់";
    return rMonth === month && (isAll || rIsAll || rB === normB);
  });
}

function doGet(e) {
  return out_({ ok: true, message: "online", version: "2.2.0" });
}

function doPost(e) {
  let hasLock = false;
  const lock = LockService.getScriptLock();

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

    const WRITE_ACTIONS = [
      "add",
      "delete",
      "add_product",
      "delete_product",
      "settle_month",
      "reopen_month",
      "rename_borrower",
    ];

    if (WRITE_ACTIONS.includes(d.action)) {
      hasLock = lock.tryLock(5000);
      if (!hasLock) {
        return out_({ ok: false, error: "server_busy_try_again" });
      }
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
        transactions: rows.map((r) => {
          const status = r.length >= 8 && r[7] ? String(r[7]).trim() : "Active";
          return {
            id: String(r[6]),
            date: formatDateStr_(r[1]),
            borrower: r[2],
            type: r[3],
            amount: Number(r[4]) || 0,
            note: r[5] || "",
            status,
            settled: status.startsWith("Settled"),
          };
        }),
      });
    }

    // 2. ADD TRANSACTION (Single Lending or Repayment)
    if (d.action === "add") {
      const s = sheetTx_();
      const borrower = normalizeBorrowerName_(d.borrower);
      if (!borrower) return out_({ ok: false, error: "invalid_borrower" });

      const allowedTypes = ["Lend", "Repay", "Refund"];
      const txType = d.type || "Lend";
      if (!allowedTypes.includes(txType)) {
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
        txType,
        amount,
        sanitizeCell_(d.note || ""),
        id,
        "Active",
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
          const hasItemCol = r.length >= 8;
          const status = r.length >= 9 && r[8] ? String(r[8]).trim() : "Active";
          return {
            id: String(r[0]),
            date: formatDateStr_(r[1]),
            borrower: r[2],
            item: hasItemCol ? (r[3] || "") : "",
            quantity: Number(hasItemCol ? r[4] : r[3]) || 0,
            unitPrice: Number(hasItemCol ? r[5] : r[4]) || 0,
            total: Number(hasItemCol ? r[6] : r[5]) || 0,
            note: hasItemCol ? (r[7] || "") : "",
            status,
            settled: status.startsWith("Settled"),
          };
        }),
      });
    }

    // 5. ADD PRODUCT (Item Name Intentionally Blank/Optional)
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

      if (s.getLastRow() > 1) {
        const ids = s
          .getRange(2, 1, s.getLastRow() - 1, 1)
          .getValues()
          .map((r) => String(r[0]));
        if (ids.includes(id)) {
          return out_({ ok: true, duplicate: true, total });
        }
      }

      const itemVal = sanitizeCell_(d.item || d.itemName || "");
      s.appendRow([
        id,
        dateStr,
        sanitizeCell_(borrower),
        itemVal, // Empty string for clean 2-variable mode
        quantity,
        unitPrice,
        total,
        sanitizeCell_(d.note || ""),
        "Active",
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

    // 7. LIST SETTLEMENTS (Supports both legacy and new 2-variable schemas)
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
        settlements: rawRows.map((r) => {
          // Detect schema: If r[5] is text direction (old schema) vs number paid (new schema)
          const isOldSchema = typeof r[5] === "string" && ["borrower_pays_dad", "dad_pays_borrower", "cleared"].includes(r[5]);

          const totalLent = isOldSchema ? (Number(r[3]) || 0) : (Number(r[3]) || 0);
          const totalGoods = isOldSchema ? 0 : (Number(r[4]) || 0);
          const paid = isOldSchema ? (Number(r[4]) || 0) : (Number(r[5]) || 0);
          const direction = isOldSchema ? String(r[5] || "cleared") : String(r[6] || "cleared");
          const dateStr = formatDateStr_(isOldSchema ? r[7] : r[7]);

          return {
            id: String(r[0]),
            month: String(r[1]),
            borrower: r[2],
            totalLent,
            totalGoods,
            balanceBefore: totalLent - totalGoods,
            paid,
            direction,
            carriedOver: 0,
            date: dateStr,
            status: "ទូទាត់រួចរាល់",
          };
        }),
      });
    }

    // 8. SETTLE MONTH (Pure 2-Variable: Total Lent - Total Goods, with persistent Row Status)
    if (d.action === "settle_month") {
      const sSettle = sheetSettle_();
      const sTx = sheetTx_();
      const sProd = sheetProd_();

      const rawBorrower = String(d.borrower || "").trim();
      const isAll =
        !rawBorrower ||
        rawBorrower === "ALL" ||
        rawBorrower === "__all__" ||
        rawBorrower === "បង្ហាញទាំងអស់" ||
        rawBorrower === "ទាំងអស់";
      const borrower = isAll ? "បង្ហាញទាំងអស់" : normalizeBorrowerName_(rawBorrower);

      let dateStr = formatDateStr_(d.date);
      if (!isValidDateStr_(dateStr)) {
        dateStr = formatDateStr_(new Date());
      }
      let month = String(d.month || "").trim();
      if (!/^\d{4}-\d{2}$/.test(month)) {
        month = dateStr.slice(0, 7);
      }

      if (!isAll && !borrower) {
        return out_({
          ok: false,
          error: "invalid_borrower",
          message: "សូមជ្រើសរើសឈ្មោះអ្នកខ្ចី",
        });
      }

      if (!/^\d{4}-\d{2}$/.test(month) || !isValidDateStr_(dateStr)) {
        return out_({
          ok: false,
          error: "invalid_settlement_data",
          debug: { borrower, month, dateStr },
        });
      }

      // Prevent duplicate settlement for same borrower + month
      if (isMonthSettled_(borrower, month + "-01")) {
        return out_({ ok: false, error: "already_settled" });
      }

      const totalLent = Number(d.totalLent != null ? d.totalLent : d.balanceBefore) || 0;
      const totalGoods = Number(d.totalGoods) || 0;
      const paid = Number(d.paid != null ? d.paid : Math.abs(totalLent - totalGoods)) || 0;
      const direction = String(
        d.direction ||
          (totalLent > totalGoods
            ? "borrower_pays_dad"
            : totalLent < totalGoods
            ? "dad_pays_borrower"
            : "cleared")
      );
      const settlementId = String(d.id || Utilities.getUuid());
      const settledTag = "Settled:" + settlementId;

      const normBorrowerLower = borrower.toLowerCase();

      // Update Transactions Status column (Col 8)
      if (sTx.getLastRow() > 1) {
        const numRows = sTx.getLastRow() - 1;
        if (sTx.getLastColumn() < 8) {
          sTx.getRange(1, 8).setValue("Status");
        }
        const txRange = sTx.getRange(2, 1, numRows, 8);
        const txValues = txRange.getValues();
        let txModified = false;

        for (let i = 0; i < txValues.length; i++) {
          const rowDate = formatDateStr_(txValues[i][1]);
          const rowMonth = rowDate.slice(0, 7);
          const rowB = normalizeBorrowerName_(txValues[i][2]).toLowerCase();
          const rowStatus = String(txValues[i][7] || "Active").trim();

          const borrowerMatches = isAll || rowB === normBorrowerLower;
          const monthMatches = !month || rowMonth === month;
          const isRowActive = !rowStatus || rowStatus === "Active";

          if (borrowerMatches && monthMatches && isRowActive) {
            txValues[i][7] = settledTag;
            txModified = true;
          }
        }
        if (txModified) {
          txRange.setValues(txValues);
        }
      }

      // Update Products Status column (Col 9)
      if (sProd.getLastRow() > 1) {
        const numRows = sProd.getLastRow() - 1;
        if (sProd.getLastColumn() < 9) {
          sProd.getRange(1, 9).setValue("Status");
        }
        const prodRange = sProd.getRange(2, 1, numRows, 9);
        const prodValues = prodRange.getValues();
        let prodModified = false;

        for (let i = 0; i < prodValues.length; i++) {
          const rowDate = formatDateStr_(prodValues[i][1]);
          const rowMonth = rowDate.slice(0, 7);
          const rowB = normalizeBorrowerName_(prodValues[i][2]).toLowerCase();
          const rowStatus = String(prodValues[i][8] || "Active").trim();

          const borrowerMatches = isAll || rowB === normBorrowerLower;
          const monthMatches = !month || rowMonth === month;
          const isRowActive = !rowStatus || rowStatus === "Active";

          if (borrowerMatches && monthMatches && isRowActive) {
            prodValues[i][8] = settledTag;
            prodModified = true;
          }
        }
        if (prodModified) {
          prodRange.setValues(prodValues);
        }
      }

      // Append row to Settlements
      sSettle.appendRow([
        settlementId,
        month,
        sanitizeCell_(borrower),
        totalLent,
        totalGoods,
        paid,
        direction,
        dateStr,
      ]);

      return out_({ ok: true, id: settlementId, month });
    }

    // 9. REOPEN MONTH (Delete from Settlements & restore Transactions/Products to Active)
    if (d.action === "reopen_month") {
      const sSettle = sheetSettle_();
      const sTx = sheetTx_();
      const sProd = sheetProd_();

      const targetId = String(d.id || "").trim();
      const rawBorrower = String(d.borrower || "").trim();
      const isAll =
        !rawBorrower ||
        rawBorrower === "ALL" ||
        rawBorrower === "__all__" ||
        rawBorrower === "បង្ហាញទាំងអស់" ||
        rawBorrower === "ទាំងអស់";
      const borrower = isAll ? "" : normalizeBorrowerName_(rawBorrower);
      const month = String(d.month || "").trim();

      if (!targetId && (!borrower || !month)) {
        return out_({ ok: false, error: "invalid_reopen_data" });
      }

      // 1. Delete matching row from Settlements
      let foundSettlementId = targetId;
      if (sSettle.getLastRow() > 1) {
        const rows = sSettle
          .getRange(2, 1, sSettle.getLastRow() - 1, Math.max(sSettle.getLastColumn(), 3))
          .getValues();
        for (let i = rows.length - 1; i >= 0; i--) {
          const rowId = String(rows[i][0]).trim();
          const rowMonth = String(rows[i][1]).trim();
          const rowB = normalizeBorrowerName_(rows[i][2]).toLowerCase();

          const idMatches = targetId && rowId === targetId;
          const monthBorrowerMatches =
            !targetId &&
            rowMonth === month &&
            (isAll || rowB === borrower.toLowerCase());

          if (idMatches || monthBorrowerMatches) {
            if (!foundSettlementId) foundSettlementId = rowId;
            sSettle.deleteRow(i + 2);
          }
        }
      }

      const settledTag = foundSettlementId ? "Settled:" + foundSettlementId : "";

      // 2. Restore Transactions back to Active
      if (sTx.getLastRow() > 1) {
        const numRows = sTx.getLastRow() - 1;
        if (sTx.getLastColumn() >= 8) {
          const txRange = sTx.getRange(2, 1, numRows, 8);
          const txValues = txRange.getValues();
          let txModified = false;

          for (let i = 0; i < txValues.length; i++) {
            const rowStatus = String(txValues[i][7] || "").trim();
            const rowMonth = formatDateStr_(txValues[i][1]).slice(0, 7);
            const rowB = normalizeBorrowerName_(txValues[i][2]).toLowerCase();

            const statusMatchesId = settledTag && rowStatus === settledTag;
            const fallbackMatches =
              !settledTag &&
              rowStatus.startsWith("Settled") &&
              rowMonth === month &&
              (isAll || rowB === borrower.toLowerCase());

            if (statusMatchesId || fallbackMatches) {
              txValues[i][7] = "Active";
              txModified = true;
            }
          }
          if (txModified) {
            txRange.setValues(txValues);
          }
        }
      }

      // 3. Restore Products back to Active
      if (sProd.getLastRow() > 1) {
        const numRows = sProd.getLastRow() - 1;
        if (sProd.getLastColumn() >= 9) {
          const prodRange = sProd.getRange(2, 1, numRows, 9);
          const prodValues = prodRange.getValues();
          let prodModified = false;

          for (let i = 0; i < prodValues.length; i++) {
            const rowStatus = String(prodValues[i][8] || "").trim();
            const rowMonth = formatDateStr_(prodValues[i][1]).slice(0, 7);
            const rowB = normalizeBorrowerName_(prodValues[i][2]).toLowerCase();

            const statusMatchesId = settledTag && rowStatus === settledTag;
            const fallbackMatches =
              !settledTag &&
              rowStatus.startsWith("Settled") &&
              rowMonth === month &&
              (isAll || rowB === borrower.toLowerCase());

            if (statusMatchesId || fallbackMatches) {
              prodValues[i][8] = "Active";
              prodModified = true;
            }
          }
          if (prodModified) {
            prodRange.setValues(prodValues);
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
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (ignored) {}
    }
  }
}
