// ===========================================
// SVAKS Annual Statement PDF Generator
// Generates a comprehensive annual financial statement
// for a single member (or all members in bulk).
// ===========================================

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build the per-member annual statement HTML.
 * Opens in a new window ready for print → Save as PDF.
 *
 * @param {object} params
 * @param {object} params.member   - The member object { id, name, father, phone, address, monthlyFee, joinedDate }
 * @param {array}  params.collections - All collections (will be filtered to this member + year)
 * @param {number} params.year     - Year to generate statement for
 * @param {object} params.settings - { appName, location }
 */
export function generateAnnualStatement({ member, collections, year, settings }) {
  const memberName = member?.name || 'Unknown';
  const father = member?.father || '—';
  const phone = member?.phone || '—';
  const address = member?.address || '—';
  const memberId = member?.id || '—';
  const monthlyFee = Number(member?.monthlyFee) || 100;

  // Parse dates safely
  const parseDate = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  };

  // Filter this member's collections for the given year
  const memberCollections = collections.filter(c => {
    if (c.memberId !== member.id) return false;
    const d = parseDate(c.date);
    return d && d.getFullYear() === year;
  });

  // Sort by date ascending
  memberCollections.sort((a, b) => {
    const da = parseDate(a.date) || new Date(0);
    const db = parseDate(b.date) || new Date(0);
    return da - db;
  });

  // Totals
  const totalPaid = memberCollections.reduce((s, c) => s + Number(c.amount || 0), 0);
  const monthlyPaid = memberCollections
    .filter(c => c.source === 'Monthly Collection')
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const donations = memberCollections
    .filter(c => c.source === 'Donation' || c.source === 'Special Contribution')
    .reduce((s, c) => s + Number(c.amount || 0), 0);
  const otherIncome = memberCollections
    .filter(c => !['Monthly Collection', 'Donation', 'Special Contribution'].includes(c.source))
    .reduce((s, c) => s + Number(c.amount || 0), 0);

  // Expected vs actual for monthly (12 months)
  const monthsPaid = new Set();
  memberCollections.forEach(c => {
    if (c.source === 'Monthly Collection') {
      const d = parseDate(c.date);
      if (d) monthsPaid.add(d.getMonth());
    }
  });
  const monthsCount = monthsPaid.size;
  const expectedAnnual = monthlyFee * 12;
  const expectedActual = monthlyFee * monthsCount;
  const pendingMonths = 12 - monthsCount;
  const pendingAmount = pendingMonths * monthlyFee;

  // Group by month for table
  const monthRows = [];
  for (let m = 0; m < 12; m++) {
    const monthColl = memberCollections.filter(c => {
      const d = parseDate(c.date);
      return d && d.getMonth() === m && d.getFullYear() === year;
    });
    if (monthColl.length > 0) {
      const total = monthColl.reduce((s, c) => s + Number(c.amount || 0), 0);
      const dateStr = parseDate(monthColl[0].date)?.toLocaleDateString('en-IN') || '—';
      const sources = [...new Set(monthColl.map(c => c.source))].join(', ');
      const receiptNos = monthColl.map(c => c.receiptNo).filter(Boolean).join(', ');
      monthRows.push({
        month: MONTHS[m],
        date: dateStr,
        amount: total,
        sources,
        receiptNos: receiptNos || '—',
        status: 'Paid'
      });
    } else {
      monthRows.push({
        month: MONTHS[m],
        date: '—',
        amount: 0,
        sources: '—',
        receiptNos: '—',
        status: 'Pending'
      });
    }
  }

  const samajName = settings?.appName || 'Somavamsha Aarya Kshthriya Samaj';
  const location = settings?.location || 'Yadgir';
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('Please allow popups to generate the statement.');
    return;
  }

  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Annual Statement - ${escapeHtml(memberName)} (${year})</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Tiro Devanagari Hindi', sans-serif;
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
      color: #333;
      font-size: 11px;
      line-height: 1.5;
    }
    @page { size: A4; margin: 12mm; }
    .header {
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 3px double #800000;
      margin-bottom: 15px;
    }
    .header .om { font-size: 28px; color: #800000; display: block; margin-bottom: 4px; }
    .header h1 { font-size: 18px; color: #800000; font-family: 'Tiro Devanagari Hindi', serif; margin-bottom: 2px; }
    .header .sub { font-size: 11px; color: #D4A017; font-weight: 600; letter-spacing: 3px; }
    .header .statement-title { font-size: 14px; color: #333; margin-top: 6px; font-weight: 700; }

    .member-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 20px;
      padding: 12px;
      background: #f9f5f0;
      border: 1px solid #e1d5c8;
      border-radius: 8px;
      margin-bottom: 15px;
      font-size: 11px;
    }
    .member-info .row { display: flex; justify-content: space-between; }
    .member-info .lbl { color: #666; font-weight: 600; }
    .member-info .val { color: #1a0a00; font-weight: 600; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 15px;
    }
    .summary-card {
      padding: 10px;
      text-align: center;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #f9f5f0;
    }
    .summary-card .val { font-size: 16px; font-weight: 700; color: #800000; }
    .summary-card .lbl { font-size: 9px; color: #888; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-card.pending .val { color: #E17055; }
    .summary-card.success .val { color: #00B894; }

    h2 {
      font-size: 12px; color: #800000; padding-bottom: 4px;
      border-bottom: 2px solid #D4A017; margin: 15px 0 8px;
      font-family: 'Tiro Devanagari Hindi', serif;
    }

    table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10px; }
    th { background: #f5f0eb; padding: 6px 8px; text-align: left; font-weight: 600; border: 1px solid #ddd; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 5px 8px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #fafafa; }
    .amt { text-align: right; }
    .ok { color: #00B894; font-weight: 600; }
    .no { color: #E17055; font-weight: 600; }
    .total-row { font-weight: 700; background: #f5f0eb !important; }

    .footer {
      text-align: center; margin-top: 20px; font-size: 9px; color: #aaa;
      border-top: 1px solid #eee; padding-top: 10px;
    }

    .sign-section {
      display: flex; justify-content: space-around; margin-top: 30px;
      font-size: 11px; color: #555;
    }
    .sign-box { text-align: center; }
    .sign-line { margin-top: 30px; border-top: 1px solid #555; width: 180px; padding-top: 4px; }

    .no-print { text-align: center; margin: 10px 0; }
    .no-print button {
      padding: 10px 24px; background: #800000; color: white; border: none;
      border-radius: 8px; cursor: pointer; font-size: 14px; margin: 0 6px;
      font-family: 'Tiro Devanagari Hindi', serif;
    }
    .no-print button:hover { background: #600000; }

    @media print {
      .no-print { display: none; }
      body { padding: 8mm; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ Print / Save as PDF</button>
    <button onclick="window.close()" style="background:#666">✕ Close</button>
  </div>

  <div class="header">
    <span class="om">&#2384;</span>
    <h1>${escapeHtml(samajName)}</h1>
    <div class="sub">${escapeHtml(location)}</div>
    <div class="statement-title">ANNUAL MEMBER STATEMENT — ${year}</div>
  </div>

  <div class="member-info">
    <div class="row"><span class="lbl">Member Name:</span><span class="val">${escapeHtml(memberName)}</span></div>
    <div class="row"><span class="lbl">Member ID:</span><span class="val">#${escapeHtml(String(memberId))}</span></div>
    <div class="row"><span class="lbl">Father's Name:</span><span class="val">${escapeHtml(father)}</span></div>
    <div class="row"><span class="lbl">Phone:</span><span class="val">${escapeHtml(phone)}</span></div>
    <div class="row"><span class="lbl">Address:</span><span class="val">${escapeHtml(address)}</span></div>
    <div class="row"><span class="lbl">Monthly Fee:</span><span class="val">Rs. ${monthlyFee.toLocaleString('en-IN')}</span></div>
  </div>

  <div class="summary-grid">
    <div class="summary-card success">
      <div class="val">Rs. ${totalPaid.toLocaleString('en-IN')}</div>
      <div class="lbl">Total Paid in ${year}</div>
    </div>
    <div class="summary-card">
      <div class="val">${monthsCount}/12</div>
      <div class="lbl">Months Paid</div>
    </div>
    <div class="summary-card pending">
      <div class="val">Rs. ${pendingAmount.toLocaleString('en-IN')}</div>
      <div class="lbl">Pending (${pendingMonths} months)</div>
    </div>
    <div class="summary-card">
      <div class="val">Rs. ${donations.toLocaleString('en-IN')}</div>
      <div class="lbl">Donations / Contributions</div>
    </div>
  </div>

  <h2>Month-wise Payment Details</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Month</th>
        <th>Date</th>
        <th class="amt">Amount</th>
        <th>Source</th>
        <th>Receipt No.</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${monthRows.map((row, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${escapeHtml(row.month)}</strong></td>
          <td>${escapeHtml(row.date)}</td>
          <td class="amt">${row.amount > 0 ? 'Rs. ' + row.amount.toLocaleString('en-IN') : '—'}</td>
          <td>${escapeHtml(row.sources)}</td>
          <td>${escapeHtml(row.receiptNos)}</td>
          <td>${row.status === 'Paid'
            ? '<span class="ok">Paid &#10004;</span>'
            : '<span class="no">Pending &#10008;</span>'}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3" style="text-align:right">TOTAL PAID</td>
        <td class="amt">Rs. ${totalPaid.toLocaleString('en-IN')}</td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>

  <h2>Payment Summary</h2>
  <table>
    <tr><th>Description</th><th class="amt">Amount</th></tr>
    <tr><td>Monthly Collections (${monthsCount} months)</td><td class="amt">Rs. ${monthlyPaid.toLocaleString('en-IN')}</td></tr>
    <tr><td>Donations / Special Contributions</td><td class="amt">Rs. ${donations.toLocaleString('en-IN')}</td></tr>
    <tr><td>Other Income</td><td class="amt">Rs. ${otherIncome.toLocaleString('en-IN')}</td></tr>
    <tr class="total-row"><td>Grand Total Received</td><td class="amt">Rs. ${totalPaid.toLocaleString('en-IN')}</td></tr>
    <tr><td>Expected Annual (${monthlyFee} × 12)</td><td class="amt">Rs. ${expectedAnnual.toLocaleString('en-IN')}</td></tr>
    <tr><td>Actually Expected (${monthlyFee} × ${monthsCount} paid months)</td><td class="amt">Rs. ${expectedActual.toLocaleString('en-IN')}</td></tr>
    <tr class="total-row" style="color:#E17055"><td><strong>Pending Dues (${pendingMonths} months)</strong></td><td class="amt"><strong>Rs. ${pendingAmount.toLocaleString('en-IN')}</strong></td></tr>
  </table>

  <div class="sign-section">
    <div class="sign-box">
      <div>Member Signature</div>
      <div class="sign-line">${escapeHtml(memberName)}</div>
    </div>
    <div class="sign-box">
      <div>Authorized by</div>
      <div class="sign-line">${escapeHtml(samajName)}</div>
    </div>
  </div>

  <div class="footer">
    ${escapeHtml(samajName)}, ${escapeHtml(location)} | Statement generated: ${escapeHtml(generatedDate)}<br>
    This is a system-generated statement. For any discrepancy, please contact the samaj admin.
  </div>
</body>
</html>`);
  w.document.close();

  // Auto-trigger print after a short delay (optional — uncomment to enable)
  // setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 800);
}

/**
 * Bulk generate statements for ALL members.
 * Opens each statement in sequence (with a small delay to avoid popup blocking).
 *
 * @param {object} params - { members, collections, year, settings }
 */
export function generateBulkStatements({ members, collections, year, settings }) {
  if (!members || members.length === 0) {
    alert('No members found to generate statements.');
    return;
  }

  if (!window.confirm(`Generate annual statements for ${members.length} members for year ${year}?\n\nNote: Browser may block multiple popups. Allow popups for this site, then click OK.`)) {
    return;
  }

  let i = 0;
  const generateNext = () => {
    if (i >= members.length) {
      alert(`✅ Generated ${members.length} annual statements!`);
      return;
    }
    const member = members[i];
    try {
      generateAnnualStatement({ member, collections, year, settings });
      i++;
      // Small delay between popups to avoid browser blocking
      setTimeout(generateNext, 1500);
    } catch (e) {
      console.error('Statement generation failed for', member.name, e);
      i++;
      setTimeout(generateNext, 500);
    }
  };
  generateNext();
}
