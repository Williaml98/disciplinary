import { useRef, useState } from 'react';
import {
  Eye, EyeOff, CheckCircle, AlertCircle, BookOpen, Users, GraduationCap, Settings, Camera, Trash2,
  ArrowLeft, UserRound, KeyRound, ShieldCheck, Loader2, Hash, Building2,
} from 'lucide-react';
import type { AppUser } from './mockData';
import { updateUserProfile, changePassword, uploadProfilePicture, removeProfilePicture } from '../../lib/api';
import { Avatar } from './Avatar';
import { DepartmentSelect } from './DepartmentSelect';
import { PrimaryButton } from './DashboardLayout';
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

// Tints match the StatusBadge treatment: soft fill, inset ring, no hard border.
const ROLE_COLORS = {
  lecturer: 'bg-blue-50 text-blue-800 ring-blue-200/70',
  committee: 'bg-ink-100 text-ink-700 ring-ink-200',
  student: 'bg-teal-50 text-teal-800 ring-teal-200/70',
  admin: 'bg-brand-50 text-brand-800 ring-brand-200',
};

const ROLE_CHIP = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-tight font-semibold ring-1 ring-inset';
const META_CHIP = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-tight font-medium text-ink-600 bg-ink-50 ring-1 ring-inset ring-ink-200';
const READONLY_ROW = 'flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-ink-50 px-3.5 py-2.5';

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
    <div className="flex-1 overflow-y-auto bg-page">
      {/* Header bar — matches PageHeader's chrome, with a back affordance ahead of the title. */}
      <div className="bg-[var(--surface-card)]/85 backdrop-blur-xl border-b border-[var(--hairline)] px-4 sm:px-8 py-4 sm:py-5
                      flex items-center gap-4 shrink-0 sticky top-0 z-20">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium text-ink-500
                     hover:text-brand-700 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <div className="h-5 w-px bg-[var(--hairline-strong)]" />
        <div className="min-w-0">
          <h1 className="display-lg text-ink-900 truncate">My Profile</h1>
          <p className="text-[13px] text-ink-500 mt-0.5 truncate">Your details, picture and password</p>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-5 rise">
        {/* Profile header card */}
        <div className="card overflow-hidden">
          <div className="h-20 bg-brand-50 border-b border-[var(--hairline)]" aria-hidden="true" />

          <div className="px-6 pb-6">
            <div className="-mt-10 flex flex-wrap items-end gap-x-5 gap-y-4">
              <div className="relative shrink-0">
                <Avatar user={user} size={80} className="ring-4 ring-white shadow-[var(--shadow-md)]" />
                {/* This camera badge used to be decorative — no input, no handler. */}
                <button
                  type="button"
                  onClick={() => pictureInputRef.current?.click()}
                  disabled={uploadingPicture}
                  aria-label="Change profile picture"
                  className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-white text-ink-600
                             ring-1 ring-[var(--hairline-strong)] shadow-[var(--shadow-sm)]
                             flex items-center justify-center hover:bg-ink-50 hover:text-brand-700
                             disabled:opacity-60 disabled:cursor-not-allowed
                             transition-all duration-[var(--dur)] ease-[var(--ease-out)]"
                >
                  <Camera size={13} />
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

              <div className="min-w-0 flex-1">
                <h2 className="display-lg text-ink-900 truncate">{user.name}</h2>
                <p className="text-[13px] text-ink-500 truncate mt-0.5">{user.email}</p>
                {uploadingPicture && (
                  <p className="text-[11px] text-ink-400 mt-1.5 flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" /> Updating picture…
                  </p>
                )}
                {user.profilePictureUrl && !uploadingPicture && (
                  <button
                    type="button"
                    onClick={handlePictureRemove}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-400 mt-1.5
                               hover:text-rose-600 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]"
                  >
                    <Trash2 size={11} /> Remove picture
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap mt-5 pt-5 border-t border-[var(--hairline)]">
              <span className={`${ROLE_CHIP} ${ROLE_COLORS[user.role]}`}>
                {ROLE_ICONS[user.role]}
                {ROLE_LABELS[user.role]}
              </span>
              {user.studentId && (
                <span className={META_CHIP}>
                  <Hash size={11} className="text-ink-400" />
                  <span className="font-mono tabular">{user.studentId}</span>
                </span>
              )}
              {user.department && (
                <span className={META_CHIP}>
                  <Building2 size={11} className="text-ink-400" />
                  {user.department}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Personal information */}
        <div className="card p-6">
          <SectionHeading
            icon={<UserRound size={16} />}
            eyebrow="Account"
            title="Personal Information"
            subtitle="How your name appears on every case you touch."
          />

          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProfileField label="Full Name" error={profileErrors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setProfileErrors(p => ({ ...p, name: '' })); }}
                  className={inputCls(!!profileErrors.name)}
                />
              </ProfileField>

              <ProfileField label="Email Address" error={profileErrors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setProfileErrors(p => ({ ...p, email: '' })); }}
                  className={inputCls(!!profileErrors.email)}
                />
              </ProfileField>
            </div>

            {isStudent && (
              <ProfileField label="Student ID">
                <div className={READONLY_ROW}>
                  <span className="text-[13px] font-mono tabular text-ink-700">{user.studentId}</span>
                  <span className="text-[11px] text-ink-400 text-right">Contact the Registrar to change this</span>
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
              />
            </ProfileField>

            {/* Role — read-only */}
            <ProfileField label="Role">
              <div className={READONLY_ROW}>
                <span className="flex items-center gap-2 text-[13px] text-ink-700">
                  <span className="text-ink-400">{ROLE_ICONS[user.role]}</span>
                  {ROLE_LABELS[user.role]}
                </span>
                <span className="text-[11px] text-ink-400 text-right">Cannot be changed here</span>
              </div>
            </ProfileField>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--hairline)]">
              <p className="text-[11px] text-ink-400">Applies everywhere your name appears in CaseFlow.</p>
              <PrimaryButton type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </PrimaryButton>
            </div>
          </form>
        </div>

        {/* Change password */}
        <div className="card p-6">
          <SectionHeading
            icon={<KeyRound size={16} />}
            eyebrow="Security"
            title="Change Password"
            subtitle="Use at least 8 characters, different from your current one."
          />

          <form onSubmit={savePassword} className="space-y-4">
            <ProfileField label="Current Password" error={pwErrors.current}>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => { setCurrentPw(e.target.value); setPwErrors(p => ({ ...p, current: '' })); }}
                  placeholder="Enter current password"
                  className={inputCls(!!pwErrors.current) + ' pr-11'}
                />
                <RevealButton shown={showCurrent} onToggle={() => setShowCurrent(s => !s)} />
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
                  />
                  <RevealButton shown={showNew} onToggle={() => setShowNew(s => !s)} />
                </div>
                {newPw.length >= 8 && !pwErrors.new && (
                  <p className="text-[11px] font-medium text-emerald-600 mt-1.5 flex items-center gap-1.5">
                    <CheckCircle size={11} className="shrink-0" /> Strong password
                  </p>
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
                  />
                  <RevealButton shown={showConfirm} onToggle={() => setShowConfirm(s => !s)} />
                </div>
              </ProfileField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--hairline)]">
              <p className="text-[11px] text-ink-400">You'll stay signed in on this device.</p>
              <PrimaryButton type="submit" disabled={savingPassword}>
                {savingPassword ? 'Updating…' : 'Update Password'}
              </PrimaryButton>
            </div>
          </form>
        </div>

        {/* Account info — read only */}
        <div className="card p-6">
          <SectionHeading
            icon={<ShieldCheck size={16} />}
            eyebrow="Reference"
            title="Account Details"
            subtitle="Quote these when contacting the Registrar."
          />

          <dl className="space-y-0">
            <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--hairline)]">
              <dt className="text-[13px] text-ink-500">Account ID</dt>
              <dd className="font-mono tabular text-[12px] text-ink-700">{user.id}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--hairline)]">
              <dt className="text-[13px] text-ink-500">Role</dt>
              <dd>
                <span className={`${ROLE_CHIP} ${ROLE_COLORS[user.role]}`}>
                  {ROLE_ICONS[user.role]} {ROLE_LABELS[user.role]}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-[13px] text-ink-500">System</dt>
              <dd className="text-[13px] text-ink-700">CaseFlow — AUCA</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ icon, eyebrow, title, subtitle }: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span
        aria-hidden="true"
        className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100
                   flex items-center justify-center shrink-0"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="display-md text-ink-900 mt-0.5">{title}</h3>
        {subtitle && <p className="text-[12px] text-ink-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function ProfileField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-ink-700 mb-1.5">{label}</label>
      {children}
      {error && (
        <p className="text-[11px] font-medium text-rose-600 mt-1.5 flex items-center gap-1.5">
          <AlertCircle size={11} className="shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function RevealButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:text-brand-700
                 transition-colors duration-[var(--dur)] ease-[var(--ease-out)]"
    >
      {shown ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

function inputCls(hasError: boolean) {
  return `w-full rounded-xl border px-3.5 py-2.5 text-[13px] text-ink-800 placeholder-ink-400 outline-none
          transition-all duration-[var(--dur)] ease-[var(--ease-out)]
          focus:border-brand-400 focus:shadow-[var(--shadow-focus)]
          ${hasError
            ? 'border-rose-300 bg-rose-50/50'
            : 'border-[var(--hairline)] bg-white hover:border-[var(--hairline-strong)]'}`;
}
