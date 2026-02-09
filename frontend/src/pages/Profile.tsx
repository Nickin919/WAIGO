import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, User, Mail, Lock, FileText, FolderKanban, Users, Loader2, Camera, MapPin, Phone, FileSignature } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const roleLabel = (role: string): string => {
  const r = effectiveRole(role);
  if (r === 'DISTRIBUTOR_REP') return 'Distributor';
  if (r === 'DIRECT_USER') return 'Direct';
  if (r === 'BASIC_USER') return 'Basic';
  return r.toLowerCase().replace(/_/g, ' ');
};

type ActivityItem = { type: 'quote' | 'project' | 'customer'; id: string; title: string; date: string };

const Profile = () => {
  const { user, logout, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [savingName, setSavingName] = useState(false);

  const [email, setEmail] = useState(user?.email ?? '');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [address, setAddress] = useState(user?.address ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [savingContact, setSavingContact] = useState(false);

  const [defaultTerms, setDefaultTerms] = useState(user?.defaultTerms ?? '');
  const [savingTerms, setSavingTerms] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
  }, [user?.firstName, user?.lastName]);

  useEffect(() => {
    setEmail(user?.email ?? '');
    setAddress(user?.address ?? '');
    setPhone(user?.phone ?? '');
    setDefaultTerms(user?.defaultTerms ?? '');
  }, [user?.email, user?.address, user?.phone, user?.defaultTerms]);

  useEffect(() => {
    let cancelled = false;
    authApi
      .getMyActivity()
      .then((res) => {
        if (!cancelled && res.data) setActivity(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setActivity([]);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSaveName = async () => {
    if (savingName) return;
    setSavingName(true);
    try {
      const res = await authApi.updateProfile({ firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined });
      updateUser(res.data);
      toast.success('Name updated');
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && typeof (e as { response: { data?: { error?: string } } }).response?.data?.error === 'string'
        ? (e as { response: { data: { error: string } } }).response.data.error
        : 'Failed to update name';
      toast.error(msg);
    } finally {
      setSavingName(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select an image (JPEG, PNG, GIF, or WebP)');
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await authApi.uploadAvatar(formData);
      updateUser(res.data);
      toast.success('Photo updated');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response: { data?: { error?: string } } }).response?.data?.error === 'string'
        ? (err as { response: { data: { error: string } } }).response.data.error
        : 'Failed to upload photo';
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSaveEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    if (trimmed === user?.email) {
      setEmailCurrentPassword('');
      return;
    }
    if (!emailCurrentPassword) {
      toast.error('Enter your current password to change email');
      return;
    }
    setSavingEmail(true);
    try {
      const res = await authApi.updateProfile({
        email: trimmed,
        currentPassword: emailCurrentPassword,
      });
      updateUser(res.data);
      setEmailCurrentPassword('');
      toast.success('Email updated');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response: { data?: { error?: string } } }).response?.data?.error === 'string'
        ? (err as { response: { data: { error: string } } }).response.data.error
        : 'Failed to update email';
      toast.error(msg);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSaveContact = async () => {
    if (savingContact) return;
    setSavingContact(true);
    try {
      const res = await authApi.updateProfile({
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      updateUser(res.data);
      toast.success('Address and phone updated');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response: { data?: { error?: string } } }).response?.data?.error === 'string'
        ? (err as { response: { data: { error: string } } }).response.data.error
        : 'Failed to update';
      toast.error(msg);
    } finally {
      setSavingContact(false);
    }
  };

  const handleSaveTerms = async () => {
    if (savingTerms) return;
    setSavingTerms(true);
    try {
      const res = await authApi.updateProfile({
        defaultTerms: defaultTerms.trim() || undefined,
      });
      updateUser(res.data);
      toast.success('Terms updated');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response: { data?: { error?: string } } }).response?.data?.error === 'string'
        ? (err as { response: { data: { error: string } } }).response.data.error
        : 'Failed to update terms';
      toast.error(msg);
    } finally {
      setSavingTerms(false);
    }
  };

  const avatarUrl = user?.avatarUrl ? (user.avatarUrl.startsWith('http') ? user.avatarUrl : `${API_URL}${user.avatarUrl}`) : null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response: { data?: { error?: string } } }).response?.data?.error === 'string'
        ? (err as { response: { data: { error: string } } }).response.data.error
        : 'Failed to change password';
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  };

  return (
    <div className="container-custom py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

      <div className="max-w-2xl space-y-6">
        {/* Profile card: avatar, name (editable), email, address/phone, role */}
        <div className="card p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative group">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-20 h-20 rounded-full overflow-hidden bg-wago-blue flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-wago-green focus:ring-offset-2"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  {uploadingAvatar ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="input w-32"
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="input w-32"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="btn btn-primary text-sm"
                >
                  {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save name'}
                </button>
              </div>
              <p className="text-gray-500 text-sm mt-1">Click photo to change</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="input flex-1 min-w-[200px]"
                />
                {email.trim() !== (user?.email ?? '') && (
                  <>
                    <input
                      type="password"
                      value={emailCurrentPassword}
                      onChange={(e) => setEmailCurrentPassword(e.target.value)}
                      placeholder="Current password to change email"
                      className="input w-48"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={handleSaveEmail}
                      disabled={savingEmail}
                      className="btn btn-primary text-sm"
                    >
                      {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save email'}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-gray-600 flex-shrink-0" />
              <div>
                <div className="text-sm text-gray-600">Role</div>
                <div className="font-medium capitalize">{user?.role ? roleLabel(user.role) : ''}</div>
              </div>
            </div>
          </div>

          {/* Address & phone */}
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Address &amp; phone
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
                className="input flex-1"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                className="input w-full sm:w-48"
              />
              <button
                type="button"
                onClick={handleSaveContact}
                disabled={savingContact}
                className="btn btn-primary whitespace-nowrap"
              >
                {savingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>

          {/* Terms (default text for Pricing Proposal PDF) */}
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileSignature className="w-4 h-4" /> Terms
            </h3>
            <p className="text-xs text-gray-500">
              Default terms text for Pricing Proposal PDFs. Used when the quote owner is you (or your hierarchy).
            </p>
            <textarea
              value={defaultTerms}
              onChange={(e) => setDefaultTerms(e.target.value)}
              placeholder="e.g. Net 30. Valid for 30 days from proposal date."
              className="input w-full min-h-[100px] resize-y"
              rows={4}
            />
            <button
              type="button"
              onClick={handleSaveTerms}
              disabled={savingTerms}
              className="btn btn-primary"
            >
              {savingTerms ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Terms'}
            </button>
          </div>
        </div>

        {/* Change password */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="input w-full"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="input w-full"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="input w-full"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={changingPassword} className="btn btn-primary">
              {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change password'}
            </button>
          </form>
        </div>

        {/* Recent activity */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent activity</h2>
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : activity.length === 0 ? (
            <p className="text-gray-500 py-4">No recent activity.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {activity.map((item) => {
                const Icon = item.type === 'quote' ? FileText : item.type === 'project' ? FolderKanban : Users;
                const href =
                  item.type === 'quote'
                    ? `/quotes/${item.id}`
                    : item.type === 'project'
                      ? `/projects/${item.id}`
                      : null;
                return (
                  <li key={`${item.type}-${item.id}`} className="py-3 first:pt-0">
                    {href ? (
                      <Link
                        to={href}
                        className="flex items-center gap-3 text-gray-800 hover:text-wago-green transition-colors"
                      >
                        <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        <span className="flex-1 truncate">{item.title}</span>
                        <span className="text-sm text-gray-500 flex-shrink-0">{formatDate(item.date)}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 text-gray-800">
                        <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        <span className="flex-1 truncate">{item.title}</span>
                        <span className="text-sm text-gray-500 flex-shrink-0">{formatDate(item.date)}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-outline flex items-center space-x-2 w-full justify-center"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Profile;
