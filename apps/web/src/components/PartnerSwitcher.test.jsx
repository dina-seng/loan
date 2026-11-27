import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PartnerSwitcher from './PartnerSwitcher.jsx';
import { labels } from '../strings.km.js';

const createPartner = vi.fn();
const updatePartner = vi.fn();

vi.mock('../partners.jsx', () => ({
  usePartner: () => ({
    partners: [],
    partner: null,
    selectPartner: vi.fn(),
    createPartner: (...args) => createPartner(...args),
    updatePartner: (...args) => updatePartner(...args),
  }),
}));

vi.mock('./Toast.jsx', () => ({ useToast: () => ({ show: vi.fn() }) }));

describe('PartnerSwitcher add flow', () => {
  beforeEach(() => {
    createPartner.mockReset();
    updatePartner.mockReset();
  });

  it('opens the add form and saves a new partner', async () => {
    render(<PartnerSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: labels.selectPartner }));
    fireEvent.click(screen.getByRole('button', { name: labels.addPartner }));

    const form = document.querySelector('#partner-form');
    expect(form).toBeTruthy();
    fireEvent.change(form.querySelector('input'), { target: { value: 'ដៃគូថ្មី' } });
    await act(async () => { fireEvent.submit(form); });

    expect(createPartner).toHaveBeenCalledWith({ name: 'ដៃគូថ្មី' });
    expect(updatePartner).not.toHaveBeenCalled();
  });
});
