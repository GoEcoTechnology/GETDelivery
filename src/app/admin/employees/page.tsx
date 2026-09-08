'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../admin.module.css';
import { Users, Plus, Trash2, X, UserCheck, Lock } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';

const MAX_EMPLOYEES = 3;

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [addModal, setAddModal] = useState(false);
  const [addError, setAddError] = useState('');

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const getToken = () => localStorage.getItem('token') || '';

  const { data, isPending } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
    staleTime: 30 * 1000
  });

  const employees = data?.data || [];
  const employeeCount = data?.count || 0;
  const canAdd = employeeCount < MAX_EMPLOYEES;

  const addMutation = useMutation({
    mutationFn: async (emp: { name: string; email: string; password: string }) => {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(emp)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create employee');
      return json;
    },
    onSuccess: () => {
      setAddModal(false);
      setNewName(''); setNewEmail(''); setNewPassword(''); setAddError('');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => setAddError(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] })
  });

  return (
    <div>
      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '14px', fontWeight: 600 }}>
              <Users size={16} />
              <span>{employeeCount} / {MAX_EMPLOYEES} employees used</span>
            </div>
            {/* Slot indicators */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {Array.from({ length: MAX_EMPLOYEES }).map((_, i) => (
                <div key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: i < employeeCount ? '#6366f1' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {i < employeeCount && <UserCheck size={14} color="white" />}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setAddModal(true)}
            className={styles.btnPrimary}
            disabled={!canAdd}
            title={!canAdd ? `Maximum ${MAX_EMPLOYEES} employees reached` : 'Add employee'}
            style={{ opacity: canAdd ? 1 : 0.5, cursor: canAdd ? 'pointer' : 'not-allowed' }}
          >
            <Plus size={16} /> Add Employee
          </button>
        </div>

        {/* Employee List */}
        {isPending ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : employees.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Users size={28} color="#94a3b8" />
            </div>
            <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontWeight: 700, justifyContent: 'center' }}>No employees yet</h3>
            <p style={{ margin: '0', color: '#64748b', fontSize: '14px' }}>
              Create up to {MAX_EMPLOYEES} employee accounts. They can log in immediately — no admin approval needed.
            </p>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
            <tbody>
              {employees.map((emp: any) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600, color: '#1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px' }}>
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      {emp.name}
                    </div>
                  </td>
                  <td style={{ color: '#475569', fontSize: '13px' }}>{emp.email}</td>
                  <td>
                    <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                      Active
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ActionMenu actions={[
                      { label: 'Remove', icon: <Trash2 size={14} />, onClick: () => { if (confirm(`Remove ${emp.name}? They will no longer be able to log in.`)) deleteMutation.mutate(emp.id); }, color: '#ef4444' }
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {/* Info footer */}
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
          <Lock size={14} />
          <span>Employee accounts can access the system immediately. You can have up to <strong>{MAX_EMPLOYEES}</strong> employees.</span>
        </div>
      </div>

      {/* Add Employee Modal */}
      {addModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Add Employee</h2>
              <button onClick={() => { setAddModal(false); setAddError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748b' }}>
              Slot {employeeCount + 1} of {MAX_EMPLOYEES} — This account will be active immediately.
            </p>

            {addError && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                {addError}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); setAddError(''); addMutation.mutate({ name: newName, email: newEmail, password: newPassword }); }}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Full Name</label>
                <input required className={styles.inputField} type="text" placeholder="e.g. Maria Santos" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Email Address</label>
                <input autoComplete="off" required className={styles.inputField} type="email" placeholder="employee@yourcompany.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>Password</label>
                <input autoComplete="new-password" required minLength={6} className={styles.inputField} type="password" placeholder="Min. 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setAddModal(false); setAddError(''); }} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={addMutation.isPending}>
                  {addMutation.isPending ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
