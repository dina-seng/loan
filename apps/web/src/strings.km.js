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
  tools: 'ឧបករណ៍',
  products: 'ទំនិញ',
  deliveries: 'ការដឹកជញ្ជូន',
  settlements: 'ការទូទាត់',
  closings: 'បិទកំឡុងពេល',
  statements: 'របាយការណ៍',
  periodReport: 'របាយការណ៍តាមកំឡុងពេល',
  audit: 'ប្រវត្តិកែប្រែ',

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
  addProduct: 'បន្ថែមទំនិញ',
  addDelivery: 'បន្ថែមទំនិញដឹកជញ្ជូន',
  addSettlement: 'បន្ថែមការទូទាត់',
  addLine: 'បន្ថែមជួរ',
  removeLine: 'លុបជួរ',
  selectProduct: 'ជ្រើសរើសទំនិញ',
  preview: 'មើលជាមុន',
  close: 'បិទ',
  reopen: 'បើកឡើងវិញ',
  deactivate: 'បិទប្រើប្រាស់',
  downloadCsv: 'ទាញយក CSV',
  viewStatement: 'មើលរបាយការណ៍',

  // form fields
  date: 'កាលបរិច្ឆេទ',
  type: 'ប្រភេទ',
  amount: 'ចំនួនទឹកប្រាក់',
  note: 'កំណត់សម្គាល់',
  username: 'ឈ្មោះគណនី',
  password: 'ពាក្យសម្ងាត់',
  login: 'ចូលប្រើ',
  logout: 'ចាកចេញ',
  productName: 'ឈ្មោះទំនិញ',
  unit: 'ឯកតា',
  quantity: 'បរិមាណ',
  unitPrice: 'តម្លៃឯកតា',
  lineTotal: 'សរុបជួរ',
  defaultUnitPrice: 'តម្លៃឯកតាលំនាំដើម',
  direction: 'ទិសដៅទូទាត់',
  partnerToDad: 'ដៃគូ → ប៉ា',
  dadToPartner: 'ប៉ា → ដៃគូ',
  method: 'វិធីទូទាត់',
  cash: 'សាច់ប្រាក់',
  bank: 'ធនាគារ',
  other: 'ផ្សេង',
  fullBalance: 'ទូទាត់សមតុល្យទាំងអស់',
  partialPayment: 'ទូទាត់ផ្នែក',
  openingBalance: 'សមតុល្យដើម',
  status: 'ស្ថានភាព',
  reference: 'លេខយោង',
  reason: 'មូលហេតុ',
  periodStart: 'ថ្ងៃចាប់ផ្តើម',
  periodEnd: 'ថ្ងៃបញ្ចប់',
  closedAt: 'ថ្ងៃបិទ',
  balanceAfter: 'សមតុល្យក្រោយ',
  actor: 'អ្នកធ្វើ',
  action: 'សកម្មភាព',

  // totals
  totalLent: 'សរុបឱ្យខ្ចី',
  totalProductValue: 'សរុបតម្លៃទំនិញ',
  receivedPayments: 'ប្រាក់ទូទាត់ចូល',
  outgoingPayments: 'ប្រាក់ទូទាត់ចេញ',
  transactionCount: 'ចំនួនប្រតិបត្តិការ',
  netFlow: 'លំហូរសុទ្ធ',
  total: 'សរុប',
  partial: 'ផ្នែក',
  full: 'ពេញ',
  active: 'កំពុងបិទ',
  reopened: 'បានបើកវិញ',

  // lists
  all: 'ទាំងអស់',
  recent: 'ប្រតិបត្តិការថ្មីៗ',
  viewAll: 'មើលទាំងអស់',
  noData: 'មិនទាន់មានទិន្នន័យនៅឡើយ',
  noProducts: 'មិនទាន់មានទំនិញនៅឡើយ',
  noClosings: 'មិនទាន់បិទកំឡុងពេលណាមួយទេ',
  voided: 'បានលុប',
  exportCsv: 'ទាញយក CSV',
  search: 'ស្វែងរក',
  from: 'ចាប់ពី',
  to: 'រហូតដល់',
  thisMonth: 'ខែនេះ',
  lastMonth: 'ខែមុន',
  allTime: 'គ្រប់ពេល',

  // warnings and confirmations
  closedPeriodWarning: 'កាលបរិច្ឆេទនេះស្ថិតក្នុងកំឡុងពេលដែលបានបិទហើយ។ ថ្ងៃបិទចុងក្រោយ {last}។ ថ្ងៃដំបូងដែលអាចបញ្ចូលបាន {earliest}។',
  closedPeriodDefault: 'កាលបរិច្ឆេទត្រូវបានកំណត់ទៅថ្ងៃដំបូងដែលអាចបញ្ចូលបាន។',
  closeConfirm: 'តើអ្នកពិតជាចង់បិទកំឡុងពេលនេះមែនទេ? ការបិទអាចបើកវិញបានតែដោយប៉ា។',
  reopenConfirm: 'តើអ្នកពិតជាចង់បើកកំឡុងពេលនេះឡើងវិញមែនទេ?',
  deactivateConfirm: 'តើអ្នកពិតជាចង់បិទប្រើប្រាស់ទំនិញនេះមែនទេ?',
  previewNote: 'មើលជាមុនមិនប្តូរទិន្នន័យទេ',
  ownerOnly: 'សូមប្រើគណនីប៉ាសម្រាប់សកម្មភាពនេះ',

  // validation
  dateRequired: 'សូមជ្រើសរើសកាលបរិច្ឆេទ',
  amountRequired: 'សូមបញ្ចូលចំនួនទឹកប្រាក់',
  productRequired: 'សូមជ្រើសរើស ឬបញ្ចូលឈ្មោះទំនិញ',
  quantityRequired: 'សូមបញ្ចូលបរិមាណ',
  unitPriceRequired: 'សូមបញ្ចូលតម្លៃឯកតា',
  linesRequired: 'ត្រូវមានទំនិញយ៉ាងតិចមួយ',
  rangeRequired: 'សូមជ្រើសរើសថ្ងៃចាប់ផ្តើម និងថ្ងៃបញ្ចប់',
  rangeInvalid: 'ថ្ងៃបញ្ចប់ត្រូវនៅក្រោយថ្ងៃចាប់ផ្តើម',
  reasonRequired: 'សូមបញ្ចូលមូលហេតុ',

  error: 'មានបញ្ហាកើតឡើង',
};

export const errors = {
  VALIDATION_ERROR: 'ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ សូមពិនិត្យឡើងវិញ',
  UNAUTHORIZED: 'សូមចូលប្រើគណនីឡើងវិញ',
  INVALID_CREDENTIALS: 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ',
  ACCOUNT_DISABLED: 'គណនីនេះត្រូវបានបិទ',
  TOO_MANY_ATTEMPTS: 'បានព្យាយាមច្រើនដង សូមរង់ចាំបន្តិច',
  FORBIDDEN: labels.ownerOnly,
  NOT_FOUND: 'រកមិនឃើញទិន្នន័យនេះទេ',
  CONFLICT: 'ទិន្នន័យនេះមានរួចហើយ',
  NOTHING_TO_SETTLE: 'មិនមានសមតុល្យត្រូវទូទាត់ទេ',
  PERIOD_CLOSED: 'កាលបរិច្ឆេទនេះស្ថិតក្នុងកំឡុងពេលដែលបានបិទហើយ',
  PERIOD_OVERLAP: 'កំឡុងពេលនេះត្រួតគ្នានឹងកំឡុងពេលដែលបានបិទរួច',
  PERIOD_HAS_LATER_CLOSING: 'សូមបើកកំឡុងពេលក្រោយជាមុនសិន',
  PRODUCT_NOT_FOUND: 'រកមិនឃើញទំនិញនេះទេ',
  NETWORK: labels.saveFailed,
  INTERNAL_ERROR: labels.saveFailed,
};

// These codes carry a composed Khmer message from the backend that includes
// dates. Prefer it over field-level details (which may contain machine ids).
const MESSAGE_FIRST = new Set(['PERIOD_CLOSED', 'PERIOD_OVERLAP', 'PERIOD_HAS_LATER_CLOSING']);

/** Prefer the field-level message, then the Khmer text for the code. */
export function errorMessage(error) {
  if (error?.code && MESSAGE_FIRST.has(error.code) && error.message) return error.message;
  const details = error?.details;
  if (details && typeof details === 'object') {
    const specific = Object.values(details).find((value) =>
      typeof value === 'string' && value.trim() && !/^[0-9a-f-]{36}$/i.test(value));
    if (specific) return specific;
  }
  if (error?.code && errors[error.code]) return errors[error.code];
  if (error?.message) return error.message;
  return labels.error;
}

/** Fill the closed-period warning with the dates supplied by the API. */
export function closedPeriodMessage(details) {
  return labels.closedPeriodWarning
    .replace('{last}', details?.lastClosedDate || '')
    .replace('{earliest}', details?.earliestAllowedDate || '');
}
