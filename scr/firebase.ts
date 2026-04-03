import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collection, query, where, getDocs, serverTimestamp, getDocFromServer, addDoc, setDoc, getDoc, limit } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Custom User Type
export interface AppUser {
  username: string;
  password?: string;
  displayName?: string;
  role: 'student' | 'admin';
  status: 'active' | 'inactive';
  isDeveloper: boolean;
  requiresPasswordChange?: boolean;
  createdAt: any;
  lastLogin: any;
  lastIp?: string;
}

// Helper to get client IP
export const getClientIp = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Error fetching IP:", error);
    return "unknown";
  }
};

// Login helper
export const loginWithUsername = async (username: string, password: string): Promise<AppUser | null> => {
  try {
    const q = query(
      collection(db, 'users'), 
      where('username', '==', username), 
      where('password', '==', password)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    const ip = await getClientIp();
    
    // Update last login and IP
    await updateDoc(userDoc.ref, { 
      lastLogin: serverTimestamp(),
      lastIp: ip
    });
    
    const userData = { ...userDoc.data(), lastIp: ip } as AppUser;
    return userData;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
};

// Bootstrap initial accounts
export const bootstrapAccounts = async () => {
  console.log("Checking for initial accounts...");
  try {
    const initialAccounts = [
      {
        username: 'admin',
        password: '123',
        displayName: 'المطور الرئيسي',
        role: 'admin',
        status: 'active',
        isDeveloper: true,
        requiresPasswordChange: false,
      },
      {
        username: 'احمد مصلحي',
        password: '123',
        displayName: 'احمد مصلحي',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'ادم تامر',
        password: '123',
        displayName: 'ادم تامر',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'اياد محمود',
        password: '123',
        displayName: 'اياد محمود',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'بلال رجب',
        password: '123',
        displayName: 'بلال رجب',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'جمعة حمادة',
        password: '123',
        displayName: 'جمعة حمادة',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'خالد ابو الحزايم',
        password: '123',
        displayName: 'خالد ابو الحزايم',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'زياد عثمان',
        password: '123',
        displayName: 'زياد عثمان',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'زياد محمود',
        password: '123',
        displayName: 'زياد محمود',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'زياد وائل',
        password: '123',
        displayName: 'زياد وائل',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'عبدالرحمن رجب',
        password: '123',
        displayName: 'عبدالرحمن رجب',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'عبدالرحمن سعدي',
        password: '123',
        displayName: 'عبدالرحمن سعدي',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'عبدالملك حسن',
        password: '123',
        displayName: 'عبدالملك حسن',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'علي شادي',
        password: '123',
        displayName: 'علي شادي',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'عمر سعيد',
        password: '123',
        displayName: 'عمر سعيد',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'عمرو اشرف',
        password: '123',
        displayName: 'عمرو اشرف',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'فهد حمادة',
        password: '123',
        displayName: 'فهد حمادة',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'مازن جداوي',
        password: '123',
        displayName: 'مازن جداوي',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'محمد احمد امين',
        password: '123',
        displayName: 'محمد احمد امين',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'محمد احمد جمعة',
        password: '123',
        displayName: 'محمد احمد جمعة',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'محمد تاج',
        password: '123',
        displayName: 'محمد تاج',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'محمد رضا',
        password: '123',
        displayName: 'محمد رضا',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'محمد ناصر',
        password: '123',
        displayName: 'محمد ناصر',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'منذر محمد',
        password: '123',
        displayName: 'منذر محمد',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'ياسين اسلام',
        password: '123',
        displayName: 'ياسين اسلام',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'يوسف صايم',
        password: '123',
        displayName: 'يوسف صايم',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      },
      {
        username: 'يوسف هاني',
        password: '123',
        displayName: 'يوسف هاني',
        role: 'student',
        status: 'active',
        isDeveloper: false,
        requiresPasswordChange: false,
      }
    ];

    console.log("Starting bootstrap process...");
    for (const account of initialAccounts) {
      const userRef = doc(db, 'users', account.username);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.log(`Account ${account.username} missing. Creating it...`);
        await setDoc(userRef, {
          ...account,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          lastIp: 'initial'
        });
      }
    }
    
    console.log("Bootstrap process finished.");
  } catch (error) {
    console.error("Error bootstrapping accounts:", error);
  }
};

// Firestore error handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();
