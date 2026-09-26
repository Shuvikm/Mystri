const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR'
});

const money = n => currency.format(n);

const text = (tag, value, className = '') => {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  return node;
};

let currentRows = [];

function updateCustomerFilter() {
  const select = document.querySelector('#customer-filter');

  if (!select) return;

  const currentValue = select.value;
  const customers = new Map();

  currentRows.forEach(row => {
    if (row.customer_id && row.customer_name) {
      customers.set(row.customer_id, row.customer_name);
    }
  });

  select.replaceChildren(
    new Option('All customers', 'all')
  );

  [...customers.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([customerId, customerName]) => {
      select.append(
        new Option(
          `${customerName} (${customerId})`,
          customerId
        )
      );
    });

  const exists = [...select.options]
    .some(option => option.value === currentValue);

  select.value = exists ? currentValue : 'all';
}

function sortRows(rows) {
  const sortBy = document.querySelector('#sort-by')?.value || 'default';

  if (sortBy === 'default') {
    return [...rows];
  }

  return [...rows].sort((a, b) => {

    switch (sortBy) {

      case 'customer':
        return a.customer_name.localeCompare(b.customer_name);

      case 'invoice':
        return a.invoice_number.localeCompare(b.invoice_number);

      case 'due_date':
        return a.due_date.localeCompare(b.due_date);

      case 'amount':
        return Number(a.amount) - Number(b.amount);

      case 'balance':
        return Number(a.balance) - Number(b.balance);

      default:
        return 0;
    }
  });
}

function renderInvoices() {
  const searchInput = document.querySelector('#invoice-search');
  const customerFilter = document.querySelector('#customer-filter');

  const query = (searchInput?.value || '')
    .trim()
    .toLowerCase();

  const selectedCustomer =
    customerFilter?.value || 'all';

  const body = document.querySelector('#invoices');

  body.replaceChildren();

  const filteredRows = currentRows.filter(row => {

    const searchableText = [
      row.customer_id,
      row.customer_name,
      row.invoice_number
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesSearch =
      !query || searchableText.includes(query);

    const matchesCustomer =
      selectedCustomer === 'all' ||
      row.customer_id === selectedCustomer;

    return matchesSearch && matchesCustomer;
  });

  const sortedRows = sortRows(filteredRows);

  sortedRows.forEach(rowData => {

    const row = document.createElement('tr');

    [
      rowData.customer_name,
      rowData.invoice_number,
      rowData.due_date
    ].forEach(value => {
      row.append(text('td', value));
    });

    [
      rowData.amount,
      rowData.paid,
      rowData.balance
    ].forEach(value => {
      row.append(
        text('td', money(value), 'number')
      );
    });

    row.append(
      text('td', rowData.status)
    );

    body.append(row);
  });

  if (!sortedRows.length) {

    const row = document.createElement('tr');

    const cell = text(
      'td',
      'No invoices match the selected filters.',
      'empty-state'
    );

    cell.colSpan = 7;

    row.append(cell);
    body.append(row);
  }
}

async function refresh() {

  const status =
    document.querySelector('#status').value;

  const responses = await Promise.all([
    fetch('/api/overview'),
    fetch(
      `/api/invoices?status=${encodeURIComponent(status)}`
    )
  ]);

  if (responses.some(response => !response.ok)) {
    throw new Error(
      'Could not refresh the register.'
    );
  }

  const [data, rows] = await Promise.all(
    responses.map(response => response.json())
  );

  document.querySelector('#invoice-count').textContent =
    data.summary.invoice_count;

  document.querySelector('#open-count').textContent =
    data.summary.open_count;

  document.querySelector('#outstanding').textContent =
    money(data.summary.outstanding);

  document.querySelector('#unmatched-count').textContent =
    data.summary.unmatched_payment_count;

  currentRows = rows;

  updateCustomerFilter();
  renderInvoices();

  const unmatched =
    document.querySelector('#unmatched');

  unmatched.replaceChildren(
    ...data.unmatched_payments.map(payment =>
      text(
        'li',
        `${payment.payment_id} · ` +
        `${payment.customer_id} / ` +
        `${payment.invoice_number} · ` +
        `${money(payment.amount)}`
      )
    )
  );

  if (!data.unmatched_payments.length) {
    unmatched.append(
      text('li', 'No unmatched payments.')
    );
  }

  document.querySelector('#page-error')
    .textContent = '';
}

async function submitImport(form) {

  const feedback =
    form.querySelector('.feedback');

  const button =
    form.querySelector('button');

  button.disabled = true;
  feedback.textContent = 'Importing…';

  try {

    const file =
      form.querySelector('input').files[0];

    if (!file) {
      throw new Error(
        'Choose a CSV file first.'
      );
    }

    const csv = await file.text();

    const response = await fetch(
      `/api/import?kind=${form.dataset.kind}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv'
        },
        body: csv
      }
    );

    const data =
      await response.json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        `Import failed (HTTP ${response.status}).`
      );
    }

    const parts = [
      `Imported ${data.imported}`,
      `skipped ${data.skipped}`,
      `rejected ${data.rejected}`
    ];

    const errors = (data.errors || [])
      .map(error =>
        `line ${error.line}: ${error.reason}`
      )
      .join('; ');

    feedback.textContent =
      `Import processed: ${parts.join(', ')}.` +
      (errors ? ` ${errors}` : '');

    await refresh();

  } catch (error) {

    feedback.textContent =
      `Import failed: ${error.message}`;

  } finally {

    button.disabled = false;
  }
}

/* Status filter */
document
  .querySelector('#status')
  .addEventListener('change', () => {

    refresh().catch(error => {
      document.querySelector('#page-error')
        .textContent = error.message;
    });

  });

/* Search */
document
  .querySelector('#invoice-search')
  .addEventListener('input', () => {
    renderInvoices();
  });

/* Customer filter */
document
  .querySelector('#customer-filter')
  .addEventListener('change', () => {
    renderInvoices();
  });

/* Sorting */
document
  .querySelector('#sort-by')
  .addEventListener('change', () => {
    renderInvoices();
  });

/* Import forms */
document
  .querySelectorAll('form[data-kind]')
  .forEach(form => {

    form.addEventListener('submit', event => {

      event.preventDefault();

      submitImport(form);
    });

  });

/* Initial load */
refresh().catch(error => {

  document.querySelector('#page-error')
    .textContent = error.message;

});