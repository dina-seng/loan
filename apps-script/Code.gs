const TAB = 'Transactions';
const HEAD = ['ល.រ', 'កាលបរិច្ឆេទ', 'ឈ្មោះអ្នកខ្ចី', 'ប្រភេទប្រតិបត្តិការ', 'ចំនួនទឹកប្រាក់', 'កំណត់សម្គាល់', 'ID'];

function normalizeBorrower_(name) {
  return String(name == null ? '' : name)
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(TAB);
  if (!s) {
    s = ss.insertSheet(TAB);
    s.appendRow(HEAD);
  }
  formatSheet_(s);
  return s;
}

function formatSheet_(s) {
  const lastRow = Math.max(s.getLastRow(), 1);
  const usedRange = s.getRange(1, 1, lastRow, HEAD.length);

  s.setFrozenRows(1);
  usedRange.setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  s.getRange(1, 1, 1, HEAD.length)
    .setBackground('#163a5f')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);
  s.setRowHeight(1, 36);

  [55, 120, 190, 185, 140, 240, 300].forEach((width, index) => {
    s.setColumnWidth(index + 1, width);
  });
  s.getRange('A:A').setHorizontalAlignment('center');
  s.getRange('B:B').setNumberFormat('@').setHorizontalAlignment('center');
  s.getRange('C:D').setHorizontalAlignment('left');
  s.getRange('E:E').setNumberFormat('#,##0" ៛"').setHorizontalAlignment('right');
  s.getRange('F:F').setWrap(true);
  s.getRange('G:G').setFontSize(9).setFontColor('#526579');
  if (lastRow > 1) {
    s.setRowHeights(2, lastRow - 1, 30);
  }

  const filterRange = s.getRange(1, 1, Math.max(lastRow, 2), HEAD.length);
  const filter = s.getFilter();
  if (filter) {
    filter.setRange(filterRange);
  } else {
    filterRange.createFilter();
  }
}

function doGet(e) {
  return out_({
    ok: true,
    message: 'Lending Management System API (ប្រព័ន្ធគ្រប់គ្រងការខ្ចីប្រាក់) is online.',
    hint: 'This endpoint accepts POST requests from the web app.'
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    if (d.username !== props.getProperty('APP_USER') || d.password !== props.getProperty('APP_PASS')) {
      return out_({ ok: false, error: 'unauthorized' });
    }
    const s = sheet_();
    if (d.action === 'list') {
      const rows = s.getDataRange().getValues().slice(1).filter(r => r[6] !== '');
      return out_({ ok: true, transactions: rows.map(r => ({
        id: String(r[6]), date: String(r[1]), borrower: r[2], type: r[3], amount: Number(r[4]), note: r[5]
      })) });
    }
    if (d.action === 'add') {
      const borrower = normalizeBorrower_(d.borrower);
      if (!borrower) return out_({ ok: false, error: 'invalid_borrower' });
      s.appendRow([s.getLastRow(), d.date, borrower, d.type, d.amount, d.note || '', d.id]);
      formatSheet_(s);
      return out_({ ok: true });
    }
    if (d.action === 'delete') {
      const ids = s.getRange(1, 7, s.getLastRow(), 1).getValues().map(r => String(r[0]));
      const i = ids.indexOf(String(d.id));
      if (i < 1) return out_({ ok: false, error: 'not_found' });
      s.deleteRow(i + 1);
      formatSheet_(s);
      return out_({ ok: true });
    }
    if (d.action === 'rename_borrower') {
      const from = normalizeBorrower_(d.from);
      const to = normalizeBorrower_(d.to);
      if (!from || !to) return out_({ ok: false, error: 'invalid_borrower' });
      if (from.toLowerCase() === to.toLowerCase()) {
        return out_({ ok: false, error: 'no_change' });
      }

      const lastRow = s.getLastRow();
      if (lastRow < 2) return out_({ ok: false, error: 'borrower_not_found' });
      const borrowerRange = s.getRange(2, 3, lastRow - 1, 1);
      const borrowerValues = borrowerRange.getValues();
      let updated = 0;
      borrowerValues.forEach(row => {
        if (normalizeBorrower_(row[0]).toLowerCase() === from.toLowerCase()) {
          row[0] = to;
          updated += 1;
        }
      });
      if (updated === 0) return out_({ ok: false, error: 'borrower_not_found' });
      borrowerRange.setValues(borrowerValues);
      return out_({ ok: true, updated });
    }
    return out_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
function setupSummary_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const t = sheet_();
  let s = ss.getSheetByName('Summary');
  if (!s) s = ss.insertSheet('Summary');
  s.clear();

  const T = 'Transactions!';
  const lent = `SUMIFS(${T}E:E,${T}D:D,"Lend")`;
  const paid = `SUMIFS(${T}E:E,${T}D:D,"Repay")`;

  s.getRange('A1').setValue('📊 សង្ខេបបំណុល (Summary)');
  s.getRange('A3:B7').setValues([
    ['ប្រាក់បានឱ្យខ្ចីសរុប (Total Lent)', '=' + lent],
    ['ប្រាក់បានទទួលសងសរុប (Total Repaid)', '=' + paid],
    ['ប្រាក់នៅជំពាក់សរុប (Net Outstanding)', '=B3-B4'],
    ['ចំនួនដងដែលបានឱ្យខ្ចី (Number of loans)', `=COUNTIF(${T}D:D,"Lend")`],
    ['កាលបរិច្ឆេទទទួលសងចុងក្រោយ (Last repayment)',
      `=IFERROR(INDEX(SORT(FILTER(${T}B2:B,${T}D2:D="Repay"),1,FALSE),1),"-")`]
  ]);

  // Borrower summary
  s.getRange('A10:E10').setValues([['ឈ្មោះអ្នកខ្ចី (Borrower)', 'ប្រាក់បានខ្ចី (Borrowed)', 'ប្រាក់បានសង (Repaid)', 'នៅជំពាក់ (Outstanding)', 'ស្ថានភាព (Status)']]);
  s.getRange('A11').setFormula(`=IFERROR(UNIQUE(FILTER(${T}C2:C,${T}C2:C<>"")),"")`);
  s.getRange('B11').setFormula(`=ARRAYFORMULA(IF(A11:A40="","",SUMIFS(${T}E:E,${T}D:D,"Lend",${T}C:C,A11:A40)))`);
  s.getRange('C11').setFormula(`=ARRAYFORMULA(IF(A11:A40="","",SUMIFS(${T}E:E,${T}D:D,"Repay",${T}C:C,A11:A40)))`);
  s.getRange('D11').setFormula('=ARRAYFORMULA(IF(A11:A40="","",B11:B40-C11:C40))');
  s.getRange('E11').setFormula('=ARRAYFORMULA(IF(A11:A40="","",IF(D11:D40<=0,"សងរួច (Paid)","នៅជំពាក់ (Owing)")))');

  // Monthly table
  s.getRange('G10:J10').setValues([['ខែ (Month)', 'ឱ្យខ្ចី (Lent)', 'ទទួលសង (Repaid)', 'សមតុល្យ (Balance)']]);
  s.getRange('G11').setFormula(`=IFERROR(SORT(UNIQUE(ARRAYFORMULA(LEFT(FILTER(${T}B2:B,${T}B2:B<>""),7))),1,FALSE),"")`);
  s.getRange('H11').setFormula(`=ARRAYFORMULA(IF(G11:G40="","",SUMIFS(${T}E:E,${T}D:D,"Lend",${T}B:B,G11:G40&"*")))`);
  s.getRange('I11').setFormula(`=ARRAYFORMULA(IF(G11:G40="","",SUMIFS(${T}E:E,${T}D:D,"Repay",${T}B:B,G11:G40&"*")))`);
  s.getRange('J11').setFormula('=ARRAYFORMULA(IF(G11:G40="","",H11:H40-I11:I40))');

  // Look
  s.getRange('A1').setFontSize(16).setFontWeight('bold');
  s.getRange('A3:A7').setFontWeight('bold');
  s.getRange('B3:B5').setNumberFormat('#,##0" ៛"').setFontSize(12).setFontWeight('bold');
  s.getRange('B5').setFontColor('#b45309');
  s.getRange('B6').setNumberFormat('0');
  s.getRange('A10:E10').setBackground('#163a5f').setFontColor('#fff').setFontWeight('bold');
  s.getRange('G10:J10').setBackground('#163a5f').setFontColor('#fff').setFontWeight('bold');
  s.getRange('B11:D40').setNumberFormat('#,##0" ៛"');
  s.getRange('H11:J40').setNumberFormat('#,##0" ៛"');
  s.setColumnWidths(1, 1, 300);
  s.setColumnWidths(2, 4, 170);
  s.setColumnWidth(6, 30);
  s.setColumnWidths(7, 4, 150);

  // Transactions tab: dropdown + colours
  t.getRange('D2:D1000').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Lend', 'Repay'], true).build());
  t.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$D2="Repay"')
      .setBackground('#e6f4ec').setRanges([t.getRange('A2:G1000')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$D2="Lend"')
      .setBackground('#fff4e0').setRanges([t.getRange('A2:G1000')]).build()
  ]);
}
