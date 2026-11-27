import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EntryList from './EntryList.jsx';
import { ConfirmDialog } from './Ui.jsx';
import { labels } from '../strings.km.js';

const entry = (id, type, date, amount, extra = {}) => ({
  id, type, date, amount, note: null, voidedAt: null, partnerId: 'p1', ...extra,
});

const entries = [
  entry('a', 'LEND', '2026-11-27', '5000000'),
  entry('b', 'PRODUCT', '2026-11-27', '2000000'),
  entry('c', 'LEND', '2026-10-01', '1000000'),
  entry('d', 'SETTLE_IN', '2026-10-05', '1000000'),
];

describe('EntryList', () => {
  it('groups entries by month, newest first, with a lend/product subtotal', () => {
    render(<EntryList entries={entries} />);
    const headings = screen.getAllByRole('heading').map((node) => node.textContent);
    expect(headings).toEqual(['វិច្ឆិកា ២០២៦', 'តុលា ២០២៦']);
    expect(screen.getByText('ឱ្យខ្ចី ៛5,000,000 · ទំនិញ ៛2,000,000')).toBeInTheDocument();
    expect(screen.getByText('ឱ្យខ្ចី ៛1,000,000 · ទំនិញ ៛0')).toBeInTheDocument();
  });

  it('labels every type in Khmer and never prints a negative amount', () => {
    render(<EntryList entries={entries} />);
    expect(screen.getAllByText(labels.lend).length).toBeGreaterThan(0);
    expect(screen.getAllByText(labels.product).length).toBeGreaterThan(0);
    expect(screen.getByText(labels.settleIn)).toBeInTheDocument();
    expect(screen.queryByText(/-\s*៛/)).toBeNull();
  });

  it('hands the row to the delete flow instead of deleting directly', () => {
    const onDelete = vi.fn();
    render(<EntryList entries={entries} onDelete={onDelete} />);
    const firstCard = screen.getAllByRole('article')[0];
    fireEvent.click(within(firstCard).getByRole('button', { name: labels.delete }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0][0].id).toBe('a');
  });

  it('marks voided rows and hides their delete button', () => {
    const voided = { ...entry('v', 'LEND', '2026-11-27', '700'), voidedAt: '2026-11-28' };
    render(<EntryList entries={[voided]} onDelete={() => {}} />);
    expect(screen.getByText(labels.voided)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: labels.delete })).toBeNull();
  });

  it('shows an empty state when there are no entries', () => {
    render(<EntryList entries={[]} />);
    expect(screen.getByText(labels.noData)).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('shows the Khmer delete question and only deletes after confirmation', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title={labels.delete}
        message={labels.deleteConfirm} confirmLabel={labels.delete} danger />,
    );
    expect(screen.getByText(labels.deleteConfirm)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: labels.delete }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
