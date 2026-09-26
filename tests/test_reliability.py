import tempfile
import unittest
from pathlib import Path
from ledger import importing, reporting, storage


class ReliabilityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp.name) / 'demo.sqlite3'
        self.db = storage.connect(self.db_path)
        storage.seed(self.db)

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_mixed_rows_process_independently_with_original_line_numbers(self):
        csv = (
            'customer_id,invoice_number,amount,due_date\n'
            'HARBOR,NEW-1,10.00,2026-09-20\n'
            'BAD,NEW-2,20.00,2026-09-21\n'
            'MAPLE,NEW-3,30.00,2026-09-22\n'
        )
        result = importing.import_csv(self.db, csv, 'invoices')
        self.assertEqual((result['imported'], result['skipped'], result['rejected']), (2, 0, 1))
        self.assertEqual(result['errors'][0]['line'], 3)
        self.assertEqual(len(reporting.invoices(self.db)), 8)

    def test_duplicate_invoice_is_skipped_or_rejected_by_identity(self):
        same = 'customer_id,invoice_number,amount,due_date\nHARBOR,INV-100,1250.00,2026-09-01\n'
        changed = 'customer_id,invoice_number,amount,due_date\nHARBOR,INV-100,999.99,2026-09-01\n'
        self.assertEqual(importing.import_csv(self.db, same, 'invoices')['skipped'], 1)
        result = importing.import_csv(self.db, changed, 'invoices')
        self.assertEqual(result['rejected'], 1)
        self.assertEqual(next(r for r in reporting.invoices(self.db) if r['invoice_number'] == 'INV-100')['amount'], 1250.0)

    def test_payment_uses_customer_and_invoice_identity_not_amount(self):
        csv = 'payment_id,customer_id,invoice_number,amount\nP-MAPLE,MAPLE,INV-200,1250.00\n'
        importing.import_csv(self.db, csv, 'payments')
        rows = reporting.invoices(self.db)
        maple = next(r for r in rows if r['customer_id'] == 'MAPLE' and r['invoice_number'] == 'INV-200')
        harbor = next(r for r in rows if r['customer_id'] == 'HARBOR' and r['invoice_number'] == 'INV-100')
        self.assertEqual(maple['paid'], 1250.0)
        self.assertEqual(harbor['paid'], 0.0)

    def test_status_filters_are_disjoint(self):
        open_rows = reporting.invoices(self.db, 'open')
        paid_rows = reporting.invoices(self.db, 'paid')
        self.assertTrue(all(r['status'] == 'open' for r in open_rows))
        self.assertTrue(all(r['status'] == 'paid' for r in paid_rows))
        self.assertEqual(len(open_rows), 5)
        self.assertEqual(len(paid_rows), 1)

    def test_money_preserves_cents_and_export_agrees(self):
        rows = reporting.invoices(self.db)
        north = next(r for r in rows if r['invoice_number'] == 'INV-300')
        self.assertEqual(north['balance'], 9.99)
        self.assertEqual(reporting.overview(self.db)['summary']['unmatched_payment_count'], 0)
        exported = reporting.export_csv(self.db)
        self.assertIn('NORTH,INV-300,19.99,10.00,9.99,open', exported)
