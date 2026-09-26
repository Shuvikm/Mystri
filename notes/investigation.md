# Investigation Notes

## Defect 01 — Open invoice filter returns paid invoices

**Priority:** High

**Area:** Invoice filtering / reporting

### Expected behaviour

Selecting `Open invoices` should return only invoices whose
balance is greater than ₹0.00.

The restored fixture has 7 open invoices.

### Reproduction steps

1. Restored the supplied fixture:
   `python restore_fixture.py --replace`
2. Started the application:
   `python app.py`
3. Opened:
   `http://127.0.0.1:8787`
4. Selected `Open invoices` from the invoice filter.

### Actual result

The overview showed:

- Open invoices: 7
- Outstanding: ₹3,698.19

However, the `Open invoices` filter displayed only:

- HARBOR / INV-101 / ₹0.00 / paid
- NORTH / KEEP-702 / ₹0.00 / paid

Both displayed records were actually paid.

### Impact

The owner cannot rely on the open-invoice view to identify outstanding
invoices. This can lead to incorrect follow-up and disagreement between
the overview and register.

### Evidence

Screenshot:
`evidence/defect-01-open-filter-before.png`

### Next investigation

Check the API response for:

`/api/invoices?status=open`

to determine whether the defect is in backend filtering or browser rendering.

## Defect 01 — Open filter returns paid invoices

Priority: High

Area: Reporting / API filtering

Expected:
`GET /api/invoices?status=open` should return only invoices with
a positive balance.

Actual:
The API returned:
- HARBOR / INV-101 / balance 0.00 / status paid
- NORTH / KEEP-702 / balance 0.00 / status paid

The overview reports 7 open invoices, so the filtered result is incorrect.

Reproduction:
1. Restore fixture:
   `python restore_fixture.py --replace`
2. Start:
   `python app.py`
3. Open the register.
4. Select `Open invoices`.
5. Verify the displayed rows.
6. Check:
   `curl.exe "http://127.0.0.1:8787/api/invoices?status=open"`

Impact:
The owner cannot use the open-invoice view for reliable collections
or follow-up because paid invoices appear while actual open invoices
are omitted.

Root-cause investigation:
The backend accepts `status=open`, but its filtering logic is returning
paid invoices.

Evidence:
- Screenshot: `evidence/defect-01-open-filter-before.png`
- API response captured during investigation.
### Backend verification

Command:

curl.exe "http://127.0.0.1:8787/api/invoices?status=open"

Observed response:

[
  {
    "invoice_number": "INV-101",
    "balance": 0.0,
    "status": "paid"
  },
  {
    "invoice_number": "KEEP-702",
    "balance": 0.0,
    "status": "paid"
  }
]

This confirms that the defect is in the backend API filtering,
not only in the browser rendering.

Evidence:
- `evidence/defect-01-open-filter-before.png`
- `evidence/defect-01-api-before.png`
## Defect 02 — Payment matched using amount instead of invoice identity

Priority: High

Area: Payment matching

Expected:
A payment may be attached only to an invoice with the same
customer_id and invoice_number.

Reproduction:
The fixture contains two invoices with the same amount:

- HARBOR / INV-100 / ₹1250.00
- MAPLE / INV-200 / ₹1250.00

Imported the supplied payment CSV:

MAPLE / INV-200 / ₹1250.00

Command:

curl.exe -X POST "http://127.0.0.1:8787/api/import?kind=payments" `
  -H "Content-Type: text/csv" `
  --data-binary "@samples/payments.csv"

Observed:
Import returned:
{"imported": 3, "skipped": 0, "rejected": 0, "errors": []}

After import, INV-100 had:
paid = 1250.00
balance = 0.00
status = paid

INV-200 had:
paid = 0
balance = 1250.00
status = open

Impact:
A payment can be allocated to the wrong customer/invoice, making
the register financially incorrect.

Evidence:
evidence/defect-02-payment-matching-before.png
## Defect 03 — Floating-point precision leaks into balances

Priority: High

Area: Money calculations / reporting

Expected:
For two-decimal currency inputs, calculations must preserve cents and
show/export money to two decimal places.

Actual:
After importing the payment for NORTH / INV-300:

paid = 19.990000000000002
balance = -3.552713678800501e-15

Impact:
Internal floating-point artifacts can leak into API/reporting values and
can cause screen/export disagreements or incorrect currency comparisons.

Evidence:
evidence/defect-03-money-precision-before.png
## Defect 04 — Re-importing identical invoices creates duplicates

Priority: High

Area: Invoice import / duplicate handling

Expected:
Re-importing an invoice with the same
(customer_id, invoice_number), amount and due date must:
- import = 0
- skip = number of duplicate rows
- reject = 0
- leave all totals unchanged

Reproduction:
1. Restored the supplied fixture:
   `python restore_fixture.py --replace`
2. Started the application:
   `python app.py`
3. Imported `samples/invoices-new.csv` once.

First import result:
`{"imported": 2, "skipped": 0, "rejected": 0, "errors": []}`

4. Without resetting the database, imported the exact same file again.

Second import result:
`{"imported": 2, "skipped": 0, "rejected": 0, "errors": []}`

Actual:
The same two invoices were imported again instead of being skipped.

Impact:
Retrying an import can create duplicate invoice records and change
the register totals. This directly matches the owner's observation:
"When I retry an import, the numbers sometimes move again."

Evidence:
- `evidence/defect-04-duplicate-invoice-before.png`

Next verification:
Compare the invoice count/records before the first import and after
the second import to prove that the register changed.
## Defect 04 — Identical invoice re-import creates duplicates

Priority: High

Area: Invoice import / idempotency

Expected:
Re-importing an invoice with the same customer_id, invoice_number,
amount and due_date must skip the row and leave totals unchanged.

Reproduction:

1. Restored the fixture:
   `python restore_fixture.py --replace`

2. Started the application:
   `python app.py`

3. Imported `samples/invoices-new.csv`:

   Result:
   `{"imported": 2, "skipped": 0, "rejected": 0, "errors": []}`

4. Without resetting, imported the exact same file again:

   Result:
   `{"imported": 2, "skipped": 0, "rejected": 0, "errors": []}`

5. Checked the overview and invoice list.

Actual:
The register increased from 9 invoices to 13 invoices.
The two imported invoice identities were inserted twice.

Duplicate records observed:
- HARBOR / INV-102 → IDs 10 and 12
- MAPLE / INV-202 → IDs 11 and 13

The summary changed to:
- invoice_count = 13
- open_count = 11
- outstanding = ₹4,258.19

Expected:
After the second identical import:
- invoice_count = 11
- second import should report imported = 0, skipped = 2
- totals should remain unchanged

Impact:
Retrying an import changes the register and can create duplicate
financial records. This directly affects data integrity and violates
the idempotent import requirement.

Evidence:
- `evidence/defect-04-duplicate-invoice-before.png`
- terminal output showing the two import responses
- `/api/overview` output showing invoice_count = 13
- `/api/invoices?status=all` showing duplicate identities
## Defect 05 — Conflicting invoice identity is imported

Priority: High

Area: Invoice import / identity protection

Expected:
An invoice is identified by `(customer_id, invoice_number)`.

If the same identity is imported with different amount or due date,
the row must be rejected and the original record preserved.

Reproduction:

Existing fixture record:
HARBOR / INV-100 / ₹1250.00 / 2026-09-01

Changed-input case:
HARBOR / INV-100 / ₹999.99 / 2026-09-01

Command:
curl.exe -X POST "http://127.0.0.1:8787/api/import?kind=invoices" `
  -H "Content-Type: text/csv" `
  --data-binary "@$temp"

Observed:
{"imported": 1, "skipped": 0, "rejected": 0, "errors": []}

The subsequent invoice listing contained both:
- HARBOR / INV-100 / ₹1250.00
- HARBOR / INV-100 / ₹999.99

Actual impact:
The same invoice identity can have multiple conflicting records.
This can corrupt the register and make totals unreliable.

Expected:
The conflicting row should be rejected and the original ₹1250.00 record
should remain unchanged.

Evidence:
- evidence/defect-05-conflicting-invoice-before.png
- terminal output showing the import response and duplicate records.
## Payment identity verification — No defect found

The starter correctly:
- rejects a reused payment_id with different details;
- skips an identical payment re-import.

The conflicting-payment test returned `rejected=1`.
The identical-payment test returned `skipped=1`.

No repair required.
## Defect 06 — Invalid data row aborts the entire invoice import

Priority: High

Area: CSV import / partial failure handling

Expected:
An invalid data row should be rejected independently while other valid
rows in the same file are still processed.

Test input:
- Line 2: HARBOR / INV-103 / 84.00 — valid
- Line 3: NORTH / INV-302 / not-a-number — invalid
- Line 4: MAPLE / INV-203 / 100.00 — valid

Expected result:
imported = 2
rejected = 1
HTTP 200
error line = 3

Actual:
[fill in actual status/result]

Impact:
A single bad row prevents valid records from being imported, which can
cause the owner to believe an import completed differently from what
was actually stored.

Evidence:
- evidence/defect-06-mixed-import-before.png

# ClearLedger Investigation Notes

## Defect 01 — Open invoice filter returns paid invoices

**Priority:** High

**Area:** Invoice filtering / reporting

### Expected behaviour

Selecting `Open invoices` should return only invoices with a positive
balance. The restored fixture contains 7 open invoices.

### Reproduction

1. Restored the supplied register:
   `python restore_fixture.py --replace`
2. Started the application:
   `python app.py`
3. Opened:
   `http://127.0.0.1:8787`
4. Selected `Open invoices`.

### Before-fix result

The overview reported:

- Open invoices: 7
- Outstanding: ₹3,698.19

However, the `Open invoices` filter displayed:

- HARBOR / INV-101 / balance ₹0.00 / paid
- NORTH / KEEP-702 / balance ₹0.00 / paid

The API reproduced the same problem:

`curl.exe "http://127.0.0.1:8787/api/invoices?status=open"`

returned the two paid invoices above.

### Impact

The owner cannot rely on the open-invoice view to identify outstanding
invoices. This can cause incorrect collection follow-up and disagreement
between the overview and register.

### Root cause

The backend status filtering logic returned the paid set when
`status=open` was requested.

### Fix

Changed the invoice filtering logic so that:

- `open` returns only positive balances;
- `paid` returns zero or negative balances;
- `all` returns both.

### After-fix verification

The repaired application showed:

- Open invoices: 7
- Every displayed invoice had `status = open`
- Every displayed invoice had a positive balance
- INV-101 and KEEP-702 no longer appeared in the open list

### Evidence

- `evidence/defect-01-open-filter-before.png`
- `evidence/defect-01-api-before.png`
- `evidence/defect-01-open-filter-after.png`

---

## Defect 02 — Payment matched using amount instead of invoice identity

**Priority:** Very High

**Area:** Payment matching

### Expected behaviour

A payment may be attached only to an invoice with the same
`customer_id` and `invoice_number`. Amount alone must not establish
identity.

### Reproduction

The fixture contains:

- HARBOR / INV-100 / ₹1250.00
- MAPLE / INV-200 / ₹1250.00

The supplied payment identifies:

- MAPLE / INV-200 / ₹1250.00

### Before-fix result

After importing `samples/payments.csv`, the payment was assigned to:

- HARBOR / INV-100

while MAPLE / INV-200 remained unpaid.

### Impact

A payment can be allocated to the wrong invoice, causing incorrect
paid amounts, balances and financial reporting.

### Root cause

Payment matching searched for an invoice using the payment amount
instead of the required `(customer_id, invoice_number)` identity.

### Fix

Changed payment matching to use:

`(customer_id, invoice_number)`

as the invoice identity.

### After-fix verification

After importing the same payment data in the repaired application:

- HARBOR / INV-100 → paid ₹0.00, balance ₹1,250.00, status `open`
- MAPLE / INV-200 → paid ₹1,250.00, balance ₹0.00, status `paid`

The payment was assigned to the correct invoice.

### Evidence

- `evidence/defect-02-payment-matching-before.png`
- `evidence/defect-02-payment-matching-after.png`
- `evidence/defect-02-payment-matching-after-browser.png`

---

## Defect 03 — Floating-point precision leaks into money values

**Priority:** High

**Area:** Money calculations / reporting

### Expected behaviour

For two-decimal inputs, currency calculations must preserve cents and
display/export values accurately to two decimal places.

### Reproduction

The fixture contains:

- NORTH / INV-300 / amount ₹19.99
- payment ₹10.00

### Before-fix result

The API exposed floating-point artifacts such as:

- paid: `19.990000000000002`
- balance: `-3.552713678800501e-15`

for a fully paid ₹19.99 invoice.

### Impact

Floating-point artifacts can leak into API responses, reports and
comparisons, causing incorrect-looking currency values and potentially
incorrect status/balance logic.

### Root cause

Currency calculations used binary floating-point arithmetic directly.

### Fix

Changed monetary calculations/reporting to preserve currency precision
using decimal/cents-based arithmetic.

### After-fix verification

The repaired application reports:

- amount: `19.99`
- paid: `19.99`
- balance: `0.00`
- status: `paid`

The screen and export use the same two-decimal values.

### Evidence

- `evidence/defect-03-money-before.png`
- `evidence/defect-03-money-after.png`

---

## Defect 04 — Identical invoice re-import creates duplicates

**Priority:** Very High

**Area:** Invoice import / idempotency

### Expected behaviour

Re-importing an invoice with the same
`(customer_id, invoice_number)`, amount and due date must skip the
record without changing totals.

### Reproduction

First import of `samples/invoices-new.csv`:

text
imported = 2
skipped = 0
rejected = 0

### Defect 5 — Conflicting invoice identity

### After-fix verification

The repaired application returned:

imported = 0
skipped = 0
rejected = 1

Reason:
"Invoice identity already exists with different details"

The original HARBOR / INV-100 record remained unchanged at ₹1250.00,
and no conflicting duplicate was created.


### DEFECT 3 Floating-point precision leaks into money values

### After-fix verification

The repaired API returned for NORTH / INV-300:

amount = 19.99
paid = 10.00
balance = 9.99
status = open

The floating-point artifacts observed in the starter were no longer
present.

## Defect 06 — Invalid data row aborts the entire invoice import

### After-fix verification

The repaired application returned HTTP 200 with:

imported = 2
skipped = 0
rejected = 1

The rejected row was reported as CSV line 3 with the expected validation
reason.

The two valid rows were present afterward:

HARBOR / INV-103 / ₹84.00
MAPLE / INV-203 / ₹100.00

The invalid NORTH / INV-302 row was not stored.
