import { describe, expect, it } from 'vitest';
import { errorMessage, dadPaysPartner, partnerPaysDad } from './labels.js';

describe('Khmer error and direction messages', () => {
  it('shows the specific backend field message instead of a generic error', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ សូមពិនិត្យឡើងវិញ',
      details: { name: 'សូមបញ្ចូលឈ្មោះដៃគូ' },
    };
    expect(errorMessage(error)).toBe('សូមបញ្ចូលឈ្មោះដៃគូ');
  });

  it('falls back to the backend message when there are no field details', () => {
    expect(errorMessage({ code: 'CONFLICT', message: 'ទិន្នន័យនេះមានរួចហើយ' })).toBe('ទិន្នន័យនេះមានរួចហើយ');
  });

  it('uses the partner name in both payment directions', () => {
    expect(partnerPaysDad('សុភី')).toBe('សុភី សងប្រាក់មកប៉ា');
    expect(dadPaysPartner('សុភី')).toBe('ប៉ាសងប្រាក់ទៅ សុភី');
  });
});
