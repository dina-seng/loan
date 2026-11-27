# Wording — ពាក្យប្រើប្រាស់

Every user-facing Khmer string lives in `apps/web/src/strings.km.js`. Components import from
that file and contain no Khmer text of their own, so a wording change is a one-file change.
The API returns `code` values (and optional field-level Khmer messages); the browser maps those
codes to Khmer through the same file.

Rule of thumb: the screens stay Khmer-only. No English labels, no mixed sentences.

## Glossary

| Term | Khmer | Meaning | Where | Colour |
|---|---|---|---|---|
| Lend | ឱ្យខ្ចី | cash we gave the partner (they owe more) | add buttons, history chips, filter | orange / amber |
| Product | ទំនិញ | value of goods we received (they owe less) | add buttons, history chips, filter | green |
| Settle | ទូទាត់រួច | the one button that clears the whole balance | dashboard button, confirm title | green |
| Balance headline | ត្រូវទូទាត់ | label above the balance amount | dashboard card | follows the state |
| They owe us | គេជំពាក់យើង | balance is positive | dashboard card, partner list | amber |
| We owe them | យើងជំពាក់គេ | balance is negative | dashboard card, partner list | blue |
| Cleared | ស្មើរួចរាល់ | balance is exactly zero | dashboard card, partner list | green |
| Person | ឈ្មោះ | the partner's name | partner picker, page subtitle | — |

Actions: **បន្ថែម** (add), **រក្សាទុក** (save), **លុប** (delete).
Feedback: **បានរក្សាទុករួចរាល់** (saved), **រក្សាទុកមិនបាន សូមព្យាយាមម្តងទៀត** (save failed),
**តើអ្នកពិតជាចង់លុបមែនទេ?** (delete confirm).

## Why these words

- **ឱ្យខ្ចី** is the everyday phrase for handing money over as a loan; it names the direction
  from our side, which matches the positive balance.
- **ទំនិញ** is simply "goods". The app records only the value of what was received, so a
  longer phrase about quantity or unit price would promise detail the screen does not ask for.
- **ទូទាត់រួច** reads as "settled". It is the single action, so it is the button label; the
  confirm dialog asks the question form, **តើអ្នកពិតជាចង់ទូទាត់សមតុល្យនេះមែនទេ?**.
- **ត្រូវទូទាត់** is the headline because it describes the amount itself ("to be settled"),
  while **គេជំពាក់យើង** / **យើងជំពាក់គេ** describe who owes whom.
- **ឈ្មោះ** keeps the partner picker short; the header already says whose ledger is open.

## Numbers and money

- Money is always a positive whole number of riel with the ៛ sign: `៛5,000,000`.
- The balance is never shown as a bare negative number. It is a sentence with a colour:
  គេជំពាក់យើង (amber) or យើងជំពាក់គេ (blue), and ស្មើរួចរាល់ (green) at zero.
- A row's amount keeps its `+` / `−` sign because the row shows one entry, not a balance.
- Dates are plain `yyyy-mm-dd` and are formatted as «២៧ វិច្ឆិកា ២០២៦» without ever converting
  through `toISOString` or a timestamp, so the Cambodia date never shifts.
