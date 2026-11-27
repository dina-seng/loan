import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BalanceCard, SummaryCard } from './Ui.jsx';
import { labels, dadOwesPartner, partnerOwesDad } from '../i18n/labels.js';

describe('BalanceCard', () => {
  it('shows the amount and the correct relationship for a positive balance', () => {
    render(<BalanceCard balance="150000" direction="PARTNER_OWES_DAD" partnerName="សុភី" openingBalance="100000" />);
    expect(screen.getByTestId('balance-amount')).toHaveTextContent('៛150,000');
    expect(screen.getByText(partnerOwesDad('សុភី'))).toBeInTheDocument();
  });

  it('shows the opposite relationship for a negative balance', () => {
    render(<BalanceCard balance="-20000" direction="DAD_OWES_PARTNER" partnerName="សុភី" />);
    expect(screen.getByText(dadOwesPartner('សុភី'))).toBeInTheDocument();
  });

  it('shows the settled state at zero', () => {
    render(<BalanceCard balance="0" direction="SETTLED" />);
    expect(screen.getByText(labels.accountSettled)).toBeInTheDocument();
  });
});

describe('SummaryCard', () => {
  it('renders Khmer label and formatted amount', () => {
    render(<SummaryCard label={labels.totalMoneyLent} amount="400000" />);
    expect(screen.getByText(labels.totalMoneyLent)).toBeInTheDocument();
    expect(screen.getByText('៛400,000')).toBeInTheDocument();
  });
});
