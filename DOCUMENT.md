# ឯកសារណែនាំ — DOCUMENT (Setup Guide)

## ១. របៀបដែលប្រព័ន្ធដំណើរការ (How the System Works)

```
┌─────────────────────┐       POST (JSON)       ┌─────────────────────┐
│                     │  ──────────────────────► │                     │
│   Website (React)   │                          │  Google Apps Script  │
│   on your phone     │  ◄────────────────────── │  (reads/writes)     │
│                     │       JSON response      │                     │
└─────────────────────┘                          └────────┬────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────────┐
                                                 │   Google Sheet      │
                                                 │   (your data)       │
                                                 └─────────────────────┘
```

- **Website** — the app you open on your phone or computer. It shows transactions, totals, and lets
  you add/delete records. It does NOT store data — all data lives in Google Sheets.
- **Google Apps Script** — a small program that lives inside your Google Sheet. It receives requests
  from the website, reads/writes rows in the sheet, and sends results back.
- **Google Sheet** — your database. Every loan and repayment is one row. You can also add your own
  summary tabs or formulas that read from the "Transactions" tab.

---

## ២. រៀបចំ Google Sheet (Prepare the Google Sheet)

1. Open **Google Sheets** at [sheets.google.com](https://sheets.google.com).
2. Open an **existing spreadsheet** or create a new one.
3. You do NOT need to create a "Transactions" tab manually — the script will create it automatically
   the first time someone logs in.
4. If you already have summary tabs or formulas, they can reference the **Transactions** tab once
   it exists (columns: ល.រ, កាលបរិច្ឆេទ, ឈ្មោះអ្នកខ្ចី, ប្រភេទប្រតិបត្តិការ, ចំនួនទឹកប្រាក់, កំណត់សម្គាល់, ID).
5. Make sure the currency format in your sheet is **៛** (Khmer Riel), not **$**.
   The script sets the format to `#,##0"៛"` automatically for the amount column.

---

## ៣. បន្ថែម Script (Add the Script)

1. In your Google Sheet, go to **Extensions → Apps Script**.
2. This opens the Apps Script editor in a new tab.
3. Delete any code already in the editor (like the empty `myFunction`).
4. Open the file `apps-script/Code.gs` from this project.
5. Copy ALL the code and paste it into the Apps Script editor.
6. Click **💾 Save** (or Ctrl+S).
7. You should see the file named "Code.gs" in the left sidebar.
8. After updating an existing deployment, open **Deploy → Manage deployments**, edit the web app deployment, choose **New version**, and deploy it.

---

## ៤. កំណត់ការចូល (Set the Login Credentials)

1. In the Apps Script editor, click the **⚙ gear icon** on the left sidebar → **Project Settings**.
2. Scroll down to **Script Properties**.
3. Click **Add script property** and add these two:

| Property   | Value                                    |
|------------|------------------------------------------|
| `APP_USER` | Choose a username (e.g., `admin`)        |
| `APP_PASS` | Choose a strong password (e.g., `MyStr0ngP@ss!2024`) |

4. Click **Save script properties**.

> ⚠️ **Important:** Remember this username and password — you will use them to log in to the website.

---

## ៥. Deploy (ដាក់ឱ្យដំណើរការ)

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the **⚙ gear icon** next to "Select type" → choose **Web app**.
3. Set these options:
   - **Description:** `Lending Management` (optional)
   - **Execute as:** `Me` (your Google account)
   - **Who has access:** `Anyone`
4. Click **Deploy**.
5. Google will ask you to **authorize** the script:
   - Click **Authorize access**
   - Choose your Google account
   - If you see "Google hasn't verified this app", click **Advanced → Go to (your project name) (unsafe)**
   - Click **Allow**
6. You will see a **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```
7. **Copy this URL** — you need it in the next step.

---

## ៦. ភ្ជាប់ Frontend (Connect the Frontend)

1. In the project folder, find the file `.env.example`.
2. Copy it and rename the copy to `.env`:
   ```
   cp .env.example .env
   ```
3. Open `.env` and set the URL you copied:
   ```
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
   ```
4. Install dependencies:
   ```
   npm install
   ```
5. Start the dev server:
   ```
   npm run dev
   ```
6. Open the URL shown in the terminal (usually `http://localhost:5173`).
7. Log in with the username and password you set in Step 4.

---

## ៧. បញ្ជីត្រួតពិនិត្យ (Test Checklist)

After setup, test each of these:

- [ ] **Wrong password is rejected** — enter a wrong password, see an error message.
- [ ] **Add a Lend** — fill in the form, choose "ឱ្យខ្ចី (Lend)", enter an amount, click Save.
- [ ] **Row appears in the sheet** — open the Google Sheet, check the Transactions tab.
- [ ] **Add a Repay** — choose "ទទួលសង (Repay)", enter an amount, click Save.
- [ ] **Totals are correct** — dashboard shows correct Total Lent, Total Repaid, Net Outstanding.
- [ ] **Delete works** — click the delete icon on a transaction, confirm, check the sheet.
- [ ] **Borrower summary is correct** — shows "សងរួច (Paid)" when outstanding is 0.
- [ ] **Borrower names are normalized** — extra spaces and invisible zero-width characters are removed when saved.
- [ ] **Rename / merge borrower** — open borrower settings, choose a current name, enter a target name, and confirm; all matching transactions should update.
- [ ] **Monthly table groups correctly** — transactions appear under the right month.

---

## ៨. Hosting ដោយឥតគិតថ្លៃ (Free Hosting — Netlify or Vercel)

### Option A: Netlify

1. Go to [netlify.com](https://netlify.com) and sign up (free).
2. Click **Add new site → Import an existing project**.
3. Connect your GitHub/GitLab repo, or drag and drop your `dist` folder.
4. **Build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Environment variables:**
   - Go to **Site settings → Environment variables**
   - Add: `VITE_APPS_SCRIPT_URL` = your Apps Script URL
6. Click **Deploy**. Netlify gives you a URL like `https://your-site.netlify.app`.

### Option B: Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (free).
2. Click **New Project → Import** your repo.
3. **Framework Preset:** Vite
4. **Environment variables:**
   - Add: `VITE_APPS_SCRIPT_URL` = your Apps Script URL
5. Click **Deploy**. Vercel gives you a URL like `https://your-site.vercel.app`.

> **Important:** After setting/changing the environment variable, you must **redeploy** (trigger a new
> build) for the change to take effect. `VITE_` variables are baked into the build at compile time.

---

## ៩. ធ្វើបច្ចុប្បន្នភាព Script (Updating the Script Later)

If you need to update the Apps Script code:

1. Open the Apps Script editor (Extensions → Apps Script in your Google Sheet).
2. Edit the code and save.
3. Go to **Deploy → Manage deployments**.
4. Click the **✏ pencil icon** next to your deployment.
5. Under "Version", select **New version**.
6. Click **Deploy**.

> The Web app URL stays the same — you do NOT need to change anything in the website or `.env`.

---

## ១០. ការដោះស្រាយបញ្ហា (Troubleshooting)

### "unauthorized" error
- The username or password you entered does not match the Script Properties.
- Go to Apps Script → Project Settings → Script Properties and check `APP_USER` and `APP_PASS`.
- Make sure there are no extra spaces before or after the values.

### CORS or redirect errors
- Make sure you are using **POST** with `Content-Type: text/plain;charset=utf-8`.
- If you see a redirect error, make sure the fetch call includes `redirect: 'follow'`.
- Check that "Who has access" is set to **Anyone** in the deployment settings.

### "Script not authorized" / permission errors
- When you deploy for the first time, you must **authorize** the script to access your Google Sheet.
- If you see this error later, try: Deploy → Manage deployments → edit → redeploy.
- Or go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions) and remove
  the app, then redeploy and re-authorize.

### Changes not showing
- If you updated the Apps Script code, make sure you created a **New version** when redeploying
  (see Step 9 above).
- If you changed the `.env` file, restart the dev server (`npm run dev`) or rebuild (`npm run build`).
- Try clearing browser cache or doing a hard refresh (Ctrl+Shift+R).

### Data looks wrong
- Open the Google Sheet and check the **Transactions** tab directly.
- Make sure all amounts are whole numbers (no decimals).
- Make sure the date format is `yyyy-mm-dd` (e.g., 2024-01-15).
- Make sure the type column contains exactly `Lend` or `Repay` (case-sensitive).
- If you edited rows manually in the sheet, make sure you did not break the ID column (column G).

---

## ១១. កំណត់សម្គាល់អំពីសុវត្ថិភាព (Security Notes)

- **Password storage:** The password is stored in Google Apps Script's **Script Properties**,
  which are server-side and NOT visible in the website's source code.
- **Login protection:** Anyone who knows the Web app URL cannot read or write data without the
  correct username and password. Every request is authenticated.
- **Changing the password:** To change the password, go to Apps Script → Project Settings →
  Script Properties → edit `APP_PASS`. No redeployment needed — the change is immediate.
- **localStorage:** If the user checks "Stay logged in", the username and password are saved in
  the browser's localStorage. This means anyone with access to the phone can use the app.
  To log out, tap the logout button — this clears the saved credentials.
- **HTTPS:** Both the website (when hosted on Netlify/Vercel) and the Apps Script URL use HTTPS,
  so data is encrypted in transit.
- **No backend server:** There is no separate server to maintain or secure. The only backend is
  Google's infrastructure (Apps Script + Sheets).
