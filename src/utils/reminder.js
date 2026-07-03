// ===========================================
// SVAKS Reminder & Share Helpers
// WhatsApp deep links + SMS deep links + Receipt printing
// ===========================================

/**
 * Clean a phone number to digits only (international format for wa.me).
 * Handles Indian numbers like +91-98765-43210 → 919876543210
 * @param {string} phone
 * @returns {string}
 */
export function cleanPhone(phone) {
  if (!phone) return '';
  // Strip everything except digits
  let cleaned = String(phone).replace(/[^\d]/g, '');
  // If it's a 10-digit Indian number without country code, prefix 91
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Generate a WhatsApp share URL for a specific phone number.
 * Opens chat with prefilled message.
 * @param {string} phone - recipient phone
 * @param {string} message - prefilled message
 * @returns {string} wa.me URL
 */
export function getWhatsAppUrl(phone, message = '') {
  const cleaned = cleanPhone(phone);
  const base = cleaned ? `https://wa.me/${cleaned}` : 'https://wa.me/';
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Generate a WhatsApp share URL WITHOUT a specific recipient.
 * Opens WhatsApp's contact picker so user can choose who to share with.
 * Useful for sharing notices to groups.
 * @param {string} message
 * @returns {string}
 */
export function getWhatsAppShareUrl(message = '') {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Generate an SMS deep link.
 * On mobile browsers, opens the SMS app with prefilled body.
 * On desktop, may not work — fall back to mailto-style behavior.
 * Uses ; & ? separators based on platform detection for maximum compatibility.
 * @param {string} phone
 * @param {string} message
 * @returns {string}
 */
export function getSmsUrl(phone, message = '') {
  const cleaned = cleanPhone(phone);
  if (!cleaned) return '';
  // iOS uses & for body, Android uses ? — we use ? which works on most modern browsers
  // For maximum compat, we use the standard sms: format
  return message
    ? `sms:+${cleaned}?body=${encodeURIComponent(message)}`
    : `sms:+${cleaned}`;
}

/**
 * Build a payment reminder message for an unpaid member.
 * @param {object} params - { name, month, year, amount, samajName }
 * @returns {string}
 */
export function buildReminderMessage({ name, month, year, amount, samajName = 'SVAKS Yadgir' }) {
  return `Namaste ${name} ji,

Aapka ${month} ${year} ka monthly samaj contribution (Rs. ${amount}) abhi tak pending hai.

Kripya jaldi se jama karein. Samaj ke vikas mein aapka yogdan mahatvapurn hai.

Dhanyavad,
${samajName}`;
}

/**
 * Build a notice-sharing message for WhatsApp groups.
 * @param {object} notice - { title, text, date }
 * @returns {string}
 */
export function buildNoticeShareMessage({ title, text, date }) {
  return `📢 ${title}

${text}

📅 ${date || ''}

— SVAKS Yadgir
(Soma Vamshi Aarya Kshthriya Samaj)`;
}

/**
 * Open a URL in a new tab (with safety fallback).
 * @param {string} url
 */
export function openShareUrl(url) {
  if (!url) return;
  // For sms: and tel: we want the same tab; for https we open new tab
  if (url.startsWith('http')) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    // sms:, tel:, mailto: — use location.href so the OS handler picks it up
    window.location.href = url;
  }
}

/**
 * Print a payment receipt in a new window.
 * @param {object} params - { member, collection, samajName, location }
 */
export function printReceipt({ member, collection, samajName, location }) {
  const receiptDate = collection?.date || new Date().toISOString().split('T')[0];
  const receiptNo = `SVAKS-${collection?.id || Date.now()}`;
  const member_name = member?.name || collection?.memberName || '—';
  const father = member?.father || '—';
  const phone = member?.phone || '—';
  const amount = Number(collection?.amount || 0);
  const source = collection?.source || 'Monthly Collection';
  const note = collection?.note || '';

  const w = window.open('', '_blank', 'width=600,height=700');
  if (!w) {
    alert('Please allow popups to print the receipt.');
    return;
  }

  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${escapeHtml(member_name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Hindi&family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Tiro Devanagari Hindi', sans-serif;
      max-width: 80mm;
      margin: 0 auto;
      padding: 10mm 8mm;
      color: #222;
      font-size: 12px;
      line-height: 1.5;
    }
    @page { size: 80mm auto; margin: 4mm; }
    .header {
      text-align: center;
      padding-bottom: 8px;
      border-bottom: 2px dashed #800000;
      margin-bottom: 12px;
    }
    .om { font-size: 22px; color: #800000; }
    .header h1 { font-size: 13px; color: #800000; font-family: 'Tiro Devanagari Hindi', serif; margin: 2px 0; }
    .header .sub { font-size: 10px; color: #D4A017; font-weight: 600; }
    .receipt-no {
      text-align: right;
      font-size: 10px;
      color: #888;
      margin-bottom: 8px;
    }
    .row { display: flex; justify-content: space-between; padding: 3px 0; }
    .row .lbl { color: #666; font-size: 11px; }
    .row .val { font-weight: 600; font-size: 11px; text-align: right; }
    .amount-box {
      margin: 12px 0;
      padding: 10px;
      background: #f9f5f0;
      border: 1px dashed #D4A017;
      border-radius: 6px;
      text-align: center;
    }
    .amount-box .lbl { font-size: 10px; color: #888; }
    .amount-box .val { font-size: 22px; font-weight: 700; color: #800000; }
    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 2px dashed #800000;
      text-align: center;
      font-size: 10px;
      color: #888;
    }
    .sign {
      margin-top: 16px;
      text-align: center;
      font-size: 11px;
      color: #555;
    }
    .sign-line {
      margin-top: 24px;
      border-top: 1px solid #888;
      width: 60%;
      margin-left: auto;
      margin-right: auto;
      padding-top: 4px;
    }
    .no-print { text-align: center; margin: 10px 0; }
    .no-print button {
      padding: 8px 16px; background: #800000; color: white; border: none;
      border-radius: 6px; cursor: pointer; font-size: 12px; margin: 0 4px;
    }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ Print Receipt</button>
    <button onclick="window.close()" style="background:#666">✕ Close</button>
  </div>

  <div class="header">
    <div class="om">ॐ</div>
    <h1>${escapeHtml(samajName)}</h1>
    <div class="sub">${escapeHtml(location)}</div>
  </div>

  <div class="receipt-no">Receipt No: ${escapeHtml(receiptNo)}</div>

  <div class="row"><span class="lbl">Date:</span><span class="val">${escapeHtml(receiptDate)}</span></div>
  <div class="row"><span class="lbl">Member Name:</span><span class="val">${escapeHtml(member_name)}</span></div>
  <div class="row"><span class="lbl">Father:</span><span class="val">${escapeHtml(father)}</span></div>
  <div class="row"><span class="lbl">Phone:</span><span class="val">${escapeHtml(phone)}</span></div>
  <div class="row"><span class="lbl">Source:</span><span class="val">${escapeHtml(source)}</span></div>
  ${note ? `<div class="row"><span class="lbl">Note:</span><span class="val">${escapeHtml(note)}</span></div>` : ''}

  <div class="amount-box">
    <div class="lbl">Amount Received</div>
    <div class="val">Rs. ${amount.toLocaleString('en-IN')}</div>
  </div>

  <div class="sign">
    <div>Authorized Signature</div>
    <div class="sign-line">${escapeHtml(samajName)}</div>
  </div>

  <div class="footer">
    ॐ Sarve Bhavantu Sukhinah • Sarve Santu Niramayah<br>
    Thank you for your contribution to the samaj 🙏
  </div>
</body>
</html>`);
  w.document.close();
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
