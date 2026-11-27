// Khmer-first interface. Keep words short, natural and readable on a phone.
// The Phase 4 wording pass moves every string into src/strings.km.js.
export const labels = {
  appName: 'បញ្ជីហិរញ្ញវត្ថុ',
  dashboard: 'ផ្ទាំងសង្ខេប',
  history: 'ប្រវត្តិ',
  lend: 'ឱ្យខ្ចី',
  product: 'ទំនិញ',
  settleIn: 'ទូទាត់ចូល',
  settleOut: 'ទូទាត់ចេញ',
  settle: 'ទូទាត់រួច',
  balanceHeadline: 'ត្រូវទូទាត់',
  theyOweUs: 'គេជំពាក់យើង',
  weOweThem: 'យើងជំពាក់គេ',
  cleared: 'ស្មើរួចរាល់',
  partner: 'ឈ្មោះ',
  partnerName: 'ឈ្មោះ',
  selectPartner: 'ជ្រើសរើសដៃគូ',
  addPartner: 'បន្ថែមដៃគូ',
  editName: 'កែឈ្មោះ',
  add: 'បន្ថែម',
  save: 'រក្សាទុក',
  cancel: 'បោះបង់',
  delete: 'លុប',
  deleteConfirm: 'តើអ្នកពិតជាចង់លុបមែនទេ?',
  settleConfirm: 'តើអ្នកពិតជាចង់ទូទាត់សមតុល្យនេះមែនទេ?',
  saved: 'បានរក្សាទុករួចរាល់',
  saveFailed: 'រក្សាទុកមិនបាន សូមព្យាយាមម្តងទៀត',
  date: 'កាលបរិច្ឆេទ',
  type: 'ប្រភេទ',
  amount: 'ចំនួនទឹកប្រាក់',
  note: 'កំណត់សម្គាល់',
  total: 'សរុប',
  all: 'ទាំងអស់',
  typeFilter: 'ចម្រាស់តាមប្រភេទ',
  recent: 'ប្រតិបត្តិការថ្មីៗ',
  viewAll: 'មើលទាំងអស់',
  noData: 'មិនទាន់មានទិន្នន័យនៅឡើយ',
  login: 'ចូលប្រើ',
  username: 'ឈ្មោះគណនី',
  password: 'ពាក្យសម្ងាត់',
  logout: 'ចាកចេញ',
  loading: 'កំពុងផ្ទុក...',
  retry: 'ព្យាយាមម្តងទៀត',
  exportCsv: 'ទាញយក CSV',
  search: 'ស្វែងរក',
  yes: 'បាទ / ចាស',
  no: 'ទេ',
  confirm: 'បញ្ជាក់',
  voided: 'បានលុប',
  error: 'មានបញ្ហាកើតឡើង',
};

export const errorMessages = {
  VALIDATION_ERROR: 'ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ សូមពិនិត្យឡើងវិញ',
  UNAUTHORIZED: 'សូមចូលប្រើគណនីឡើងវិញ',
  INVALID_CREDENTIALS: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ',
  TOO_MANY_ATTEMPTS: 'បានព្យាយាមច្រើនដង សូមរង់ចាំបន្តិច',
  NOT_FOUND: 'រកមិនឃើញទិន្នន័យនេះទេ',
  CONFLICT: 'ទិន្នន័យនេះមានរួចហើយ',
  NOTHING_TO_SETTLE: 'មិនមានសមតុល្យត្រូវទូទាត់ទេ',
  NETWORK: 'មិនអាចភ្ជាប់ប្រព័ន្ធបានទេ សូមពិនិត្យអ៊ីនធឺណិត',
  INTERNAL_ERROR: 'មានបញ្ហាបច្ចេកទេស សូមព្យាយាមម្តងទៀត',
};

export function errorMessage(error) {
  // Field-level messages from the backend are the most specific.
  const details = error?.details;
  if (details && typeof details === 'object') {
    const specific = Object.values(details).find((value) => typeof value === 'string' && value.trim());
    if (specific) return specific;
  }
  if (error?.code && errorMessages[error.code]) return errorMessages[error.code];
  if (error?.message) return error.message;
  return labels.error;
}
