import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, BookOpen, Mic, MicOff, Plus, MessageSquare, Trash2, Menu, X, LogOut, UserPlus, ShieldCheck, AlertCircle, ToggleLeft, ToggleRight, FileText, Copy, Check, Edit2, Settings, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { askQuestion, summarizeCurriculumSection, classifyConversation } from '../services/geminiService';
import { cn } from '../lib/utils';
import { db, AppUser, handleFirestoreError, OperationType, getClientIp } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, onSnapshot, orderBy, setDoc } from 'firebase/firestore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: any;
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-1 py-2">
    <motion.div
      className="w-2 h-2 bg-indigo-400 rounded-full"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
    />
    <motion.div
      className="w-2 h-2 bg-indigo-400 rounded-full"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
    />
    <motion.div
      className="w-2 h-2 bg-indigo-400 rounded-full"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
    />
  </div>
);

const MessageBubble = ({ msg }: { msg: Message }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3 max-w-[90%] md:max-w-[80%] group",
        msg.role === 'user' ? "mr-auto flex-row-reverse" : "ml-auto flex-row"
      )}
    >
      <div className={cn(
        "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1",
        msg.role === 'user' ? "bg-indigo-600" : "bg-white border border-slate-200"
      )}>
        {msg.role === 'user' ? (
          <User className="w-4 h-4 md:w-5 md:h-5 text-white" />
        ) : (
          <Bot className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
        )}
      </div>
      <div className="relative flex flex-col gap-1 min-w-0">
        <div className={cn(
          "p-4 md:p-5 rounded-2xl shadow-sm overflow-hidden",
          msg.role === 'user' 
            ? "bg-indigo-600 text-white rounded-tl-sm" 
            : "bg-white border border-slate-200 text-slate-800 rounded-tr-sm"
        )}>
          <div className={cn(
            "prose max-w-none prose-sm md:prose-base break-words",
            msg.role === 'user' ? "prose-invert" : "prose-slate",
            "prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-50 prose-headings:font-bold"
          )}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        </div>
        
        {msg.role === 'assistant' && (
          <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity px-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] md:text-xs text-slate-500 hover:text-indigo-600 transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  category: string;
}

const CATEGORIES = [
  { id: 'nursing_practical', name: 'أساسيات التمريض (عملي)', icon: BookOpen },
  { id: 'nursing_theoretical', name: 'أساسيات التمريض (نظري)', icon: BookOpen },
  { id: 'biology', name: 'الأحياء', icon: Bot },
  { id: 'social', name: 'الدراسات الاجتماعية', icon: MessageSquare },
  { id: 'anatomy', name: 'التشريح وعلم وظائف الأعضاء', icon: BookOpen },
  { id: 'english', name: 'اللغة الإنجليزية', icon: MessageSquare },
  { id: 'religion', name: 'التربية الدينية الإسلامية', icon: BookOpen },
  { id: 'math', name: 'الرياضيات', icon: Bot },
  { id: 'physics_chemistry', name: 'العلوم التطبيقية: فيزياء / كيمياء', icon: Bot },
  { id: 'arabic', name: 'اللغة العربية', icon: MessageSquare },
];

// Add types for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

interface ChatInterfaceProps {
  user: AppUser;
  onLogout: () => void;
}

export default function ChatInterface({ user, onLogout }: ChatInterfaceProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summarySubject, setSummarySubject] = useState('أساسيات التمريض');
  const [summarySection, setSummarySection] = useState('');
  const [summaryLanguage, setSummaryLanguage] = useState('العربية');

  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatCategory, setNewChatCategory] = useState(CATEGORIES[0].id);

  // Developer Modal State
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(false);
  const [newAccountData, setNewAccountData] = useState({ username: '', password: '', isDeveloper: false });
  const [devActionLoading, setDevActionLoading] = useState(false);
  const [devMessage, setDevMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editFormData, setEditFormData] = useState({ username: '', password: '', displayName: '', isDeveloper: false });
  const [profileFormData, setProfileFormData] = useState({ username: user.username, password: user.password || '', displayName: user.displayName || '' });

  const scrollRef = useRef<HTMLDivElement>(null);
  const editFormRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load sessions from Firestore on mount
  useEffect(() => {
    const q = query(
      collection(db, 'chatSessions'),
      where('userId', '==', user.username),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSessions: ChatSession[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatSession));
      
      setSessions(fetchedSessions);
      
      if (fetchedSessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(fetchedSessions[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chatSessions');
    });

    return () => unsubscribe();
  }, [user.username]);

  // Load accounts for developer
  useEffect(() => {
    if (isDevModalOpen && user.isDeveloper) {
      loadAccounts();
    }
  }, [isDevModalOpen, user.isDeveloper]);

  const loadAccounts = async () => {
    setIsAccountsLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedAccounts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAccounts(fetchedAccounts);
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setIsAccountsLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevActionLoading(true);
    setDevMessage(null);

    try {
      if (!newAccountData.username) {
        setDevMessage({ type: 'error', text: 'يرجى إدخال اسم المستخدم' });
        return;
      }

      // Check if username exists
      const q = query(collection(db, 'users'), where('username', '==', newAccountData.username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setDevMessage({ type: 'error', text: 'اسم المستخدم موجود بالفعل' });
        return;
      }

      // Use username as document ID for consistency with bootstrap
      await setDoc(doc(db, 'users', newAccountData.username), {
        username: newAccountData.username,
        password: newAccountData.password,
        isDeveloper: newAccountData.isDeveloper,
        status: 'active',
        role: 'student',
        requiresPasswordChange: true,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      setDevMessage({ type: 'success', text: 'تم إنشاء الحساب بنجاح' });
      setNewAccountData({ username: '', password: '', isDeveloper: false });
      loadAccounts();
    } catch (error) {
      console.error("Failed to create account", error);
      setDevMessage({ type: 'error', text: 'فشل إنشاء الحساب' });
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setDevActionLoading(false);
    }
  };

  const toggleAccountStatus = async (accountId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'users', accountId), { status: newStatus });
      loadAccounts();
    } catch (err) {
      console.error("Failed to toggle status", err);
    }
  };

  const handleBulkUpdate = async (status: 'active' | 'inactive') => {
    if (selectedAccountIds.length === 0) return;
    setIsBulkActionLoading(true);
    try {
      for (const accountId of selectedAccountIds) {
        if (!accountId) continue;
        await updateDoc(doc(db, 'users', accountId), { status });
      }
      setSelectedAccountIds([]);
      loadAccounts();
      setDevMessage({ type: 'success', text: `تم تحديث ${selectedAccountIds.length} حساب بنجاح` });
    } catch (err) {
      console.error("Bulk update failed", err);
      setDevMessage({ type: 'error', text: 'فشل التحديث الجماعي' });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAccountIds.length === 0) return;
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      setTimeout(() => setConfirmBulkDelete(false), 3000);
      return;
    }
    
    setIsBulkActionLoading(true);
    let deletedCount = 0;
    let errorCount = 0;

    try {
      for (const accountId of selectedAccountIds) {
        if (!accountId) continue;
        
        // Rule: Only admin can delete admin
        if (accountId === 'admin' && user.username !== 'admin') {
          errorCount++;
          continue;
        }

        // Get user data for logging
        const userRef = doc(db, 'users', accountId);
        const userSnap = await getDocs(query(collection(db, 'users'), where('username', '==', accountId)));
        
        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();
          
          // Log deletion
          await addDoc(collection(db, 'deletedUsers'), {
            ...userData,
            deletedBy: user.username,
            deletedAt: serverTimestamp(),
            originalDocId: accountId
          });

          // Delete account
          await deleteDoc(userRef);
          deletedCount++;
        }
      }
      
      setSelectedAccountIds([]);
      setConfirmBulkDelete(false);
      loadAccounts();
      
      if (errorCount > 0) {
        setDevMessage({ 
          type: 'error', 
          text: `تم حذف ${deletedCount} حساب، وفشل حذف ${errorCount} (لا يمكنك حذف المطور الأساسي)` 
        });
      } else {
        setDevMessage({ type: 'success', text: 'تم حذف الحسابات المختارة بنجاح' });
      }
    } catch (err) {
      console.error("Bulk delete failed", err);
      setDevMessage({ type: 'error', text: 'فشل الحذف الجماعي' });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (confirmDeleteId !== accountId) {
      setConfirmDeleteId(accountId);
      setTimeout(() => setConfirmDeleteId(null), 3000); // Reset after 3 seconds
      return;
    }
    
    // Rule: Only admin can delete admin
    if (accountId === 'admin' && user.username !== 'admin') {
      setDevMessage({ type: 'error', text: 'لا يمكنك حذف حساب المطور الأساسي' });
      setConfirmDeleteId(null);
      return;
    }

    setDevActionLoading(true);
    try {
      const userRef = doc(db, 'users', accountId);
      const userSnap = await getDocs(query(collection(db, 'users'), where('username', '==', accountId)));
      
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data();
        
        // Log deletion
        await addDoc(collection(db, 'deletedUsers'), {
          ...userData,
          deletedBy: user.username,
          deletedAt: serverTimestamp(),
          originalDocId: accountId
        });

        // Delete account
        await deleteDoc(userRef);
        
        setConfirmDeleteId(null);
        setDevMessage({ type: 'success', text: 'تم حذف الحساب بنجاح' });
        
        // Refresh accounts list
        await loadAccounts();
      } else {
        setDevMessage({ type: 'error', text: 'الحساب غير موجود' });
      }
    } catch (error) {
      console.error("Failed to delete account", error);
      setDevMessage({ type: 'error', text: 'فشل حذف الحساب من قاعدة البيانات' });
      handleFirestoreError(error, OperationType.DELETE, `users/${accountId}`);
    } finally {
      setDevActionLoading(false);
    }
  };

  const handleStartEdit = (account: any) => {
    setEditingAccount(account);
    setEditFormData({
      username: account.username,
      password: account.password || '',
      displayName: account.displayName || '',
      isDeveloper: account.isDeveloper || false
    });
    
    // Scroll to edit form
    setTimeout(() => {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const updateUsernameInSessions = async (oldUsername: string, newUsername: string) => {
    if (oldUsername === newUsername) return;
    try {
      const q = query(collection(db, 'chatSessions'), where('userId', '==', oldUsername));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(d.ref, { userId: newUsername });
      }
    } catch (err) {
      console.error("Failed to update username in sessions", err);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setDevActionLoading(true);
    try {
      // If username changed, check if new one is taken
      if (editFormData.username !== editingAccount.username) {
        const q = query(collection(db, 'users'), where('username', '==', editFormData.username));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setDevMessage({ type: 'error', text: 'اسم المستخدم الجديد موجود بالفعل' });
          return;
        }
        
        // Since username is the document ID, we need to create a new doc and delete the old one
        const oldData = (await getDocs(query(collection(db, 'users'), where('username', '==', editingAccount.username)))).docs[0].data();
        await setDoc(doc(db, 'users', editFormData.username), {
          ...oldData,
          username: editFormData.username,
          password: editFormData.password,
          displayName: editFormData.displayName,
          isDeveloper: editFormData.isDeveloper
        });
        await deleteDoc(doc(db, 'users', editingAccount.username));
      } else {
        await updateDoc(doc(db, 'users', editingAccount.id), {
          password: editFormData.password,
          displayName: editFormData.displayName,
          isDeveloper: editFormData.isDeveloper
        });
      }

      // Update chat sessions if username changed
      await updateUsernameInSessions(editingAccount.username, editFormData.username);

      setEditingAccount(null);
      setDevMessage({ type: 'success', text: 'تم تحديث الحساب بنجاح' });
      loadAccounts();
    } catch (err) {
      console.error("Failed to update account", err);
      setDevMessage({ type: 'error', text: 'فشل تحديث الحساب' });
    } finally {
      setDevActionLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevActionLoading(true);
    setProfileMessage(null);
    try {
      const ip = await getClientIp();
      
      // If username changed, check if new one is taken
      if (profileFormData.username !== user.username) {
        const q = query(collection(db, 'users'), where('username', '==', profileFormData.username));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setProfileMessage({ type: 'error', text: 'اسم المستخدم الجديد موجود بالفعل' });
          return;
        }
        
        // Handle username change (new doc, delete old)
        const oldRef = (await getDocs(query(collection(db, 'users'), where('username', '==', user.username)))).docs[0].ref;
        const oldData = (await getDocs(query(collection(db, 'users'), where('username', '==', user.username)))).docs[0].data();
        
        await setDoc(doc(db, 'users', profileFormData.username), {
          ...oldData,
          username: profileFormData.username,
          password: profileFormData.password,
          displayName: profileFormData.displayName,
          lastIp: ip,
          lastLogin: serverTimestamp()
        });
        await deleteDoc(oldRef);
      } else {
        // Find user document by current username
        const q = query(collection(db, 'users'), where('username', '==', user.username));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(snap.docs[0].ref, {
            password: profileFormData.password,
            displayName: profileFormData.displayName,
            lastIp: ip,
            lastLogin: serverTimestamp()
          });
        }
      }

      // Update chat sessions if username changed
      await updateUsernameInSessions(user.username, profileFormData.username);

      setProfileMessage({ type: 'success', text: 'تم تحديث بياناتك الشخصية بنجاح. يرجى إعادة تسجيل الدخول لتطبيق التغييرات.' });
      setTimeout(() => {
        setIsProfileModalOpen(false);
        onLogout();
      }, 2000);
    } catch (err) {
      console.error("Failed to update profile", err);
      setProfileMessage({ type: 'error', text: 'فشل تحديث البيانات الشخصية' });
    } finally {
      setDevActionLoading(false);
    }
  };

  const toggleSelectUser = (accountId: string) => {
    if (!accountId) return;
    setSelectedAccountIds(prev => 
      prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
    );
  };

  const toggleSelectAll = () => {
    const nonDevAccountIds = accounts.filter(acc => !acc.isDeveloper).map(acc => acc.id);
    if (selectedAccountIds.length === nonDevAccountIds.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(nonDevAccountIds);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentSessionId, sessions, isLoading]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ar-EG';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const createNewSession = async (category: string) => {
    try {
      const newSession = {
        userId: user.username,
        title: 'محادثة جديدة',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category,
      };
      const docRef = await addDoc(collection(db, 'chatSessions'), newSession);
      setCurrentSessionId(docRef.id);
      setIsSidebarOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chatSessions');
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'chatSessions', id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chatSessions/${id}`);
    }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let sessionId = currentSessionId;
    let session = currentSession;

    setIsLoading(true);
    const userMessageContent = input.trim();
    setInput('');

    try {
      // If no session exists, create one automatically
      if (!sessionId || !session) {
        const classification = await classifyConversation(userMessageContent);
        const newSession = {
          userId: user.username,
          title: classification.title,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          category: classification.category,
        };
        const docRef = await addDoc(collection(db, 'chatSessions'), newSession);
        sessionId = docRef.id;
        setCurrentSessionId(sessionId);
        // We need to wait for the local state to update or just use the new object
        session = { id: sessionId, ...newSession };
      }

      const userMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content: userMessageContent,
        timestamp: Date.now()
      };

      const newMessages = [...session.messages, userMessage];
      const newTitle = session.messages.length === 0 ? session.title : session.title;

      await updateDoc(doc(db, 'chatSessions', sessionId), {
        messages: newMessages,
        title: newTitle,
        updatedAt: Date.now()
      });

      const response = await askQuestion(userMessageContent);
      const assistantMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      await updateDoc(doc(db, 'chatSessions', sessionId), {
        messages: [...newMessages, assistantMessage],
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      // If it was a firestore error, we already logged it in handleFirestoreError if we used it
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summarySection.trim() || isLoading) return;

    setIsSummaryModalOpen(false);
    setIsLoading(true);
    
    let sessionId = currentSessionId;
    let session = currentSession;

    const promptText = `طلب تلخيص: الجزء "${summarySection}" من مادة "${summarySubject}" باللغة ${summaryLanguage}`;
    const sectionToSummarize = summarySection;
    setSummarySection('');

    try {
      // If no session exists, create one automatically
      if (!sessionId || !session) {
        const classification = await classifyConversation(promptText);
        const newSession = {
          userId: user.username,
          title: classification.title,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          category: classification.category,
        };
        const docRef = await addDoc(collection(db, 'chatSessions'), newSession);
        sessionId = docRef.id;
        setCurrentSessionId(sessionId);
        session = { id: sessionId, ...newSession };
      }

      const userMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content: promptText,
        timestamp: Date.now()
      };

      const newMessages = [...session.messages, userMessage];

      await updateDoc(doc(db, 'chatSessions', sessionId), {
        messages: newMessages,
        updatedAt: Date.now()
      });

      const langParam = summaryLanguage === 'العربية' ? 'Arabic' : 'English';
      const response = await summarizeCurriculumSection(summarySubject, sectionToSummarize, langParam);
      const assistantMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };

      await updateDoc(doc(db, 'chatSessions', sessionId), {
        messages: [...newMessages, assistantMessage],
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error("Error in handleSummarize:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden" dir="rtl">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 w-80 bg-white border-l border-slate-200 z-50 transition-transform duration-300 transform lg:relative lg:translate-x-0 flex flex-col shadow-xl lg:shadow-none",
        isSidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">سجل المحادثات</h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
              title="محادثة جديدة"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-slate-100 rounded-lg lg:hidden"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-8">
          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-slate-500">
                  <cat.icon className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">{cat.name}</h3>
                </div>
              </div>
              
              <div className="space-y-1">
                {sessions.filter(s => s.category === cat.id).length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-2 italic">لا توجد محادثات</p>
                ) : (
                  sessions.filter(s => s.category === cat.id).map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        setCurrentSessionId(session.id);
                        setIsSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full p-2.5 rounded-xl flex items-center gap-3 transition-all group text-right cursor-pointer",
                        currentSessionId === session.id 
                          ? "bg-indigo-600 text-white shadow-md" 
                          : "hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      <MessageSquare className={cn(
                        "w-4 h-4 shrink-0",
                        currentSessionId === session.id ? "text-indigo-100" : "text-slate-400"
                      )} />
                      <span className="flex-1 truncate text-xs font-medium">{session.title}</span>
                      <button
                        type="button"
                        onClick={(e) => deleteSession(session.id, e)}
                        className={cn(
                          "p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity",
                          currentSessionId === session.id ? "hover:bg-indigo-500 text-indigo-100" : "hover:bg-slate-200 text-slate-400"
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          <button
            onClick={onLogout}
            className="w-full py-2 px-4 bg-slate-50 text-slate-600 rounded-xl flex items-center gap-2 hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm z-30">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BookOpen className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900">مساعد التمريض الذكي</h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] md:text-xs text-slate-500">مرحباً، {user.username}</p>
                {user.isDeveloper && (
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setIsDevModalOpen(true)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold hover:bg-amber-200 transition-colors"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      المطور
                    </button>
                    <button 
                      onClick={() => setIsProfileModalOpen(true)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold hover:bg-slate-200 transition-colors"
                    >
                      <Settings className="w-3 h-3" />
                      حسابي
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-lg lg:hidden"
          >
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-80">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center">
                <Bot className="w-10 h-10 text-indigo-600" />
              </div>
              <div className="max-w-md px-4">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">كيف يمكنني مساعدتك اليوم؟</h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  أنا مدرب على الإجابة من جميع الكتب و المناهج الخاصة بمدارس التمريض (الصف الأول الثانوي).
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mt-8">
                {[
                  "ما هي خطوات غسيل الأيدي؟",
                  "اشرح لي مكونات الخلية الحيوانية",
                  "ما هي العوامل المؤثرة على توزيع الأمراض؟",
                  "لخص لي فصل العلامات الحيوية"
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="p-3 text-sm text-right bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-slate-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>

          {isLoading && (
            <div className="flex gap-3 ml-auto max-w-[80%]">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm mt-1">
                <Bot className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
              </div>
              <div className="p-4 md:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm rounded-tr-sm flex items-center gap-3">
                <TypingIndicator />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-200 p-4 md:p-6 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] z-10">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSummaryModalOpen(true)}
              disabled={isLoading}
              className="p-3 md:p-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50 hover:text-indigo-600"
              title="تلخيص جزء من المنهج"
            >
              <FileText className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            <div className="relative flex-1 group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اسأل عن أي شيء في المنهج..."
                className="w-full pr-4 pl-12 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-right shadow-sm group-hover:border-slate-300"
                dir="rtl"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-sm active:scale-95"
              >
                <Send className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
            
            {recognitionRef.current && (
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "p-3 md:p-4 rounded-xl transition-all shadow-sm flex items-center justify-center",
                  isListening 
                    ? "bg-red-500 text-white animate-pulse shadow-red-500/20" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-indigo-600"
                )}
              >
                {isListening ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
              </button>
            )}
          </form>
          <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
            هذا المساعد مخصص لأغراض تعليمية فقط. يرجى مراجعة الكتب الرسمية دائماً.
          </p>
        </div>
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {isNewChatModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewChatModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="text-indigo-600" />
                  محادثة جديدة
                </h2>
                <button onClick={() => setIsNewChatModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                createNewSession(newChatCategory);
                setIsNewChatModalOpen(false);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المادة الدراسية</label>
                  <select
                    value={newChatCategory}
                    onChange={(e) => setNewChatCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-sm mt-4"
                >
                  <Plus className="w-4 h-4" />
                  إنشاء محادثة
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Developer Modal */}
      <AnimatePresence>
        {isSummaryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSummaryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="text-indigo-600" />
                  تلخيص جزء من المنهج
                </h2>
                <button onClick={() => setIsSummaryModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSummarize} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المادة الدراسية</label>
                  <select
                    value={summarySubject}
                    onChange={(e) => setSummarySubject(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="أساسيات التمريض (عملي)">أساسيات التمريض (عملي)</option>
                    <option value="أساسيات التمريض (نظري)">أساسيات التمريض (نظري)</option>
                    <option value="الأحياء">الأحياء</option>
                    <option value="الدراسات الاجتماعية (جغرافيا طبية)">الدراسات الاجتماعية (جغرافيا طبية)</option>
                    <option value="التشريح وعلم وظائف الأعضاء">التشريح وعلم وظائف الأعضاء</option>
                    <option value="اللغة الإنجليزية">اللغة الإنجليزية</option>
                    <option value="التربية الدينية الإسلامية">التربية الدينية الإسلامية</option>
                    <option value="الرياضيات">الرياضيات</option>
                    <option value="العلوم التطبيقية: فيزياء / كيمياء">العلوم التطبيقية: فيزياء / كيمياء</option>
                    <option value="اللغة العربية">اللغة العربية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الجزء المراد تلخيصه (مثال: الخلية، غسيل الأيدي)</label>
                  <input
                    type="text"
                    value={summarySection}
                    onChange={(e) => setSummarySection(e.target.value)}
                    placeholder="اكتب اسم الجزء أو الفصل..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">لغة التلخيص</label>
                  <select
                    value={summaryLanguage}
                    onChange={(e) => setSummaryLanguage(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  >
                    <option value="العربية">العربية</option>
                    <option value="الإنجليزية">الإنجليزية</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!summarySection.trim() || isLoading}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-4"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'بدء التلخيص'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Developer Modal */}
      <AnimatePresence>
        {isDevModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDevModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">لوحة تحكم المطور</h2>
                    <p className="text-xs text-slate-500">إدارة حسابات المستخدمين والتحكم في الصلاحيات</p>
                  </div>
                </div>
                <button onClick={() => setIsDevModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Create/Edit Account Section */}
                <section ref={editFormRef} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    {editingAccount ? <Edit2 className="w-4 h-4 text-indigo-600" /> : <UserPlus className="w-4 h-4 text-indigo-600" />}
                    {editingAccount ? 'تعديل بيانات الحساب' : 'إنشاء حساب جديد'}
                  </h3>
                  <form onSubmit={editingAccount ? handleUpdateAccount : handleCreateAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 mr-1">اسم المستخدم</label>
                      <input
                        type="text"
                        value={editingAccount ? editFormData.username : newAccountData.username}
                        onChange={(e) => editingAccount 
                          ? setEditFormData(prev => ({ ...prev, username: e.target.value }))
                          : setNewAccountData(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        placeholder="username"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 mr-1">كلمة المرور</label>
                      <input
                        type="text"
                        value={editingAccount ? editFormData.password : newAccountData.password}
                        onChange={(e) => editingAccount
                          ? setEditFormData(prev => ({ ...prev, password: e.target.value }))
                          : setNewAccountData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        placeholder="password"
                        required
                      />
                    </div>
                    <div className="flex items-center gap-3 h-10 px-2">
                      <input
                        type="checkbox"
                        id="isDev"
                        checked={editingAccount ? editFormData.isDeveloper : newAccountData.isDeveloper}
                        onChange={(e) => editingAccount
                          ? setEditFormData(prev => ({ ...prev, isDeveloper: e.target.checked }))
                          : setNewAccountData(prev => ({ ...prev, isDeveloper: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="isDev" className="text-sm font-medium text-slate-700 cursor-pointer">حساب مطور</label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={devActionLoading}
                        className="flex-1 h-10 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm px-6"
                      >
                        {devActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingAccount ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {editingAccount ? 'تحديث الحساب' : 'إنشاء الحساب'}
                      </button>
                      {editingAccount && (
                        <button
                          type="button"
                          onClick={() => setEditingAccount(null)}
                          className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </form>
                  {devMessage && (
                    <div className={cn(
                      "mt-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2",
                      devMessage.type === 'success' ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"
                    )}>
                      <AlertCircle className="w-4 h-4" />
                      {devMessage.text}
                    </div>
                  )}
                </section>

                {/* Accounts Table Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-600" />
                      قائمة الحسابات ({accounts.length})
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      {selectedAccountIds.length > 0 && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                          <button
                            onClick={() => handleBulkUpdate('active')}
                            disabled={isBulkActionLoading}
                            className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors flex items-center gap-1"
                          >
                            تفعيل المختار ({selectedAccountIds.length})
                          </button>
                          <button
                            onClick={() => handleBulkUpdate('inactive')}
                            disabled={isBulkActionLoading}
                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors flex items-center gap-1"
                          >
                            تعطيل المختار ({selectedAccountIds.length})
                          </button>
                          <button
                            onClick={handleBulkDelete}
                            disabled={isBulkActionLoading}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                              confirmBulkDelete ? "bg-red-600 text-white animate-pulse" : "bg-slate-800 text-white hover:bg-slate-900"
                            )}
                          >
                            {confirmBulkDelete ? <AlertCircle className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                            {confirmBulkDelete ? 'تأكيد الحذف' : `حذف المختار (${selectedAccountIds.length})`}
                          </button>
                        </div>
                      )}
                      <button 
                        onClick={loadAccounts}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                        title="تحديث"
                      >
                        <Loader2 className={cn("w-4 h-4", isAccountsLoading && "animate-spin")} />
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-4 w-10">
                            <input
                              type="checkbox"
                              checked={selectedAccountIds.length > 0 && selectedAccountIds.length === accounts.filter(a => !a.isDeveloper).length}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="p-4 font-bold text-slate-700">اسم المستخدم</th>
                          <th className="p-4 font-bold text-slate-700">كلمة المرور</th>
                          <th className="p-4 font-bold text-slate-700">النوع</th>
                          <th className="p-4 font-bold text-slate-700">الحالة</th>
                          <th className="p-4 font-bold text-slate-700">عنوان IP</th>
                          <th className="p-4 font-bold text-slate-700">آخر ظهور</th>
                          <th className="p-4 font-bold text-slate-700">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isAccountsLoading && accounts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-12 text-center">
                              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                              <p className="text-slate-500">جاري تحميل البيانات...</p>
                            </td>
                          </tr>
                        ) : accounts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-12 text-center text-slate-400">لا توجد حسابات مسجلة</td>
                          </tr>
                        ) : (
                          accounts.map((acc) => (
                            <tr key={acc.id} className={cn(
                              "hover:bg-slate-50/50 transition-colors",
                              selectedAccountIds.includes(acc.id) && "bg-indigo-50/30"
                            )}>
                              <td className="p-4">
                                {!acc.isDeveloper && (
                                  <input
                                    type="checkbox"
                                    checked={selectedAccountIds.includes(acc.id)}
                                    onChange={() => toggleSelectUser(acc.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                )}
                              </td>
                              <td className="p-4 font-medium text-slate-900">{acc.username}</td>
                              <td className="p-4 font-mono text-xs text-slate-500">{acc.password}</td>
                              <td className="p-4">
                                {acc.isDeveloper ? (
                                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold">مطور</span>
                                ) : (
                                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">طالب</span>
                                )}
                              </td>
                              <td className="p-4">
                                <span className={cn(
                                  "px-2 py-1 rounded-md text-[10px] font-bold",
                                  acc.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                )}>
                                  {acc.status === 'active' ? 'نشط' : 'معطل'}
                                </span>
                              </td>
                              <td className="p-4 text-[10px] font-mono text-slate-500">
                                {acc.lastIp || 'غير مسجل'}
                              </td>
                              <td className="p-4 text-xs text-slate-500">
                                {acc.lastLogin?.toDate ? acc.lastLogin.toDate().toLocaleString('ar-EG') : 'غير متوفر'}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {!acc.isDeveloper && (
                                    <button
                                      onClick={() => toggleAccountStatus(acc.id, acc.status)}
                                      className={cn(
                                        "p-1.5 rounded-lg transition-colors",
                                        acc.status === 'active' ? "text-green-500 hover:bg-green-50" : "text-red-500 hover:bg-red-50"
                                      )}
                                      title={acc.status === 'active' ? 'تعطيل' : 'تفعيل'}
                                    >
                                      {acc.status === 'active' ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleStartEdit(acc)}
                                    className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="تعديل"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  {!acc.isDeveloper && (
                                    <button
                                      onClick={() => handleDeleteAccount(acc.id)}
                                      className={cn(
                                        "p-1.5 rounded-lg transition-all",
                                        confirmDeleteId === acc.id ? "bg-red-500 text-white" : "text-red-400 hover:bg-red-50"
                                      )}
                                      title={confirmDeleteId === acc.id ? 'تأكيد الحذف' : 'حذف'}
                                    >
                                      {confirmDeleteId === acc.id ? <AlertCircle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  تعديل بياناتي الشخصية
                </h2>
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {profileMessage && (
                  <div className={cn(
                    "p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2",
                    profileMessage.type === 'success' ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
                  )}>
                    {profileMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {profileMessage.text}
                  </div>
                )}
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 mr-1">اسم المستخدم</label>
                    <input
                      type="text"
                      value={profileFormData.username}
                      onChange={(e) => setProfileFormData({...profileFormData, username: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      placeholder="اسم المستخدم"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 mr-1">الاسم المستعار</label>
                    <input
                      type="text"
                      value={profileFormData.displayName}
                      onChange={(e) => setProfileFormData({...profileFormData, displayName: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      placeholder="الاسم الذي يظهر للآخرين"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 mr-1">كلمة المرور الجديدة</label>
                    <input
                      type="text"
                      value={profileFormData.password}
                      onChange={(e) => setProfileFormData({...profileFormData, password: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                      placeholder="أدخل كلمة مرور جديدة"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={devActionLoading}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {devActionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                    حفظ التغييرات
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
