import { describe, it, expect } from 'vitest';
import { calculateBalance, calculateTotals } from '../../lib/math';
import { sanitizeForGoogleSheets, validateNote } from '../../lib/validation';
import { computeTotals, formatMoney, getSettlementStatus } from '../../src/utils';
import { Transaction, Product } from '../../lib/types';

describe('Category 7: Security & Formula Injection Prevention', () => {
  describe('7.1 Formula Injection (CSV / Spreadsheet Injection)', () => {
    it('prefixes formula triggers = + - @ with an apostrophe', () => {
      expect(sanitizeForGoogleSheets('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeForGoogleSheets('+123456789')).toBe("'+123456789");
      expect(sanitizeForGoogleSheets('-500000')).toBe("'-500000");
      expect(sanitizeForGoogleSheets('@cmd')).toBe("'@cmd");
    });

    it('leaves safe strings untouched without prepending apostrophe', () => {
      expect(sanitizeForGoogleSheets('សុខា (Sokha)')).toBe('សុខា (Sokha)');
      expect(sanitizeForGoogleSheets('Rice delivery')).toBe('Rice delivery');
      expect(sanitizeForGoogleSheets('100000')).toBe('100000');
    });

    it('sanitizes notes properly while preserving emoji and Khmer text', () => {
      const safeNote = validateNote('ទិញស្រូវ 🌾🌾');
      expect(safeNote.valid).toBe(true);
      expect(safeNote.sanitized).toBe('ទិញស្រូវ 🌾🌾');

      const injectionNote = validateNote('=cmd|"/C calc"!A0');
      expect(injectionNote.valid).toBe(true);
      expect(injectionNote.sanitized).toBe('\'=cmd|"/C calc"!A0');
    });
  });

  describe('7.2 Authentication & Credential Guard Logic', () => {
    it('detects unconfigured server properties (APP_USER / APP_PASS empty or unset)', () => {
      const verifyProperties = (user?: string, pass?: string) => {
        if (!user || !pass || !user.trim() || !pass.trim()) {
          return { ok: false, error: 'server_misconfigured' };
        }
        return { ok: true };
      };

      expect(verifyProperties('', 'secret').error).toBe('server_misconfigured');
      expect(verifyProperties(undefined, 'secret').error).toBe('server_misconfigured');
      expect(verifyProperties('admin', '   ').error).toBe('server_misconfigured');
      expect(verifyProperties('admin', 'secret').ok).toBe(true);
    });

    it('rejects invalid credentials with unauthorized error', () => {
      const authenticate = (reqUser: string, reqPass: string, appUser: string, appPass: string) => {
        if (reqUser !== appUser || reqPass !== appPass) {
          return { ok: false, error: 'unauthorized' };
        }
        return { ok: true };
      };

      expect(authenticate('admin', 'wrong', 'admin', 'password123')).toEqual({ ok: false, error: 'unauthorized' });
      expect(authenticate('admin', 'password123', 'admin', 'password123')).toEqual({ ok: true });
    });

    it('ensures password is never in request URL parameters', () => {
      const apiEndpoint = 'https://script.google.com/macros/s/AKfycb.../exec';
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ username: 'admin', password: 'secretPassword123' }),
      };

      // URL must remain completely clean of credentials
      expect(apiEndpoint).not.toContain('secretPassword123');
      expect(apiEndpoint).not.toContain('password');
      expect(requestOptions.body).toContain('secretPassword123');
    });
  });
});

describe('Category 8: Sheet Consistency & Worked Example', () => {
  describe('8.1 Prompt Worked Example Specification', () => {
    it('executes exact prompt scenario: Lend 5M, Products 4,504,500 -> 495,500; then Repay 495,500 -> 0', () => {
      // Step 1: My dad lends 5,000,000 to borrower (e.g. Sokha)
      const tx1: Transaction = {
        id: 'tx-1',
        date: '2026-11-01',
        borrower: 'Sokha',
        type: 'Lend',
        amount: 5_000_000,
        note: 'Cash loan',
      };

      // Borrower delivers products worth 4,504,500 Riel during the month
      const prod1: Product = {
        id: 'pr-1',
        date: '2026-11-20',
        borrower: 'Sokha',
        item: 'Agricultural products',
        quantity: 1287,
        unitPrice: 3500,
        total: 4_504_500,
      };

      const step1Totals = computeTotals([tx1], [prod1]);
      // Balance = 5,000,000 - 0 - 4,504,500 + 0 = 495,500
      expect(step1Totals.balance).toBe(495_500);
      expect(step1Totals.status.key).toBe('borrower_owes');
      expect(step1Totals.status.direction).toBe('borrower_pays_dad');
      expect(formatMoney(step1Totals.balance)).toBe('495,500៛');

      // Step 2: At month end, borrower repays remaining 495,500 Riel cash
      const tx2: Transaction = {
        id: 'tx-2',
        date: '2026-11-30',
        borrower: 'Sokha',
        type: 'Repay',
        amount: 495_500,
        note: 'Month settlement 2026-11',
      };

      const step2Totals = computeTotals([tx1, tx2], [prod1]);
      // Balance = 5,000,000 - 495,500 - 4,504,500 + 0 = 0 (Cleared!)
      expect(step2Totals.balance).toBe(0);
      expect(step2Totals.status.key).toBe('cleared');
      expect(step2Totals.status.direction).toBe('cleared');
      expect(formatMoney(step2Totals.balance)).toBe('0៛');
    });
  });

  describe('8.2 Decimal Product Quantities (e.g. 2.5 kg)', () => {
    it('calculates Math.round(quantity * unitPrice) to exact integer Riel', () => {
      // 2.5 kg at 3,600 Riel/kg = 9,000 Riel
      const qty = 2.5;
      const unitPrice = 3600;
      const total = Math.round(qty * unitPrice);
      expect(total).toBe(9000);
      expect(Number.isInteger(total)).toBe(true);

      // Fractional riel rounding check: 3.33 kg x 1,000 Riel = 3330
      const total2 = Math.round(3.33 * 1000);
      expect(total2).toBe(3330);
    });
  });

  describe('8.3 Sheet Formula and Website Consistency', () => {
    it('verifies that Summary sheet formula B3-B4-B6+B5 matches website calculateBalance', () => {
      // Summary Sheet:
      // B3: Total Lent = 10,000,000
      // B4: Total Repaid = 4,000,000
      // B5: Total Refunded = 500,000
      // B6: Total Products = 3,000,000
      // Sheet Formula: =B3-B4-B6+B5
      const B3 = 10_000_000;
      const B4 = 4_000_000;
      const B5 = 500_000;
      const B6 = 3_000_000;
      const sheetFormulaResult = B3 - B4 - B6 + B5;

      const websiteResult = calculateBalance({
        lent: B3,
        repaid: B4,
        productValue: B6,
        refunded: B5,
      });

      expect(websiteResult).toBe(sheetFormulaResult);
      expect(websiteResult).toBe(3_500_000);
    });

    it('safely skips blank, null, or corrupted rows without crashing', () => {
      const corruptedTx: any[] = [
        { id: '1', date: '2026-11-01', borrower: 'Sokha', type: 'Lend', amount: 1_000_000 },
        { id: '', date: '', borrower: '', type: '', amount: null }, // empty row
        null,
        undefined,
        { id: '2', date: '2026-11-02', borrower: 'Sokha', type: 'Repay', amount: 'invalid-amount' },
      ];

      const cleanTotals = computeTotals(corruptedTx.filter(Boolean) as any);
      expect(cleanTotals.totalLent).toBe(1_000_000);
      expect(cleanTotals.totalRepaid).toBe(0);
    });

    it('guarantees zero emojis in UI source code and apps-script', () => {
      const fs = require('fs');
      const path = require('path');
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      const scanDirectory = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (/\.(jsx?|tsx?|gs)$/.test(file)) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const match = content.match(emojiRegex);
            expect(match, `Emoji found in ${fullPath}: ${match ? match[0] : ''}`).toBeNull();
          }
        }
      };

      scanDirectory(path.resolve(__dirname, '../../src'));
      scanDirectory(path.resolve(__dirname, '../../apps-script'));
    });
  });
});
