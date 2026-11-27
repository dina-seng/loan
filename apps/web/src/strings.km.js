// Every user-facing Khmer string lives here. Components must not contain Khmer
// text of their own — import from this file instead. WORDING.md explains the
// glossary and why each phrase was chosen.

export const RIER = '៛';

export const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
export const numerals = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
export const khmerDigits = { '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4', '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9' };

export const labels = {
  // app chrome
  appName: 'បញ្ជីហិរញ្ញវត្ថុ',
  loginTitle: 'បញ្ជីហិរញ្ញវត្ថុ',
  loginSubtitle: 'រវាងប៉ា និងដៃគូ',
  loginHint: 'សូមប្រើគណនីដែលបានកំណត់ឱ្យប៉ា',
  loading: 'កំពុងផ្ទុក...',

  // screens
  dashboard: 'ផ្ទាំងសង្ខេប',
  history: 'ប្រវត្តិ',

  // the four entry types
  lend: 'ឱ្យខ្ចី',
  product: 'ទំនិញ',
  settleIn: 'ទូទាត់ចូល',
  settleOut: 'ទូទាត់ចេញ',

  // balance
  balanceHeadline: 'ត្រូវទូទាត់',
  theyOweUs: 'គេជំពាក់យើង',
  weOweThem: 'យើងជំពាក់គេ',
  cleared: 'ស្មើរួចរាល់',
  settle: 'ទូទាត់រួច',
  settleConfirm: 'តើអ្នកពិតជាចង់ទូទាត់សមតុល្យនេះមែនទេ?',

  // people
  partner: 'ឈ្មោះ',
  partnerName: 'ឈ្មោះ',
  partnerRequired: 'សូមបញ្ចូលឈ្មោះដៃគូ',
  selectPartner: 'ជ្រើសរើសដៃគូ',
  addPartner: 'បន្ថែមដៃគូ',
  editName: 'កែឈ្មោះ',

  // actions
  add: 'បន្ថែម',
  save: 'រក្សាទុក',
  cancel: 'បោះបង់',
  delete: 'លុប',
  deleteConfirm: 'តើអ្នកពិតជាចង់លុបមែនទេ?',
  confirm: 'បញ្ជាក់',
  saved: 'បានរក្សាទុករួចរាល់',
  saveFailed: 'រក្សាទុកមិនបាន សូមព្យាយាមម្តងទៀត',

  // form fields
  date: 'កាលបរិច្ឆេទ',
  type: 'ប្រភេទ',
  amount: 'ចំនួនទឹកប្រាក់',
  note: 'កំណត់សម្គាល់',
  username: 'ឈ្មោះគណនី',
  password: 'ពាក្យសម្ងាត់',
  login: 'ចូលប្រើ',
  logout: 'ចាកចេញ',

  // lists
  all: 'ទាំងអស់',
  recent: 'ប្រតិបត្តិការថ្មីៗ',
  viewAll: 'មើលទាំងអស់',
  noData: 'មិនទាន់មានទិន្នន័យនៅឡើយ',
  voided: 'បានលុប',
  exportCsv: 'ទាញយក CSV',
  search: 'ស្វែងរក',

  // validation
  dateRequired: 'សូមជ្រើសរើសកាលបរិច្ឆេទ',
  amountRequired: 'សូមបញ្ចូលចំនួនទឹកប្រាក់',

  error: 'មានបញ្ហាកើតឡើង',
};

export const errors = {
  VALIDATION_ERROR: 'ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ សូមពិនិត្យឡើងវិញ',
  UNAUTHORIZED: 'សូមចូលប្រើគណនីឡើងវិញ',
  INVALID_CREDENTIALS: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ',
  TOO_MANY_ATTEMPTS: 'បានព្យាយាមច្រើនដង សូមរង់ចាំបន្តិច',
  NOT_FOUND: 'រកមិនឃើញទិន្នន័យនេះទេ',
  CONFLICT: 'ទិន្នន័យនេះមានរួចហើយ',
  NOTHING_TO_SETTLE: 'មិនមានសមតុល្យត្រូវទូទាត់ទេ',
  NETWORK: labels.saveFailed,
  INTERNAL_ERROR: labels.saveFailed,
};

/** Prefer the field-level message, then the Khmer text for the code. */
export function errorMessage(error) {
  const details = error?.details;
  if (details && typeof details === 'object') {
    const specific = Object.values(details).find((value) => typeof value === 'string' && value.trim());
    if (specific) return specific;
  }
  if (error?.code && errors[error.code]) return errors[error.code];
  if (error?.message) return error.message;
  return labels.error;
}
