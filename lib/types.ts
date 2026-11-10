export type TransactionType = 'Lend' | 'Repay' | 'Refund';
export type CurrencyCode = 'KHR' | 'USD';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  borrower: string;
  type: TransactionType;
  amount: number; // Integers only for KHR
  currency?: CurrencyCode;
  note?: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  date: string;
  borrower: string;
  item?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  note?: string;
}

export interface SettlementRecord {
  id: string;
  month: string;
  borrower: string;
  balanceBefore: number;
  paid: number;
  direction: 'borrower_pays_dad' | 'dad_pays_borrower' | 'cleared';
  carriedOver: number;
  date: string;
}

export interface BorrowerSummary {
  borrower: string;
  totalBorrowed: number;
  totalRepaid: number;
  totalRefunded?: number;
  totalProducts?: number;
  outstanding: number;
  balance?: number;
  settlement?: number;
  status: 'paid' | 'owing';
  settlementStatus?: 'borrower_owes' | 'dad_owes' | 'cleared';
  transactionCount: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  lent: number;
  repaid: number;
  products?: number;
  refunded?: number;
  netBalance?: number;
  runningBalance?: number;
  balance: number;
  isSettled?: boolean;
  status?: string;
  settlementRecord?: SettlementRecord | null;
}

export interface Totals {
  totalLent: number;
  totalRepaid: number;
  totalRefunded?: number;
  totalProducts?: number;
  balance?: number;
  netOutstanding: number;
  status?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings?: Record<string, string>;
  sanitizedValue?: any;
}
