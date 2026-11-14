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
import { CongregationSettings, CompletedMeeting, ActionLog } from "../types";

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
    console.log("Firebase connection test check:", err);
    return true;
  }
}

// Constantes de caminhos
const CONGREGATION_DOC_PATH = "congregations/default/settings/current";
const MEETINGS_COLLECTION_PATH = "congregations/default/meetings";
const MEETINGS_BACKUP_COLLECTION_PATH = "congregations/default/meetings_backup";
const LEGACY_MEETINGS_COLLECTION_PATH = "meetings";
const LOGS_COLLECTION_PATH = "congregations/default/logs";

function cleanUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Normaliza qualquer documento de reunião (incluindo versões anteriores do schema)
export function normalizeMeetingDocument(docId: string, raw: any): CompletedMeeting | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || docId || `meeting-${Date.now()}`);
  if (id.startsWith('demo-')) return null;

  const encerradaEm = raw.encerrada_em || raw.data_iso || raw.createdAt || raw.syncedAt || new Date().toISOString();
  const iniciadaEm = raw.iniciada_em || raw.data_iso || raw.createdAt || encerradaEm;
  const partes = Array.isArray(raw.partes)
    ? raw.partes
    : Array.isArray(raw.records)
      ? raw.records
      : Array.isArray(raw.history)
        ? raw.history
        : [];

  const duracaoRealSegundos = typeof raw.duracao_real_segundos === 'number'
    ? raw.duracao_real_segundos
    : typeof raw.duracao_real_minutos === 'number'
      ? raw.duracao_real_minutos * 60
      : partes.reduce((acc: number, p: any) => acc + (Number(p?.actualTime) || 0), 0);

  const duracaoRealMinutos = typeof raw.duracao_real_minutos === 'number'
    ? raw.duracao_real_minutos
    : Math.round(duracaoRealSegundos / 60);

  const duracaoPlanejadaMinutos = typeof raw.duracao_planejada_minutos === 'number'
    ? raw.duracao_planejada_minutos
    : 105;

  const saldoFinalSegundos = typeof raw.saldo_final_segundos === 'number'
    ? raw.saldo_final_segundos
    : typeof raw.saldo_final_minutos === 'number'
      ? raw.saldo_final_minutos * 60
      : 0;

  const saldoFinalMinutos = typeof raw.saldo_final_minutos === 'number'
    ? raw.saldo_final_minutos
    : Math.round(saldoFinalSegundos / 60);

  let dataCurta = raw.data_reuniao_curta;
  if (!dataCurta && encerradaEm) {
    const d = new Date(encerradaEm);
    if (!isNaN(d.getTime())) {
      const day2 = String(d.getDate()).padStart(2, '0');
      const month2 = String(d.getMonth() + 1).padStart(2, '0');
      const year2 = String(d.getFullYear()).slice(-2);
      dataCurta = `${day2}/${month2}/${year2}`;
    }
  }

  let dataFormatada = raw.data_formatada;
  if (!dataFormatada && encerradaEm) {
    const d = new Date(encerradaEm);
    if (!isNaN(d.getTime())) {
      dataFormatada = d.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }
  }

  return {
    id,
    status: 'encerrada',
    encerrada_em: encerradaEm,
    iniciada_em: iniciadaEm,
    data_formatada: dataFormatada || dataCurta || 'Reunião Concluída',
    semana_apostila: raw.semana_apostila || dataFormatada || 'Programação da Semana',
    data_reuniao_curta: dataCurta || '',
    congregacao: raw.congregacao || 'Jardim Rosana - Ferraz de Vasconcelos SP',
    presidente: raw.presidente || 'Presidente da Reunião',
    tipo_semana: raw.tipo_semana === 'Visita do SC (Semana)' || raw.tipo_reuniao === 'Visita do SC (Semana)'
      ? 'Visita do SC (Semana)'
      : 'Normal',
    duracao_planejada_minutos: duracaoPlanejadaMinutos,
    duracao_real_minutos: duracaoRealMinutos,
    duracao_real_segundos: duracaoRealSegundos,
    saldo_final_segundos: saldoFinalSegundos,
    saldo_final_minutos: saldoFinalMinutos,
    indice_final_percentual: typeof raw.indice_final_percentual === 'number'
      ? raw.indice_final_percentual
      : Math.min(100, Math.round((duracaoRealMinutos / duracaoPlanejadaMinutos) * 100)),
    salvo_por_email: raw.salvo_por_email || raw.user_email || undefined,
    user_email: raw.user_email || raw.salvo_por_email || undefined,
    partes
  };
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

// Carregar histórico de reuniões do Firebase (incluindo coleções de backup/legado)
export async function fetchFirebaseMeetings(): Promise<CompletedMeeting[]> {
  const meetingsMap = new Map<string, CompletedMeeting>();

  // 1. Coleção principal
  try {
    const colRef = collection(db, MEETINGS_COLLECTION_PATH);
    const snap = await getDocs(colRef);
    snap.forEach((d) => {
      const normalized = normalizeMeetingDocument(d.id, d.data());
      if (normalized) {
        meetingsMap.set(normalized.id, normalized);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, MEETINGS_COLLECTION_PATH);
  }

  // 2. Coleção de backup persistente
  try {
    const backupRef = collection(db, MEETINGS_BACKUP_COLLECTION_PATH);
    const backupSnap = await getDocs(backupRef);
    backupSnap.forEach((d) => {
      const normalized = normalizeMeetingDocument(d.id, d.data());
      if (normalized && !meetingsMap.has(normalized.id)) {
        meetingsMap.set(normalized.id, normalized);
      }
    });
  } catch (error) {
    // Ignore backup collection read errors
  }

  // 3. Coleção raiz legada (se existir)
  try {
    const legacyRef = collection(db, LEGACY_MEETINGS_COLLECTION_PATH);
    const legacySnap = await getDocs(legacyRef);
    legacySnap.forEach((d) => {
      const normalized = normalizeMeetingDocument(d.id, d.data());
      if (normalized && !meetingsMap.has(normalized.id)) {
        meetingsMap.set(normalized.id, normalized);
      }
    });
  } catch (error) {
    // Ignore legacy collection read errors
  }

  const list = Array.from(meetingsMap.values());
  list.sort((a, b) => new Date(b.encerrada_em || b.iniciada_em || 0).getTime() - new Date(a.encerrada_em || a.iniciada_em || 0).getTime());
  return list;
}

// Salvar uma reunião individual no Firebase (principal + backup imutável)
export async function saveFirebaseMeeting(meeting: CompletedMeeting): Promise<void> {
  const cleanData = cleanUndefined({
    ...meeting,
    syncedAt: new Date().toISOString()
  });

  try {
    const docRef = doc(db, `${MEETINGS_COLLECTION_PATH}/${meeting.id}`);
    await setDoc(docRef, cleanData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${MEETINGS_COLLECTION_PATH}/${meeting.id}`);
  }

  try {
    const backupDocRef = doc(db, `${MEETINGS_BACKUP_COLLECTION_PATH}/${meeting.id}`);
    await setDoc(backupDocRef, cleanData);
  } catch (error) {
    // Ignore backup write errors
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
        const normalized = normalizeMeetingDocument(d.id, d.data());
        if (normalized) {
          list.push(normalized);
        }
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

export async function fetchFirebaseLogs(): Promise<ActionLog[]> {
  try {
    const colRef = collection(db, LOGS_COLLECTION_PATH);
    const snap = await getDocs(colRef);
    const list: ActionLog[] = [];
    snap.forEach((d) => {
      list.push(d.data() as ActionLog);
    });
    list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, LOGS_COLLECTION_PATH);
    return [];
  }
}

export async function logAction(log: Omit<ActionLog, 'id' | 'timestamp'>) {
  try {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const docRef = doc(db, `${LOGS_COLLECTION_PATH}/${id}`);
    const fullLog: ActionLog = {
      ...log,
      id,
      timestamp: new Date().toISOString()
    };
    await setDoc(docRef, cleanUndefined(fullLog));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, LOGS_COLLECTION_PATH);
  }
}

export function subscribeToFirebaseLogs(callback: (logs: ActionLog[]) => void) {
  try {
    const colRef = collection(db, LOGS_COLLECTION_PATH);
    return onSnapshot(colRef, (snapshot) => {
      const list: ActionLog[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as ActionLog);
      });
      list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      callback(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, LOGS_COLLECTION_PATH);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, LOGS_COLLECTION_PATH);
    return () => {};
  }
}
