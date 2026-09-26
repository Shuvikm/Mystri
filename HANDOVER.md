# Handover

- Name: Shuvik M
- Email used for this application: mshuvik@gmail.com
- Chosen track: A — Repair the register
- Approximate total time, including setup and handover: 3 hours 40 minutes

## Profile

- GitHub: https://github.com/Shuvikm
- LinkedIn: https://linkedin.com/in/shuvikm
- Portfolio: https://portfolio-final-ckug2kizt-mshuvik-8538s-projects.vercel.app/

## Why this track

I chose Track A because it matches my interest in product engineering and full-stack development. My work includes React/Node.js/MongoDB applications as well as Python-based projects such as an AI-powered mentoring platform and a flight-delay prediction system. I enjoy investigating existing behaviour, debugging reliability issues, making focused changes, and validating those changes with tests and real application workflows.

## Run and verify

Prerequisite: Python 3.10+ and a modern browser. No third-party dependencies are required.

From the repository root:

```text
python -m unittest discover -s tests -v
python restore_fixture.py --replace
python app.py

## Run and verify

Prerequisite: Python 3.10+; no third-party dependencies.

From `track-a/`:

```text
python -m unittest discover -s tests -v
python restore_fixture.py --replace
python app.py
```

Open `http://127.0.0.1:8787`. The fixture restore must be done with the server stopped. The supplied `fixtures/` files are retained and the generated `.local/` database is not submitted.

## What I delivered

I focused on the highest-risk correctness issues indicated by the owner observations and the public business rules:

- invoice identity is now `(customer_id, invoice_number)`, with identical re-imports skipped and conflicting details rejected;
- payment matching now uses both customer ID and invoice number rather than amount;
- invalid data rows are rejected independently with their original CSV line numbers;
- `open` and `paid` filters now return only their requested status;
- money calculations/reporting preserve two-decimal cents and export the same values shown by the register;
- the browser now checks HTTP failures and displays actual import counts plus rejected line/reason details;
- added regression coverage for these cases.

Small improvement beyond the required repairs: the overview now shows an **Unmatched payments** count so unresolved payments are visible as a headline operational signal, not only in the detail list.

## Evidence and limits

Baseline starter suite: 5 tests passed before changes.

Final suite: **10 tests passed** with:

```text
python -m unittest discover -s tests -v
```

Failing-before/passing-after examples:

1. A payment for `MAPLE / INV-200` with amount `1250.00` previously matched the first invoice with that amount (`HARBOR / INV-100`). After the fix it attaches to `MAPLE / INV-200`.
2. An `open` status query previously returned paid records as well. After the fix, `open` contains only open invoices and `paid` contains only paid invoices.

Changed-input case: a three-row invoice import containing two valid rows and one unknown customer now returns `imported=2, rejected=1`, with the rejection reported on CSV line 3, while both valid rows are stored.

Existing-register preservation was checked against `fixtures/expected-records.json`: all 3 customers, 9 invoice records/IDs and 5 payment records/allocations matched; starting totals were 7 open invoices, INR 3,698.19 outstanding and 1 unmatched payment. A new invoice and payment were then imported and were still present after closing and reopening the database.

HTTP verification also checked that an invalid CSV header returns HTTP 400 with a useful error instead of claiming a successful import.

Known limits / next step: I did not add a schema-level unique constraint or a migration because the current repair can preserve the supplied fixture without changing its schema. In a production system I would add database-enforced identity uniqueness after checking for existing duplicates, then add a migration and concurrent-writer tests.

## Tools and judgment

- **GPT-5.6 Luna**: used for code inspection, identifying likely defect locations, proposing focused fixes and test cases. I checked each proposed behaviour against `BUSINESS_RULES.md`, reproduced defects before changing code, and rejected broad rewrites in favour of small patches.
- **Python 3.10+ / unittest**: used to run the starter suite, create regression tests, and verify mixed-row imports, identity matching, status filters and money calculations. All 10 final tests passed.
- **curl**: used to verify the HTTP contract, including a malformed-header request returning HTTP 400. I also reopened the SQLite database after imports to verify persistence rather than relying only on the in-process result.
