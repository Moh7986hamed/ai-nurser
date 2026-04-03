import { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Login from './components/Login';
import PasswordChange from './components/PasswordChange';
import { Loader2 } from 'lucide-react';
import { AppUser, bootstrapAccounts, db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Bootstrap initial accounts if needed
      await bootstrapAccounts();

      // Check for existing session in localStorage
      const savedUser = localStorage.getItem('app_user');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          // Fetch latest data from Firestore to ensure sync
          const userRef = doc(db, 'users', parsedUser.username);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const latestData = userSnap.data() as AppUser;
            setUser(latestData);
            localStorage.setItem('app_user', JSON.stringify(latestData));
          } else {
            // User no longer exists in DB
            localStorage.removeItem('app_user');
            setUser(null);
          }
        } catch (e) {
          console.error("Failed to parse or sync saved user", e);
          localStorage.removeItem('app_user');
        }
      }
      setIsAuthChecking(false);
    };

    init();
  }, []);

  const handleLogin = (userData: AppUser) => {
    setUser(userData);
    localStorage.setItem('app_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('app_user');
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {user ? (
        user.requiresPasswordChange ? (
          <PasswordChange user={user} onPasswordChanged={handleLogin} />
        ) : (
          <ChatInterface user={user} onLogout={handleLogout} />
        )
      ) : (
        <Login onLoginSuccess={handleLogin} />
      )}
    </div>
  );
}
