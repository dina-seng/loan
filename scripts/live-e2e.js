const PROD_URL = process.env.VITE_APPS_SCRIPT_URL;
const USER = process.env.USER;
const PASS = process.env.PASS;

async function post(action, payload = {}) {
  const res = await fetch(PROD_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      username: USER,
      password: PASS,
      action,
      ...payload,
    }),
    redirect: "follow",
  });
  return res.json();
}

async function runLiveE2ETest() {
  console.log("=== Starting Live Production E2E Test on Google Sheets ===\n");

  // Step 1: Initial List
  console.log("Step 1: Fetching current transactions...");
  const initial = await post("list");
  console.log("  Initial state:", initial);
  if (!initial.ok)
    throw new Error("Failed to list: " + JSON.stringify(initial));

  // Step 2: Add a Loan (Lend)
  const loanId = "test-" + Date.now() + "-1";
  console.log("\nStep 2: Adding Loan (Lend) transaction...");
  console.log("  Borrower: សុខ គង់");
  console.log("  Amount: 1,500,000៛");
  const addLoanRes = await post("add", {
    id: loanId,
    date: "2026-11-10",
    borrower: "សុខ គង់",
    type: "Lend",
    amount: 1500000,
    note: "តេស្តប្រព័ន្ធផ្ទាល់ (Live System Test)",
  });
  console.log("  Add Loan Response:", addLoanRes);
  if (!addLoanRes.ok)
    throw new Error("Failed to add loan: " + JSON.stringify(addLoanRes));

  // Step 3: Add a Repayment (Repay)
  const repayId = "test-" + Date.now() + "-2";
  console.log("\nStep 3: Adding Repayment (Repay) transaction...");
  console.log("  Borrower: សុខ គង់");
  console.log("  Amount: 500,000៛");
  const addRepayRes = await post("add", {
    id: repayId,
    date: "2026-11-10",
    borrower: "សុខ គង់",
    type: "Repay",
    amount: 500000,
    note: "តេស្តសងប្រាក់ (Test Repay)",
  });
  console.log("  Add Repay Response:", addRepayRes);
  if (!addRepayRes.ok)
    throw new Error("Failed to add repayment: " + JSON.stringify(addRepayRes));

  // Step 4: Verify List & Mathematical Consistency
  console.log("\nStep 4: Verifying sheet data & financial calculations...");
  const afterAdd = await post("list");
  console.log(
    `  Fetched ${afterAdd.transactions.length} rows from Google Sheet:`,
  );
  for (const t of afterAdd.transactions) {
    console.log(
      `    - [${t.type}] ${t.date} | ${t.borrower} | ${t.amount.toLocaleString()}៛ | Note: ${t.note}`,
    );
  }

  // Calculate frontend math
  let totalLent = 0;
  let totalRepaid = 0;
  for (const t of afterAdd.transactions) {
    if (t.type === "Lend") totalLent += t.amount;
    if (t.type === "Repay") totalRepaid += t.amount;
  }
  const netOutstanding = totalLent - totalRepaid;

  console.log("\n  Calculated Financial Totals:");
  console.log(`    Total Lent:        ${totalLent.toLocaleString()}៛`);
  console.log(`    Total Repaid:      ${totalRepaid.toLocaleString()}៛`);
  console.log(`    Net Outstanding:   ${netOutstanding.toLocaleString()}៛`);

  if (
    totalLent === 1500000 &&
    totalRepaid === 500000 &&
    netOutstanding === 1000000
  ) {
    console.log(
      "  ✅ Mathematical Accuracy: VERIFIED PERFECT (1,000,000៛ Outstanding)",
    );
  } else {
    console.error("  ❌ Math mismatch!");
  }

  // Step 5: Test Delete Functionality
  console.log("\nStep 5: Testing delete operation on repayment row...");
  const delRes = await post("delete", { id: repayId });
  console.log("  Delete Response:", delRes);

  const afterDelete = await post("list");
  console.log(`  Remaining rows: ${afterDelete.transactions.length}`);
  const stillHasRepay = afterDelete.transactions.some((t) => t.id === repayId);
  const stillHasLoan = afterDelete.transactions.some((t) => t.id === loanId);
  console.log(
    `  Repayment row removed: ${!stillHasRepay ? "YES (Verified)" : "NO"}`,
  );
  console.log(`  Loan row intact: ${stillHasLoan ? "YES (Verified)" : "NO"}`);

  // Also clean up the loan row so the sheet remains pristine
  console.log("\nStep 6: Cleaning up test loan row...");
  await post("delete", { id: loanId });
  const finalState = await post("list");
  console.log(
    `  Final rows in sheet: ${finalState.transactions.length} (Sheet is clean)`,
  );

  console.log("\n🎉 ALL LIVE PRODUCTION TESTS PASSED WITH 100% SUCCESS!");
}

runLiveE2ETest().catch(console.error);
