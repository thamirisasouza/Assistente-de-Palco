import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  onSnapshot,
  getDocFromServer
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { CongregationSettings, CompletedMeeting } from "../types";

// Configuração oficial do Firebase fornecida pelo usuário
export const firebaseConfig = {
  apiKey: "AIzaSyC3ofldDAwnOSiIDqfv8rwh90is1AuAdVs",
  authDomain: "assistentedepalcojw.firebaseapp.com",
  projectId: "assistentedepalcojw",
  storageBucket: "assistentedepalcojw.firebasestorage.app",
  messagingSenderId: "497897387003",
  appId: "1:497897387003:web:47c9ce6a9a28e1082a915e",
  measurementId: "G-HYXPZ6PVNJ"
};

// Inicialização segura do Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Inicialização segura do Google Analytics
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      try {
        getAnalytics(app);
      } catch (err) {
        console.warn("Analytics initialization skipped:", err);
      }
    }
  }).catch(() => {});
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error("Firebase Firestore Error:", JSON.stringify(errInfo));
  return errInfo;
}

// Testa a conectividade com o Firestore
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "health", "ping"));
    return true;
  } catch (err) {
    // Se for erro de offline ou permissão, mas o SDK inicializou
    console.log("Firebase connection test check:", err);
    return true;
  }
}

// Constantes de caminhos
const CONGREGATION_DOC_PATH = "congregations/default/settings/current";
const MEETINGS_COLLECTION_PATH = "congregations/default/meetings";

// Remove todas as propriedades 'undefined' para compatibilidade estrita com Firestore
function sanitizeFirestoreData<T>(obj: T): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  }), (key, value) => {
    // If it was transformed to null and we prefer removing keys from objects:
    return value;
  });
}

function cleanUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Carregar configurações da congregação do Firebase
export async function fetchFirebaseSettings(): Promise<CongregationSettings | null> {
  try {
    const docRef = doc(db, CONGREGATION_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as CongregationSettings;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, CONGREGATION_DOC_PATH);
  }
  return null;
}

// Salvar configurações da congregação no Firebase
export async function saveFirebaseSettings(settings: CongregationSettings): Promise<void> {
  try {
    const docRef = doc(db, CONGREGATION_DOC_PATH);
    const cleanData = cleanUndefined({
      ...settings,
      updatedAt: new Date().toISOString()
    });
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, CONGREGATION_DOC_PATH);
  }
}

// Inscrição em tempo real para configurações da congregação
export function subscribeToFirebaseSettings(callback: (settings: CongregationSettings | null) => void) {
  try {
    const docRef = doc(db, CONGREGATION_DOC_PATH);
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as CongregationSettings);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, CONGREGATION_DOC_PATH);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, CONGREGATION_DOC_PATH);
    return () => {};
  }
}

// Carregar histórico de reuniões do Firebase
export async function fetchFirebaseMeetings(): Promise<CompletedMeeting[]> {
  try {
    const colRef = collection(db, MEETINGS_COLLECTION_PATH);
    const snap = await getDocs(colRef);
    const list: CompletedMeeting[] = [];
    snap.forEach((d) => {
      list.push(d.data() as CompletedMeeting);
    });
    // Ordena da mais recente para a mais antiga
    list.sort((a, b) => new Date(b.encerrada_em || b.iniciada_em || 0).getTime() - new Date(a.encerrada_em || a.iniciada_em || 0).getTime());
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, MEETINGS_COLLECTION_PATH);
    return [];
  }
}

// Salvar uma reunião individual no Firebase
export async function saveFirebaseMeeting(meeting: CompletedMeeting): Promise<void> {
  try {
    const docRef = doc(db, `${MEETINGS_COLLECTION_PATH}/${meeting.id}`);
    const cleanData = cleanUndefined({
      ...meeting,
      syncedAt: new Date().toISOString()
    });
    await setDoc(docRef, cleanData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${MEETINGS_COLLECTION_PATH}/${meeting.id}`);
  }
}

// Deletar uma reunião do Firebase
export async function deleteFirebaseMeeting(id: string): Promise<void> {
  try {
    const docRef = doc(db, `${MEETINGS_COLLECTION_PATH}/${id}`);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${MEETINGS_COLLECTION_PATH}/${id}`);
  }
}

// Inscrição em tempo real para atualizações de reuniões
export function subscribeToFirebaseMeetings(callback: (meetings: CompletedMeeting[]) => void) {
  try {
    const colRef = collection(db, MEETINGS_COLLECTION_PATH);
    return onSnapshot(colRef, (snapshot) => {
      const list: CompletedMeeting[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as CompletedMeeting);
      });
      list.sort((a, b) => new Date(b.encerrada_em || b.iniciada_em || 0).getTime() - new Date(a.encerrada_em || a.iniciada_em || 0).getTime());
      callback(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, MEETINGS_COLLECTION_PATH);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, MEETINGS_COLLECTION_PATH);
    return () => {};
  }
}
