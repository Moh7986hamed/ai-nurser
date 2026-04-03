import { useState } from 'react';
import { Lock, Loader2, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { db, AppUser, getClientIp } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface PasswordChangeProps {
  user: AppUser;
  onPasswordChanged: (updatedUser: AppUser) => void;
}

export default function PasswordChange({ user, onPasswordChanged }: PasswordChangeProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 3) {
      setError('كلمة المرور يجب أن تكون 3 أحرف على الأقل');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ip = await getClientIp();
      const userRef = doc(db, 'users', user.username);
      await updateDoc(userRef, {
        password: newPassword,
        requiresPasswordChange: false,
        lastIp: ip
      });

      const updatedUser: AppUser = {
        ...user,
        password: newPassword,
        requiresPasswordChange: false,
        lastIp: ip
      };

      setSuccess(true);
      setTimeout(() => {
        onPasswordChanged(updatedUser);
      }, 2000);
    } catch (err) {
      setError('حدث خطأ أثناء تحديث كلمة المرور. يرجى المحاولة مرة أخرى.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 font-sans" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-100">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">تغيير كلمة المرور</h1>
          <p className="text-slate-500 font-medium">يجب عليك تغيير كلمة المرور عند تسجيل الدخول لأول مرة</p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-600 text-sm font-medium"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            تم تغيير كلمة المرور بنجاح! جاري الدخول...
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 mr-1">كلمة المرور الجديدة</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-900"
                placeholder="أدخل كلمة المرور الجديدة"
                required
                disabled={success}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 mr-1">تأكيد كلمة المرور</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-slate-900"
                placeholder="أعد إدخال كلمة المرور"
                required
                disabled={success}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                جاري التحديث...
              </>
            ) : (
              'تحديث كلمة المرور'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
