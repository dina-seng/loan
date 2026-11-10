# ឯកសារណែនាំ — DOCUMENT (Complete Setup & Operations Guide)

## ១. របៀបដែលប្រព័ន្ធដំណើរការ (Architecture & Workflow)

```
┌─────────────────────────────────┐        POST text/plain (JSON)        ┌──────────────────────────────────┐
│                                 │ ───────────────────────────────────► │                                  │
│   Frontend Website (React/Vite) │                                      │   Google Apps Script (Code.gs)   │
│   on Dad's Phone / Computer     │ ◄─────────────────────────────────── │   (Authenticated Server Engine)  │
│                                 │            JSON Response             │                                  │
└─────────────────────────────────┘                                      └────────────────┬─────────────────┘
                                                                                          │
                                                                                          ▼
                                                                         ┌──────────────────────────────────┐
                                                                         │       Google Sheet Database      │
                                                                         │  • Transactions (Lend/Repay/Ref) │
                                                                         │  • Products (Items Tab)          │
                                                                         │  • Settlements (Locked Months)   │
                                                                         │  • Summary (Dashboard Formulas)  │
                                                                         └──────────────────────────────────┘
```

- **Frontend (React + Vite + Tailwind):** Client application with Noto Sans Khmer typography, instant local conversions of Khmer digits (០-៩ ➔ 0-9), commas while typing, live auto-calculations, and high-contrast accessible settlement banners.
- **Backend (Google Apps Script):** Serverless API running on Google's infrastructure. Authenticates credentials against Script Properties, enforces LockService mutex locks, validates numeric limits, sanitizes text against spreadsheet formula injection, enforces month-locking, and returns dates formatted strictly as `yyyy-mm-dd`.
- **Database (Google Sheets):**
  1. `Transactions`: `[ល.រ, កាលបរិច្ឆេទ, ឈ្មោះអ្នកខ្ចី, ប្រភេទប្រតិបត្តិការ, ចំនួនទឹកប្រាក់, កំណត់សម្គាល់, ID]`
  2. `Products`: `[ID, Date, Borrower, Item, Quantity, Unit price, Total, Note]`
  3. `Settlements`: `[ID, Month, Borrower, Balance before, Paid, Direction, Carried over, Date]`
  4. `Summary`: Formula dashboard calculated using `Settlement = Lend - Repay - ProductValue + Refund`.

---

## ២. រៀបចំ Google Sheet និង Script (Setup / Update Code.gs)

### ២.១ បន្ថែម និង Update កូដក្នុង Apps Script
1. បើក Google Sheets របស់អ្នកនៅ [sheets.google.com](https://sheets.google.com)។
2. ចូលទៅកាន់ម៉ឺនុយ **Extensions (ផ្នែកបន្ថែម)** ➔ **Apps Script**។
3. លុបកូដចាស់ៗចេញ រួចបើកឯកសារ [`apps-script/Code.gs`](apps-script/Code.gs) ក្នុងគម្រោងនេះ ហើយចម្លង (Copy) កូដទាំងអស់ទៅបិទភ្ជាប់ (Paste) ក្នុងផ្ទាំង Apps Script។
4. ចុច **💾 Save** (ឬ `Ctrl + S`)។

### ២.២ ដំណើរការ `setupSummary` ម្តង (Run setupSummary once)
1. នៅលើរបារខាងលើនៃផ្ទាំង Apps Script សូមមើលកន្លែងជ្រើសរើស Function (dropdown)។
2. ជ្រើសរើសពាក្យ **`setupSummary`**។
3. ចុចប៊ូតុង **▶ Run** (ដំណើរការ)។
4. ប្រសិនបើ Google សួររកសិទ្ធិ (Authorization), ចុច **Review Permissions** ➔ ជ្រើសរើសគណនី Google របស់អ្នក ➔ ចុច **Advanced** ➔ ចុច **Go to (project) (unsafe)** ➔ ចុច **Allow**។
5. ផ្ទាំង `Summary` នឹងត្រូវបង្កើតឡើងដោយស្វ័យប្រវត្តិជាមួយរូបមន្តកាត់កងកម្ចី និងទំនិញ ព្រមទាំង Validation សម្រាប់ `Lend`, `Repay`, និង `Refund`។

### ២.៣ កំណត់ Script Properties (Username & Password)
1. នៅលើរបារឆ្វេងដៃនៃ Apps Script ចុចលើរូបកង់ធ្មេញ **⚙ Project Settings**។
2. អូសចុះមកក្រោមត្រង់ **Script Properties**។
3. ចុច **Add script property** ហើយបញ្ចូល៖
   - `APP_USER` = ឈ្មោះគណនី (ឧ. `admin`)
   - `APP_PASS` = ពាក្យសម្ងាត់សុវត្ថិភាព (ឧ. `P@ssw0rd2026!`)
4. ចុច **Save script properties**។

---

## ៣. ការដាក់ឱ្យដំណើរការ (Deploying & Updating Deployment)

> ⚠️ **សំខាន់បំផុតពេល Update កូដ:** ការចុច Save តែមួយមុខ **មិនទាន់** ធ្វើឱ្យ Web App URL ដំណើរការកូដថ្មីនោះទេ។ អ្នកត្រូវតែ Deploy **"New version"** ជានិច្ច!

1. នៅជ្រុងខាងស្តាំខាងលើ ចុចលើ **Deploy** ➔ ជ្រើសរើស **Manage deployments** (គ្រប់គ្រងការដាក់ឱ្យដំណើរការ)។
2. ចុចលើរូបខ្មៅដៃ **✏ Edit** នៅជាប់ deployment សកម្មរបស់អ្នក។
3. ត្រង់កន្លែង **Version**, ចុចជ្រើសរើស **"New version" (កំណែថ្មី)**។
4. ចុច **Deploy** រួចចុច **Done**។
5. Web App URL នឹងនៅដដែល មិនផ្លាស់ប្តូរទេ ហើយប្រព័ន្ធនឹងដំណើរការមុខងារថ្មីភ្លាមៗ!

---

## ៤. របៀបដំណើរការទូទាត់ប្រចាំខែ (Month Settlement Workflow)

### រូបមន្តគណនាសមតុល្យរួម៖
$$\text{Balance} = \text{Lend} - \text{Repay} - \text{ProductValue} + \text{Refund}$$

- **Balance > 0 (ពណ៌ទឹកក្រូច / Amber):** អ្នកខ្ចីនៅជំពាក់លោកប៉ា (Borrower owes dad)។
- **Balance < 0 (ពណ៌ខៀវ / Blue):** លោកប៉ាត្រូវបើកសងអ្នកខ្ចីវិញ (Dad owes borrower) ដោយសារតម្លៃទំនិញលើសបំណុលកម្ចី។
- **Balance = 0 (ពណ៌បៃតង / Green):** ទូទាត់រួចរាល់ដាច់ស្មើគ្នា (Cleared)។

### ជំហានទូទាត់ប្រចាំខែ (Settle Month):
1. ជ្រើសរើសឈ្មោះអ្នកខ្ចីជាក់លាក់ណាម្នាក់ (ឧ. សុខា) ក្នុង dropdown នៅលើ Dashboard។
2. ក្នុងតារាងប្រចាំខែ (Monthly Table) ចុចលើប៊ូតុង **"ទូទាត់ខែ (Settle month)"** នៅខែដែលចង់ទូទាត់។
3. ផ្ទាំងផ្ទៀងផ្ទាត់នឹងបង្ហាញ៖
   - ប្រាក់បានឱ្យខ្ចី (Lent)
   - ប្រាក់បានទទួលសង (Repaid)
   - តម្លៃទំនិញបានផ្គត់ផ្គង់ (Products)
   - ប្រាក់បានសងត្រឡប់ (Refunded)
   - ទិសដៅនៃការទូទាត់ (អ្នកណាត្រូវសងអ្នកណា)
4. បញ្ចូលចំនួនទឹកប្រាក់ដែលបានទូទាត់ជាក់ស្តែង (Actual Paid Amount):
   - ប្រសិនបើទូទាត់គ្រប់ចំនួន: សមតុល្យខែនោះក្លាយជា 0។
   - ប្រសិនបើទូទាត់មិនទាន់គ្រប់ (Partial payment): ចំនួនដែលនៅសល់នឹងត្រូវបានបន្ត (Carried over) ទៅក្នុងសមតុល្យបន្ត (Running balance) នៃខែបន្ទាប់ដោយស្វ័យប្រវត្តិ។
5. ចុច **"បញ្ជាក់ការទូទាត់ (Confirm)"**:
   - ប្រព័ន្ធនឹងកត់ត្រាចូលផ្ទាំង `Settlements` ក្នុង Google Sheet។
   - បន្ថែមជួរប្រតិបត្តិការ `Repay` ឬ `Refund` ស្វ័យប្រវត្តិក្នង `Transactions` ជាមួយកំណត់សម្គាល់ `Month settlement YYYY-MM`។
   - ខែនោះនឹងត្រូវ **ចាក់សោ (Locked)** មិនឱ្យមានការបន្ថែម ឬលុបប្រតិបត្តិការ និងទំនិញក្នុងខែនោះទៀតឡើយ (`month_settled`)។

### របៀបបើកខែឡើងវិញ (Reopen Month):
1. ប្រសិនបើមានការកត់ត្រាខុស ចុចលើ **"បើកខែឡើងវិញ (Reopen month)"** លើខែដែលបានទូទាត់រួច។
2. ដើម្បីការពារការច្រឡំដៃ ប្រព័ន្ធតម្រូវឱ្យអ្នកប្រើប្រាស់វាយឈ្មោះអ្នកខ្ចី (ឧ. `Sokha`) ឱ្យបានត្រឹមត្រូវ។
3. នៅពេលបញ្ជាក់ ប្រព័ន្ធនឹងលុបជួរ Settlement និងប្រតិបត្តិការកាត់កងស្វ័យប្រវត្តិ ដោះសោខែនោះឱ្យដំណើរការជាប្រក្រតីវិញ។

---

## ៥. ការធ្វើតេស្តលើទូរស័ព្ទដៃផ្ទាល់ជាមួយ ngrok (Local Phone Testing)

ដើម្បីបើកតេស្ត Website ពីទូរស័ព្ទដៃរបស់លោកប៉ាពេលកំពុង Run local:

1. **ដំឡើង ngrok** (ប្រសិនបើមិនទាន់មាន):
   ```powershell
   winget install ngrok
   ```
2. **បើក Dev server ក្នុងគម្រោង:**
   ```powershell
   npm run dev
   ```
3. **បើក Terminal ថ្មីមួយទៀត ហើយ Run ngrok ទៅកាន់ Port 5173:**
   ```powershell
   ngrok http 5173
   ```
4. **កំណត់ Allowed Hosts ក្នុង Vite:**
   ឯកសារ `vite.config.js` ត្រូវបានកំណត់រួចជាស្រេចដើម្បីទទួល `.ngrok-free.app` និង `.ngrok-free.dev`:
   ```javascript
   server: {
     allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev'],
   }
   ```
5. ចម្លងអាសយដ្ឋាន HTTPS (ឧ. `https://xxxx.ngrok-free.app`) ទៅបើកក្នុង Safari/Chrome លើទូរស័ព្ទដៃរបស់លោកប៉ាដើម្បីតេស្តផ្ទាល់។

---

## ៦. ការដាក់ Hosting លើ Subdomain នៃ dinacreator.space (Custom Domain Hosting)

ដើម្បីដាក់ឱ្យលោកប៉ាប្រើប្រាស់ជាអចិន្ត្រៃយ៍លើ Subdomain ផ្ទាល់ខ្លួន (ឧ. `loan.dinacreator.space`):

### ជំហានទី ១: Deploy លើ Vercel ឬ Netlify
1. រុញកូដ (Push) ទៅកាន់ GitHub Repository។
2. ចូលទៅកាន់ [vercel.com](https://vercel.com) ➔ ចុច **Add New... ➔ Project** ➔ Import repository នេះ។
3. កំណត់ **Environment Variable**:
   - `VITE_APPS_SCRIPT_URL` = (Web App URL នៃ Apps Script របស់អ្នក)
4. ចុច **Deploy**។

### ជំហានទី ២: កំណត់ Custom Subdomain លើ Vercel
1. ក្នុង Vercel Dashboard នៃ Project ➔ ចូលទៅ **Settings ➔ Domains**។
2. វាយបញ្ចូល Subdomain: `loan.dinacreator.space` រួចចុច **Add**។
3. Vercel នឹងបង្ហាញតម្លៃ CNAME record ដែលត្រូវកំណត់ (ឧ. `cname.vercel-dns.com`)។

### ជំហានទី ៣: បន្ថែម DNS CNAME Record ក្នុង Domain Provider របស់អ្នក
1. ចូលទៅកាន់ផ្ទាំងគ្រប់គ្រង DNS នៃ Domain `dinacreator.space` (Cloudflare, Namecheap, ឬ Hostinger)។
2. បន្ថែម Record ថ្មីប្រភេទ **CNAME**:
   - **Type:** `CNAME`
   - **Name (Host):** `loan`
   - **Target (Value):** `cname.vercel-dns.com`
   - **TTL:** Auto ឬ 3600
3. រង់ចាំពី ៥ ទៅ ១៥ នាទី Vercel នឹងដំឡើង SSL Certificate (HTTPS) ដោយស្វ័យប្រវត្តិ។
4. ឥឡូវលោកប៉ាអាចចូលប្រើប្រាស់បានតាមរយៈ `https://loan.dinacreator.space` ដោយសុវត្ថិភាព!

---

## ៧. បញ្ជីត្រួតពិនិត្យផ្ទាល់លើទូរស័ព្ទដៃ (Manual Phone Checklist)

- [ ] **Khmer Numeric Input:** វាយលេខខ្មែរ `១៥០០០០` ក្នុងប្រអប់ទឹកប្រាក់ ➔ ប្រព័ន្ធបំលែងជា `150,000៛` ភ្លាមៗ។
- [ ] **Thousand Separator:** វាយលេខបន្តគ្នាយ៉ាងលឿន ➔ ក្បៀសរាប់ពាន់លោតឡើងស្វ័យប្រវត្តិ។
- [ ] **Product Live Calculation:** វាយបរិមាណ `2.5` និងតម្លៃឯកតា `3,600` ➔ ប្រអប់តម្លៃសរុបលោត `9,000៛` ភ្លាមៗដោយគ្មាន Decimal Error។
- [ ] **Quick Product Entry:** ចុចរក្សាទុកទំនិញ ➔ ឈ្មោះអ្នកខ្ចី និងកាលបរិច្ឆេទនៅរក្សាទុកដដែល ចំណែកបរិមាណនិងតម្លៃត្រូវលុបស្អាត រួចរាល់សម្រាប់កត់ត្រាទំនិញបន្ទាប់។
- [ ] **Positive Amount in Transaction Log:** រាល់ប្រតិបត្តិការទាំងអស់បង្ហាញជាចំនួនវិជ្ជមាន ជាមួយ Badge ពណ៌ និងប្រភេទច្បាស់លាស់ (ឱ្យខ្ចី, ទទួលសង, សងត្រឡប់)។
- [ ] **No Overlap on Small Phones:** អូសចុះក្រោមដល់បាតតារាង ➔ Floating Action Buttons មិនបាំងជួរទិន្នន័យឡើយ (`pb-36` padding)។
- [ ] **Month Locking:** សាកល្បងបន្ថែមប្រតិបត្តិការក្នុងខែដែលបានទូទាត់រួច ➔ ប្រព័ន្ធបង្ហាញសារព្រមានច្បាស់លាស់ថាមិនអាចបន្ថែមបានទេព្រោះខែបានចាក់សោរួច។
- [ ] **Export CSV:** ចុចប៊ូតុង "📥 CSV កម្ចី" និង "📥 CSV ទំនិញ" ➔ ទូរស័ព្ទ Download ឯកសារ CSV ដែលមានអក្សរខ្មែរត្រឹមត្រូវមិនបែក Font (UTF-8 BOM)។

---

## ៨. ការដោះស្រាយបញ្ហាទូទៅ (Troubleshooting)

| បញ្ហា (Issue) | មូលហេតុ (Cause) | ដំណោះស្រាយ (Solution) |
|---|---|---|
| `unknown_action` | Apps Script នៅដំណើរការ Deployment ចាស់ | ចូល Apps Script ➔ **Deploy ➔ Manage deployments ➔ Edit ➔ ជ្រើសរើស "New version"** ➔ Deploy |
| `month_settled` | ខែនៃកាលបរិច្ឆេទនោះត្រូវបានទូទាត់បិទរួច | ប្រសិនបើចង់កែប្រែ សូមចុច **"បើកខែឡើងវិញ (Reopen month)"** ក្នុងតារាងប្រចាំខែជាមុនសិន |
| `server_misconfigured` | មិនទាន់បានកំណត់ `APP_USER` ឬ `APP_PASS` | ចូល Apps Script ➔ **Project Settings ➔ Script Properties** រួចបញ្ចូល Username និង Password |
| Product Date បង្ហាញវែង | កាលបរិច្ឆេទជាប់ Format Date របស់ Sheet | Apps Script ថ្មីប្រើ `Utilities.formatDate` ជាមួយ Timezone `Asia/Phnom_Penh` ដោះស្រាយបញ្ហានេះ ១០០% |
| ប៊ូតុងបាំងទិន្នន័យ | កង្វះ Bottom Padding | កំណត់ `pb-36` លើ Container ធានាថាមិនបាំងជួរទិន្នន័យទោះលើទូរស័ព្ទអេក្រង់តូច |
