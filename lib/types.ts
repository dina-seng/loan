export type TransactionType = 'Lend' | 'Repay';
export type CurrencyCode = 'KHR' | 'USD';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  borrower: string;
  type: TransactionType;
  amount: number; // Integers only for KHR, cents or integers for USD
  currency?: CurrencyCode;
  note?: string;
  createdAt?: string;
}

export interface BorrowerSummary {
  borrower: string;
  totalBorrowed: number;
  totalRepaid: number;
  outstanding: number;
  status: 'paid' | 'owing';
  transactionCount: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  lent: number;
  repaid: number;
  balance: number;
}

export interface Totals {
  totalLent: number;
  totalRepaid: number;
  netOutstanding: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings?: Record<string, string>;
  sanitizedValue?: any;
}
