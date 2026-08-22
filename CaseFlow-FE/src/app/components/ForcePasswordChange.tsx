import { useState } from 'react';
import { KeyRound, Eye, EyeOff, LogOut } from 'lucide-react';
import { changePassword, fetchCurrentUser } from '../../lib/api';
import { notifyError, notifySuccess } from '../../lib/toast';
import type { AppUser } from './mockData';
import logo from '../../imports/logo.png';

const NAVY = '#1D3A5F';

/**
 * Blocking screen shown when an admin created the account with a generated temporary password.
 *
 * It stands between login and the dashboard deliberately: the temporary password was sent by email, so
 * it should stop working as soon as the user has one of their own. The backend clears
 * `mustChangePassword` when the password changes, so this screen disappears on its own.
 */
export function ForcePasswordChange({ user, onChanged, onLogout }: {
  user: AppUser;
  onChanged: (updated: AppUser) => void;
  onLogout: () => void;
}) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!currentPw) found.current = 'Enter the temporary password from your email.';
    if (!newPw) found.new = 'Choose a new password.';
    else if (newPw.length < 8) found.new = 'Must be at least 8 characters.';
    else if (newPw === currentPw) found.new = 'Choose something different from the temporary password.';
    if (confirmPw !== newPw) found.confirm = 'Passwords do not match.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await changePassword(user.id, currentPw, newPw);
      // Re-read the user so the cleared mustChangePassword flag comes from the server rather than
      // being assumed here.
      onChanged(await fetchCurrentUser());
      notifySuccess('Password set.', 'Welcome to CaseFlow.');
    } catch (err) {
      setErrors({ current: 'Check the temporary password from your email and try again.' });
      notifyError(err, 'Unable to set your password. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (hasError: boolean) =>
    `w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-colors ${
      hasError ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-[#1D3A5F]'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f0ead9' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <img src={logo} alt="AUCA" className="w-11 h-11 rounded-full bg-white p-0.5 object-cover" />
          <div>
            <p className="font-bold text-lg leading-tight" style={{ color: NAVY }}>CaseFlow</p>
            <p className="text-xs text-gray-500">AUCA Disciplinary System</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={16} style={{ color: NAVY }} />
            <h1 className="text-base font-semibold text-gray-900">Set your password</h1>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Your account was created by an administrator. Choose a password to finish signing in as{' '}
            <span className="font-medium text-gray-700">{user.email}</span>.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Temporary password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setErrors(p => ({ ...p, current: '' })); }}
                placeholder="From your welcome email"
                className={inputCls(!!errors.current)}
                autoFocus
              />
              {errors.current && <p className="text-xs text-red-600 mt-1">{errors.current}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => { setNewPw(e.target.value); setErrors(p => ({ ...p, new: '' })); }}
                  placeholder="At least 8 characters"
                  className={inputCls(!!errors.new)}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.new && <p className="text-xs text-red-600 mt-1">{errors.new}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm new password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setErrors(p => ({ ...p, confirm: '' })); }}
                className={inputCls(!!errors.confirm)}
              />
              {errors.confirm && <p className="text-xs text-red-600 mt-1">{errors.confirm}</p>}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full text-white rounded-xl py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: NAVY }}
            >
              {saving ? 'Saving…' : 'Set password and continue'}
            </button>
          </form>
        </div>

        <button
          onClick={onLogout}
          className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
