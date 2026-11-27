import { describe, expect, it } from 'vitest';
import { closedPeriodMessage, errorMessage, labels } from './strings.km.js';

describe('Khmer wording', () => {
  it('prefers the specific backend field message', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: labels.error,
      details: { name: 'ឈ្មោះដៃគូនេះមានរួចហើយ' },
    };
    expect(errorMessage(error)).toBe('ឈ្មោះដៃគូនេះមានរួចហើយ');
  });

  it('maps known error codes to Khmer', () => {
    expect(errorMessage({ code: 'NOTHING_TO_SETTLE' })).toBe('មិនមានសមតុល្យត្រូវទូទាត់ទេ');
    expect(errorMessage({ code: 'UNAUTHORIZED' })).toBe('សូមចូលប្រើគណនីឡើងវិញ');
    expect(errorMessage({ code: 'NETWORK' })).toBe('រក្សាទុកមិនបាន សូមព្យាយាមម្តងទៀត');
    expect(errorMessage({ code: 'FORBIDDEN' })).toBe(labels.ownerOnly);
    expect(errorMessage({ code: 'PRODUCT_NOT_FOUND' })).toBe('រកមិនឃើញទំនិញនេះទេ');
  });

  it('prefers the composed closed-period message over machine ids', () => {
    const error = {
      code: 'PERIOD_CLOSED',
      message: 'ថ្ងៃបិទចុងក្រោយ 2026-11-30',
      details: { closingId: '00000000-0000-4000-8000-000000000001', lastClosedDate: '2026-11-30', earliestAllowedDate: '2026-12-01' },
    };
    expect(errorMessage(error)).toBe('ថ្ងៃបិទចុងក្រោយ 2026-11-30');
    expect(closedPeriodMessage(error.details)).toContain('2026-12-01');
  });

  it('falls back to the error text, then the generic message', () => {
    expect(errorMessage({ code: 'UNKNOWN', message: 'ខុស' })).toBe('ខុស');
    expect(errorMessage({ code: 'UNKNOWN' })).toBe(labels.error);
  });

  it('uses the agreed glossary for the four entry types', () => {
    expect(labels.lend).toBe('ឱ្យខ្ចី');
    expect(labels.product).toBe('ទំនិញ');
    expect(labels.settle).toBe('ទូទាត់រួច');
    expect(labels.balanceHeadline).toBe('ត្រូវទូទាត់');
    expect(labels.theyOweUs).toBe('គេជំពាក់យើង');
    expect(labels.weOweThem).toBe('យើងជំពាក់គេ');
    expect(labels.partner).toBe('ឈ្មោះ');
  });

  it('uses the agreed action and feedback phrases', () => {
    expect(labels.add).toBe('បន្ថែម');
    expect(labels.save).toBe('រក្សាទុក');
    expect(labels.delete).toBe('លុប');
    expect(labels.deleteConfirm).toBe('តើអ្នកពិតជាចង់លុបមែនទេ?');
    expect(labels.saved).toBe('បានរក្សាទុករួចរាល់');
    expect(labels.saveFailed).toBe('រក្សាទុកមិនបាន សូមព្យាយាមម្តងទៀត');
  });
});
