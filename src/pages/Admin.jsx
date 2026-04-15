import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../DataContext';
import { useToast } from '../components/Toast';
import { getDirectImageUrl, PLACEHOLDER_IMAGE } from '../utils';
import Modal from '../components/Modal';
import PDFExport from '../components/PDFExport';
import '../styles/Admin.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CURRENT_YEAR = new Date().getFullYear();
const COLLECTION_SOURCES = ['Monthly Collection', 'Donation', 'Special Contribution', 'Event Income', 'Other'];
const EXPENSE_CATEGORIES = ['Admin Cost', 'Event Expense', 'Maintenance', 'Help/Support', 'Travel', 'Printing', 'Other'];

function getMonthPaymentStatus(members, collections, month, year) {
  const paid = new Set();
  collections.forEach(c => {
    if (!c.date) return;
    const d = new Date(c.date);
    if (d.getMonth() === month && d.getFullYear() === year && c.memberId) {
      paid.add(c.memberId);
    }
  });
  return members.map(m => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    paid: paid.has(m.id),
    paidCount: collections.filter(c => c.memberId === m.id && new Date(c.date).getMonth() === month && new Date(c.date).getFullYear() === year).length,
    paidAmount: collections.filter(c => c.memberId === m.id && new Date(c.date).getMonth() === month && new Date(c.date).getFullYear() === year).reduce((s, c) => s + Number(c.amount || 0), 0)
  }));
}

// ===== DASHBOARD SECTION =====
function DashboardSection() {
  const { members, collections, expenditure, settings, setData } = useData();
  const { addToast: toast } = useToast();

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

  const markAllPaid = () => {
    if (unpaidCount === 0) {
      toast.addToast('All members already paid!', 'info');
      return;
    }
    if (window.confirm(`Mark all ${unpaidCount} pending members as paid for ${MONTHS[currentMonth]}?`)) {
      const newCollections = [...collections];
      monthStatus.forEach(m => {
        if (!m.paid) {
          newCollections.push({
            id: Date.now() + Math.random(),
            memberId: m.id,
            memberName: m.name,
            amount: members.find(mem => mem.id === m.id)?.monthlyFee || 100,
            source: 'Monthly Collection',
            date: new Date().toISOString().split('T')[0],
            note: `Bulk marked paid for ${MONTHS[currentMonth]} ${currentYear}`
          });
        }
      });
      setData(prev => ({ ...prev, collections: newCollections }));
      toast.addToast('All members marked as paid!', 'success');
    }
  };

  const recentCollections = [...collections]
    .sort((a, b) => safeParseDate(b.date) - safeParseDate(a.date))
    .slice(0, 10);
  const recentExpenditure = [...expenditure]
    .sort((a, b) => safeParseDate(b.date) - safeParseDate(a.date))
    .slice(0, 10);

  return (
    <div className="fade-in">
      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card members">
          <div className="summary-icon">👥</div>
          <h4>Total Members</h4>
          <div className="big-number">{members.length}</div>
        </div>
        <div className="summary-card collections">
          <div className="summary-icon">💰</div>
          <h4>Total Collections</h4>
          <div className="big-number">₹{totalCollections.toLocaleString('en-IN')}</div>
        </div>
        <div className="summary-card expenditure">
          <div className="summary-icon">📊</div>
          <h4>Total Expense</h4>
          <div className="big-number">₹{totalExpenditure.toLocaleString('en-IN')}</div>
        </div>
        <div className="summary-card balance">
          <div className="summary-icon">🏦</div>
          <h4>Balance</h4>
          <div className="big-number">₹{balance.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Current Month Status */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>{MONTHS[currentMonth]} {currentYear} - Monthly Payment Status</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className="badge badge-gold">
              {paidCount} Paid | {unpaidCount} Pending
            </span>
            <button
              className="btn-primary btn-sm"
              onClick={markAllPaid}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Mark All Paid
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
                  <tr><th>Date</th><th>Member</th><th>Amount</th><th>Source</th></tr>
                </thead>
                <tbody>
                  {recentCollections.map(c => (
                    <tr key={c.id}>
                      <td>{c.date || '-'}</td>
                      <td>{c.memberName || '-'}</td>
                      <td>₹{Number(c.amount).toLocaleString('en-IN')}</td>
                      <td><span className="badge badge-gold">{c.source || 'Other'}</span></td>
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
  const { members, addMember, updateMember, deleteMember, settings } = useData();
  const { addToast: toast } = useToast();
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
      toast.addToast('Name is required!', 'danger');
      return;
    }
    if (editId) {
      updateMember(editId, form);
      toast.addToast('Member updated successfully!', 'success');
    } else {
      addMember(form);
      toast.addToast('Member added successfully!', 'success');
    }
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure? This member will be deleted!')) {
      deleteMember(id);
      toast.addToast('Member deleted', 'info');
    }
  };

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
                  <th>#</th><th>Name</th><th>Father</th><th>Phone</th><th>Address</th><th>Occupation</th><th>Monthly Fee</th><th>Actions</th>
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
                      <button onClick={() => openEdit(m)} className="btn-action btn-edit">Edit</button>
                      <button onClick={() => handleDelete(m.id)} className="btn-action btn-delete">Delete</button>
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
  const { collections, members, addCollection, deleteCollection } = useData();
  const { addToast: toast } = useToast();
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ memberId: '', memberName: '', amount: '', source: 'Monthly Collection', note: '', date: new Date().toISOString().split('T')[0] });

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

  const handleSave = () => {
    if (!form.memberId && !form.memberName) {
      toast.addToast('Please select a member or enter name!', 'danger');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.addToast('Please enter amount!', 'danger');
      return;
    }
    addCollection(form);
    toast.addToast('Payment recorded successfully!', 'success');
    setShowModal(false);
    setForm({ memberId: '', memberName: '', amount: '', source: 'Monthly Collection', note: '', date: new Date().toISOString().split('T')[0] });
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this collection?')) {
      deleteCollection(id);
      toast.addToast('Payment deleted', 'info');
    }
  };

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
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Collection</button>
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
                <tr><th>#</th><th>Date</th><th>Member</th><th>Amount</th><th>Source</th><th>Note</th><th>Actions</th></tr>
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
                      <button onClick={() => handleDelete(c.id)} className="btn-action btn-delete">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Collection">
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
            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Add Collection</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== EXPENDITURE SECTION =====
function ExpenditureSection() {
  const { expenditure, addExpenditure, updateExpenditure, deleteExpenditure } = useData();
  const { addToast: toast } = useToast();
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
      toast.addToast('Please enter amount!', 'danger');
      return;
    }
    if (editId) {
      updateExpenditure(editId, form);
      toast.addToast('Expense updated', 'success');
    } else {
      addExpenditure(form);
      toast.addToast('Expense recorded', 'success');
    }
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this expense?')) {
      deleteExpenditure(id);
      toast.addToast('Expense deleted', 'info');
    }
  };

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
                <tr><th>#</th><th>Date</th><th>Category</th><th>Amount</th><th>Description</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {expenditure.sort((a, b) => {
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
                      <button onClick={() => openEdit(e)} className="btn-action btn-edit">Edit</button>
                      <button onClick={() => handleDelete(e.id)} className="btn-action btn-delete">Delete</button>
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

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Monthly Report - {MONTHS[month]} {year}</h3>
          <button className="btn-primary" onClick={handleDownloadPDF}>
            Download PDF
          </button>
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

// ===== COMMITTEE SECTION =====
function CommitteeSection() {
  const { committee, updateCommittee } = useData();

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };

  const handlePhotoChange = (id, url) => {
    updateCommittee(id, { photo: url });
  };

  const handleFieldChange = (id, field, value) => {
    updateCommittee(id, { [field]: value });
  };

  const handleImageUpload = (id, e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          updateCommittee(id, { photo: event.target.result });
        }
      };
      reader.onerror = () => {
        alert('Error reading file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Committee Members</h3>
          <p style={{ fontSize: '13px', color: '#888', margin: '8px 0 0' }}>Changes are saved automatically. You can also upload photo directly.</p>
        </div>
        <div className="committee-edit-grid">
          {committee.map(member => {
            const imgError = false; // Simplified - removed useState from map
            return (
            <div className="committee-edit-card" key={member.id}>
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
                <span className="position-badge">{member.position}</span>
                <label>
                  Name
                  <input
                    value={member.name}
                    onChange={e => handleFieldChange(member.id, 'name', e.target.value)}
                    placeholder="Enter name"
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={member.phone}
                    onChange={e => handleFieldChange(member.id, 'phone', e.target.value)}
                    placeholder="Phone number"
                  />
                </label>
                <label>
                  Photo URL (Google Photos/Drive)
                  <input
                    value={member.photo || ''}
                    onChange={e => handlePhotoChange(member.id, e.target.value)}
                    placeholder="https://photos.google.com/... or https://drive.google.com/..."
                  />
                </label>
                <label>
                  Address
                  <input
                    value={member.address}
                    onChange={e => handleFieldChange(member.id, 'address', e.target.value)}
                    placeholder="Address"
                  />
                </label>
              </div>
            </div>
            );})}
        </div>
      </div>
    </div>
  );
}

// ===== SETTINGS SECTION =====
function SettingsSection() {
  const { settings, updateSetting, syncToGoogleSheet, loadFromGoogleSheet, exportJSON, importJSON } = useData();
  const { addToast: toast } = useToast();
  const [form, setForm] = useState({
    appName: settings.appName,
    location: settings.location,
    monthlyFee: settings.monthlyFee,
    pin: '',
    newPin: '',
    confirmPin: '',
    sheetUrl: settings.sheetUrl
  });

  const handleSaveSettings = () => {
    if (form.appName) updateSetting('appName', form.appName);
    if (form.location) updateSetting('location', form.location);
    updateSetting('monthlyFee', Number(form.monthlyFee) || 100);
    updateSetting('sheetUrl', form.sheetUrl);
    toast.addToast('Settings saved successfully!', 'success');
  };

  const handlePinChange = () => {
    if (form.pin !== settings.pin) {
      toast.addToast('Current PIN is wrong!', 'danger');
      return;
    }
    if (form.newPin.length !== 4) {
      toast.addToast('New PIN must be 4 digits!', 'danger');
      return;
    }
    if (form.newPin !== form.confirmPin) {
      toast.addToast('New PIN and Confirm PIN do not match!', 'danger');
      return;
    }
    updateSetting('pin', form.newPin);
    setForm(prev => ({ ...prev, pin: '', newPin: '', confirmPin: '' }));
    toast.addToast('PIN changed successfully!', 'success');
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      importJSON(file);
      toast.addToast('Data import successful!', 'success');
    }
  };

  const APPS_SCRIPT_CODE = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = ['Members', 'Collections', 'Expenditure', 'Committee', 'Settings'];
  var dataKeys = ['members', 'collections', 'expenditure', 'committee', 'settings'];
  for (var i = 0; i < sheetNames.length; i++) {
    var sheet = ss.getSheetByName(sheetNames[i]);
    if (!sheet) sheet = ss.insertSheet(sheetNames[i]);
    sheet.clear();
    var rows = data[dataKeys[i]];
    if (rows && rows.length > 0) {
      var headers = Object.keys(rows[0]);
      sheet.appendRow(headers);
      rows.forEach(function(item) {
        sheet.appendRow(headers.map(h => item[h] || ''));
      });
    }
  }
  return ContentService.createTextOutput('OK');
}

function doGet(e) {
  if (e.parameter.action === 'load') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = {};
    var sheetNames = ['Members', 'Collections', 'Expenditure', 'Committee', 'Settings'];
    var dataKeys = ['members', 'collections', 'expenditure', 'committee', 'settings'];
    for (var i = 0; i < sheetNames.length; i++) {
      var sheet = ss.getSheetByName(sheetNames[i]);
      if (sheet) {
        var values = sheet.getDataRange().getValues();
        if (values.length > 1) {
          var headers = values[0];
          data[dataKeys[i]] = values.slice(1).map(function(row) {
            var obj = {};
            headers.forEach(function(h, idx) { obj[h] = row[idx]; });
            return obj;
          });
        } else {
          data[dataKeys[i]] = [];
        }
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
            <div className="settings-field">
              <label>Google Sheets URL</label>
              <input
                value={form.sheetUrl}
                onChange={e => setForm(prev => ({ ...prev, sheetUrl: e.target.value }))}
                placeholder="https://script.google.com/..."
              />
            </div>
          </div>
          <div className="settings-actions">
            <button className="btn-primary" onClick={handleSaveSettings}>Save Settings</button>
          </div>
        </div>
      </div>

      {/* PIN Change */}
      <div className="admin-card">
        <div className="settings-section">
          <h4>Change PIN</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
            <div className="settings-field">
              <label>Current PIN</label>
              <input
                type="password"
                value={form.pin}
                onChange={e => setForm(prev => ({ ...prev, pin: e.target.value }))}
                placeholder="4-digit PIN"
                maxLength="4"
              />
            </div>
            <div className="settings-field">
              <label>New PIN</label>
              <input
                type="password"
                value={form.newPin}
                onChange={e => setForm(prev => ({ ...prev, newPin: e.target.value }))}
                placeholder="New 4-digit PIN"
                maxLength="4"
              />
            </div>
            <div className="settings-field">
              <label>Confirm New PIN</label>
              <input
                type="password"
                value={form.confirmPin}
                onChange={e => setForm(prev => ({ ...prev, confirmPin: e.target.value }))}
                placeholder="Confirm PIN"
                maxLength="4"
              />
            </div>
            <button className="btn-primary" onClick={handlePinChange}>Change PIN</button>
          </div>
        </div>
      </div>

      {/* Google Sheets Sync */}
      <div className="admin-card">
        <div className="settings-section">
          <h4>Google Sheets Setup</h4>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px', lineHeight: '1.6' }}>
            To sync with Google Sheets, setup Apps Script first:
          </p>
          <ol style={{ paddingLeft: '20px', color: '#555', fontSize: '14px', lineHeight: '2' }}>
            <li>Go to <strong>Google Sheets</strong> and create new spreadsheet</li>
            <li>Click <strong>Extensions → Apps Script</strong></li>
            <li>Copy the code below and <strong>Deploy → New Deployment</strong></li>
            <li>Select <strong>Web app</strong>, Execute as <strong>"Me"</strong>, Access <strong>"Anyone"</strong></li>
            <li>Copy the Web App URL and paste in Settings above</li>
          </ol>
          <textarea
            className="code-block"
            readOnly
            value={APPS_SCRIPT_CODE}
            style={{ width: '100%', minHeight: '250px' }}
          />
          <div className="settings-actions">
            <button className="btn-primary" onClick={syncToGoogleSheet}>
              Send Data to Sheets
            </button>
            <button className="btn-secondary" onClick={loadFromGoogleSheet} style={{ color: 'var(--gold)', borderColor: 'var(--gold)' }}>
              Load from Sheets
            </button>
          </div>
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
              Export JSON
            </button>
            <label className="btn-secondary" style={{ color: 'var(--gold)', borderColor: 'var(--gold)', cursor: 'pointer' }}>
              Import JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== NOTIFICATIONS SECTION =====
function NotificationsSection() {
  const { notifications, addNotification, deleteNotification } = useData();
  const { addToast: toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', text: '', date: new Date().toLocaleDateString('en-IN') });

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.addToast('Title is required!', 'danger');
      return;
    }
    if (!form.text.trim()) {
      toast.addToast('Message is required!', 'danger');
      return;
    }
    addNotification(form);
    toast.addToast('Notice posted successfully!', 'success');
    setShowModal(false);
    setForm({ title: '', text: '', date: new Date().toLocaleDateString('en-IN') });
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this notification?')) {
      deleteNotification(id);
      toast.addToast('Notice deleted', 'info');
    }
  };

  const activeNotifs = notifications.filter(n => n.active);

  return (
    <div className="fade-in">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Notice Board ({activeNotifs.length})</h3>
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Notice</button>
        </div>
        
        {activeNotifs.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '30px' }}>No notices yet. Add your first notice!</p>
        ) : (
          <div className="notifications-list">
            {activeNotifs.map((notif, i) => (
              <div key={notif.id} className="notification-item">
                <div className="notification-number">{i + 1}</div>
                <div className="notification-content-admin">
                  <span className="notification-badge">{notif.title}</span>
                  <p>{notif.text}</p>
                  <span className="notification-date-admin">{notif.date}</span>
                </div>
                <button onClick={() => handleDelete(notif.id)} className="btn-action btn-delete">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Notice">
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
            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Add Notice</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== MAIN ADMIN COMPONENT =====
function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('svaks_admin') === 'true';
    if (!isAuthenticated) {
      navigate('/admin-login');
    }
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('svaks_admin');
    navigate('/');
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'collections', label: 'Collections', icon: '💰' },
    { id: 'expenditure', label: 'Expenditure', icon: '📋' },
    { id: 'notifications', label: 'Notices', icon: '📢' },
    { id: 'reports', label: 'Reports', icon: '📑' },
    { id: 'committee', label: 'Committee', icon: '🏛️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardSection />;
      case 'members': return <MembersSection />;
      case 'collections': return <CollectionsSection />;
      case 'expenditure': return <ExpenditureSection />;
      case 'notifications': return <NotificationsSection />;
      case 'reports': return <ReportsSection />;
      case 'committee': return <CommitteeSection />;
      case 'settings': return <SettingsSection />;
      default: return <DashboardSection />;
    }
  };

  const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="admin-layout">
      <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)}></div>

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
          <button onClick={handleLogout}>
            <span>🔒</span> Logout →
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>☰</button>
            <h2>{activeTabLabel}</h2>
          </div>
          <span className="date">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="admin-content">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default Admin;