import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Avoid noisy logs on transient connection re-negotiations
setLogLevel('error');

// Use initializeFirestore with experimentalForceLongPolling to ensure rock-solid
// connectivity in iframe and Cloud Run environments where streaming WebChannels may be interrupted
const firestoreDatabaseId = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-b67305f5-5703-4b56-b34e-a97c8b8e5544';
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firestoreDatabaseId);

export const storage = getStorage(app);

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
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as any)?.code;
  
  // Ignore permission-denied errors if the user is logged out (e.g., during sign out)
  if ((errorCode === 'permission-denied' || errorMessage.includes('Missing or insufficient permissions')) && !auth.currentUser) {
    console.warn(`Ignored permission-denied error during ${operationType} on ${path} because user is logged out.`);
    return;
  }

  // Gracefully handle offline or transient network unavailable errors without crashing
  if (errorCode === 'unavailable' || errorMessage.includes('the client is offline') || errorMessage.includes('Could not reach Cloud Firestore')) {
    console.warn(`Firestore operating in offline mode for ${operationType} on ${path}.`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default app;
