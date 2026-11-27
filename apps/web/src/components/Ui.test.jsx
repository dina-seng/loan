import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BalanceCard } from './Ui.jsx';
import { labels } from '../i18n/labels.js';

describe('BalanceCard', () => {
  it('shows a positive balance as a sentence, not a bare number', () => {
    render(<BalanceCard balance="150000" direction="PARTNER_OWES_US" />);
    expect(screen.getByTestId('balance-amount')).toHaveTextContent('៛150,000');
    expect(screen.getByTestId('balance-message')).toHaveTextContent(labels.theyOweUs);
    expect(screen.getByText(labels.balanceHeadline)).toBeInTheDocument();
  });

  it('never shows a negative number when we owe the partner', () => {
    render(<BalanceCard balance="-4504500" direction="WE_OWE_PARTNER" />);
    expect(screen.getByTestId('balance-amount')).toHaveTextContent('៛4,504,500');
    expect(screen.getByTestId('balance-amount')).not.toHaveTextContent('-');
    expect(screen.getByTestId('balance-message')).toHaveTextContent(labels.weOweThem);
  });

  it('shows the cleared state at zero', () => {
    render(<BalanceCard balance="0" direction="SETTLED" />);
    expect(screen.getByTestId('balance-message')).toHaveTextContent(labels.cleared);
  });
});
