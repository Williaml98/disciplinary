import { useRef, useState } from 'react';
import { Eye, EyeOff, CheckCircle, AlertCircle, BookOpen, Users, GraduationCap, Settings, Camera, Trash2 } from 'lucide-react';
import type { AppUser } from './mockData';
import { updateUserProfile, changePassword, uploadProfilePicture, removeProfilePicture } from '../../lib/api';
import { Avatar } from './Avatar';
import { DepartmentSelect } from './DepartmentSelect';
import { notifyError, notifySuccess } from '../../lib/toast';

interface Props {
  user: AppUser;
  onUpdate: (updated: AppUser) => void;
  onClose: () => void;
}

const ROLE_LABELS = {
  lecturer: 'Lecturer / Invigilator',
  committee: 'Committee Member',
  student: 'Student',
  admin: 'Registrar / Admin',
};

const ROLE_ICONS = {
  lecturer: <BookOpen size={13} />,
  committee: <Users size={13} />,
  student: <GraduationCap size={13} />,
  admin: <Settings size={13} />,
};

const ROLE_COLORS = {
  lecturer: 'bg-blue-50 text-blue-700 border-blue-200',
  committee: 'bg-slate-100 text-slate-700 border-slate-200',
  student: 'bg-teal-50 text-teal-700 border-teal-200',
  admin: 'bg-[#1D3A5F]/10 text-[#1D3A5F] border-[#1D3A5F]/20',
};

export function ProfilePage({ user, onUpdate, onClose }: Props) {
  // Profile info state
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  // Student ID and department are separate fields, not one shared "extra" — a student has both, and
  // conflating them meant a student could never set their programme.
  const [department, setDepartment] = useState(user.department || '');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const pictureInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [savingPassword, setSavingPassword] = useState(false);

  const isStudent = user.role === 'student';

  async function handlePictureUpload(file: File) {
    setUploadingPicture(true);
    try {
      onUpdate(await uploadProfilePicture(user.id, file));
      notifySuccess('Profile picture updated.');
    } catch (err) {
      notifyError(err, 'Unable to upload that image. Please try again.');
    } finally {
      setUploadingPicture(false);
    }
  }

  async function handlePictureRemove() {
    setUploadingPicture(true);
    try {
      onUpdate(await removeProfilePicture(user.id));
      notifySuccess('Profile picture removed.');
    } catch (err) {
      notifyError(err, 'Unable to remove your profile picture.');
    } finally {
      setUploadingPicture(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Name is required.';
    if (!email.trim()) errors.email = 'Email is required.';
    if (!department.trim()) errors.department = isStudent ? 'Programme is required.' : 'Department is required.';
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingProfile(true);
    try {
      const updated = await updateUserProfile(user.id, {
        name: name.trim(),
        email: email.trim(),
        department: department.trim(),
        // Sent unchanged. Only an admin may alter a student's ID (it's the key tying them to their
        // case), so echoing the current value keeps this a no-op rather than a 403.
        ...(user.studentId ? { studentId: user.studentId } : {}),
      });
      onUpdate(updated);
      notifySuccess('Profile updated.');
    } catch (err) {
      // Toast rather than setProfileErrors({ email: ... }) — a server error about any field used to
      // render under the Email input regardless of what it actually referred to.
      notifyError(err, 'Unable to save profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!currentPw) errors.current = 'Please enter your current password.';
    if (!newPw) errors.new = 'New password is required.';
    else if (newPw.length < 8) errors.new = 'Password must be at least 8 characters.';
    if (newPw === currentPw) errors.new = 'New password must be different from the current one.';
    if (confirmPw !== newPw) errors.confirm = 'Passwords do not match.';
    setPwErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPassword(true);
    try {
      await changePassword(user.id, currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      notifySuccess('Password updated.', 'Use your new password next time you sign in.');
    } catch (err) {
      // The server's message here is almost always "current password is incorrect", which does belong
      // on that field — so show it inline as well as in the toast.
      setPwErrors({ current: 'Check your current password and try again.' });
      notifyError(err, 'Unable to change password. Please try again.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex items-center gap-4 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Back
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <h1 className="text-lg text-gray-900">My Profile</h1>
      </div>

      <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-5">
        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <Avatar user={user} size={80} />
              {/* This camera badge used to be decorative — no input, no handler. */}
              <button
                type="button"
                onClick={() => pictureInputRef.current?.click()}
                disabled={uploadingPicture}
                aria-label="Change profile picture"
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-gray-100 border-2 border-white rounded-full flex items-center justify-center hover:bg-gray-200 disabled:opacity-60 transition-colors"
              >
                <Camera size={12} className="text-gray-600" />
              </button>
              <input
                ref={pictureInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  // Reset so re-picking the same file still fires a change event.
                  e.target.value = '';
                  if (file) handlePictureUpload(file);
                }}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl text-gray-900 truncate">{user.name}</h2>
              <p className="text-sm text-gray-500 truncate mt-0.5">{user.email}</p>
              {uploadingPicture && <p className="text-xs text-gray-400 mt-1">Updating picture…</p>}
              {user.profilePictureUrl && !uploadingPicture && (
                <button
                  type="button"
                  onClick={handlePictureRemove}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 mt-1 transition-colors"
                >
                  <Trash2 size={11} /> Remove picture
                </button>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${ROLE_COLORS[user.role]}`}>
                  {ROLE_ICONS[user.role]}
                  {ROLE_LABELS[user.role]}
                </span>
                {user.studentId && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                    ID: {user.studentId}
                  </span>
                )}
                {user.department && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                    {user.department}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Personal information */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-5">Personal Information</h3>

          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProfileField label="Full Name" error={profileErrors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setProfileErrors(p => ({ ...p, name: '' })); }}
                  className={inputCls(!!profileErrors.name)}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </ProfileField>

              <ProfileField label="Email Address" error={profileErrors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setProfileErrors(p => ({ ...p, email: '' })); }}
                  className={inputCls(!!profileErrors.email)}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </ProfileField>
            </div>

            {isStudent && (
              <ProfileField label="Student ID">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-sm text-gray-700">{user.studentId}</span>
                  <span className="text-xs text-gray-400">Contact the Registrar to change this</span>
                </div>
              </ProfileField>
            )}

            <ProfileField label={isStudent ? 'Programme' : 'Department'} error={profileErrors.department}>
              <DepartmentSelect
                role={user.role}
                value={department}
                onChange={v => { setDepartment(v); setProfileErrors(p => ({ ...p, department: '' })); }}
                placeholder={isStudent ? 'Select your programme…' : 'Select your department…'}
                className={inputCls(!!profileErrors.department)}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </ProfileField>

            {/* Role — read-only */}
            <ProfileField label="Role">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                {ROLE_ICONS[user.role]}
                <span className="text-sm text-gray-600">{ROLE_LABELS[user.role]}</span>
                <span className="text-xs text-gray-400 ml-auto">Cannot be changed here</span>
              </div>
            </ProfileField>

            <div className="pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: '#1D3A5F' }}
              >
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-5">Change Password</h3>

          <form onSubmit={savePassword} className="space-y-4">
            <ProfileField label="Current Password" error={pwErrors.current}>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => { setCurrentPw(e.target.value); setPwErrors(p => ({ ...p, current: '' })); }}
                  placeholder="Enter current password"
                  className={inputCls(!!pwErrors.current) + ' pr-11'}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <button type="button" onClick={() => setShowCurrent(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </ProfileField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProfileField label="New Password" error={pwErrors.new}>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => { setNewPw(e.target.value); setPwErrors(p => ({ ...p, new: '' })); }}
                    placeholder="Minimum 8 characters"
                    className={inputCls(!!pwErrors.new) + ' pr-11'}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                  <button type="button" onClick={() => setShowNew(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPw.length >= 8 && !pwErrors.new && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle size={11} /> Strong password</p>
                )}
              </ProfileField>

              <ProfileField label="Confirm New Password" error={pwErrors.confirm}>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setPwErrors(p => ({ ...p, confirm: '' })); }}
                    placeholder="Re-enter new password"
                    className={inputCls(!!pwErrors.confirm) + ' pr-11'}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                  <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </ProfileField>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={savingPassword}
                className="text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                style={{ backgroundColor: '#1D3A5F' }}
              >
                {savingPassword ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Account info — read only */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Account Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Account ID</span>
              <span className="font-mono text-gray-600 text-xs">{user.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Role</span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${ROLE_COLORS[user.role]}`}>
                {ROLE_ICONS[user.role]} {ROLE_LABELS[user.role]}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">System</span>
              <span className="text-gray-600">CaseFlow — AUCA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle size={11} className="shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full border ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'} rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors`;
}

function focusStyle(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.boxShadow = '0 0 0 2px #1D3A5F40';
  e.currentTarget.style.borderColor = '#1D3A5F';
}

function blurStyle(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.boxShadow = '';
  e.currentTarget.style.borderColor = '';
}
