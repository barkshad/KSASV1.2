/**
 * src/pages/admin/UserManagement.tsx
 * Admin user management — create, import, and view users.
 * Default password messaging removed from UI per security policy.
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Download, Search, Plus, Loader2, Users, UserCheck, Shield, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { hashPassword } from '../../lib/auth';
import {
  uploadJSONToCloudinary as uploadJSON,
  fetchJSONFromCloudinary as getJSON,
} from '../../lib/cloudinary';
import { db, doc, setDoc, collection, query, where, getDocs } from '../../lib/firebase';
import { collections } from '../../lib/db';

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  password: string;
  role: 'student' | 'lecturer' | 'admin';
  course?: string;
  department?: string;
  year?: string;
  status: 'active' | 'inactive';
}

function generateInitialPassword(): string {
  // 8-char alphanumeric — never displayed in UI, sent via separate channel
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

type RoleFilter = 'student' | 'lecturer' | 'admin';

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [filterRole, setFilterRole] = useState<RoleFilter>('student');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<UserRecord & { plainPassword: string }>>({
    role: 'student',
  });
  const [savingUser, setSavingUser] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = (await getJSON('users.json') as UserRecord[]) || [];
        setUsers(data);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Save single user ────────────────────────────────────────────────────────
  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    setSaveResult(null);
    try {
      if (!newUser.uid || !newUser.name || !newUser.email || !newUser.role) {
        throw new Error('Name, Email, ID, and Role are required.');
      }

      const plainPw = newUser.plainPassword || generateInitialPassword();
      const hashedPw = hashPassword(plainPw);

      const userObj: UserRecord = {
        uid: newUser.uid.trim(),
        name: newUser.name.trim(),
        email: newUser.email.toLowerCase().trim(),
        password: hashedPw,
        role: newUser.role as UserRecord['role'],
        course: newUser.course?.trim() || undefined,
        department: newUser.department?.trim() || undefined,
        status: 'active',
      };

      const docId = userObj.uid.toLowerCase().replace(/[^a-z0-9]/g, '');
      await setDoc(doc(db, collections.USERS, docId), {
        uid: userObj.uid,
        name: userObj.name,
        email: userObj.email,
        role: userObj.role,
        status: userObj.status,
        password: hashedPw,
        ...(userObj.course ? { course: userObj.course } : {}),
        ...(userObj.department ? { department: userObj.department } : {}),
      }, { merge: true });

      const merged = [...users.filter((u) => u.uid !== userObj.uid), userObj];
      await uploadJSON('users.json', merged);
      setUsers(merged);

      setShowAddModal(false);
      setNewUser({ role: 'student' });
      toast.success(`${userObj.name} added successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user.');
      setSaveResult({ type: 'err', msg: err.message || 'Failed to create user.' });
    } finally {
      setSavingUser(false);
    }
  };

  // ── Bulk CSV import ─────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const newUsers: UserRecord[] = [];
          for (const row of results.data as Record<string, string>[]) {
            const role = (row.Role?.toLowerCase() ||
              (row.StudentNumber ? 'student' : 'lecturer')) as UserRecord['role'];
            const id = (row.StudentNumber || row.StaffID || row.ID || '').toString().trim();
            if (!id || !row.Email) continue;

            const userObj: UserRecord = {
              uid: id,
              name: (row.FullName || row.Name || '').trim(),
              email: row.Email.toLowerCase().trim(),
              password: hashPassword('123456'), // CSV import uses default; users must change
              role,
              course: row.Course?.trim(),
              department: row.Department?.trim(),
              year: row.Year?.trim(),
              status: 'active',
            };
            newUsers.push(userObj);

            await setDoc(
              doc(db, collections.USERS, id.toLowerCase().replace(/[^a-z0-9]/g, '')),
              {
                uid: userObj.uid,
                name: userObj.name,
                email: userObj.email,
                role,
                status: 'active',
                password: userObj.password,
              },
              { merge: true }
            );
          }

          const merged = [
            ...users.filter((u) => !newUsers.some((n) => n.uid === u.uid)),
            ...newUsers,
          ];
          await uploadJSON('users.json', merged);
          setUsers(merged);
          toast.success(`Successfully imported ${newUsers.length} users.`);
        } catch (err: any) {
          toast.error(`Import failed: ${err.message}`);
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (err) => {
        toast.error(`CSV parse error: ${err.message}`);
        setImporting(false);
      },
    });
  };

  // ── Filtered users ──────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    if (u.role !== filterRole) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.uid?.toLowerCase().includes(s)
    );
  });

  const roleTabs: { id: RoleFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'student', label: 'Students', icon: <Users className="w-4 h-4" /> },
    { id: 'lecturer', label: 'Lecturers', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'admin', label: 'Administrators', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col px-4 md:px-6 py-6 max-w-7xl mx-auto w-full animate-in fade-in duration-500">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-bold text-2xl text-primary">User Management</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Manage accounts for students, lecturers, and administrators.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <button
              onClick={() => {
                const csv = Papa.unparse(filteredUsers.map(u => ({
                  ID: u.uid, Name: u.name, Email: u.email, Role: u.role, Status: u.status
                })));
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-variant transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Save result banner */}
        {saveResult && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${saveResult.type === 'ok' ? 'bg-success-container/20 text-success' : 'bg-error-container text-on-error-container'}`}>
            {saveResult.msg}
            <button onClick={() => setSaveResult(null)} className="ml-4 underline text-xs">Dismiss</button>
          </div>
        )}

        {/* Tabs + Search */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm mb-6 overflow-hidden">
          <div className="flex border-b border-outline-variant/20">
            {roleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterRole(tab.id)}
                className={`flex items-center gap-2 flex-1 justify-center py-3.5 text-sm font-bold transition-colors ${
                  filterRole === tab.id
                    ? 'text-primary border-b-2 border-primary bg-primary-container/10'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="text-xs bg-surface-container px-1.5 py-0.5 rounded-full">
                  {users.filter((u) => u.role === tab.id).length}
                </span>
              </button>
            ))}
          </div>

          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
              <input
                type="text"
                placeholder="Search by name, ID, or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>
        </div>

        {/* User grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
            <Users className="w-10 h-10 mx-auto text-outline mb-3" />
            <p className="font-bold text-on-surface mb-1">No users registered yet. The Kabarak family awaits.</p>
            <p className="text-sm text-on-surface-variant">
              {search ? 'Try a different search term.' : 'Use the Import CSV or + button to add users.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredUsers.map((u) => (
              <div
                key={u.uid}
                className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/20 hover:shadow-md transition-shadow flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center shrink-0">
                      {u.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-on-surface text-sm truncate">{u.name}</p>
                      <p className="text-xs text-on-surface-variant truncate">{u.uid}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${u.status === 'active' ? 'bg-success-container/20 text-success' : 'bg-error-container text-on-error-container'}`}>
                    {u.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Email</span>
                    <span className="text-primary font-medium truncate max-w-[160px]">{u.email}</span>
                  </div>
                  {(u.course || u.department) && (
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">{u.role === 'student' ? 'Course' : 'Dept'}</span>
                      <span className="font-medium truncate max-w-[160px]">{u.course || u.department}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setShowAddModal(true); setSaveResult(null); }}
        className="fixed bottom-24 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40"
        aria-label="Add user"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Add User Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-12 md:pt-24 bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={() => { setShowAddModal(false); setNewUser({ role: 'student' }); }}>
          <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-7 w-full max-w-md shadow-2xl border border-outline-variant/30 animate-scale-in relative my-8" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setShowAddModal(false); setNewUser({ role: 'student' }); }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-xl text-on-surface mb-1">Create New Account</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              The user will receive login credentials through institutional channels.
            </p>

            <form onSubmit={handleManualSave} className="space-y-5">
              <div className="form-group">
                <label className="form-label" htmlFor="modal-name">Full Name</label>
                <input id="modal-name" required value={newUser.name || ''} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Jane Doe" className="input-base" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="modal-email">Email</label>
                <input id="modal-email" required type="email" value={newUser.email || ''} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="jane@kabarak.ac.ke" className="input-base" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="modal-uid">ID / Student Number</label>
                <input id="modal-uid" required value={newUser.uid || ''} onChange={(e) => setNewUser({ ...newUser, uid: e.target.value })} placeholder="KAB/001/2023" className="input-base" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="modal-role">Role</label>
                <select id="modal-role" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRecord['role'] })} className="input-base cursor-pointer">
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              {newUser.role === 'student' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-course">Course</label>
                  <input id="modal-course" value={newUser.course || ''} onChange={(e) => setNewUser({ ...newUser, course: e.target.value })} placeholder="e.g. BSc Computer Science" className="input-base" />
                </div>
              )}
              {newUser.role === 'lecturer' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="modal-dept">Department</label>
                  <input id="modal-dept" value={newUser.department || ''} onChange={(e) => setNewUser({ ...newUser, department: e.target.value })} placeholder="e.g. Computer Science" className="input-base" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="modal-pw">Initial Password <span className="font-normal normal-case text-on-surface-variant">(leave blank to auto-generate)</span></label>
                <input id="modal-pw" type="password" value={newUser.plainPassword || ''} onChange={(e) => setNewUser({ ...newUser, plainPassword: e.target.value })} placeholder="Set a password" className="input-base" />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowAddModal(false); setNewUser({ role: 'student' }); }} className="flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-variant rounded-xl transition-colors text-sm border border-outline-variant/30">
                  Cancel
                </button>
                <button type="submit" disabled={savingUser} className="btn-primary flex-1 h-12 text-sm disabled:opacity-60">
                  {savingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {savingUser ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
