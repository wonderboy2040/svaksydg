const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Escape HTML to prevent XSS in generated PDF
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const sourceNames = {
  'Monthly Collection': 'Monthly Collection',
  'Donation': 'Daan',
  'Special Contribution': 'Vishesh Yogdan',
  'Event Income': 'Program Income',
  'Other': 'Any'
};

const catNames = {
  'Admin Cost': 'Admin Cost',
  'Event Expense': 'Program Kharcha',
  'Maintenance': 'Maintenance',
  'Help/Support': 'Daan/Madad',
  'Travel': 'Safar',
  'Printing': 'Print/Stationary',
  'Other': 'Any'
};

function exportReport(members, collections, expenditure, memberStatus, month, year) {
  const totalCol = collections.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalExp = expenditure.reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = totalCol - totalExp;
  const monthName = MONTHS[month] || '';

  // Source breakdown
  let bySource = {};
  collections.forEach(c => {
    const s = c.source || 'Other';
    bySource[s] = (bySource[s] || 0) + Number(c.amount || 0);
  });

  // Category breakdown
  let byCat = {};
  expenditure.forEach(e => {
    const s = e.category || 'Other';
    byCat[s] = (byCat[s] || 0) + Number(e.amount || 0);
  });

  const w = window.open('', '_blank', 'width=800,height=600');
  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${MONTHS[month]} ${year} - SVAKS Report</title>
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
      line-height: 1.4;
    }
    @page { size: A4; margin: 10mm; }

    .header {
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 3px double #800000;
      margin-bottom: 15px;
    }
    .header .om { font-size: 28px; color: #800000; display: block; margin-bottom: 4px; }
    .header h1 { font-size: 18px; color: #800000; font-family: 'Tiro Devanagari Hindi', serif; margin-bottom: 2px; }
    .header .sub { font-size: 11px; color: #D4A017; font-weight: 600; letter-spacing: 3px; }
    .header .month { font-size: 13px; color: #666; margin-top: 4px; }

    .summary-box {
      display: flex; gap: 10px; margin-bottom: 15px;
    }
    .summary-item {
      flex: 1; padding: 10px; text-align: center;
      border: 1px solid #ddd; border-radius: 8px; background: #f9f5f0;
    }
    .summary-item .val { font-size: 16px; font-weight: 700; color: #800000; }
    .summary-item .lbl { font-size: 9px; color: #888; margin-top: 2px; }

    h2 {
      font-size: 13px; color: #800000; padding-bottom: 4px;
      border-bottom: 2px solid #D4A017; margin: 15px 0 8px;
      font-family: 'Tiro Devanagari Hindi', serif;
    }

    table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10px; }
    th { background: #f5f0eb; padding: 5px 8px; text-align: left; font-weight: 600; border: 1px solid #ddd; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 4px 8px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #fafafa; }
    .amt { text-align: right; }
    .ok { color: #00B894; font-weight: 600; }
    .no { color: #E17055; font-weight: 600; }

    .footer {
      text-align: center; margin-top: 20px; font-size: 9px; color: #aaa;
      border-top: 1px solid #eee; padding-top: 10px;
    }

    @media print {
      body { padding: 8mm; }
      .no-print { display: none; }
    }
    .print-btn {
      padding: 10px 25px; background: #800000; color: white; border: none;
      border-radius: 8px; cursor: pointer; font-size: 14px;
      font-family: 'Tiro Devanagari Hindi', serif;
      margin: 10px 5px;
    }
    .print-btn:hover { background: #600000; }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;padding:15px 0;">
    <button class="print-btn" onclick="window.print()">&#11015; PDF Print Karo</button>
    <button class="print-btn" style="background:#D4A017" onclick="window.close()">Window Band Karo</button>
  </div>

  <div class="header">
    <span class="om">&#9783;</span>
    <h1>Soma Vamshi Aarya Kshthriya Samaj, Yadgir</h1>
    <div class="sub">MONTHLY REPORT</div>
    <div class="month">${escapeHtml(monthName)} ${year}</div>
  </div>

  <div class="summary-box">
    <div class="summary-item"><div class="val">Rs.${totalCol.toLocaleString('en-IN')}</div><div class="lbl">Kul Collection</div></div>
    <div class="summary-item"><div class="val">Rs.${totalExp.toLocaleString('en-IN')}</div><div class="lbl">Kul Kharcha</div></div>
    <div class="summary-item"><div class="val">Rs.${balance.toLocaleString('en-IN')}</div><div class="lbl">Bachat (Balance)</div></div>
    <div class="summary-item"><div class="val">${memberStatus.filter(m => m.paid).length}/${members.length}</div><div class="lbl">Members Paid</div></div>
  </div>

  <h2>Collection Breakdown</h2>
  <table>
    <tr><th>Source</th><th class="amt">Amount</th></tr>
    ${Object.keys(bySource).map(s => `<tr><td>${escapeHtml(sourceNames[s] || s)}</td><td class="amt">Rs.${bySource[s].toLocaleString('en-IN')}</td></tr>`).join('')}
    <tr style="font-weight:700;background:#f5f0eb"><td>Total Collection</td><td class="amt">Rs.${totalCol.toLocaleString('en-IN')}</td></tr>
  </table>

  <h2>Expenditure Breakdown</h2>
  <table>
    <tr><th>Category</th><th class="amt">Amount</th></tr>
    ${Object.keys(byCat).length === 0 ? '<tr><td colspan="2" style="text-align:center;color:#999;padding:12px">Koi kharcha nahi hua iss mahine</td></tr>' :
      Object.keys(byCat).map(c => `<tr><td>${escapeHtml(catNames[c] || c)}</td><td class="amt">Rs.${byCat[c].toLocaleString('en-IN')}</td></tr>`).join('')}
    <tr style="font-weight:700;background:#f5f0eb"><td>Total Kharcha</td><td class="amt">Rs.${totalExp.toLocaleString('en-IN')}</td></tr>
  </table>

  <h2>Member Payment Status - Kisne Diya / Kisne Nahi</h2>
  <table>
    <tr><th>#</th><th>Member Name</th><th>Status</th><th class="amt">Amount Paid</th></tr>
    ${memberStatus.map((m, i) => `<tr><td>${i + 1}</td><td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${m.paid
          ? '<span class="ok">Paid &#10004;</span>'
          : '<span class="no">Pending &#10008;</span>'
        }</td>
      <td class="amt">Rs.${m.paidAmount.toLocaleString('en-IN')}</td></tr>`).join('')}
  </table>

  <h2>Collection Details</h2>
  <table>
    <tr><th>#</th><th>Date</th><th>Member</th><th class="amt">Amount</th><th>Source</th><th>Note</th></tr>
    ${collections.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:#999;padding:12px">Koi collection nahi</td></tr>'
      : collections.map((c, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(c.date || '-')}</td><td>${escapeHtml(c.memberName || '-')}</td><td class="amt">Rs.${Number(c.amount).toLocaleString('en-IN')}</td><td>${escapeHtml(sourceNames[c.source] || c.source || '-')}</td><td>${escapeHtml(c.note || '-')}</td></tr>`).join('')}
  </table>

  <h2>Expenditure Details</h2>
  <table>
    <tr><th>#</th><th>Date</th><th>Category</th><th class="amt">Amount</th><th>Description</th></tr>
    ${expenditure.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:#999;padding:12px">Koi kharcha nahi</td></tr>'
      : expenditure.map((e, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(e.date || '-')}</td><td>${escapeHtml(catNames[e.category] || e.category || '-')}</td><td class="amt">Rs.${Number(e.amount).toLocaleString('en-IN')}</td><td>${escapeHtml(e.description || '-')}</td></tr>`).join('')}
  </table>

  <div class="footer">
    Soma Vamshi Aarya Kshthriya Samaj, Yadgir | Report generated: ${new Date().toLocaleDateString('en-IN')}<br>
    Auto-generated by SVAKS Admin System
  </div>

  <script>
    // Auto-open print dialog for easy PDF download
    // User can save as PDF from print dialog
    setTimeout(function() {
      // Uncomment next line to auto-trigger print:
      // window.print();
    }, 500);
  <\/script>
</body>
</html>`);
  w.document.close();
}

export default { exportReport };
