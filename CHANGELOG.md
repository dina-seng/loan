# កំណត់ត្រានៃការផ្លាស់ប្តូរ — CHANGELOG

## [2.0.0] - 2026-11-10

### 1. Fix Known Bugs (ការជួសជុលបញ្ហាដែលបានរកឃើញ)
- **Product Dates Formatting:** ជួសជុលបញ្ហាដែលកាលបរិច្ឆេទបង្ហាញជា `"Tue Nov 10 2026 00:00:00 GMT+0700"`។ ឥឡូវនេះ Google Apps Script ប្រើ `Utilities.formatDate` ជាមួយ Timezone `Asia/Phnom_Penh` រក្សាទុក និងត្រឡប់ជាទម្រង់ `yyyy-mm-dd` ជានិច្ច ព្រមទាំងលុបបំបាត់ការប្រើ `toISOString` ដែលអាចរំកិលថ្ងៃរវាង UTC និង UTC+7។
- **Top Summary Cards & Headline Settlement:** ជំនួសកាតសង្ខេបចាស់ដែលមិនរាប់បញ្ចូលទំនិញ ដោយកាត ៤ យ៉ាងច្បាស់លាស់៖
  1. ប្រាក់បានឱ្យខ្ចីសរុប (Total Lent)
  2. ទទួលសង / សងត្រឡប់ (Total Repaid / Refunded)
  3. តម្លៃទំនិញសរុប (Product Value)
  4. **សមតុល្យទូទាត់សរុប (Headline Settlement Card)** ដែលគណនាដោយរូបមន្តរួមតែមួយគត់:
     $$\text{Balance} = \text{Lend} - \text{Repay} - \text{ProductValue} + \text{Refund}$$
- **3-State Settlement Status:** កំណត់ស្ថានភាពជា ៣ សភាពយ៉ាងច្បាស់លាស់ ដោយគ្មានលេខអវិជ្ជមានដែលគ្មានស្លាកសញ្ញា៖
  - **អ្នកខ្ចីជំពាក់លោកប៉ា (Borrower owes dad):** ពណ៌ទឹកក្រូច (Amber)
  - **ទូទាត់រួចរាល់ស្មើគ្នា (Cleared):** ពណ៌បៃតង (Green)
  - **លោកប៉ាត្រូវបើកសងអ្នកខ្ចី (Dad owes borrower):** ពណ៌ខៀវ (Blue)
- **Positive Numbers in Transaction Log:** កែប្រែចំនួនទឹកប្រាក់ឱ្យខ្ចីដែលពីមុនបង្ហាញសញ្ញាដក (`-1,000,000៛`) ឱ្យបង្ហាញជាចំនួនវិជ្ជមានវិញ ជាមួយ Badge ប្រភេទប្រតិបត្តិការ (`Lend`, `Repay`, `Refund`) និងពណ៌ច្បាស់លាស់។
- **FAB Overlap on Small Phones:** បន្ថែម Bottom Padding លើកម្រិត `pb-36` ក្នុង `<main>` container ការពារមិនឱ្យ Floating Action Buttons បាំងជួរទិន្នន័យលើទូរស័ព្ទដៃអេក្រង់តូច។
- **Comprehensive Monthly Table:** កែប្រែតារាងប្រចាំខែឱ្យបង្ហាញជួរឈរពេញលេញ៖
  `ខែ (Month) | ឱ្យខ្ចី (Lent) | ទទួលសង (Repaid) | ទំនិញ (Products) | សងត្រឡប់ (Refunded) | សមតុល្យខែ (Net) | សមតុល្យបន្ត (Running Balance) | ស្ថានភាព (Status)`

### 2. Product Tab Enhancements (ការអភិវឌ្ឍផ្ទាំងទំនិញ)
- **Item Name Field:** បន្ថែមប្រអប់ស្រេចចិត្តសម្រាប់ឈ្មោះទំនិញ (Item Name ឧ. ស្រូវ, ត្រី, បន្លែ)។ ជួរឈរក្នុង Sheet: `["ID", "Date", "Borrower", "Item", "Quantity", "Unit price", "Total", "Note"]`។
- **Decimal Quantities:** បរិមាណអាចវាយទសភាគរហូតដល់ ២ ខ្ទង់ (ឧ. 2.5 kg) ហើយតម្លៃសរុបគណនាជាចំនួនគត់រៀល `Math.round(quantity * unitPrice)` ផ្ទាល់ពេលកំពុងវាយ។
- **Delete Product:** បន្ថែមប៊ូតុងលុបទំនិញជាមួយផ្ទាំងបញ្ជាក់ការលុប (Confirm dialog) តាមរយៈ Action `delete_product`។
- **Quick Entry Support:** ក្រោយពេលចុចរក្សាទុក ប្រព័ន្ធរក្សាទុកឈ្មោះអ្នកខ្ចី និងកាលបរិច្ឆេទដដែល ដោយលុបស្អាតតែបរិមាណ តម្លៃឯកតា មុខទំនិញ និងកំណត់សម្គាល់ រួចរាល់សម្រាប់កត់ត្រាទំនិញបន្ទាប់ភ្លាមៗ។

### 3. Month Settlement & Locking (ការទូទាត់ និងចាក់សោខែ)
- **Settle Month Action:** បន្ថែមប៊ូតុង "ទូទាត់ខែ" សម្រាប់អ្នកខ្ចីម្នាក់ៗតាមខែ បង្ហាញតួលេខលម្អិត (កម្ចី, សង, ទំនិញ, សងត្រឡប់, សមតុល្យ និងទិសដៅ)។
- **Settlement Row & Auto-Payment:** កត់ត្រាការទូទាត់ចូលផ្ទាំងថ្មី `Settlements` (`ID, Month, Borrower, Balance before, Paid, Direction, Carried over, Date`) និងបង្កើតជួរ `Repay` ឬ `Refund` ស្វ័យប្រវត្តិក្នង `Transactions`។
- **Automatic Carry-Over:** ប្រសិនបើសងមិនទាន់គ្រប់ សមតុល្យដែលនៅសល់នឹងត្រូវបន្តចូល Running balance នៃខែបន្ទាប់ដោយស្វ័យប្រវត្តិ។
- **Month Locking:** ចាក់សោខែដែលបានទូទាត់រួច ដោយបដិសេធការ Add/Delete ក្នុងខែនោះ (`month_settled`)។
- **Reopen Month:** អនុញ្ញាតឱ្យបើកខែឡើងវិញបានលុះត្រាតែអ្នកប្រើប្រាស់វាយឈ្មោះអ្នកខ្ចីឱ្យដូចបេះបិទក្នុង Dialog បញ្ជាក់។

### 4. Borrower Handling & Normalization (ការគ្រប់គ្រងឈ្មោះអ្នកខ្ចី)
- **Dropdown with "+ Add new borrower":** ប្រអប់អ្នកខ្ចីជា Dropdown ជានិច្ចជាមួយជម្រើសជ្រើសរើសអ្នកខ្ចីចុងក្រោយ ឬបន្ថែមថ្មី។
- **Comprehensive Normalization:** សម្អាតចន្លោះទទេ, លុប Zero-width characters (`\u200B\u200C\u200D\uFEFF`), Unicode NFC normalization, និងប្រៀបធៀបមិនប្រកាន់ Case ទាំងក្នុង Frontend និង Backend។
- **Rename / Merge Borrower:** Action `rename_borrower` ធ្វើបច្ចុប្បន្នភាពឈ្មោះព្រមគ្នាក្នុង `Transactions`, `Products`, និង `Settlements`។

### 5. Backend Hardening (Apps Script Code.gs)
- **Script Properties Validation:** បដិសេធភ្លាមៗប្រសិនបើ `APP_USER` ឬ `APP_PASS` មិនទាន់កំណត់ (`server_misconfigured`)។
- **Server-Side Validation:** ផ្ទៀងផ្ទាត់ប្រភេទ (`Lend`, `Repay`, `Refund`), ចំនួនទឹកប្រាក់វិជ្ជមាន, កាលបរិច្ឆេទពិតប្រាកដ, និងបរិមាណទំនិញ។
- **Idempotency:** ត្រួតពិនិត្យ ID ដែលមានស្រាប់ ត្រឡប់ `{ ok: true, duplicate: true }` ការពារការចុច ២ ដង។
- **Formula Injection Prevention:** បន្ថែមសញ្ញា `'` ពីមុខអត្ថបទដែលចាប់ផ្តើមដោយ `=`, `+`, `-`, `@`។
- **LockService Concurrency:** រុំការសរសេរទាំងអស់ក្នុង `lock.waitLock(10000)`។
- **doGet Health Check:** បន្ថែម Endpoint `doGet` ដែលត្រឡប់ `{ ok: true, message: "online" }` ដោយមិនបង្ហាញទិន្នន័យ។
- **setupSummary Enhancement:** រូបមន្តគណនាសមតុល្យរួម និង Monthly table ត្រូវគ្នានឹង Website ១០០% ព្រមទាំងដាក់ឈ្មោះ Function មិនបញ្ចប់ដោយ `_` ដើម្បីអាច Run ពី Apps Script menu បាន។

### 6. Security & Privacy
- បន្ថែម `<meta name="robots" content="noindex,nofollow" />` ក្នុង `index.html`។
- បង្កើត `public/robots.txt` (`User-agent: *`, `Disallow: /`)។
- ពាក្យសម្ងាត់ផ្ញើតែក្នុង POST body មិនបង្ហាញក្នុង URL ឬ Console Logs ឡើយ។

### 7. UX & Backups
- បំលែងលេខខ្មែរ (០-៩) ទៅជាលេខអារ៉ាប់ (0-9) ផ្ទាល់ពេលកំពុងវាយ។
- បន្ថែមប៊ូតុង "📥 CSV កម្ចី" និង "📥 CSV ទំនិញ" ជាមួយ UTF-8 BOM សម្រាប់ Backup ទិន្នន័យ។
