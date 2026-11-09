import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionForm from '../../src/components/TransactionForm';
import { Transaction } from '../../lib/types';

describe('Integration Test: TransactionForm User Interactions & Safety Gates', () => {
  const mockTransactions: Transaction[] = [
    { id: '1', date: '2024-03-01', borrower: 'សុខ គង់', type: 'Lend', amount: 1_000_000 },
    { id: '2', date: '2024-03-05', borrower: 'សុខ គង់', type: 'Repay', amount: 400_000 },
  ]; // Current outstanding debt for សុខ គង់ = 600,000 KHR

  const mockOnSave = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders form with default date and borrower suggestion dropdown', async () => {
    render(
      <TransactionForm
        transactions={mockTransactions}
        defaults={null}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByLabelText(/កាលបរិច្ឆេទ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ឈ្មោះអ្នកខ្ចី/i)).toBeInTheDocument();
    expect(screen.getByText(/ឱ្យខ្ចី \(Lend\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ទទួលសង \(Repay\)/i)).toBeInTheDocument();
  });

  it('formats numeric inputs with thousands separator in real time', () => {
    render(
      <TransactionForm
        transactions={mockTransactions}
        defaults={null}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    const amountInput = screen.getByLabelText(/ចំនួនទឹកប្រាក់/i) as HTMLInputElement;

    // Type 1500000
    fireEvent.change(amountInput, { target: { value: '1500000' } });
    expect(amountInput.value).toBe('1,500,000');
  });

  it('locks the Save button while saving is in progress to prevent duplicate submissions', async () => {
    // Create a slow promise to simulate network latency
    let resolveSave: (value: any) => void;
    const slowSavePromise = new Promise(resolve => {
      resolveSave = resolve;
    });
    mockOnSave.mockReturnValue(slowSavePromise);

    render(
      <TransactionForm
        transactions={mockTransactions}
        defaults={null}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    const borrowerInput = screen.getByLabelText(/ឈ្មោះអ្នកខ្ចី/i);
    const amountInput = screen.getByLabelText(/ចំនួនទឹកប្រាក់/i);
    const submitBtn = screen.getByRole('button', { name: /រក្សាទុក \(Save\)/i });

    fireEvent.change(borrowerInput, { target: { value: 'សុខ គង់' } });
    fireEvent.change(amountInput, { target: { value: '200000' } });

    // Click submit
    fireEvent.click(submitBtn);

    // Save button should immediately be disabled with loading text
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/កំពុងរក្សាទុក/i)).toBeInTheDocument();

    // Clicking again should not trigger another save
    fireEvent.click(submitBtn);
    expect(mockOnSave).toHaveBeenCalledTimes(1);

    // Finish save
    resolveSave!(true);
    await waitFor(() => {
      expect(screen.getByText(/រក្សាទុកបានសម្រេច/i)).toBeInTheDocument();
    });
  });

  it('preserves user input on screen if saving throws a network or script error', async () => {
    mockOnSave.mockRejectedValue(new Error('Google Apps Script Lock Timeout'));

    render(
      <TransactionForm
        transactions={mockTransactions}
        defaults={null}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    const borrowerInput = screen.getByLabelText(/ឈ្មោះអ្នកខ្ចី/i) as HTMLInputElement;
    const amountInput = screen.getByLabelText(/ចំនួនទឹកប្រាក់/i) as HTMLInputElement;
    const noteInput = screen.getByLabelText(/កំណត់សម្គាល់/i) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /រក្សាទុក \(Save\)/i });

    fireEvent.change(borrowerInput, { target: { value: 'ចាន់ ណារី' } });
    fireEvent.change(amountInput, { target: { value: '500,000' } });
    fireEvent.change(noteInput, { target: { value: 'ទិញសម្ភារៈបន្ទាន់' } });

    fireEvent.click(submitBtn);

    // Error banner displayed
    await waitFor(() => {
      expect(screen.getByText(/រក្សាទុកមិនបានសម្រេច/i)).toBeInTheDocument();
    });

    // Form inputs must retain exact typed content
    expect(borrowerInput.value).toBe('ចាន់ ណារី');
    expect(amountInput.value).toBe('500,000');
    expect(noteInput.value).toBe('ទិញសម្ភារៈបន្ទាន់');
    expect(submitBtn).not.toBeDisabled();
  });
});
