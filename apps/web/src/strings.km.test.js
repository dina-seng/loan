import { describe, expect, it } from 'vitest';
import { errorMessage } from './labels.js';

describe('Khmer error messages', () => {
  it('shows the specific backend field message instead of a generic error', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ សូមពិនិត្យឡើងវិញ',
      details: { name: 'ឈ្មោះដៃគូនេះមានរួចហើយ' },
    };
    expect(errorMessage(error)).toBe('ឈ្មោះដៃគូនេះមានរួចហើយ');
  });

  it('maps known error codes to Khmer', () => {
    expect(errorMessage({ code: 'NOTHING_TO_SETTLE' })).toBe('មិនមានសមតុល្យត្រូវទូទាត់ទេ');
    expect(errorMessage({ code: 'UNAUTHORIZED' })).toBe('សូមចូលប្រើគណនីឡើងវិញ');
  });

  it('falls back to the error message text', () => {
    expect(errorMessage({ code: 'UNKNOWN', message: 'ខុស' })).toBe('ខុស');
  });
});
