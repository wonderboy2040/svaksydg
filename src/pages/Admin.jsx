import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../DataContext';
import { useLang } from '../i18n';
import { useTheme } from '../utils/useTheme';
import { usePWAInstall, useServiceWorker } from '../utils/usePWA';
import { useToast } from '../components/Toast';
import { getDirectImageUrl, validateImageUrl, PLACEHOLDER_IMAGE } from '../utils';
import {
  getWhatsAppUrl,
  getSmsUrl,
  buildReminderMessage,
  openShareUrl,
  printReceipt
} from '../utils/reminder';
import { generateAnnualStatement, generateBulkStatements } from '../utils/annualStatement';
import Modal from '../components/Modal';
import PDFExport from '../components/PDFExport';
import { APP_VERSION } from '../config';
import Loading from '../components/Loading';
import '../styles/Admin.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CURRENT_YEAR = new Date().getFullYear();
const COLLECTION_SOURCES = ['Monthly Collection', 'Donation', 'Special Contribution', 'Event Income', 'Other'];
const EXPENSE_CATEGORIES = ['Gudi Pujari', 'Cleaner', 'Milk & Curd', 'Flowers', 'SAMAJ Collector Fee', 'Admin Cost', 'Event Expense', 'Maintenance', 'Help/Support', 'Travel', 'Printing', 'Other'];

// CSV cell escaping — wrap in quotes and escape internal quotes.
// Prevents commas/quotes/newlines in names from breaking the CSV.
const csvCell = (val) => {
  const s = String(val == null ? '' : val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

function getMonthPaymentStatus(members, collections, month, year) {
  const paid = new Set();

  // Safe date parsing
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  // A collection is "valid" (counts toward paid status) if it has a positive
  // amount AND is not a cancelled entry (note starts with CANCELLED —).
  // This prevents the "Mark Unpaid" flow from leaving phantom paid entries.
  const isValidCollection = (c) => {
    const amount = Number(c.amount || 0);
    if (amount <= 0) return false;
    const note = String(c.note || '');
    if (note.startsWith('CANCELLED —') || note.startsWith('CANCELLED-')) return false;
    return true;
  };

  collections.forEach(c => {
    if (!isValidCollection(c)) return;
    const d = parseDate(c.date);
    if (d && d.getMonth() === month && d.getFullYear() === year && c.memberId) {
      paid.add(c.memberId);
    }
  });

  return members.map(m => {
    // Filter valid collections for this member in this month
    const memberCollections = collections.filter(c => {
      if (!c.memberId || c.memberId !== m.id) return false;
      if (!isValidCollection(c)) return false;
      const d = parseDate(c.date);
      return d && d.getMonth() === month && d.getFullYear() === year;
    });

    const paidCount = memberCollections.length;
    const paidAmount = memberCollections.reduce((s, c) => s + Number(c.amount || 0), 0);

    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      paid: paid.has(m.id),
      paidCount,
      paidAmount
    };
  });
}

// ===== DASHBOARD SECTION =====
function DashboardSection() {
  const { members, collections, expenditure, settings, setData, bulkAddCollections, saving } = useData();
  const { addToast } = useToast();
  const { t } = useLang();

  const safeParseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  const totalCollections = collections.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalExpenditure = expenditure.reduce((s, e) => s + Number(e.amount || 0), 0);
  const balance = totalCollections - totalExpenditure;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthStatus = getMonthPaymentStatus(members, collections, currentMonth, currentYear);
  const paidCount = monthStatus.filter(m => m.paid).length;
  const unpaidCount = monthStatus.filter(m => !m.paid).length;

  // Build reminder message for an unpaid member
  const buildMsg = (m) => {
    const member = members.find(mem => mem.id === m.id);
    const amount = member?.monthlyFee || settings.monthlyFee || 100;
    return buildReminderMessage({
      name: m.name,
      month: MONTHS[currentMonth],
      year: currentYear,
      amount,
      samajName: settings.appName || 'SVAKS Yadgir'
    });
  };

  // Send reminder via WhatsApp
  const handleWhatsAppReminder = (m) => {
    if (!m.phone) {
      addToast(t('reminder.noPhone'), 'warning');
      return;
    }
    openShareUrl(getWhatsAppUrl(m.phone, buildMsg(m)));
  };

  // Send reminder via SMS
  const handleSmsReminder = (m) => {
    if (!m.phone) {
      addToast(t('reminder.noPhone'), 'warning');
      return;
    }
    openShareUrl(getSmsUrl(m.phone, buildMsg(m)));
  };

  // Bulk WhatsApp reminder: open each unpaid member's chat one by one
  // (browsers block multiple window.open, so we just open the first one
  // and show a toast listing the unpaid count for the admin to follow up)
  const handleBulkWhatsApp = () => {
    const unpaid = monthStatus.filter(m => !m.paid && m.phone);
    if (unpaid.length === 0) {
      addToast('No pending members with phone numbers', 'info');
      return;
    }
    if (!window.confirm(`Send WhatsApp reminders to ${unpaid.length} unpaid members? (First chat will open — send the prefilled message, then come back to open the next.)`)) {
      return;
    }
    // Open the first one — admin manually continues
    openShareUrl(getWhatsAppUrl(unpaid[0].phone, buildMsg(unpaid[0])));
    addToast(`${unpaid.length} reminders queued. Open them one by one from the table below.`, 'info');
  };

  const markAllPaid = async () => {
    if (unpaidCount === 0) {
      addToast('All members already paid!', 'info');
      return;
    }
    if (window.confirm(`Mark all ${unpaidCount} pending members as paid for ${MONTHS[currentMonth]}?`)) {
      const newEntries = [];
      const baseId = Date.now();
      let i = 0;
      monthStatus.forEach(m => {
        if (!m.paid) {
          // Use a robust unique id: base timestamp + index + random suffix
          // to prevent collisions even with very large member lists.
          newEntries.push({
            id: baseId + i * 1000 + Math.floor(Math.random() * 1000),
            memberId: m.id,
            memberName: m.name,
            amount: members.find(mem => mem.id === m.id)?.monthlyFee || 100,
            source: 'Monthly Collection',
            date: new Date().toISOString().split('T')[0],
            note: `Bulk marked paid for ${MONTHS[currentMonth]} ${currentYear}`
          });
          i++;
        }
      });
      const success = await bulkAddCollections(newEntries);
      if (success) addToast('All members marked as paid & saved to cloud!', 'success');
      else addToast('Failed to save to cloud!', 'danger');
    }
  };

  const recentCollections = [...collections]
    .sort((a, b) => safeParseDate(b.date) - safeParseDate(a.date))
    .slice(0, 10);
  const recentExpenditure = [...expenditure]
    .sort((a, b) => safeParseDate(b.date) - safeParseDate(a.date))
    .slice(0, 10);

  // Print receipt for a collection entry
  const handlePrintReceipt = (collection) => {
    const member = members.find(m => m.id === collection.memberId);
    printReceipt({
      member,
      collection,
      samajName: settings.appName || 'SVAKS Yadgir',
      location: settings.location || 'Yadgir'
    });
  };

  return (
    <div className="fade-in">
      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card members">
          <div className="summary-icon">👥</div>
          <h4>{t('admin.totalMembers')}</h4>
          <div className="big-number">{members.length}</div>
        </div>
        <div className="summary-card collections">
          <div className="summary-icon">💰</div>
          <h4>{t('admin.totalCollections')}</h4>
          <div className="big-number">₹{totalCollections.toLocaleString('en-IN')}</div>
        </div>
        <div className="summary-card expenditure">
          <div className="summary-icon">📊</div>
          <h4>{t('admin.totalExpense')}</h4>
          <div className="big-number">₹{totalExpenditure.toLocaleString('en-IN')}</div>
        </div>
        <div className="summary-card balance">
          <div className="summary-icon">🏦</div>
          <h4>{t('admin.balance')}</h4>
          <div className="big-number">₹{balance.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Current Month Status */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>{MONTHS[currentMonth]} {currentYear} - Monthly Payment Status</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-gold">
              {paidCount} Paid | {unpaidCount} Pending
            </span>
            <button
              className="btn-whatsapp"
              onClick={handleBulkWhatsApp}
              title="Send WhatsApp reminders to unpaid members"
            >
              💬 Bulk WhatsApp
            </button>
            <button
              className="btn-primary btn-sm"
              onClick={markAllPaid}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {t('admin.markAllPaid')}
            </button>
          </div>
        </div>
        {members.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No members yet. Add members first!</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Times</th>
                  <th>Reminders</th>
                </tr>
              </thead>
              <tbody>
                {monthStatus.map((m, i) => (
                  <tr key={m.id}>
                    <td>{i + 1}</td>
                    <td>{m.name}</td>
                    <td>{m.phone || '-'}</td>
                    <td>
                      {m.paid
                        ? <span className="badge badge-success">Paid</span>
                        : <span className="badge badge-danger">Pending</span>
                      }
                    </td>
                    <td>₹{m.paidAmount.toLocaleString('en-IN')}</td>
                    <td>{m.paidCount}</td>
                    <td>
                      {!m.paid && m.phone ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn-whatsapp"
                            onClick={() => handleWhatsAppReminder(m)}
                            title="Send WhatsApp reminder"
                          >
                            💬
                          </button>
                          <button
                            className="btn-sms"
                            onClick={() => handleSmsReminder(m)}
                            title="Send SMS reminder"
                          >
                            📱
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#aaa', fontSize: '11px' }}>{m.paid ? '✓ Paid' : 'No phone'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="dashboard-grid">
        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Recent Collections</h3>
            <span className="badge badge-success">{recentCollections.length} entries</span>
          </div>
          {recentCollections.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999' }}>No collections yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Member</th><th>Amount</th><th>Source</th><th>Receipt</th></tr>
                </thead>
                <tbody>
                  {recentCollections.map(c => (
                    <tr key={c.id}>
                      <td>{c.date || '-'}</td>
                      <td>{c.memberName || '-'}</td>
                      <td>₹{Number(c.amount).toLocaleString('en-IN')}</td>
                      <td><span className="badge badge-gold">{c.source || 'Other'}</span></td>
                      <td>
                        <button
                          className="btn-receipt"
                          onClick={() => handlePrintReceipt(c)}
                          title="Print receipt"
                        >
                          {t('admin.printReceipt')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h3>Recent Expenses</h3>
            <span className="badge badge-maroon">{recentExpenditure.length} entries</span>
          </div>
          {recentExpenditure.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999' }}>No expenses recorded.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Category</th><th>Amount</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {recentExpenditure.map(e => (
                    <tr key={e.id}>
                      <td>{e.date || '-'}</td>
                      <td><span className="badge badge-maroon">{e.category || 'Other'}</span></td>
                      <td>₹{Number(e.amount).toLocaleString('en-IN')}</td>
                      <td>{e.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== MEMBERS SECTION =====
function MembersSection() {
  const { members, addMember, updateMember, settings, saving } = useData();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', father: '', phone: '', address: '', occupation: '', monthlyFee: '', other: '' });

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.phone?.includes(search) ||
    m.father?.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setForm({ name: '', father: '', phone: '', address: '', occupation: '', monthlyFee: '', other: '' });
    setEditId(null);
  };

  const openEdit = (member) => {
    setForm({
      name: member.name || '',
      father: member.father || '',
      phone: member.phone || '',
      address: member.address || '',
      occupation: member.occupation || '',
      monthlyFee: member.monthlyFee || '',
      other: member.other || ''
    });
    setEditId(member.id);
    setShowModal(true);
  };

  const openAdd = () => {
    resetForm();
    setForm(prev => ({ ...prev, monthlyFee: settings.monthlyFee }));
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      addToast('Name is required!', 'danger');
      return;
    }
    
    // Close modal and reset instantly for native speed feel
    setShowModal(false);
    
    if (editId) {
      updateMember(editId, form).then(success => {
        if (success) addToast('Member updated & saved to cloud!', 'success');
        else addToast('Failed to save to cloud!', 'danger');
      });
    } else {
      addMember(form).then(success => {
        if (success) addToast('Member added & saved to cloud!', 'success');
        else addToast('Failed to save to cloud!', 'danger');
      });
    }
    resetForm();
  };

  // Delete removed — only allowed from Google Sheets directly

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Members List ({members.length})</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              className="search-input"
              placeholder="Search members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn-primary" onClick={openAdd}>+ Add Member</button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '30px' }}>
            {members.length === 0 ? 'No members yet. Add your first member!' : 'No search results found.'}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Father</th><th>Phone</th><th>Address</th><th>Occupation</th><th>Monthly Fee</th><th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.id}>
                    <td>{i + 1}</td>
                    <td><strong>{m.name}</strong></td>
                    <td>{m.father || '-'}</td>
                    <td>{m.phone || '-'}</td>
                    <td>{m.address || '-'}</td>
                    <td>{m.occupation || '-'}</td>
                    <td>₹{Number(m.monthlyFee).toLocaleString('en-IN')}</td>
                    <td>
                      <button onClick={() => openEdit(m)} className="btn-action btn-edit">✏️ Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editId ? 'Edit Member' : 'Add New Member'}>
        <div className="modal-form">
          {[
            { key: 'name', label: 'Full Name *', placeholder: 'Enter full name' },
            { key: 'father', label: 'Father Name', placeholder: 'Father name' },
            { key: 'phone', label: 'Phone', placeholder: 'Phone number', type: 'tel' },
            { key: 'address', label: 'Address', placeholder: 'Full address' },
            { key: 'occupation', label: 'Occupation', placeholder: 'Job / Business' },
            { key: 'monthlyFee', label: 'Monthly Fee', placeholder: 'Monthly amount' },
            { key: 'other', label: 'Other Notes', placeholder: 'Any additional info' }
          ].map(field => (
            <div key={field.key} className="form-group">
              <label>{field.label}</label>
              <input
                type={field.type || 'text'}
                value={form[field.key]}
                placeholder={field.placeholder}
                onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>{editId ? 'Save Changes' : 'Add Member'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== COLLECTIONS SECTION =====
function CollectionsSection() {
  const { collections, members, addCollection, updateCollection, settings } = useData();
  const { addToast } = useToast();
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ memberId: '', memberName: '', amount: '', source: 'Monthly Collection', note: '', date: new Date().toISOString().split('T')[0] });

  const resetForm = () => {
    setForm({ memberId: '', memberName: '', amount: '', source: 'Monthly Collection', note: '', date: new Date().toISOString().split('T')[0] });
    setEditId(null);
  };

  const openEdit = (item) => {
    setForm({
      memberId: item.memberId || '',
      memberName: item.memberName || '',
      amount: item.amount || '',
      source: item.source || 'Monthly Collection',
      note: item.note || '',
      date: item.date || ''
    });
    setEditId(item.id);
    setShowModal(true);
  };

  const filtered = collections.filter(c => {
    if (!c.date) return false;
    const d = new Date(c.date);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  }).sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateB - dateA;
  });

  const monthlyTotal = filtered.reduce((s, c) => s + Number(c.amount || 0), 0);

  // Print receipt for a collection entry
  const handlePrintReceipt = (collection) => {
    const member = members.find(m => m.id === collection.memberId);
    printReceipt({
      member,
      collection,
      samajName: settings.appName || 'SVAKS Yadgir',
      location: settings.location || 'Yadgir'
    });
  };

  const handleSave = () => {
    if (!form.memberId && !form.memberName) {
      addToast('Please select a member or enter name!', 'danger');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      addToast('Please enter amount!', 'danger');
      return;
    }

    // Close modal instantly
    setShowModal(false);

    if (editId) {
      updateCollection(editId, form).then(success => {
        if (success) addToast('Payment updated & saved to cloud!', 'success');
        else addToast('Failed to save to cloud!', 'danger');
      });
    } else {
      addCollection(form).then(success => {
        if (success) addToast('Payment recorded & saved to cloud!', 'success');
        else addToast('Failed to save to cloud!', 'danger');
      });
    }
    resetForm();
  };

  // Delete removed — only allowed from Google Sheets directly

  const selectMember = (memberId) => {
    const member = members.find(m => m.id === memberId);
    setForm({
      memberId,
      memberName: member ? member.name : '',
      amount: member?.monthlyFee || form.amount,
      source: 'Monthly Collection',
      note: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Collections</h3>
          <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>+ Add Collection</button>
        </div>

        <div className="filters-row">
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
            {[CURRENT_YEAR - 3, CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
          <span className="badge badge-gold" style={{ fontSize: '14px', padding: '8px 16px' }}>
            Total: ₹{monthlyTotal.toLocaleString('en-IN')} ({filtered.length} entries)
          </span>
        </div>

        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '30px' }}>No collections this month.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Date</th><th>Member</th><th>Amount</th><th>Source</th><th>Note</th><th>Receipt</th><th>Edit</th></tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id}>
                    <td>{i + 1}</td>
                    <td>{c.date}</td>
                    <td>{c.memberName || '-'}</td>
                    <td><strong>₹{Number(c.amount).toLocaleString('en-IN')}</strong></td>
                    <td><span className="badge badge-gold">{c.source || 'Other'}</span></td>
                    <td>{c.note || '-'}</td>
                    <td>
                      <button
                        className="btn-receipt"
                        onClick={() => handlePrintReceipt(c)}
                        title="Print receipt"
                      >
                        🧾
                      </button>
                    </td>
                    <td>
                      <button onClick={() => openEdit(c)} className="btn-action btn-edit">✏️ Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editId ? "Edit Collection" : "Add New Collection"}>
        <div className="modal-form">
          <div className="form-group">
            <label>Select Member</label>
            <select
              value={form.memberId}
              onChange={e => selectMember(Number(e.target.value))}
            >
              <option value="">-- Select Member --</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Or Enter Member Name (if not in list)</label>
            <input
              value={form.memberName}
              onChange={e => setForm(prev => ({ ...prev, memberName: e.target.value }))}
              placeholder="Enter name"
            />
          </div>
          <div className="form-group">
            <label>Amount (₹) *</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="Enter amount"
            />
          </div>
          <div className="form-group">
            <label>Source</label>
            <select
              value={form.source}
              onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))}
            >
              {COLLECTION_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Note</label>
            <input
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
              placeholder="Optional note"
            />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>{editId ? "Save Changes" : "Add Collection"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== MONTHLY FIXED COLLECTION SECTION =====
// For 65 permanent members who pay Rs. 200/month.
// Quick paid/unpaid toggle with receipt number field.
function MonthlyFixedCollectionSection() {
  const { members, collections, bulkAddCollections, updateCollection, settings, saving } = useData();
  const { addToast } = useToast();
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [receiptInputs, setReceiptInputs] = useState({}); // { [memberId]: receiptNo }
  const [search, setSearch] = useState('');

  const FIXED_AMOUNT = Number(settings.monthlyFee) || 200;

  // Parse date safely
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // For each member, check if they've paid this month/year
  // Excludes cancelled entries (amount=0 with CANCELLED note)
  const memberStatus = members.map(m => {
    const memberCollections = collections.filter(c => {
      if (c.memberId !== m.id) return false;
      // Exclude cancelled entries
      const note = String(c.note || '');
      if (note.startsWith('CANCELLED —') || note.startsWith('CANCELLED-')) return false;
      if (Number(c.amount || 0) <= 0) return false;
      const d = parseDate(c.date);
      return d && d.getMonth() === filterMonth && d.getFullYear() === filterYear;
    });
    const collection = memberCollections[0]; // First collection this month
    return {
      ...m,
      paid: memberCollections.length > 0,
      collectionId: collection?.id || null,
      receiptNo: collection?.receiptNo || '',
      paidAmount: memberCollections.reduce((s, c) => s + Number(c.amount || 0), 0)
    };
  });

  const filtered = memberStatus.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.phone?.includes(search) ||
    m.father?.toLowerCase().includes(search.toLowerCase())
  );

  const paidCount = memberStatus.filter(m => m.paid).length;
  const unpaidCount = memberStatus.length - paidCount;
  const totalCollected = memberStatus.reduce((s, m) => s + m.paidAmount, 0);
  const expectedTotal = members.length * FIXED_AMOUNT;

  // Mark a single member as paid
  const handleMarkPaid = async (member) => {
    const receiptNo = (receiptInputs[member.id] || '').trim();
    if (!receiptNo) {
      addToast(`Receipt number required for ${member.name}!`, 'warning');
      return;
    }

    const newCollection = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      memberId: member.id,
      memberName: member.name,
      amount: FIXED_AMOUNT,
      source: 'Monthly Collection',
      note: `Fixed monthly collection - ${MONTHS[filterMonth]} ${filterYear}`,
      receiptNo,
      date: new Date(filterYear, filterMonth, new Date().getDate()).toISOString().split('T')[0]
    };

    const success = await bulkAddCollections([newCollection]);
    if (success) {
      addToast(`${member.name} marked as Paid (Rs. ${FIXED_AMOUNT}) ✓`, 'success');
      setReceiptInputs(prev => ({ ...prev, [member.id]: '' }));
    } else {
      addToast('Failed to save — try again!', 'danger');
    }
  };

  // Unmark (mark as unpaid) — removes the collection entry from local state
  // Note: actual deletion from Google Sheets must be done manually
  const handleMarkUnpaid = async (member) => {
    if (!member.collectionId) {
      addToast(`${member.name} has no collection to remove`, 'info');
      return;
    }
    if (!window.confirm(`Mark ${member.name} as UNPAID for ${MONTHS[filterMonth]} ${filterYear}?\n\nNote: This removes the entry from local view. To permanently delete from Google Sheets, do it manually.`)) {
      return;
    }

    // Update the collection to set amount=0 and note as cancelled
    // (we can't delete via API, so we mark it as cancelled)
    const success = await updateCollection(member.collectionId, {
      amount: 0,
      note: `CANCELLED — ${MONTHS[filterMonth]} ${filterYear}`,
      receiptNo: ''
    });

    if (success) {
      addToast(`${member.name} marked as Unpaid ✗`, 'info');
    } else {
      addToast('Failed to update — try again!', 'danger');
    }
  };

  // Quick fill: auto-generate receipt number
  const handleAutoReceipt = (memberId) => {
    const auto = `R${filterYear}${String(filterMonth + 1).padStart(2, '0')}${String(memberId).slice(-3)}`;
    setReceiptInputs(prev => ({ ...prev, [memberId]: auto }));
  };

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>📅 Fixed Monthly Collection ({MONTHS[filterMonth]} {filterYear})</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-success" style={{ fontSize: '13px', padding: '6px 12px' }}>
              ✓ {paidCount} Paid
            </span>
            <span className="badge badge-danger" style={{ fontSize: '13px', padding: '6px 12px' }}>
              ✗ {unpaidCount} Pending
            </span>
            <span className="badge badge-gold" style={{ fontSize: '13px', padding: '6px 12px' }}>
              ₹{totalCollected.toLocaleString('en-IN')} / ₹{expectedTotal.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-row" style={{ marginBottom: '12px' }}>
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
            {[CURRENT_YEAR - 3, CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
          <input
            className="search-input"
            placeholder="🔍 Search member..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(212,160,23,0.08)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
            <span style={{ color: '#888' }}>Collection Progress</span>
            <span style={{ fontWeight: '600', color: '#800000' }}>
              {Math.round((paidCount / Math.max(members.length, 1)) * 100)}%
            </span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(paidCount / Math.max(members.length, 1)) * 100}%`,
              background: 'linear-gradient(90deg, #00B894, #00cec9)',
              transition: 'width 0.5s ease',
              borderRadius: '4px'
            }}></div>
          </div>
        </div>

        {members.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '30px' }}>
            No members yet. Add members first from the Members tab!
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '30px' }}>
            No members match your search.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Member Name</th>
                  <th>Father</th>
                  <th>Phone</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Receipt No.</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.id} style={{ background: m.paid ? 'rgba(0,184,148,0.05)' : 'transparent' }}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{m.name}</strong>
                      {m.father && <div style={{ fontSize: '11px', color: '#888' }}>{m.father}</div>}
                    </td>
                    <td>{m.father || '-'}</td>
                    <td>{m.phone || '-'}</td>
                    <td>
                      {m.paid ? (
                        <strong style={{ color: '#00B894' }}>₹{m.paidAmount.toLocaleString('en-IN')}</strong>
                      ) : (
                        <span style={{ color: '#E17055' }}>₹{FIXED_AMOUNT.toLocaleString('en-IN')}</span>
                      )}
                    </td>
                    <td>
                      {m.paid
                        ? <span className="badge badge-success">✓ Paid</span>
                        : <span className="badge badge-danger">✗ Pending</span>
                      }
                      {m.paid && m.receiptNo && (
                        <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                          Receipt: {m.receiptNo}
                        </div>
                      )}
                    </td>
                    <td>
                      {m.paid ? (
                        <span style={{ fontSize: '12px', color: '#888' }}>{m.receiptNo || '—'}</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={receiptInputs[m.id] || ''}
                            onChange={e => setReceiptInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                            placeholder="Receipt #"
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              width: '110px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              background: 'rgba(255,255,255,0.05)'
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && (receiptInputs[m.id] || '').trim()) {
                                handleMarkPaid(m);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAutoReceipt(m.id)}
                            title="Auto-generate receipt number"
                            style={{
                              padding: '4px 6px',
                              fontSize: '11px',
                              background: 'rgba(108,92,231,0.2)',
                              border: '1px solid rgba(108,92,231,0.4)',
                              borderRadius: '4px',
                              color: '#a29bfe',
                              cursor: 'pointer'
                            }}
                          >
                            🎲
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      {m.paid ? (
                        <button
                          onClick={() => handleMarkUnpaid(m)}
                          className="btn-action"
                          style={{
                            background: 'rgba(225,112,85,0.15)',
                            color: '#E17055',
                            border: '1px solid rgba(225,112,85,0.3)',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                          title="Mark as unpaid"
                        >
                          ✗ Unpaid
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkPaid(m)}
                          className="btn-action"
                          style={{
                            background: 'linear-gradient(135deg, #00B894, #00cec9)',
                            color: 'white',
                            border: 'none',
                            padding: '5px 14px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,184,148,0.3)'
                          }}
                          title="Mark as paid"
                        >
                          ✓ Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer summary */}
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '12px', color: '#888' }}>
          <strong>📋 How it works:</strong> Each permanent member pays ₹{FIXED_AMOUNT}/month. Enter the receipt number,
          click "✓ Mark Paid" — done! Use 🎲 to auto-generate a receipt number.
          To remove a payment (wrong entry), click "✗ Unpaid" — but the row in Google Sheets must be deleted manually.
        </div>
      </div>
    </div>
  );
}

// ===== EXPENDITURE SECTION =====
function ExpenditureSection() {
  const { expenditure, addExpenditure, updateExpenditure } = useData();
  const { addToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });

  const safeParseAmount = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : Math.abs(num);
  };

  const totalExpense = expenditure.reduce((s, e) => s + safeParseAmount(e.amount), 0);

  const resetForm = () => {
    setForm({ category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    setEditId(null);
  };

  const openEdit = (item) => {
    setForm({
      category: item.category || '',
      amount: item.amount || '',
      description: item.description || '',
      date: item.date || ''
    });
    setEditId(item.id);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.amount || Number(form.amount) <= 0) {
      addToast('Please enter amount!', 'danger');
      return;
    }
    
    // Close modal instantly
    setShowModal(false);
    
    if (editId) {
      updateExpenditure(editId, form).then(success => {
        if (success) addToast('Expense updated & saved to cloud!', 'success');
        else addToast('Failed to save to cloud!', 'danger');
      });
    } else {
      addExpenditure(form).then(success => {
        if (success) addToast('Expense recorded & saved to cloud!', 'success');
        else addToast('Failed to save to cloud!', 'danger');
      });
    }
    resetForm();
  };

  // Delete removed — only allowed from Google Sheets directly

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Expenditure ({expenditure.length})</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span className="badge badge-gold" style={{ fontSize: '14px', padding: '8px 16px' }}>
              Total: ₹{totalExpense.toLocaleString('en-IN')}
            </span>
            <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Expense</button>
          </div>
        </div>
        {expenditure.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '30px' }}>No expenses recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Date</th><th>Category</th><th>Amount</th><th>Description</th><th>Edit</th></tr>
              </thead>
              <tbody>
                {[...expenditure].sort((a, b) => {
                  const dateA = a.date ? new Date(a.date) : new Date(0);
                  const dateB = b.date ? new Date(b.date) : new Date(0);
                  return dateB - dateA;
                }).map((e, i) => (
                  <tr key={e.id}>
                    <td>{i + 1}</td>
                    <td>{e.date || '-'}</td>
                    <td><span className="badge badge-maroon">{e.category || 'Other'}</span></td>
                    <td><strong>₹{Number(e.amount).toLocaleString('en-IN')}</strong></td>
                    <td>{e.description || '-'}</td>
                    <td>
                      <button onClick={() => openEdit(e)} className="btn-action btn-edit">✏️ Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editId ? 'Edit Expense' : 'Add New Expense'}>
        <div className="modal-form">
          <div className="form-group">
            <label>Category</label>
            <select
              value={form.category}
              onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">-- Select Category --</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Amount (₹) *</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="Enter amount"
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What was this expense for?"
            />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>{editId ? 'Save Changes' : 'Add Expense'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== GALLERY SECTION =====
function GallerySection() {
  const { gallery, addGalleryAlbum, updateGalleryAlbum, addPhotoToAlbum } = useData();
  const { addToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [editAlbum, setEditAlbum] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [urlStatus, setUrlStatus] = useState(null);
  const [form, setForm] = useState({ title: '', date: '', cover: '' });

  // Safe gallery with default
  const safeGallery = gallery || [];
  const totalPhotos = safeGallery.reduce((sum, album) => sum + (album.photos?.length || 0), 0);

  const handleCreateAlbum = () => {
    if (!form.title.trim()) {
      addToast('Album title is required!', 'danger');
      return;
    }
    setShowModal(false);
    addGalleryAlbum({
      title: form.title,
      date: form.date || new Date().toLocaleDateString('en-IN'),
      cover: form.cover,
      photos: []
    }).then(success => {
      if (success) addToast('Album created & saved to cloud!', 'success');
      else addToast('Failed to save to cloud!', 'danger');
    });
    setForm({ title: '', date: '', cover: '' });
  };

  const handleUpdateAlbum = () => {
    if (!editAlbum || !form.title.trim()) return;
    setShowModal(false);
    updateGalleryAlbum(editAlbum.id, {
      title: form.title,
      date: form.date,
      cover: form.cover
    }).then(success => {
      if (success) addToast('Album updated & saved to cloud!', 'success');
      else addToast('Failed to save to cloud!', 'danger');
    });
    setEditAlbum(null);
    setForm({ title: '', date: '', cover: '' });
  };

  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) {
      addToast('Please enter photo URL!', 'danger');
      return;
    }
    setShowPhotoModal(false);
    addPhotoToAlbum(selectedAlbum.id, newPhotoUrl).then(success => {
      if (success) addToast('Photo added & saved to cloud!', 'success');
      else addToast('Failed to save to cloud!', 'danger');
    });
    setNewPhotoUrl('');
    setUrlStatus(null);
  };

  const openEdit = (album) => {
    setEditAlbum(album);
    setForm({ title: album.title, date: album.date || '', cover: album.cover || '' });
    setShowModal(true);
  };

  const openPhotoAdd = (album) => {
    setSelectedAlbum(album);
    setNewPhotoUrl('');
    setShowPhotoModal(true);
  };

  // Delete removed — only allowed from Google Sheets directly

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Photo Gallery ({safeGallery.length} albums, {totalPhotos} photos)</h3>
          <button className="btn-primary" onClick={() => { setEditAlbum(null); setForm({ title: '', date: '', cover: '' }); setShowModal(true); }}>
            + New Album
          </button>
        </div>

        {safeGallery.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            <span style={{ fontSize: '48px' }}>📸</span>
            <p>No albums yet. Create your first album!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', padding: '16px' }}>
            {safeGallery.map(album => (
              <div key={album.id} style={{
                background: 'linear-gradient(135deg, #2D1810, #1a0a00)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(212,160,23,0.2)'
              }}>
                {/* Cover Image */}
                <div style={{ height: '140px', background: album.cover ? `url(${getDirectImageUrl(album.cover)}) center/cover` : 'linear-gradient(135deg, #800000, #a00000)', position: 'relative' }}>
                  {!album.cover && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '40px', color: '#D4A017' }}>
                      📸
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#D4A017' }}>{album.photos?.length || 0} photos</span>
                  </div>
                </div>

                {/* Album Info */}
                <div style={{ padding: '12px' }}>
                  <h4 style={{ color: '#fff', fontSize: '14px', marginBottom: '4px', fontWeight: '600' }}>{album.title}</h4>
                  <p style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>{album.date}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button onClick={() => setSelectedAlbum(album)} style={{ flex: 1, padding: '6px', background: 'rgba(212,160,23,0.2)', border: '1px solid rgba(212,160,23,0.4)', borderRadius: '6px', color: '#D4A017', fontSize: '12px', cursor: 'pointer' }}>
                      👁️ View
                    </button>
                    <button onClick={() => openPhotoAdd(album)} style={{ flex: 1, padding: '6px', background: 'rgba(0,184,148,0.2)', border: '1px solid rgba(0,184,148,0.4)', borderRadius: '6px', color: '#00B894', fontSize: '12px', cursor: 'pointer' }}>
                      ➕ Photo
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button onClick={() => openEdit(album)} style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#ccc', fontSize: '11px', cursor: 'pointer' }}>
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Album Modal */}
      {selectedAlbum && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', zIndex: 99999,
          display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '16px', background: '#2D1810', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: '#D4A017', marginBottom: '4px' }}>{selectedAlbum.title}</h3>
              <span style={{ color: '#888', fontSize: '13px' }}>{selectedAlbum.date} | {selectedAlbum.photos?.length || 0} photos</span>
            </div>
            <button onClick={() => setSelectedAlbum(null)} style={{ padding: '8px 16px', background: '#800000', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>
              ✕ Close
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {selectedAlbum.photos?.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                <span style={{ fontSize: '48px' }}>📷</span>
                <p>No photos in this album yet.</p>
                <button onClick={() => openPhotoAdd(selectedAlbum)} style={{ marginTop: '16px', padding: '12px 24px', background: '#D4A017', border: 'none', borderRadius: '8px', color: '#000', cursor: 'pointer', fontWeight: '600' }}>
                  Add Photos
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                {selectedAlbum.photos?.map(photo => (
                  <div key={photo.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                    <img
                      src={getDirectImageUrl(photo.url)}
                      alt=""
                      style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = PLACEHOLDER_IMAGE; }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ padding: '16px', background: '#2D1810', textAlign: 'center' }}>
            <button onClick={() => openPhotoAdd(selectedAlbum)} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #D4A017, #FF9933)', border: 'none', borderRadius: '8px', color: '#000', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
              + Add More Photos
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Album Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditAlbum(null); setForm({ title: '', date: '', cover: '' }); }} title={editAlbum ? 'Edit Album' : 'Create New Album'}>
        <div className="modal-form">
          <div className="form-group">
            <label>Album Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Navratri Celebration 2025"
            />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              value={form.date}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
              placeholder="e.g., October 2025"
            />
          </div>
          <div className="form-group">
            <label>Cover Photo URL (Google Drive)</label>
            <input
              value={form.cover}
              onChange={e => setForm(prev => ({ ...prev, cover: e.target.value }))}
              placeholder="https://drive.google.com/..."
            />
            <small style={{ color: '#888', fontSize: '11px' }}>Paste Google Drive photo URL for album cover</small>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowModal(false); setEditAlbum(null); }}>Cancel</button>
            <button className="btn-primary" onClick={editAlbum ? handleUpdateAlbum : handleCreateAlbum}>
              {editAlbum ? 'Save Changes' : 'Create Album'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Photo Modal */}
      <Modal isOpen={showPhotoModal} onClose={() => { setShowPhotoModal(false); setNewPhotoUrl(''); setUrlStatus(null); }} title="Add Photo to Album">
        <div className="modal-form">
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
            Paste a Google Drive or Google Photos URL. You can add multiple photos one by one.
          </p>
          <div className="form-group">
            <label>Photo URL (Google Drive / Google Photos) *</label>
            <input
              value={newPhotoUrl}
              onChange={e => {
                setNewPhotoUrl(e.target.value);
                if (e.target.value.trim()) {
                  setUrlStatus(validateImageUrl(e.target.value));
                } else {
                  setUrlStatus(null);
                }
              }}
              placeholder="https://drive.google.com/file/d/... or https://photos.google.com/..."
            />
            {urlStatus && (
              <small style={{ color: urlStatus.type === 'drive' ? '#00B894' : urlStatus.type === 'photos' ? '#FDCB6E' : '#888', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                {urlStatus.message}
              </small>
            )}
            <small style={{ color: '#666', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              💡 Tip: For Google Drive, right-click image → Get link → set "Anyone with link". For Google Photos, use sharing link.
            </small>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowPhotoModal(false); setNewPhotoUrl(''); setUrlStatus(null); }}>Cancel</button>
            <button className="btn-primary" onClick={handleAddPhoto}>💾 Save Photo to Cloud</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== REPORTS SECTION =====
function ReportsSection() {
  const { members, collections, expenditure } = useData();
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const safeParseDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const monthCollections = collections.filter(c => {
    const d = safeParseDate(c.date);
    if (!d) return false;
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const monthExpenditure = expenditure.filter(e => {
    const d = safeParseDate(e.date);
    if (!d) return false;
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const totalCol = monthCollections.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalExp = monthExpenditure.reduce((s, e) => s + Number(e.amount || 0), 0);

  const monthStatus = getMonthPaymentStatus(members, collections, month, year);

  const handleDownloadPDF = () => {
    PDFExport.exportReport(members, monthCollections, monthExpenditure, monthStatus, month, year);
  };

  // CSV Export function
  const handleExportCSV = (type) => {
    let csvContent = '';
    let filename = '';

    if (type === 'collections') {
      csvContent = 'Date,Member,Amount,Source,Note\n';
      monthCollections.forEach(c => {
        csvContent += [csvCell(c.date), csvCell(c.memberName), csvCell(c.amount), csvCell(c.source), csvCell(c.note)].join(',') + '\n';
      });
      filename = `collections_${MONTHS[month]}_${year}.csv`;
    } else if (type === 'expenditure') {
      csvContent = 'Date,Category,Amount,Description\n';
      monthExpenditure.forEach(e => {
        csvContent += [csvCell(e.date), csvCell(e.category), csvCell(e.amount), csvCell(e.description)].join(',') + '\n';
      });
      filename = `expenditure_${MONTHS[month]}_${year}.csv`;
    } else if (type === 'members') {
      csvContent = 'Name,Father,Phone,Address,Occupation,Monthly Fee,Status,Amount Paid\n';
      monthStatus.forEach(m => {
        const member = members.find(mem => mem.id === m.id);
        csvContent += [
          csvCell(m.name),
          csvCell(member?.father || ''),
          csvCell(m.phone || ''),
          csvCell(member?.address || ''),
          csvCell(member?.occupation || ''),
          csvCell(member?.monthlyFee || 0),
          csvCell(m.paid ? 'Paid' : 'Pending'),
          csvCell(m.paidAmount)
        ].join(',') + '\n';
      });
      filename = `members_${MONTHS[month]}_${year}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Monthly Report - {MONTHS[month]} {year}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" onClick={handleDownloadPDF}>
              📄 PDF
            </button>
            <button className="btn-secondary" onClick={() => handleExportCSV('collections')} style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>
              📊 CSV
            </button>
          </div>
        </div>

        <div className="filters-row">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[CURRENT_YEAR - 3, CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
        </div>

        {/* Summary */}
        <div className="summary-grid" style={{ marginBottom: '24px' }}>
          <div className="summary-card collections">
            <h4>Monthly Income</h4>
            <div className="big-number">₹{totalCol.toLocaleString('en-IN')}</div>
          </div>
          <div className="summary-card expenditure">
            <h4>Monthly Expense</h4>
            <div className="big-number">₹{totalExp.toLocaleString('en-IN')}</div>
          </div>
          <div className="summary-card balance">
            <h4>Monthly Savings</h4>
            <div className="big-number">₹{(totalCol - totalExp).toLocaleString('en-IN')}</div>
          </div>
          <div className="summary-card members">
            <h4>Paid Members</h4>
            <div className="big-number">{monthStatus.filter(m => m.paid).length} / {members.length}</div>
          </div>
        </div>

        {/* Payment Status Table */}
        <h4 style={{ marginBottom: '12px', color: 'var(--maroon)' }}>
          Member Payment Status
        </h4>
        {members.length === 0 ? (
          <p style={{ color: '#999' }}>Add members for reports.</p>
        ) : (
          <div className="table-wrap" style={{ marginBottom: '24px' }}>
            <table>
              <thead>
                <tr><th>#</th><th>Name</th><th>Status</th><th>Amount Paid</th><th>Times</th></tr>
              </thead>
              <tbody>
                {monthStatus.map((m, i) => (
                  <tr key={m.id}>
                    <td>{i + 1}</td>
                    <td>{m.name}</td>
                    <td>
                      {m.paid
                        ? <span className="badge badge-success">Paid ✓</span>
                        : <span className="badge badge-danger">Pending ✗</span>
                      }
                    </td>
                    <td>₹{m.paidAmount.toLocaleString('en-IN')}</td>
                    <td>{m.paidCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Collection Details */}
        {monthCollections.length > 0 && (
          <>
            <h4 style={{ marginBottom: '12px', color: 'var(--maroon)' }}>
              Collection Details
            </h4>
            <div className="table-wrap" style={{ marginBottom: '24px' }}>
              <table>
                <thead><tr><th>#</th><th>Date</th><th>Member</th><th>Amount</th><th>Source</th><th>Note</th></tr></thead>
                <tbody>
                  {monthCollections.map((c, i) => (
                    <tr key={c.id}>
                      <td>{i + 1}</td>
                      <td>{c.date}</td>
                      <td>{c.memberName || '-'}</td>
                      <td>₹{Number(c.amount).toLocaleString('en-IN')}</td>
                      <td>{c.source || '-'}</td>
                      <td>{c.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Expenditure Details */}
        {monthExpenditure.length > 0 && (
          <>
            <h4 style={{ marginBottom: '12px', color: 'var(--maroon)' }}>
              Expenditure Details
            </h4>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Date</th><th>Category</th><th>Amount</th><th>Description</th></tr></thead>
                <tbody>
                  {monthExpenditure.map((e, i) => (
                    <tr key={e.id}>
                      <td>{i + 1}</td>
                      <td>{e.date}</td>
                      <td>{e.category || '-'}</td>
                      <td>₹{Number(e.amount).toLocaleString('en-IN')}</td>
                      <td>{e.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== ANNUAL STATEMENT SECTION =====
function AnnualStatementSection() {
  const { members, collections, settings } = useData();
  const { addToast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [search, setSearch] = useState('');

  const filteredMembers = members.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.father?.toLowerCase().includes(search.toLowerCase()) ||
    m.phone?.includes(search)
  );

  const handleGenerate = () => {
    const member = members.find(m => String(m.id) === String(selectedMemberId));
    if (!member) {
      addToast('Please select a member first!', 'warning');
      return;
    }
    try {
      generateAnnualStatement({ member, collections, year, settings });
      addToast(`Statement generated for ${member.name} (${year})`, 'success');
    } catch (e) {
      console.error('Statement error:', e);
      addToast('Failed to generate statement. Allow popups and try again.', 'danger');
    }
  };

  const handleGenerateBulk = () => {
    if (members.length === 0) {
      addToast('No members to generate statements for!', 'warning');
      return;
    }
    try {
      generateBulkStatements({ members, collections, year, settings });
      addToast(`Bulk generation started for ${members.length} members`, 'info');
    } catch (e) {
      console.error('Bulk statement error:', e);
      addToast('Failed to start bulk generation. Allow popups.', 'danger');
    }
  };

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>📑 Annual Member Statement ({year})</h3>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ maxWidth: '120px' }}
          >
            {[CURRENT_YEAR - 3, CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
        </div>

        <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', marginBottom: '20px' }}>
          <h4 style={{ color: 'var(--gold)', marginBottom: '12px' }}>📄 Generate Single Member Statement</h4>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
            Select a member and click "Generate PDF". Opens in a new window — print or save as PDF.
            Includes month-wise breakdown, totals, pending dues, and signature section.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="search-input"
              placeholder="🔍 Search member..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: '180px' }}
            />
            <select
              value={selectedMemberId}
              onChange={e => setSelectedMemberId(e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            >
              <option value="">-- Select Member ({filteredMembers.length}) --</option>
              {filteredMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}{m.father ? ` (S/o ${m.father})` : ''}</option>
              ))}
            </select>
            <button className="btn-primary" onClick={handleGenerate}>
              📄 Generate PDF
            </button>
          </div>
        </div>

        <div style={{ padding: '20px', background: 'rgba(108,92,231,0.08)', borderRadius: '12px', border: '1px solid rgba(108,92,231,0.2)', marginBottom: '20px' }}>
          <h4 style={{ color: '#a29bfe', marginBottom: '12px' }}>📦 Bulk Generate — All Members</h4>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
            Generates annual statements for all {members.length} members one by one.
            <strong style={{ color: '#FDCB6E' }}> ⚠️ Allow popups</strong> for this site, otherwise only the first statement will open.
            Each statement opens with a 1.5 second delay to avoid popup blocking.
          </p>
          <button
            onClick={handleGenerateBulk}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #6c5ce7, #5a4bd1)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(108,92,231,0.4)'
            }}
          >
            📦 Generate {members.length} Statements
          </button>
        </div>

        <div style={{ padding: '16px', background: 'rgba(0,184,148,0.08)', borderRadius: '12px', border: '1px solid rgba(0,184,148,0.2)' }}>
          <h4 style={{ color: '#00B894', marginBottom: '8px' }}>💡 What's in the statement?</h4>
          <ul style={{ fontSize: '13px', color: '#888', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>Member details (name, father, phone, address, monthly fee)</li>
            <li>Summary cards: Total paid, Months paid, Pending dues, Donations</li>
            <li>Month-wise payment table with dates, amounts, receipt numbers</li>
            <li>Payment summary: Monthly collections vs donations vs other</li>
            <li>Signature lines for member and authorized signatory</li>
            <li>Print-friendly A4 layout — save as PDF from print dialog</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ===== COMMITTEE SECTION =====
function CommitteeSection() {
  const { committee, updateCommittee, saveCommittee, addCommitteeMember, deleteCommitteeMember, saving } = useData();
  const { addToast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };

  const handlePhotoChange = (id, url) => {
    updateCommittee(id, { photo: url });
    setHasChanges(true);
  };

  const handleFieldChange = (id, field, value) => {
    updateCommittee(id, { [field]: value });
    setHasChanges(true);
  };

  const handleAddMember = () => {
    addCommitteeMember({
      id: Date.now(),
      position: 'Committee Member',
      name: '',
      photo: '',
      phone: '',
      address: ''
    });
    setHasChanges(true);
    addToast('New member added locally! Fill details and save.', 'info');
  };

  const handleDeleteMember = (id) => {
    if (window.confirm('Delete this committee member?')) {
      deleteCommitteeMember(id);
      setHasChanges(true);
      addToast('Member removed locally! Save changes to sync.', 'info');
    }
  };

  const handleSaveCommittee = async () => {
    const success = await saveCommittee();
    if (success) {
      addToast('Committee saved to cloud!', 'success');
      setHasChanges(false);
    } else {
      addToast('Failed to save to cloud!', 'danger');
    }
  };

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Committee Members ({committee.length})</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" style={{ background: '#00B894' }} onClick={handleAddMember}>
              ➕ Add Committee Member
            </button>
            {hasChanges && <span style={{ fontSize: '12px', color: '#FDCB6E' }}>⚠️ Unsaved changes</span>}
            <button className="btn-primary" onClick={handleSaveCommittee} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {saving ? '🔄 Saving...' : '💾 Save Committee to Cloud'}
            </button>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#888', padding: '0 16px', marginBottom: '8px' }}>
          Edit fields below, then click "💾 Save Committee to Cloud" to push changes. Use Google Drive or Google Photos links for photos.
        </p>
        
        {committee.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#f8f9fa', borderRadius: '12px', border: '1px dashed #ccc', margin: '20px' }}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>🏛️</span>
            <p style={{ color: '#666', margin: 0 }}>No committee members found.</p>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>Click "➕ Add Committee Member" to build your team.</p>
          </div>
        ) : (
          <div className="committee-edit-grid">
            {committee.map(member => {
              const imgError = false;
              const photoValidation = member.photo ? validateImageUrl(member.photo) : null;
              return (
                <div className="committee-edit-card" key={member.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(225, 112, 85, 0.1)',
                      border: '1px solid rgba(225, 112, 85, 0.3)',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      zIndex: 2,
                      color: '#e17055',
                      transition: 'all 0.2s'
                    }}
                    title="Remove Member"
                    onMouseEnter={e => { e.currentTarget.style.background = '#e17055'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(225, 112, 85, 0.1)'; e.currentTarget.style.color = '#e17055'; }}
                  >
                    🗑️
                  </button>
                  
                  <div className="photo-section">
                    {member.photo ? (
                      <img
                        src={getDirectImageUrl(member.photo)}
                        alt={member.name}
                        className="committee-photo"
                        onError={(e) => {
                          e.target.src = PLACEHOLDER_IMAGE;
                        }}
                      />
                    ) : null}
                    <div className="avatar-placeholder" style={member.photo && !imgError ? { display: 'none' } : {}}>
                      {getInitials(member.name || member.position)}
                    </div>
                  </div>
                  <div className="form-fields">
                    <div style={{ marginBottom: '4px' }}>
                      <span className="position-badge">{member.position || 'Member'}</span>
                    </div>
                    <label>
                      Designation / Position
                      <input
                        value={member.position || ''}
                        onChange={e => handleFieldChange(member.id, 'position', e.target.value)}
                        placeholder="e.g. President, Vice President"
                      />
                    </label>
                    <label>
                      Name
                      <input
                        value={member.name || ''}
                        onChange={e => handleFieldChange(member.id, 'name', e.target.value)}
                        placeholder="Enter name"
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        value={member.phone || ''}
                        onChange={e => handleFieldChange(member.id, 'phone', e.target.value)}
                        placeholder="Phone number"
                      />
                    </label>
                    <label>
                      Photo URL (Google Drive / Google Photos)
                      <input
                        value={member.photo || ''}
                        onChange={e => handlePhotoChange(member.id, e.target.value)}
                        placeholder="https://drive.google.com/... or https://photos.google.com/..."
                      />
                      {photoValidation && (
                        <small style={{ color: photoValidation.type === 'drive' ? '#00B894' : photoValidation.type === 'photos' ? '#FDCB6E' : '#888', fontSize: '10px' }}>
                          {photoValidation.message}
                        </small>
                      )}
                    </label>
                    <label>
                      Address
                      <input
                        value={member.address || ''}
                        onChange={e => handleFieldChange(member.id, 'address', e.target.value)}
                        placeholder="Address"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Bottom Save Button */}
        <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button className="btn-primary" onClick={handleSaveCommittee} disabled={saving} style={{ padding: '12px 32px', fontSize: '15px' }}>
            {saving ? '🔄 Saving to Cloud...' : '💾 Save All Committee Changes to Cloud'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== SETTINGS SECTION =====
function SettingsSection() {
  const { settings, saveSettingsWith, syncToGoogleSheet, loadFromGoogleSheet, exportJSON, importJSON, syncStatus, syncError, syncLastTime, saving, members, collections, expenditure } = useData();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    appName: settings.appName,
    location: settings.location,
    monthlyFee: settings.monthlyFee,
    sheetUrl: settings.sheetUrl
  });

  // Sync local form when cloud settings change (e.g., after poll/refresh)
  useEffect(() => {
    setForm({
      appName: settings.appName,
      location: settings.location,
      monthlyFee: settings.monthlyFee,
      sheetUrl: settings.sheetUrl
    });
  }, [settings.appName, settings.location, settings.monthlyFee, settings.sheetUrl]);

  const handleSaveSettings = async () => {
    // Compute the new settings directly and push to cloud in one shot
    // to avoid the stale-closure problem with sequential updateSetting() calls.
    const success = await saveSettingsWith({
      appName: form.appName?.trim() || settings.appName,
      location: form.location?.trim() || settings.location,
      monthlyFee: Math.abs(Number(form.monthlyFee)) || 100
    });
    if (success) addToast('Settings saved to cloud!', 'success');
    else addToast('Failed to save to cloud!', 'danger');
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Reset input so the same file can be re-imported
      e.target.value = '';
      addToast('Importing data — please wait...', 'info');
      importJSON(file);
    }
  };

  const APPS_SCRIPT_CODE = `// SVAKS v2 - MERGE-ONLY Sync (No Auto-Delete)
// Data is ONLY added or updated. Delete/update must be done MANUALLY in the sheet.

function doPost(e) {
  var raw = e.postData.contents;
  var data = JSON.parse(raw);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var arraySheets = ['Members', 'Collections', 'Expenditure', 'Committee', 'Notifications', 'Gallery'];
  var arrayKeys = ['members', 'collections', 'expenditure', 'committee', 'notifications', 'gallery'];

  for (var i = 0; i < arraySheets.length; i++) {
    var sheet = ss.getSheetByName(arraySheets[i]);
    if (!sheet) sheet = ss.insertSheet(arraySheets[i]);

    var rows = data[arrayKeys[i]];
    if (!rows || rows.length === 0) continue;

    var headers;
    var existingValues = sheet.getDataRange().getValues();
    var existingIds = {};

    if (existingValues.length > 0 && existingValues[0].length > 0 && existingValues[0][0] !== '') {
      headers = existingValues[0];
      var idCol = headers.indexOf('id');
      if (idCol >= 0) {
        for (var r = 1; r < existingValues.length; r++) {
          existingIds[String(existingValues[r][idCol])] = r + 1;
        }
      }
    } else {
      headers = Object.keys(rows[0]);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    rows.forEach(function(item) {
      var itemId = String(item.id || '');
      var rowData = headers.map(function(h) {
        var val = item[h];
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (Array.isArray(val) || typeof val === 'object') return JSON.stringify(val);
        return val !== undefined && val !== null ? val : '';
      });

      if (itemId && existingIds[itemId]) {
        // UPDATE existing row
        sheet.getRange(existingIds[itemId], 1, 1, headers.length).setValues([rowData]);
      } else {
        // ADD new row
        sheet.appendRow(rowData);
        if (itemId) {
          existingIds[itemId] = sheet.getLastRow();
        }
      }
    });
  }

  // Settings: always overwrite (small key-value data)
  var settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) settingsSheet = ss.insertSheet('Settings');
  settingsSheet.clear();
  settingsSheet.appendRow(['key', 'value']);
  if (data._syncVersion) settingsSheet.appendRow(['_syncVersion', data._syncVersion]);
  if (data._lastSync) settingsSheet.appendRow(['_lastSync', data._lastSync]);
  if (data.settings) {
    Object.keys(data.settings).forEach(function(key) {
      settingsSheet.appendRow([key, data.settings[key]]);
    });
  }

  return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (e.parameter.action === 'load' || e.parameter.load === 'true') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = {};

    var arraySheets = ['Members', 'Collections', 'Expenditure', 'Committee', 'Notifications', 'Gallery'];
    var arrayKeys = ['members', 'collections', 'expenditure', 'committee', 'notifications', 'gallery'];

    for (var i = 0; i < arraySheets.length; i++) {
      var sheet = ss.getSheetByName(arraySheets[i]);
      if (sheet) {
        var values = sheet.getDataRange().getValues();
        if (values.length > 1) {
          var headers = values[0];
          data[arrayKeys[i]] = values.slice(1).map(function(row) {
            var obj = {};
            headers.forEach(function(h, idx) {
              var val = row[idx];
              if (val === 'TRUE') val = true;
              else if (val === 'FALSE') val = false;
              else if (h === 'id' || h === 'amount' || h === 'monthlyFee' || h === 'memberId') {
                var num = Number(val);
                if (!isNaN(num) && val !== '') val = num;
              } else if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
                try { val = JSON.parse(val); } catch(ex) {}
              }
              obj[h] = val;
            });
            return obj;
          });
        } else {
          data[arrayKeys[i]] = [];
        }
      }
    }

    var settingsSheet = ss.getSheetByName('Settings');
    if (settingsSheet) {
      var settingsData = settingsSheet.getDataRange().getValues();
      var settings = {};
      for (var j = 1; j < settingsData.length; j++) {
        var key = settingsData[j][0];
        var value = settingsData[j][1];
        if (key === '_syncVersion') {
          data._syncVersion = Number(value) || 0;
        } else if (key === '_lastSync') {
          data._lastSync = value;
        } else if (key === 'monthlyFee') {
          settings[key] = Number(value) || 100;
        } else if (key) {
          settings[key] = value;
        }
      }
      if (Object.keys(settings).length > 0) {
        data.settings = settings;
      }
    }

    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('Use POST to sync data');
}`;

  return (
    <div className="fade-in">
      {/* General Settings */}
      <div className="admin-card">
        <div className="settings-section">
          <h4>General Settings</h4>
          <div className="settings-form-grid">
            <div className="settings-field">
              <label>Samaj Name</label>
              <input
                value={form.appName}
                onChange={e => setForm(prev => ({ ...prev, appName: e.target.value }))}
                placeholder="Samaj name"
              />
            </div>
            <div className="settings-field">
              <label>Location</label>
              <input
                value={form.location}
                onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City name"
              />
            </div>
            <div className="settings-field">
              <label>Monthly Fee (₹)</label>
              <input
                type="number"
                value={form.monthlyFee}
                onChange={e => setForm(prev => ({ ...prev, monthlyFee: e.target.value }))}
                placeholder="100"
              />
            </div>
          </div>
          <div className="settings-actions">
            <button className="btn-primary" onClick={handleSaveSettings}>Save Settings</button>
          </div>
        </div>
      </div>

      {/* Google Sheets Sync */}
      <div className="admin-card">
        <div className="settings-section">
          <h4>Google Sheets Setup</h4>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px', lineHeight: '1.6' }}>
            <strong>Step-by-step:</strong>
          </p>
          <ol style={{ paddingLeft: '20px', color: '#555', fontSize: '14px', lineHeight: '2' }}>
            <li>Go to <strong>Google Sheets</strong> and create new spreadsheet</li>
            <li>Click <strong>Extensions → Apps Script</strong></li>
            <li>Delete any code there, copy the code below and paste</li>
            <li>Click <strong>Save</strong> (blue button)</li>
            <li>Click <strong>Deploy → New Deployment</strong></li>
            <li>Select <strong>Web app</strong>, Description: <strong>SVAKS Sync</strong></li>
            <li><strong>Execute as:</strong> Me | <strong>Who has access:</strong> Anyone</li>
            <li>Click <strong>Deploy</strong></li>
            <li><strong>Copy the Web App URL</strong> (not the spreadsheet URL!)</li>
            <li>Paste that URL in the field above</li>
          </ol>
          <textarea
            className="code-block"
            readOnly
            value={APPS_SCRIPT_CODE}
            style={{ width: '100%', minHeight: '250px' }}
          />
          <div className="settings-actions">
            <button className="btn-primary" onClick={syncToGoogleSheet}>
              📤 Send Data to Sheets
            </button>
            <button className="btn-secondary" onClick={loadFromGoogleSheet} style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>
              📥 Load from Sheets
            </button>
          </div>

          {/* Multi-Device Sync Info */}
          {settings?.sheetUrl && (
            <div style={{ marginTop: '16px', padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(0,184,148,0.08), rgba(253,203,110,0.05))', border: '1px solid rgba(0,184,148,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>☁️</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#00B894' }}>Multi-Device Auto-Sync Active</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Data automatically syncs across all devices</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', fontSize: '12px' }}>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ color: '#888' }}>🔄 Auto-poll</div>
                  <div style={{ color: '#fff' }}>Every 30 seconds</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ color: '#888' }}>👁️ Tab switch</div>
                  <div style={{ color: '#fff' }}>Instant sync</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div style={{ color: '#888' }}>📊 Last sync</div>
                  <div style={{ color: '#fff' }}>{syncLastTime ? new Date(syncLastTime).toLocaleTimeString() : 'Never'}</div>
                </div>
              </div>
              {/* Sync Status Display */}
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: syncStatus === 'syncing' || saving ? 'rgba(253,203,110,0.15)' : syncStatus === 'synced' ? 'rgba(0,184,148,0.15)' : syncStatus === 'error' ? 'rgba(225,112,85,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${syncStatus === 'syncing' || saving ? 'rgba(253,203,110,0.4)' : syncStatus === 'synced' ? 'rgba(0,184,148,0.4)' : syncStatus === 'error' ? 'rgba(225,112,85,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: syncStatus === 'syncing' || saving ? '#FDCB6E' : syncStatus === 'synced' ? '#00B894' : syncStatus === 'error' ? '#E17055' : '#aaa' }}>
                  <span>{saving ? '💾' : syncStatus === 'syncing' ? '🔄' : syncStatus === 'synced' ? '✅' : syncStatus === 'error' ? '❌' : syncStatus === 'loading' ? '⏳' : '☁️'}</span>
                  <span>
                    {saving ? 'Saving to Google Sheets...' :
                      syncStatus === 'syncing' ? 'Syncing to cloud...' :
                        syncStatus === 'synced' ? 'All data synced to Google Sheets ✓' :
                          syncStatus === 'error' ? 'Sync error!' :
                            syncStatus === 'loading' ? 'Loading from cloud...' :
                              'Cloud connected'}
                  </span>
                </div>
                {syncError && <div style={{ marginTop: '6px', fontSize: '12px', color: '#E17055' }}>Error: {syncError}</div>}
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#888', lineHeight: '1.5' }}>
                  ℹ️ Data is saved directly to Google Sheets. To delete data, go to Google Sheets directly and delete rows manually.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data Backup / Restore */}
      <div className="admin-card">
        <div className="settings-section">
          <h4>Data Backup & Restore</h4>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
            Keep a backup of your data and restore when needed.
          </p>
          <div className="settings-actions">
            <button className="btn-primary" onClick={exportJSON}>
              📦 Full Backup (JSON)
            </button>
            <label className="btn-secondary" style={{ color: 'var(--gold)', borderColor: 'var(--gold)', cursor: 'pointer' }}>
              📥 Import JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          {/* Quick Exports */}
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Quick Export (CSV for Excel)</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const csv = 'ID,Name,Father,Phone,Address,Occupation,Monthly Fee\n' +
                    members.map(m => [csvCell(m.id), csvCell(m.name), csvCell(m.father), csvCell(m.phone), csvCell(m.address), csvCell(m.occupation), csvCell(m.monthlyFee || 0)].join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'members.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#ccc', cursor: 'pointer' }}
              >
                👥 Members CSV
              </button>
              <button
                onClick={() => {
                  const csv = 'ID,Date,Member,Amount,Source,Note,Receipt No\n' +
                    collections.map(c => [csvCell(c.id), csvCell(c.date), csvCell(c.memberName), csvCell(c.amount), csvCell(c.source), csvCell(c.note), csvCell(c.receiptNo)].join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'collections.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#ccc', cursor: 'pointer' }}
              >
                💰 Collections CSV
              </button>
              <button
                onClick={() => {
                  const csv = 'ID,Date,Category,Amount,Description\n' +
                    expenditure.map(e => [csvCell(e.id), csvCell(e.date), csvCell(e.category), csvCell(e.amount), csvCell(e.description)].join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'expenditure.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#ccc', cursor: 'pointer' }}
              >
                📋 Expenses CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== NOTIFICATIONS SECTION =====
function NotificationsSection() {
  const { notifications, addNotification, updateNotification } = useData();
  const { addToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', text: '', date: new Date().toLocaleDateString('en-IN') });

  const handleSave = async () => {
    if (!form.title.trim()) {
      addToast('Title is required!', 'danger');
      return;
    }
    if (!form.text.trim()) {
      addToast('Message is required!', 'danger');
      return;
    }
    let success;
    if (editId) {
      success = await updateNotification(editId, form);
      if (success) addToast('Notice updated & saved to cloud!', 'success');
    } else {
      success = await addNotification(form);
      if (success) addToast('Notice posted & saved to cloud!', 'success');
    }
    if (!success) addToast('Failed to save to cloud!', 'danger');
    setShowModal(false);
    setForm({ title: '', text: '', date: new Date().toLocaleDateString('en-IN') });
    setEditId(null);
  };

  const handleEdit = (notif) => {
    setForm({ title: notif.title, text: notif.text, date: notif.date });
    setEditId(notif.id);
    setShowModal(true);
  };

  const handleToggle = async (notif) => {
    const success = await updateNotification(notif.id, { active: !notif.active });
    if (success) addToast(notif.active ? 'Notice hidden & saved!' : 'Notice published & saved!', 'info');
    else addToast('Failed to save to cloud!', 'danger');
  };

  // Delete removed — only allowed from Google Sheets directly

  const activeNotifs = notifications.filter(n => n.active);
  const inactiveNotifs = notifications.filter(n => !n.active);

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Notice Board ({activeNotifs.length} active)</h3>
          <button className="btn-primary" onClick={() => { setEditId(null); setForm({ title: '', text: '', date: new Date().toLocaleDateString('en-IN') }); setShowModal(true); }}>+ Add Notice</button>
        </div>

        {activeNotifs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#f8f9fa', borderRadius: '12px', border: '1px dashed #ccc' }}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>📢</span>
            <p style={{ color: '#666', margin: 0 }}>No active notices on the website.</p>
            <p style={{ color: '#999', fontSize: '14px', marginTop: '4px' }}>Click "+ Add Notice" to announce something.</p>
          </div>
        ) : (
          <div className="notifications-list">
            {activeNotifs.map((notif, i) => (
              <div key={notif.id} className="notification-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                  <div className="notification-number">{i + 1}</div>
                  <div className="notification-content-admin">
                    <span className="notification-badge">{notif.title}</span>
                    <p style={{ fontSize: '16px', fontWeight: '500' }}>{notif.text}</p>
                    <span className="notification-date-admin" style={{ color: '#888' }}>📅 {notif.date}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
                  <button onClick={() => handleToggle(notif)} className="btn-action" style={{ background: '#f1f2f6', color: '#57606f', border: '1px solid #dfe4ea', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>👁️ Hide</button>
                  <button onClick={() => handleEdit(notif)} className="btn-action" style={{ background: 'var(--gold)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>✏️ Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inactiveNotifs.length > 0 && (
        <div className="admin-card" style={{ marginTop: '20px', opacity: 0.7 }}>
          <div className="admin-card-header">
            <h3>Hidden Notices ({inactiveNotifs.length})</h3>
          </div>
          <div className="notifications-list">
            {inactiveNotifs.map((notif, i) => (
              <div key={notif.id} className="notification-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8, filter: 'grayscale(50%)' }}>
                <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
                  <div className="notification-number" style={{ background: 'linear-gradient(135deg, #666, #888)' }}>{i + 1}</div>
                  <div className="notification-content-admin">
                    <span className="notification-badge" style={{ background: 'linear-gradient(135deg, #666, #888)' }}>{notif.title}</span>
                    <p style={{ fontSize: '16px', fontWeight: '500' }}>{notif.text}</p>
                    <span className="notification-date-admin" style={{ color: '#888' }}>📅 {notif.date}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
                  <button onClick={() => handleToggle(notif)} className="btn-action" style={{ background: '#00B894', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>📢 Publish</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditId(null); }} title={editId ? 'Edit Notice' : 'Add New Notice'}>
        <div className="modal-form">
          <div className="form-group">
            <label>Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Upcoming Event, Meeting"
            />
          </div>
          <div className="form-group">
            <label>Message *</label>
            <textarea
              value={form.text}
              onChange={e => setForm(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Enter notice details..."
              rows={3}
              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              type="text"
              value={form.date}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
              placeholder="DD Month YYYY"
            />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowModal(false); setEditId(null); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>{editId ? 'Update Notice' : 'Add Notice'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== MAIN ADMIN COMPONENT =====
function Admin() {
  const navigate = useNavigate();
  const { syncStatus, settings, loadFromGoogleSheet, syncToGoogleSheet, members, collections, expenditure, saving, initialLoadDone, getPendingCount } = useData();
  const { lang, setLang, t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();
  const { status: swStatus, updateAvailable, applyUpdate } = useServiceWorker();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Global search functionality
  const handleGlobalSearch = (query) => {
    setGlobalSearch(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    const q = query.toLowerCase();
    const results = {
      members: members.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        m.father?.toLowerCase().includes(q)
      ).slice(0, 5),
      collections: collections.filter(c =>
        c.memberName?.toLowerCase().includes(q) ||
        c.note?.toLowerCase().includes(q)
      ).slice(0, 5),
      expenditure: expenditure.filter(e =>
        e.description?.toLowerCase().includes(q) ||
        e.category?.toLowerCase().includes(q)
      ).slice(0, 5)
    };
    setSearchResults(results);
  };

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('svaks_admin') === 'true';
    if (!isAuthenticated) {
      navigate('/admin-login');
    }
  }, [navigate]);

  // CRITICAL: Synchronous auth check — must happen AFTER all hooks are declared
  // but BEFORE any admin UI is rendered. Done below after all useEffect hooks.

  // Show PWA install banner after 30 seconds if installable
  useEffect(() => {
    if (canInstall && !isInstalled) {
      const dismissed = sessionStorage.getItem('svaks_install_dismissed');
      if (dismissed !== 'yes') {
        const timer = setTimeout(() => setShowInstallBanner(true), 30000);
        return () => clearTimeout(timer);
      }
    }
  }, [canInstall, isInstalled]);

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('svaks_install_dismissed', 'yes');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('svaks_admin');
    navigate('/');
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'monthly-fixed', label: 'Monthly ₹200', icon: '📅' },
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'collections', label: 'Collections', icon: '💰' },
    { id: 'expenditure', label: 'Expenditure', icon: '📋' },
    { id: 'notifications', label: 'Notices', icon: '📢' },
    { id: 'gallery', label: 'Gallery', icon: '📸' },
    { id: 'reports', label: 'Reports', icon: '📑' },
    { id: 'annual-statement', label: 'Statement', icon: '📄' },
    { id: 'committee', label: 'Committee', icon: '🏛️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardSection />;
      case 'monthly-fixed': return <MonthlyFixedCollectionSection />;
      case 'members': return <MembersSection />;
      case 'collections': return <CollectionsSection />;
      case 'expenditure': return <ExpenditureSection />;
      case 'notifications': return <NotificationsSection />;
      case 'gallery': return <GallerySection />;
      case 'reports': return <ReportsSection />;
      case 'annual-statement': return <AnnualStatementSection />;
      case 'committee': return <CommitteeSection />;
      case 'settings': return <SettingsSection />;
      default: return <DashboardSection />;
    }
  };

  const activeTabLabel = tabs.find(tab => tab.id === activeTab)?.label || 'Dashboard';

  // CRITICAL: Synchronous auth check — render null BEFORE the loading screen
  // so unauthenticated users never see even a flash of admin UI. This runs
  // after all hooks are declared (Rules of Hooks).
  if (sessionStorage.getItem('svaks_admin') !== 'true') {
    return null;
  }

  // Show a full-screen loader while the initial cloud load is in flight.
  // This prevents the admin from rendering with empty arrays and showing
  // "No members yet" / "No collections this month" flashes before data arrives.
  if (!initialLoadDone && syncStatus === 'loading') {
    return <Loading fullScreen message={t('admin.loading')} />;
  }

  return (
    <div className="admin-layout">
      <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)}></div>

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          background: 'linear-gradient(135deg, #6c5ce7, #5a4bd1)',
          color: 'white',
          padding: '12px 20px',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          fontSize: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>📱</span>
            <div>
              <div style={{ fontWeight: '600' }}>Install SVAKS App</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Works offline, faster, app-like experience</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleInstall}
              style={{
                padding: '6px 16px',
                background: 'white',
                color: '#6c5ce7',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Install
            </button>
            <button
              onClick={handleDismissInstall}
              style={{
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Update Available Banner */}
      {updateAvailable && (
        <div style={{
          position: 'fixed',
          top: showInstallBanner ? '56px' : '0',
          left: 0, right: 0,
          background: 'linear-gradient(135deg, #00B894, #00cec9)',
          color: 'white',
          padding: '8px 20px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontSize: '13px'
        }}>
          <span>🔄 New version available!</span>
          <button
            onClick={applyUpdate}
            style={{
              padding: '4px 14px',
              background: 'white',
              color: '#00B894',
              border: 'none',
              borderRadius: '4px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Update Now
          </button>
        </div>
      )}

      <aside className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <span className="sidebar-om">ॐ</span>
          <h3>SVAKS</h3>
          <p>Admin Panel</p>
        </div>
        <nav className="admin-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setMobileOpen(false); }}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          {/* Language & Theme Toggles */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', alignItems: 'center', justifyContent: 'center' }}>
            <div className="theme-lang-toggle" role="group" aria-label="Language toggle">
              <button
                type="button"
                className={lang === 'en' ? 'active' : ''}
                onClick={() => setLang('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={lang === 'hi' ? 'active' : ''}
                onClick={() => setLang('hi')}
              >
                हिं
              </button>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
              aria-label="Toggle theme"
              style={{
                background: 'var(--clay-inset)',
                border: '1px solid var(--border)',
                color: 'var(--gold)',
                padding: '5px 11px',
                borderRadius: '999px',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
                boxShadow: 'var(--clay-inset-sm)'
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
          {/* Cloud Sync Status Indicator */}
          <>
            <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: syncStatus === 'syncing' || saving ? 'rgba(253,203,110,0.18)' : syncStatus === 'synced' ? 'rgba(0,184,148,0.18)' : syncStatus === 'error' ? 'rgba(225,112,85,0.18)' : syncStatus === 'loading' ? 'rgba(108,92,231,0.18)' : syncStatus === 'offline' ? 'rgba(253,203,110,0.18)' : 'var(--clay-inset)' }}>
              <span>{syncStatus === 'syncing' || saving ? '🔄' : syncStatus === 'synced' ? '✅' : syncStatus === 'error' ? '❌' : syncStatus === 'loading' ? '⏳' : syncStatus === 'offline' ? '📡' : '☁️'}</span>
              <span style={{ color: syncStatus === 'syncing' || saving ? 'var(--warning)' : syncStatus === 'synced' ? 'var(--success)' : syncStatus === 'error' ? 'var(--danger)' : syncStatus === 'loading' ? '#a29bfe' : syncStatus === 'offline' ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600 }}>
                {saving ? 'Saving to cloud...' : syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'synced' ? 'Cloud synced ✓' : syncStatus === 'error' ? 'Sync error' : syncStatus === 'loading' ? 'Loading from cloud...' : syncStatus === 'offline' ? 'Offline mode' : 'Cloud ready'}
              </span>
            </div>
            {/* Offline queue indicator */}
            {getPendingCount() > 0 && (
              <div style={{ marginBottom: '12px', padding: '7px 11px', borderRadius: '10px', fontSize: '11px', background: 'rgba(253,203,110,0.22)', border: '1px solid rgba(253,203,110,0.5)', color: '#8B6500', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <span>⏳</span>
                <span>{getPendingCount()} save(s) queued — will sync when online</span>
              </div>
            )}
            <button
              onClick={loadFromGoogleSheet}
              style={{ marginBottom: '12px', padding: '7px 11px', fontSize: '11px', background: 'rgba(0,184,148,0.18)', border: '1px solid rgba(0,184,148,0.4)', borderRadius: '10px', color: 'var(--success)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', fontWeight: 600 }}
            >
              {t('admin.refreshCloud')}
            </button>
          </>
          <button onClick={handleLogout}>
            <span>{t('admin.logoutIcon')}</span> {t('admin.logout')} →
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>☰</button>
            <h2>{activeTabLabel}</h2>
          </div>
          {/* Global Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search..."
              value={globalSearch}
              onChange={e => handleGlobalSearch(e.target.value)}
              style={{
                background: 'var(--clay-inset)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '9px 14px',
                color: 'var(--text)',
                fontSize: '13px',
                width: '160px',
                outline: 'none',
                boxShadow: 'var(--clay-inset-sm)'
              }}
            />
            {searchResults && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                background: 'var(--clay-surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '14px',
                minWidth: '250px',
                maxHeight: '300px',
                overflow: 'auto',
                zIndex: 1000,
                boxShadow: 'var(--clay-shadow-lg)'
              }}>
                {searchResults.members.length === 0 && searchResults.collections.length === 0 && searchResults.expenditure.length === 0 ? (
                  <div style={{ color: 'var(--text-soft)', fontSize: '13px' }}>No results found</div>
                ) : (
                  <>
                    {searchResults.members.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ color: 'var(--maroon)', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>👥 Members ({searchResults.members.length})</div>
                        {searchResults.members.map(m => (
                          <div key={m.id} style={{ fontSize: '13px', color: 'var(--text)', padding: '5px 8px', borderRadius: '8px', cursor: 'pointer' }}
                            onClick={() => { setActiveTab('members'); setGlobalSearch(''); setSearchResults(null); }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--clay-inset)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {m.name} {m.phone && `(${m.phone})`}
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.collections.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ color: 'var(--maroon)', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>💰 Collections ({searchResults.collections.length})</div>
                        {searchResults.collections.map(c => (
                          <div key={c.id} style={{ fontSize: '13px', color: 'var(--text)', padding: '5px 8px', borderRadius: '8px', cursor: 'pointer' }}
                            onClick={() => { setActiveTab('collections'); setGlobalSearch(''); setSearchResults(null); }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--clay-inset)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {c.memberName || 'Unknown'} - ₹{Number(c.amount || 0).toLocaleString('en-IN')}
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.expenditure.length > 0 && (
                      <div>
                        <div style={{ color: 'var(--maroon)', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>📋 Expenses ({searchResults.expenditure.length})</div>
                        {searchResults.expenditure.map(e => (
                          <div key={e.id} style={{ fontSize: '13px', color: 'var(--text)', padding: '5px 8px', borderRadius: '8px', cursor: 'pointer' }}
                            onClick={() => { setActiveTab('expenditure'); setGlobalSearch(''); setSearchResults(null); }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--clay-inset)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {e.category} - ₹{Number(e.amount || 0).toLocaleString('en-IN')}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <span className="date">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="admin-content">
          {renderContent()}
        </div>
        {/* Version Footer */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          fontSize: '11px',
          color: 'var(--text-soft)',
          borderTop: '1px solid var(--border-soft)',
          fontWeight: 600,
          letterSpacing: '0.5px'
        }}>
          SVAKS Admin v{APP_VERSION} | ॐ Sarve Bhavantu Sukhinah
        </div>
      </main>
    </div>
  );
}

export default Admin;