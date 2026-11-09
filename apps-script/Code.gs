const TAB = 'Transactions';
const HEAD = ['ល.រ', 'កាលបរិច្ឆេទ', 'ឈ្មោះអ្នកខ្ចី', 'ប្រភេទប្រតិបត្តិការ', 'ចំនួនទឹកប្រាក់', 'កំណត់សម្គាល់', 'ID'];

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(TAB);
  if (!s) {
    s = ss.insertSheet(TAB);
    s.appendRow(HEAD);
    s.setFrozenRows(1);
    s.getRange('B:B').setNumberFormat('@');
    s.getRange('E:E').setNumberFormat('#,##0"៛"');
    try {
      s.getRange(1, 1, 1, HEAD.length)
        .setBackground('#1e3a5f')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
    } catch (e) {}
  }
  return s;
}

function doGet(e) {
  return out_({
    ok: true,
    message: 'Lending Management System API (ប្រព័ន្ធគ្រប់គ្រងការខ្ចីប្រាក់) is online.',
    hint: 'This endpoint accepts POST requests from the web app.'
  });
}

function doPost(e) {
  let lock = null;
  try {
    const d = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    if (d.username !== props.getProperty('APP_USER') || d.password !== props.getProperty('APP_PASS')) {
      return out_({ ok: false, error: 'unauthorized' });
    }

    const s = sheet_();

    // 'list' is a read-only action — no lock needed!
    if (d.action === 'list') {
      const rows = s.getDataRange().getValues().slice(1).filter(r => r[6] !== '');
      return out_({
        ok: true,
        transactions: rows.map(r => ({
          id: String(r[6]),
          date: String(r[1]).split('T')[0],
          borrower: String(r[2]),
          type: String(r[3]),
          amount: Number(r[4]) || 0,
          note: String(r[5] || '')
        }))
      });
    }

    // Write actions require lock
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return out_({ ok: false, error: 'busy' });
    }

    if (d.action === 'add') {
      s.appendRow([s.getLastRow(), d.date, d.borrower, d.type, d.amount, d.note || '', d.id]);
      return out_({ ok: true });
    }

    if (d.action === 'delete') {
      const ids = s.getRange(1, 7, s.getLastRow(), 1).getValues().map(r => String(r[0]));
      const i = ids.indexOf(String(d.id));
      if (i < 1) return out_({ ok: false, error: 'not_found' });
      s.deleteRow(i + 1);
      return out_({ ok: true });
    }

    return out_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    if (lock) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
  }
}
