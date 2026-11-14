import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  MeetingState, 
  MeetingPart, 
  DEFAULT_PARTS, 
  getPartsForWeekType,
  CongregationSettings, 
  DEFAULT_BROTHERS, 
  Role, 
  Brother, 
  PartRecord, 
  CompletedMeeting, 
  ActiveMeetingSession,
  ActionLog,
  TOTAL_PLANNED_MEETING_MINUTES
} from '../types';
import { safeStorage } from '../lib/storage';
import {
  auth,
  fetchFirebaseSettings,
  saveFirebaseSettings,
  fetchFirebaseMeetings,
  saveFirebaseMeeting,
  deleteFirebaseMeeting,
  subscribeToFirebaseMeetings,
  subscribeToFirebaseSettings,
  fetchFirebaseLogs,
  logAction
} from '../lib/firebase';
import {
  MonthPdfParseResult,
  ParsedWeekSchedule,
  applyPdfWeekToMeetingParts,
  findMatchingWeekForDate,
  mergeWeekSchedules,
  getWeekMonthInfo,
  parseMonthlyPdfText,
  SAMPLE_MONTHLY_PDF_TEXT
} from '../lib/apostilaParser';

const STORAGE_SETTINGS_KEY = 'jw_stage_settings';
const STORAGE_ACTIVE_SESSION_KEY = 'jw_stage_active_session';
const STORAGE_MEETINGS_ARCHIVE_KEY = 'jw_stage_meetings_archive';
const STORAGE_MEETINGS_BACKUP_KEY = 'jw_stage_meetings_backup';
const STORAGE_DELETED_MEETING_IDS_KEY = 'jw_stage_deleted_meeting_ids_v2';

export function normalizePartPlannedTime(part: PartRecord): PartRecord {
  let expectedTime = part.plannedTime;

  if (part.id === 'estudo' || part.title.toLowerCase().includes('estudo bíblico') || part.title.toLowerCase().includes('estudo biblico')) {
    expectedTime = 30;
  } else if (part.id === 'discurso_sc' || part.title.toLowerCase().includes('superintendente')) {
    expectedTime = 30;
  } else if (part.id === 'comentarios_finais' || part.title.toLowerCase().includes('comentários finais') || part.title.toLowerCase().includes('comentarios finais')) {
    expectedTime = 3;
  } else if (part.id === 'discurso' && expectedTime !== 10) {
    expectedTime = 10;
  } else if (part.id === 'joias' && expectedTime !== 10) {
    expectedTime = 10;
  } else if (part.id === 'leitura' && expectedTime !== 4) {
    expectedTime = 4;
  } else if (part.id === 'abertura' && expectedTime !== 5) {
    expectedTime = 5;
  } else if (part.id === 'comentarios' && expectedTime !== 1) {
    expectedTime = 1;
  } else if (part.id === 'vida_cantico' && expectedTime !== 5) {
    expectedTime = 5;
  } else if (part.id === 'conclusao_cantico' && expectedTime !== 6) {
    expectedTime = 6;
  }

  if (expectedTime !== part.plannedTime) {
    const diffSeconds = part.actualTime - (expectedTime * 60);
    const newStatus = diffSeconds > 0 ? 'Excedido' : (part.actualTime < (expectedTime * 60) / 2 ? 'Terminou antes do tempo' : 'No tempo correto');
    return {
      ...part,
      plannedTime: expectedTime,
      status: newStatus
    };
  }

  return part;
}

export function sanitizeCompletedMeeting(meeting: CompletedMeeting): CompletedMeeting {
  if (!meeting || !meeting.partes) return meeting;

  let hasChanged = false;
  const sanitizedPartes = meeting.partes.map(p => {
    const updated = normalizePartPlannedTime(p);
    if (updated !== p) hasChanged = true;
    return updated;
  });

  if (!hasChanged) return meeting;

  const updatedMeeting = {
    ...meeting,
    partes: sanitizedPartes
  };

  saveFirebaseMeeting(updatedMeeting).catch(() => {});

  return updatedMeeting;
}

function parseDateFromPortugueseString(dateStr?: string, fallbackIso?: string): Date {
  if (dateStr) {
    const ptMonths: Record<string, number> = {
      'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2, 'abril': 3,
      'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8,
      'outubro': 9, 'novembro': 10, 'dezembro': 11
    };
    const m = dateStr.toLowerCase().match(/(\d{1,2})\s+de\s+([a-zçãéíóú]+)(?:\s+de\s+(\d{4}))?/i);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = ptMonths[m[2]] ?? -1;
      const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
      if (month !== -1) {
        return new Date(year, month, day, 21, 15, 0);
      }
    }
    const slash = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (slash) {
      const d = parseInt(slash[1], 10);
      const mo = parseInt(slash[2], 10) - 1;
      let y = parseInt(slash[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, mo, d, 21, 15, 0);
    }
  }
  if (fallbackIso) {
    const parsed = new Date(fallbackIso);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function reconstructMeetingFromLog(
  log: ActionLog,
  settings: CongregationSettings
): CompletedMeeting {
  if (log.meetingSnapshot && log.meetingSnapshot.partes?.length) {
    return sanitizeCompletedMeeting({
      ...log.meetingSnapshot,
      id: log.meetingId || log.meetingSnapshot.id
    });
  }

  const idMatch = (log.meetingId || '').match(/meeting-(\d+)/);
  const meetingDateObj = idMatch
    ? new Date(Number(idMatch[1]))
    : parseDateFromPortugueseString(log.meetingDate, log.timestamp);

  const validDate = !isNaN(meetingDateObj.getTime()) ? meetingDateObj : new Date();
  const startTime = new Date(validDate.getTime() - TOTAL_PLANNED_MEETING_MINUTES * 60 * 1000);

  // Procura semanas disponíveis (settings, localStorage ou sample padrão da congregação)
  let availableWeeks: ParsedWeekSchedule[] = [];
  if (settings.monthlySchedule?.weeks?.length) {
    availableWeeks = [...settings.monthlySchedule.weeks];
  }
  try {
    const savedLocalMonth = safeStorage.getItem('s38t_imported_month_schedule');
    if (savedLocalMonth) {
      const parsedLocal: MonthPdfParseResult = JSON.parse(savedLocalMonth);
      if (parsedLocal?.weeks?.length) {
        availableWeeks = mergeWeekSchedules(availableWeeks, parsedLocal.weeks);
      }
    }
  } catch (e) {}

  const sampleParsed = parseMonthlyPdfText(SAMPLE_MONTHLY_PDF_TEXT);
  if (sampleParsed.weeks.length) {
    availableWeeks = mergeWeekSchedules( sampleParsed.weeks, availableWeeks);
  }

  const matchingWeek = findMatchingWeekForDate(availableWeeks, validDate);
  const baseParts = getPartsForWeekType(settings.weekType || 'Normal');
  const populatedParts = matchingWeek
    ? applyPdfWeekToMeetingParts(baseParts, matchingWeek)
    : baseParts;

  const partes: PartRecord[] = populatedParts.map((p) => ({
    id: p.id,
    partNumber: p.partNumber,
    title: p.title,
    speaker: p.speaker,
    assistant: p.assistant,
    hideSpeaker: p.hideSpeaker,
    plannedTime: p.plannedTime,
    actualTime: p.plannedTime * 60,
    status: 'No tempo correto',
    hasCounsel: p.hasCounsel,
    counselRecorded: p.hasCounsel
  }));

  const day2 = String(validDate.getDate()).padStart(2, '0');
  const month2 = String(validDate.getMonth() + 1).padStart(2, '0');
  const year2 = String(validDate.getFullYear()).slice(-2);
  const dataReuniaoCurta = `${day2}/${month2}/${year2}`;

  const dataFormatada = log.meetingDate && log.meetingDate !== 'Data desconhecida'
    ? log.meetingDate
    : validDate.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

  return {
    id: log.meetingId || `meeting-${validDate.getTime()}`,
    status: 'encerrada',
    encerrada_em: validDate.toISOString(),
    iniciada_em: startTime.toISOString(),
    data_formatada: dataFormatada,
    semana_apostila: matchingWeek?.weekLabel || `${validDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} | ${(settings.weekType || 'Normal').toUpperCase()}`,
    data_reuniao_curta: dataReuniaoCurta,
    congregacao: settings.name || matchingWeek?.congregationName || 'Jardim Rosana - Ferraz de Vasconcelos SP',
    presidente: matchingWeek?.president || settings.presidentName || 'Presidente da Reunião',
    tipo_semana: settings.weekType || 'Normal',
    duracao_planejada_minutos: TOTAL_PLANNED_MEETING_MINUTES,
    duracao_real_minutos: TOTAL_PLANNED_MEETING_MINUTES,
    duracao_real_segundos: TOTAL_PLANNED_MEETING_MINUTES * 60,
    saldo_final_segundos: 0,
    saldo_final_minutos: 0,
    indice_final_percentual: 100,
    salvo_por_email: log.userEmail || auth.currentUser?.email || undefined,
    user_email: log.userEmail || auth.currentUser?.email || undefined,
    partes
  };
}

function loadLocalMeetingsBackup(): CompletedMeeting[] {
  const map = new Map<string, CompletedMeeting>();
  const keys = [STORAGE_MEETINGS_ARCHIVE_KEY, STORAGE_MEETINGS_BACKUP_KEY];

  for (const key of keys) {
    try {
      const raw = safeStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((m: any) => {
            if (m && m.id && !String(m.id).startsWith('demo-')) {
              map.set(String(m.id), m as CompletedMeeting);
            }
          });
        }
      }
    } catch (e) {}
  }

  const list = Array.from(map.values());
  list.sort((a, b) => new Date(b.encerrada_em || b.iniciada_em || 0).getTime() - new Date(a.encerrada_em || a.iniciada_em || 0).getTime());
  return list;
}

function persistLocalMeetingsBackup(meetings: CompletedMeeting[]) {
  try {
    const clean = (meetings || []).filter(m => m && m.id && !String(m.id).startsWith('demo-'));
    const serialized = JSON.stringify(clean);
    safeStorage.setItem(STORAGE_MEETINGS_ARCHIVE_KEY, serialized);
    safeStorage.setItem(STORAGE_MEETINGS_BACKUP_KEY, serialized);
  } catch (e) {}
}

function getDeletedMeetingIds(): Set<string> {
  try {
    const raw = safeStorage.getItem(STORAGE_DELETED_MEETING_IDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(String));
    }
  } catch (e) {}
  return new Set();
}

function addDeletedMeetingId(id: string) {
  try {
    const set = getDeletedMeetingIds();
    set.add(id);
    safeStorage.setItem(STORAGE_DELETED_MEETING_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

function removeDeletedMeetingId(id: string) {
  try {
    const set = getDeletedMeetingIds();
    set.delete(id);
    safeStorage.setItem(STORAGE_DELETED_MEETING_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function useMeetingTimer() {
  const [firebaseStatus, setFirebaseStatus] = useState<'synced' | 'syncing' | 'offline'>('syncing');
  const hasAutoSelectedCurrentWeekRef = useRef(false);

  // Settings (preservando monthlySchedule, selectedWeekId e importedWeekLabel no cache local)
  const [settings, setSettings] = useState<CongregationSettings>(() => {
    const saved = safeStorage.getItem(STORAGE_SETTINGS_KEY);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        const rawLoadedBrothers: Brother[] = parsed.brothers?.length ? parsed.brothers : DEFAULT_BROTHERS;
        
        const seenIds = new Set<string>();
        const sanitizedBrothers: Brother[] = rawLoadedBrothers.map((b, idx) => {
          let brotherId = b.id;
          if (!brotherId || seenIds.has(brotherId)) {
            brotherId = `br-sanitized-${idx}-${Math.random().toString(36).substring(2, 7)}`;
          }
          seenIds.add(brotherId);
          return { ...b, id: brotherId };
        });

        let savedSchedule = parsed.monthlySchedule;
        if (savedSchedule?.weeks?.length) {
          savedSchedule = {
            ...savedSchedule,
            weeks: mergeWeekSchedules([], savedSchedule.weeks)
          };
        }

        return {
          name: parsed.name || "Minha Congregação",
          defaultTime: parsed.defaultTime !== undefined ? parsed.defaultTime : "",
          presidentName: parsed.presidentName || "Presidente da Reunião",
          weekType: parsed.weekType || "Normal",
          brothers: sanitizedBrothers,
          monthlySchedule: savedSchedule || undefined,
          selectedWeekId: parsed.selectedWeekId || undefined,
          importedWeekLabel: parsed.importedWeekLabel || undefined
        };
      } catch (e) {}
    }
    return {
      name: "Minha Congregação",
      defaultTime: "",
      presidentName: "Presidente da Reunião",
      weekType: "Normal",
      brothers: DEFAULT_BROTHERS
    };
  });

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
    safeStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Archive of completed meetings - persistente em nuvem + backup local imutável
  const [archivedMeetings, setArchivedMeetings] = useState<CompletedMeeting[]>(() => {
    return loadLocalMeetingsBackup().map(sanitizeCompletedMeeting);
  });

  useEffect(() => {
    if (archivedMeetings.length > 0) {
      persistLocalMeetingsBackup(archivedMeetings);
    }
  }, [archivedMeetings]);

  // Função para sincronizar e recuperar históricos faltantes a partir do Firebase, backups e Logs
  const recoverAndSyncMeetings = useCallback(async (currentSettings: CongregationSettings) => {
    const deletedIds = getDeletedMeetingIds();
    const localList = loadLocalMeetingsBackup();
    const remoteList = await fetchFirebaseMeetings();
    const logs = await fetchFirebaseLogs();

    const combinedMap = new Map<string, CompletedMeeting>();

    // 1. Adiciona reuniões locais (se não foram excluídas intencionalmente pelo usuário)
    localList.forEach((m) => {
      if (m && m.id && !deletedIds.has(m.id)) {
        combinedMap.set(m.id, sanitizeCompletedMeeting(m));
      }
    });

    // 2. Adiciona reuniões remotas do Firebase (prioridade para dados remotos)
    remoteList.forEach((m) => {
      if (m && m.id && !deletedIds.has(m.id)) {
        combinedMap.set(m.id, sanitizeCompletedMeeting(m));
      }
    });

    const remoteIds = new Set(remoteList.map(m => m.id));

    // 3. Verifica nos Logs de Atividade se existem reuniões registradas que estão faltando no Histórico
    const logsByMeetingId = new Map<string, ActionLog>();
    // Percorre do mais antigo para o mais recente para manter o melhor snapshot/dados
    [...logs].reverse().forEach((log) => {
      if (!log || !log.meetingId) return;
      const existingLog = logsByMeetingId.get(log.meetingId);
      if (!existingLog || log.meetingSnapshot) {
        logsByMeetingId.set(log.meetingId, {
          ...existingLog,
          ...log,
          meetingDate: log.meetingDate || existingLog?.meetingDate,
          userEmail: log.userEmail || existingLog?.userEmail,
          meetingSnapshot: log.meetingSnapshot || existingLog?.meetingSnapshot
        });
      }
    });

    logsByMeetingId.forEach((log, meetingId) => {
      if (!combinedMap.has(meetingId) && !deletedIds.has(meetingId)) {
        // Verifica se já não existe outra reunião com a exata mesma data formatada para não duplicar
        const reconstructed = reconstructMeetingFromLog(log, currentSettings);
        combinedMap.set(meetingId, sanitizeCompletedMeeting(reconstructed));
      }
    });

    // 4. Salva de volta no Firebase qualquer reunião recuperada que não estava na coleção principal
    const finalMeetings = Array.from(combinedMap.values());
    finalMeetings.sort((a, b) => new Date(b.encerrada_em || b.iniciada_em || 0).getTime() - new Date(a.encerrada_em || a.iniciada_em || 0).getTime());

    for (const meeting of finalMeetings) {
      if (!remoteIds.has(meeting.id)) {
        saveFirebaseMeeting(meeting).catch(() => {});
      }
    }

    persistLocalMeetingsBackup(finalMeetings);
    return finalMeetings;
  }, []);

  // Sincronização autenticada com o Firebase (reage ao login/restauração de sessão)
  useEffect(() => {
    let isMounted = true;
    let unsubscribeSettings: (() => void) | null = null;
    let unsubscribeMeetings: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeSettings) {
        unsubscribeSettings();
        unsubscribeSettings = null;
      }
      if (unsubscribeMeetings) {
        unsubscribeMeetings();
        unsubscribeMeetings = null;
      }

      if (!user) {
        if (isMounted) setFirebaseStatus('offline');
        return;
      }

      try {
        if (isMounted) setFirebaseStatus('syncing');

        // 1. Sincronizar configurações da congregação
        let activeSettings = settingsRef.current;
        const remoteSettings = await fetchFirebaseSettings();
        if (remoteSettings && isMounted) {
          if (remoteSettings.name || remoteSettings.brothers?.length) {
            const seenIds = new Set<string>();
            const sanitizedBrothers = (remoteSettings.brothers || DEFAULT_BROTHERS).map((b, idx) => {
              let brotherId = b.id;
              if (!brotherId || seenIds.has(brotherId)) {
                brotherId = `br-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
              }
              seenIds.add(brotherId);
              return { ...b, id: brotherId };
            });

            // Preserva semanas locais caso o remoto esteja vazio, ou mescla ambos
            const mergedWeeks = mergeWeekSchedules(
              settingsRef.current.monthlySchedule?.weeks || [],
              remoteSettings.monthlySchedule?.weeks || []
            );

            const nextMonthlySchedule = mergedWeeks.length > 0
              ? {
                  ...(remoteSettings.monthlySchedule || settingsRef.current.monthlySchedule || { allBrothersFound: [] }),
                  weeks: mergedWeeks
                }
              : (remoteSettings.monthlySchedule ?? null);

            activeSettings = {
              ...remoteSettings,
              brothers: sanitizedBrothers,
              monthlySchedule: nextMonthlySchedule
            };
            setSettings(activeSettings);
            safeStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(activeSettings));
          }
        }

        // 2. Recuperar e sincronizar histórico de reuniões
        const syncedMeetings = await recoverAndSyncMeetings(activeSettings);
        if (isMounted) {
          setArchivedMeetings(syncedMeetings);
          setFirebaseStatus('synced');
        }
      } catch (err) {
        console.warn("Firebase sync notice:", err);
        if (isMounted) setFirebaseStatus('synced');
      }

      if (!isMounted) return;

      // 3. Listeners em tempo real após autenticação confirmada
      unsubscribeSettings = subscribeToFirebaseSettings((liveSettings) => {
        if (!isMounted || !liveSettings) return;
        if (liveSettings.name || liveSettings.brothers?.length) {
          const seenIds = new Set<string>();
          const sanitizedBrothers = (liveSettings.brothers || []).map((b, idx) => {
            let brotherId = b.id;
            if (!brotherId || seenIds.has(brotherId)) {
              brotherId = `br-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
            }
            seenIds.add(brotherId);
            return { ...b, id: brotherId };
          });

          let normalizedSchedule = liveSettings.monthlySchedule;
          if (normalizedSchedule?.weeks?.length) {
            normalizedSchedule = {
              ...normalizedSchedule,
              weeks: mergeWeekSchedules([], normalizedSchedule.weeks)
            };
          }

          const sanitized: CongregationSettings = {
            ...liveSettings,
            brothers: sanitizedBrothers,
            monthlySchedule: normalizedSchedule
          };
          setSettings(sanitized);
          safeStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(sanitized));
        }
      });

      unsubscribeMeetings = subscribeToFirebaseMeetings((liveMeetings) => {
        if (!isMounted) return;
        const deletedIds = getDeletedMeetingIds();
        const cleanLive = (liveMeetings || [])
          .filter(m => m && m.id && !String(m.id).startsWith('demo-') && !deletedIds.has(m.id))
          .map(sanitizeCompletedMeeting);

        setArchivedMeetings((prev) => {
          // Mantém reuniões locais caso alguma ainda esteja sincronizando
          const map = new Map<string, CompletedMeeting>();
          prev.forEach(m => {
            if (m && m.id && !deletedIds.has(m.id)) map.set(m.id, m);
          });
          cleanLive.forEach(m => {
            if (m && m.id && !deletedIds.has(m.id)) map.set(m.id, m);
          });
          const merged = Array.from(map.values());
          merged.sort((a, b) => new Date(b.encerrada_em || b.iniciada_em || 0).getTime() - new Date(a.encerrada_em || a.iniciada_em || 0).getTime());
          persistLocalMeetingsBackup(merged);
          return merged;
        });
        setFirebaseStatus('synced');
      });
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeMeetings) unsubscribeMeetings();
    };
  }, [recoverAndSyncMeetings]);

  const saveToArchive = (meeting: CompletedMeeting) => {
    removeDeletedMeetingId(meeting.id);

    setArchivedMeetings(prev => {
      const filtered = prev.filter(m => m.id !== meeting.id);
      const next = [meeting, ...filtered];
      next.sort((a, b) => new Date(b.encerrada_em || b.iniciada_em || 0).getTime() - new Date(a.encerrada_em || a.iniciada_em || 0).getTime());
      persistLocalMeetingsBackup(next);
      return next;
    });

    logAction({
      action: 'create_history',
      meetingId: meeting.id,
      meetingDate: meeting.data_formatada,
      userEmail: auth.currentUser?.email || undefined,
      details: `Reunião salva: ${meeting.data_formatada}`,
      meetingSnapshot: meeting
    }).catch(() => {});

    saveFirebaseMeeting(meeting).catch(e => console.error("Error saving meeting to Firebase:", e));
  };

  const deleteFromArchive = (id: string) => {
    const meetingToDelete = archivedMeetings.find(m => m.id === id);
    addDeletedMeetingId(id);

    setArchivedMeetings(prev => {
      const next = prev.filter(m => m.id !== id);
      persistLocalMeetingsBackup(next);
      return next;
    });

    logAction({
      action: 'delete_history',
      meetingId: id,
      meetingDate: meetingToDelete?.data_formatada,
      userEmail: auth.currentUser?.email || undefined,
      details: `Reunião excluída: ${meetingToDelete?.data_formatada || id}`,
      meetingSnapshot: meetingToDelete
    }).catch(() => {});

    deleteFirebaseMeeting(id).catch(e => console.error("Error deleting meeting from Firebase:", e));
  };

  // Permite restaurar manualmente uma reunião a partir de um Log ou recuperar todos os faltantes
  const restoreMeetingFromLog = useCallback((log: ActionLog) => {
    if (!log || !log.meetingId) return;
    removeDeletedMeetingId(log.meetingId);
    const restored = reconstructMeetingFromLog(log, settingsRef.current);
    saveToArchive(restored);
  }, []);

  const recoverMissingHistory = useCallback(async () => {
    // Limpa lista de bloqueio local para forçar a recuperação de todas as reuniões registradas nos logs/backups
    safeStorage.removeItem(STORAGE_DELETED_MEETING_IDS_KEY);
    const synced = await recoverAndSyncMeetings(settingsRef.current);
    setArchivedMeetings(synced);
    return synced.length;
  }, [recoverAndSyncMeetings]);

  // State
  const [state, setState] = useState<MeetingState>({
    status: 'setup',
    parts: JSON.parse(JSON.stringify(DEFAULT_PARTS)),
    currentPartIndex: 0,
    isCounselPhase: false,
    timeBalance: 0,
    totalElapsedSeconds: 0,
    history: []
  });

  const [currentTimerSeconds, setCurrentTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(0);
  
  // Pending active session detection
  const [pendingSavedSession, setPendingSavedSession] = useState<ActiveMeetingSession | null>(() => {
    const saved = safeStorage.getItem(STORAGE_ACTIVE_SESSION_KEY);
    if (saved) {
      try {
        const parsed: ActiveMeetingSession = JSON.parse(saved);
        if (parsed && parsed.status === 'running') {
          return parsed;
        }
      } catch (e) {}
    }
    return null;
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickTimeRef = useRef<number | null>(null);

  // Autosave active session during running meeting
  const saveActiveSession = useCallback(() => {
    if (state.status !== 'running') return;
    const session: ActiveMeetingSession = {
      status: 'running',
      iniciada_em: state.startTime ? state.startTime.toISOString() : new Date().toISOString(),
      presidente: settings.presidentName,
      tipo_semana: settings.weekType,
      congregacao: settings.name,
      importedWeekLabel: state.importedWeekLabel || settings.importedWeekLabel,
      parts: state.parts,
      currentPartIndex: state.currentPartIndex,
      isCounselPhase: state.isCounselPhase,
      timeBalance: state.timeBalance,
      currentTimerSeconds,
      targetDurationSeconds,
      isTimerRunning,
      totalElapsedSeconds: state.totalElapsedSeconds,
      records: state.history
    };
    safeStorage.setItem(STORAGE_ACTIVE_SESSION_KEY, JSON.stringify(session));
  }, [state, currentTimerSeconds, targetDurationSeconds, isTimerRunning, settings]);

  useEffect(() => {
    if (state.status === 'running') {
      saveActiveSession();
    }
  }, [state.status, state.currentPartIndex, state.isCounselPhase, state.timeBalance, state.history, saveActiveSession]);

  const resumeSavedMeeting = () => {
    if (!pendingSavedSession) return;
    const session = pendingSavedSession;
    setState({
      status: 'running',
      parts: session.parts,
      currentPartIndex: session.currentPartIndex,
      isCounselPhase: session.isCounselPhase,
      timeBalance: session.timeBalance,
      startTime: new Date(session.iniciada_em),
      totalElapsedSeconds: session.totalElapsedSeconds,
      history: session.records
    });
    setTargetDurationSeconds(session.targetDurationSeconds);
    setCurrentTimerSeconds(session.currentTimerSeconds);
    setIsTimerRunning(false);
    setPendingSavedSession(null);
  };

  const discardSavedMeeting = () => {
    safeStorage.removeItem(STORAGE_ACTIVE_SESSION_KEY);
    setPendingSavedSession(null);
  };

  // Settings operations
  const updateSettings = (updates: Partial<CongregationSettings>) => {
    if (state.status !== 'setup') {
      console.warn("Settings can only be changed during setup.");
      return;
    }
    setSettings(prev => {
      const next = { ...prev, ...updates };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };

  const updateBrother = (id: string, updates: Partial<Brother>) => {
    const cleanNewName = updates.name !== undefined ? updates.name.trim() : undefined;
    if (cleanNewName !== undefined && !cleanNewName) return;

    const targetBrother = settings.brothers.find(b => b.id === id);
    const oldName = targetBrother?.name;

    setSettings(prev => {
      const updatedBrothers = prev.brothers
        .map(b => b.id === id ? { ...b, ...updates, ...(cleanNewName ? { name: cleanNewName } : {}) } : b)
        .sort((a, b) => a.name.localeCompare(b.name));

      let nextPresident = prev.presidentName;
      if (oldName && cleanNewName && oldName !== cleanNewName && prev.presidentName === oldName) {
        nextPresident = cleanNewName;
      }

      // Atualiza também nas semanas salvas da escala mensal caso o nome tenha mudado
      let nextMonthlySchedule = prev.monthlySchedule;
      if (oldName && cleanNewName && oldName !== cleanNewName && prev.monthlySchedule?.weeks) {
        const replaceName = (val?: string) => (val === oldName ? cleanNewName : val);
        nextMonthlySchedule = {
          ...prev.monthlySchedule,
          weeks: prev.monthlySchedule.weeks.map((w: ParsedWeekSchedule) => ({
            ...w,
            president: replaceName(w.president),
            openingPrayer: replaceName(w.openingPrayer),
            treasuresSpeaker: replaceName(w.treasuresSpeaker),
            spiritualGemsSpeaker: replaceName(w.spiritualGemsSpeaker),
            bibleReadingSpeaker: replaceName(w.bibleReadingSpeaker),
            congregationStudyConductor: replaceName(w.congregationStudyConductor),
            congregationStudyReader: replaceName(w.congregationStudyReader),
            closingPrayer: replaceName(w.closingPrayer),
            ministryParts: (w.ministryParts || []).map(mp => ({
              ...mp,
              speaker: replaceName(mp.speaker),
              assistant: replaceName(mp.assistant)
            })),
            christianLivingParts: (w.christianLivingParts || []).map(cp => ({
              ...cp,
              speaker: replaceName(cp.speaker)
            }))
          }))
        };
      }

      const next: CongregationSettings = {
        ...prev,
        presidentName: nextPresident,
        brothers: updatedBrothers,
        monthlySchedule: nextMonthlySchedule
      };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });

    // Atualiza nas partes atualmente carregadas na tela
    if (oldName && cleanNewName && oldName !== cleanNewName) {
      setState(prev => ({
        ...prev,
        parts: prev.parts.map(p => ({
          ...p,
          speaker: p.speaker === oldName ? cleanNewName : p.speaker,
          assistant: p.assistant === oldName ? cleanNewName : p.assistant
        }))
      }));
    }
  };

  const removeBrother = (id: string) => {
    setSettings(prev => {
      const next = {
        ...prev,
        brothers: prev.brothers.filter(b => b.id !== id)
      };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };

  const addBrother = (name: string, role: Role) => {
    if (!name.trim()) return;
    setSettings(prev => {
      if (prev.brothers.some(b => b.name.toLowerCase() === name.trim().toLowerCase())) return prev;
      const uniqueId = `br-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newBrothers = [...prev.brothers, { id: uniqueId, name: name.trim(), role }];
      const next = { ...prev, brothers: newBrothers.sort((a, b) => a.name.localeCompare(b.name)) };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };

  const addBrothersBatch = (
    items: Array<string | { name: string; role?: Role }>,
    defaultRole: Role = "Publicador"
  ) => {
    if (!items.length) return;
    setSettings(prev => {
      const existingMap = new Set(prev.brothers.map(b => b.name.toLowerCase().trim()));
      const toAdd: Brother[] = [];
      
      items.forEach((item, index) => {
        const rawName = typeof item === 'string' ? item : item.name;
        const itemRole = typeof item === 'object' && item.role ? item.role : defaultRole;
        const cleanName = rawName.trim();
        if (cleanName && !existingMap.has(cleanName.toLowerCase())) {
          existingMap.add(cleanName.toLowerCase());
          toAdd.push({
            id: `br-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
            name: cleanName,
            role: itemRole
          });
        }
      });
      
      if (!toAdd.length) return prev;
      
      const newBrothers = [...prev.brothers, ...toAdd];
      const next = { ...prev, brothers: newBrothers.sort((a, b) => a.name.localeCompare(b.name)) };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };

  // Setup functions
  const updatePart = (index: number, updates: Partial<MeetingPart>) => {
    setState(prev => {
      const newParts = [...prev.parts];
      newParts[index] = { ...newParts[index], ...updates };
      return { ...prev, parts: newParts };
    });
  };

  const setAllParts = (newParts: MeetingPart[]) => {
    setState(prev => ({
      ...prev,
      parts: newParts
    }));
  };

  // Aplica uma programação mensal completa importada (acumula todos os meses em ordem cronológica)
  // e seleciona automaticamente a semana vigente correspondente à data de hoje
  const applyMonthSchedule = (parseResult: MonthPdfParseResult) => {
    if (!parseResult || !parseResult.weeks || parseResult.weeks.length === 0) return;

    const existingWeeks = settings.monthlySchedule?.weeks || [];
    const mergedWeeks = mergeWeekSchedules(existingWeeks, parseResult.weeks);

    const finalParseResult: MonthPdfParseResult = {
      ...parseResult,
      weeks: mergedWeeks
    };

    try {
      safeStorage.setItem('s38t_imported_month_schedule', JSON.stringify(finalParseResult));
    } catch (e) {}

    // Seleciona automaticamente a semana vigente na lista completa mesclada
    const matchingWeek = findMatchingWeekForDate(mergedWeeks, new Date()) || parseResult.weeks[0] || mergedWeeks[0];

    const baseParts = getPartsForWeekType(settings.weekType);
    const updatedParts = applyPdfWeekToMeetingParts(baseParts, matchingWeek);

    setState(prev => ({
      ...prev,
      parts: updatedParts,
      importedWeekLabel: matchingWeek.weekLabel
    }));

    // Adiciona irmãos encontrados automaticamente
    const existingMap = new Set(settings.brothers.map(b => b.name.toLowerCase().trim()));
    const toAdd: Brother[] = [];
    (parseResult.allBrothersFound || []).forEach((name, idx) => {
      const cleanName = name.trim();
      if (cleanName && !existingMap.has(cleanName.toLowerCase())) {
        existingMap.add(cleanName.toLowerCase());
        toAdd.push({
          id: `br-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          name: cleanName,
          role: 'Publicador'
        });
      }
    });

    const nextBrothers = toAdd.length ? [...settings.brothers, ...toAdd].sort((a, b) => a.name.localeCompare(b.name)) : settings.brothers;

    const updates: Partial<CongregationSettings> = {
      monthlySchedule: finalParseResult,
      selectedWeekId: matchingWeek.id,
      importedWeekLabel: matchingWeek.weekLabel,
      brothers: nextBrothers
    };

    if (matchingWeek.president) {
      updates.presidentName = matchingWeek.president;
    }
    if (parseResult.congregationName && parseResult.congregationName.length > 3) {
      updates.name = parseResult.congregationName;
    }

    hasAutoSelectedCurrentWeekRef.current = true;

    setSettings(prev => {
      const next = { ...prev, ...updates };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };

  // Alterna manualmente para outra semana da programação mensal salva
  const selectWeekFromSchedule = (weekId: string) => {
    if (!settings.monthlySchedule?.weeks) return;
    const week = settings.monthlySchedule.weeks.find((w: ParsedWeekSchedule) => w.id === weekId);
    if (!week) return;

    hasAutoSelectedCurrentWeekRef.current = true;

    const baseParts = getPartsForWeekType(settings.weekType);
    const updatedParts = applyPdfWeekToMeetingParts(baseParts, week);

    setState(prev => ({
      ...prev,
      parts: updatedParts,
      importedWeekLabel: week.weekLabel
    }));

    const updates: Partial<CongregationSettings> = {
      selectedWeekId: week.id,
      importedWeekLabel: week.weekLabel
    };
    if (week.president) {
      updates.presidentName = week.president;
    }

    setSettings(prev => {
      const next = { ...prev, ...updates };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };

  // Remove apenas as semanas de um mês específico (mantendo os demais meses e NUNCA afetando o histórico de reuniões)
  const removeMonthFromSchedule = (monthKey: string) => {
    if (!settings.monthlySchedule?.weeks) return;
    const remainingWeeks = settings.monthlySchedule.weeks.filter(
      (w: ParsedWeekSchedule) => getWeekMonthInfo(w).monthKey !== monthKey
    );

    if (remainingWeeks.length === 0) {
      clearMonthlySchedule();
      return;
    }

    const matchingWeek = findMatchingWeekForDate(remainingWeeks, new Date()) || remainingWeeks[0];
    const baseParts = getPartsForWeekType(settings.weekType);
    const updatedParts = applyPdfWeekToMeetingParts(baseParts, matchingWeek);

    setState(prev => ({
      ...prev,
      parts: updatedParts,
      importedWeekLabel: matchingWeek.weekLabel
    }));

    const nextSchedule = {
      ...settings.monthlySchedule,
      weeks: remainingWeeks
    };

    try {
      safeStorage.setItem('s38t_imported_month_schedule', JSON.stringify(nextSchedule));
    } catch (e) {}

    setSettings(prev => {
      const next: CongregationSettings = {
        ...prev,
        monthlySchedule: nextSchedule,
        selectedWeekId: matchingWeek.id,
        importedWeekLabel: matchingWeek.weekLabel,
        presidentName: matchingWeek.president || prev.presidentName
      };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };

  // Exclui todas as escalas de PDF importadas (NUNCA afeta o histórico de reuniões concluídas)
  const clearMonthlySchedule = () => {
    const baseParts = getPartsForWeekType(settings.weekType);
    setState(prev => ({
      ...prev,
      parts: baseParts,
      importedWeekLabel: undefined
    }));

    try {
      safeStorage.removeItem('s38t_imported_month_schedule');
    } catch (e) {}

    setSettings(prev => {
      const next = {
        ...prev,
        monthlySchedule: null,
        selectedWeekId: undefined,
        importedWeekLabel: undefined
      };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };

  // Ao iniciar o app ou carregar as semanas do Firebase, seleciona automaticamente a SEMANA VIGENTE (data de hoje)
  useEffect(() => {
    if (state.status !== 'setup') return;
    if (!settings.monthlySchedule?.weeks || settings.monthlySchedule.weeks.length === 0) return;

    const currentMatchingWeek = findMatchingWeekForDate(settings.monthlySchedule.weeks, new Date());
    if (!currentMatchingWeek) return;

    // Na inicialização da sessão, prioriza sempre a semana vigente de hoje automaticamente
    let targetWeek: ParsedWeekSchedule;
    if (!hasAutoSelectedCurrentWeekRef.current) {
      hasAutoSelectedCurrentWeekRef.current = true;
      targetWeek = currentMatchingWeek;
      if (settings.selectedWeekId !== currentMatchingWeek.id) {
        setSettings(prev => {
          const next = {
            ...prev,
            selectedWeekId: currentMatchingWeek.id,
            importedWeekLabel: currentMatchingWeek.weekLabel,
            presidentName: currentMatchingWeek.president || prev.presidentName
          };
          saveFirebaseSettings(next).catch(() => {});
          return next;
        });
      }
    } else {
      const targetWeekId = settings.selectedWeekId || currentMatchingWeek.id;
      targetWeek = settings.monthlySchedule.weeks.find((w: ParsedWeekSchedule) => w.id === targetWeekId) || currentMatchingWeek;
    }

    if (state.importedWeekLabel !== targetWeek.weekLabel) {
      const baseParts = getPartsForWeekType(settings.weekType);
      const updatedParts = applyPdfWeekToMeetingParts(baseParts, targetWeek);
      setState(prev => ({
        ...prev,
        parts: updatedParts,
        importedWeekLabel: targetWeek.weekLabel
      }));
    }
  }, [settings.monthlySchedule, settings.selectedWeekId, settings.weekType, state.status, state.importedWeekLabel]);

  const addPart = (index: number) => {
    setState(prev => {
      const newParts = [...prev.parts];
      newParts.splice(index + 1, 0, {
        id: `custom-${Date.now()}`,
        title: "Nova Parte",
        plannedTime: 5,
        flexible: false,
        hasCounsel: false
      });
      return { ...prev, parts: newParts };
    });
  };

  const removePart = (index: number) => {
    setState(prev => {
      const newParts = [...prev.parts];
      newParts.splice(index, 1);
      return { ...prev, parts: newParts };
    });
  };

  const startMeeting = () => {
    const initialParts = JSON.parse(JSON.stringify(state.parts));
    const firstPart = initialParts[0];
    const initialTargetSecs = (firstPart?.plannedTime || 5) * 60;
    
    setState(prev => ({
      ...prev,
      status: 'running',
      startTime: new Date(),
      currentPartIndex: 0,
      isCounselPhase: false,
      timeBalance: 0,
      totalElapsedSeconds: 0,
      history: []
    }));
    setTargetDurationSeconds(initialTargetSecs);
    setCurrentTimerSeconds(initialTargetSecs);
    setIsTimerRunning(false);
    setPendingSavedSession(null);
  };

  // Timer tick effect
  useEffect(() => {
    if (isTimerRunning) {
      lastTickTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = (now - (lastTickTimeRef.current || now)) / 1000;
        lastTickTimeRef.current = now;
        
        setCurrentTimerSeconds(prev => prev - delta);
        setState(prev => ({
          ...prev,
          totalElapsedSeconds: prev.totalElapsedSeconds + delta
        }));
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const toggleTimer = () => {
    setIsTimerRunning(prev => !prev);
  };

  const adjustTimer = (secondsDelta: number) => {
    setCurrentTimerSeconds(prev => prev + secondsDelta);
  };

  const getNextUncompletedIndex = (parts: MeetingPart[], history: PartRecord[], currentIndex: number): number => {
    for (let i = currentIndex + 1; i < parts.length; i++) {
      if (!history.some(h => h.id === parts[i].id)) {
        return i;
      }
    }
    for (let i = 0; i < currentIndex; i++) {
      if (!history.some(h => h.id === parts[i].id)) {
        return i;
      }
    }
    return parts.length;
  };

  const nextPhase = () => {
    setIsTimerRunning(false);
    
    setState(prev => {
      const currentPart = prev.parts[prev.currentPartIndex];
      const newState = { ...prev, history: [...prev.history] };
      
      const actualTimeSpent = Math.max(0, targetDurationSeconds - currentTimerSeconds);
      
      if (prev.isCounselPhase) {
        newState.isCounselPhase = false;
        newState.currentPartIndex = getNextUncompletedIndex(newState.parts, newState.history, newState.currentPartIndex);
      } else {
        const roundedActualTime = Math.max(0, Math.round(actualTimeSpent));
        const overTime = roundedActualTime - (currentPart.plannedTime * 60);
        
        const record: PartRecord = {
          id: currentPart.id,
          partNumber: currentPart.partNumber,
          title: currentPart.title,
          speaker: currentPart.speaker,
          assistant: currentPart.assistant,
          hideSpeaker: currentPart.hideSpeaker,
          plannedTime: currentPart.plannedTime,
          actualTime: roundedActualTime,
          status: overTime > 0 ? 'Excedido' : (roundedActualTime < (currentPart.plannedTime * 60) / 2 ? 'Terminou antes do tempo' : 'No tempo correto'),
          hasCounsel: currentPart.hasCounsel,
          counselRecorded: currentPart.hasCounsel
        };

        const existingIndex = newState.history.findIndex(h => h.id === currentPart.id);
        if (existingIndex >= 0) {
          newState.history[existingIndex] = record;
        } else {
          newState.history.push(record);
        }

        newState.timeBalance = newState.history.reduce(
          (sum, h) => sum + (h.actualTime - h.plannedTime * 60),
          0
        );

        if (currentPart.hasCounsel) {
          newState.isCounselPhase = true;
        } else {
          newState.currentPartIndex = getNextUncompletedIndex(newState.parts, newState.history, newState.currentPartIndex);
        }
      }

      const allDone = newState.parts.every(p => newState.history.some(h => h.id === p.id)) || newState.currentPartIndex >= newState.parts.length;

      if (allDone) {
        newState.currentPartIndex = newState.parts.length;
        setTargetDurationSeconds(0);
        setCurrentTimerSeconds(0);
      } else {
        if (newState.isCounselPhase) {
          setTargetDurationSeconds(60);
          setCurrentTimerSeconds(60);
        } else {
          const nextTarget = (newState.parts[newState.currentPartIndex]?.plannedTime || 5) * 60;
          setTargetDurationSeconds(nextTarget);
          setCurrentTimerSeconds(nextTarget);
        }
      }

      return newState;
    });
  };

  const skipCounsel = () => {
    setIsTimerRunning(false);
    setState(prev => {
      const newState = { ...prev };
      newState.isCounselPhase = false;
      newState.currentPartIndex = getNextUncompletedIndex(newState.parts, newState.history, newState.currentPartIndex);
      
      const allDone = newState.parts.every(p => newState.history.some(h => h.id === p.id)) || newState.currentPartIndex >= newState.parts.length;

      if (allDone) {
        newState.currentPartIndex = newState.parts.length;
        setTargetDurationSeconds(0);
        setCurrentTimerSeconds(0);
      } else {
        const nextTarget = (newState.parts[newState.currentPartIndex]?.plannedTime || 5) * 60;
        setTargetDurationSeconds(nextTarget);
        setCurrentTimerSeconds(nextTarget);
      }
      return newState;
    });
  };

  const jumpToPart = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= state.parts.length || targetIndex === state.currentPartIndex) return;

    setIsTimerRunning(false);
    setState(prev => {
      const currentPart = prev.parts[prev.currentPartIndex];
      const newState = { ...prev, history: [...prev.history] };
      
      const actualTimeSpent = Math.max(0, targetDurationSeconds - currentTimerSeconds);
      if (actualTimeSpent > 3) {
        const existingHistoryIndex = newState.history.findIndex(h => h.id === currentPart.id);
        const roundedActualTime = Math.max(0, Math.round(actualTimeSpent));
        const overTime = roundedActualTime - (currentPart.plannedTime * 60);
        const record: PartRecord = {
          id: currentPart.id,
          partNumber: currentPart.partNumber,
          title: currentPart.title,
          speaker: currentPart.speaker,
          assistant: currentPart.assistant,
          hideSpeaker: currentPart.hideSpeaker,
          plannedTime: currentPart.plannedTime,
          actualTime: roundedActualTime,
          status: overTime > 0 ? 'Excedido' : (roundedActualTime < (currentPart.plannedTime * 60) / 2 ? 'Terminou antes do tempo' : 'No tempo correto'),
          hasCounsel: currentPart.hasCounsel
        };
        
        if (existingHistoryIndex >= 0) {
          newState.history[existingHistoryIndex] = record;
        } else {
          newState.history.push(record);
        }

        newState.timeBalance = newState.history.reduce(
          (sum, h) => sum + (h.actualTime - h.plannedTime * 60),
          0
        );
      }

      newState.currentPartIndex = targetIndex;
      newState.isCounselPhase = false;

      const nextTarget = (newState.parts[targetIndex]?.plannedTime || 5) * 60;
      setTargetDurationSeconds(nextTarget);
      setCurrentTimerSeconds(nextTarget);

      return newState;
    });
  };

  // RF08: Encerramento explícito e gravação imutável (independente de futuros PDFs excluídos)
  const concludeMeeting = () => {
    setIsTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const now = new Date();
    const startTime = state.startTime || new Date(now.getTime() - state.totalElapsedSeconds * 1000);
    const duracaoTotalSegundos = Math.max(0, Math.round(state.totalElapsedSeconds));
    const duracaoTotalMinutos = Math.round(duracaoTotalSegundos / 60);
    const saldoFinalSegundos = Math.round(state.timeBalance);
    const saldoFinalMinutos = Math.round(saldoFinalSegundos / 60);
    const indiceFinalPercentual = Math.min(100, Math.round((duracaoTotalMinutos / TOTAL_PLANNED_MEETING_MINUTES) * 100));

    const day2 = String(now.getDate()).padStart(2, '0');
    const month2 = String(now.getMonth() + 1).padStart(2, '0');
    const year2 = String(now.getFullYear()).slice(-2);
    const dataReuniaoCurta = `${day2}/${month2}/${year2}`;

    const weekApostila = state.importedWeekLabel || settings.importedWeekLabel || `${now.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} | ${settings.weekType.toUpperCase()}`;

    // Garante que todas as partes da reunião fiquem registradas no snapshot imutável da reunião
    const recordedMap = new Map<string, PartRecord>();
    state.history.forEach(h => recordedMap.set(h.id, h));
    const completePartes: PartRecord[] = state.parts.map(p => {
      const recorded = recordedMap.get(p.id);
      if (recorded) return recorded;
      return {
        id: p.id,
        partNumber: p.partNumber,
        title: p.title,
        speaker: p.speaker,
        assistant: p.assistant,
        hideSpeaker: p.hideSpeaker,
        plannedTime: p.plannedTime,
        actualTime: 0,
        status: 'No tempo correto',
        hasCounsel: p.hasCounsel,
        counselRecorded: false
      };
    });

    const completed: CompletedMeeting = {
      id: `meeting-${now.getTime()}`,
      status: 'encerrada',
      encerrada_em: now.toISOString(),
      iniciada_em: startTime.toISOString(),
      data_formatada: now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
      semana_apostila: weekApostila,
      data_reuniao_curta: dataReuniaoCurta,
      congregacao: settings.name,
      presidente: settings.presidentName,
      tipo_semana: settings.weekType,
      duracao_planejada_minutos: TOTAL_PLANNED_MEETING_MINUTES,
      duracao_real_minutos: duracaoTotalMinutos,
      duracao_real_segundos: duracaoTotalSegundos,
      saldo_final_segundos: saldoFinalSegundos,
      saldo_final_minutos: saldoFinalMinutos,
      indice_final_percentual: indiceFinalPercentual,
      salvo_por_email: auth.currentUser?.email || undefined,
      user_email: auth.currentUser?.email || undefined,
      partes: completePartes
    };

    saveToArchive(completed);
    safeStorage.removeItem(STORAGE_ACTIVE_SESSION_KEY);
    setPendingSavedSession(null);

    setState(prev => ({
      ...prev,
      status: 'summary',
      currentMeeting: completed
    }));
  };

  const viewArchivedMeeting = (meeting: CompletedMeeting) => {
    setState(prev => ({
      ...prev,
      status: 'summary',
      currentMeeting: meeting
    }));
  };

  const viewArchiveList = () => {
    setState(prev => ({
      ...prev,
      status: 'history_list'
    }));
  };

  const pauseAndReturnToSetup = () => {
    setIsTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    const session: ActiveMeetingSession = {
      status: 'running',
      iniciada_em: state.startTime ? state.startTime.toISOString() : new Date().toISOString(),
      presidente: settings.presidentName,
      tipo_semana: settings.weekType,
      congregacao: settings.name,
      importedWeekLabel: state.importedWeekLabel || settings.importedWeekLabel,
      parts: state.parts,
      currentPartIndex: state.currentPartIndex,
      isCounselPhase: state.isCounselPhase,
      timeBalance: state.timeBalance,
      currentTimerSeconds,
      targetDurationSeconds,
      isTimerRunning: false,
      totalElapsedSeconds: state.totalElapsedSeconds,
      records: state.history
    };
    safeStorage.setItem(STORAGE_ACTIVE_SESSION_KEY, JSON.stringify(session));
    setPendingSavedSession(session);

    setState(prev => ({
      ...prev,
      status: 'setup'
    }));
  };

  const resetToSetup = () => {
    safeStorage.removeItem(STORAGE_ACTIVE_SESSION_KEY);
    setPendingSavedSession(null);
    setState({
      status: 'setup',
      parts: JSON.parse(JSON.stringify(DEFAULT_PARTS)),
      currentPartIndex: 0,
      isCounselPhase: false,
      timeBalance: 0,
      totalElapsedSeconds: 0,
      history: []
    });
  };

  const progressPercent = Math.min(100, Math.round((state.totalElapsedSeconds / (TOTAL_PLANNED_MEETING_MINUTES * 60)) * 100));

  return {
    state,
    settings,
    currentTimerSeconds,
    isTimerRunning,
    targetDurationSeconds,
    progressPercent,
    pendingSavedSession,
    archivedMeetings,
    resumeSavedMeeting,
    discardSavedMeeting,
    updatePart,
    setAllParts,
    addPart,
    removePart,
    startMeeting,
    toggleTimer,
    adjustTimer,
    nextPhase,
    skipCounsel,
    jumpToPart,
    concludeMeeting,
    pauseAndReturnToSetup,
    resetToSetup,
    viewArchivedMeeting,
    viewArchiveList,
    deleteFromArchive,
    restoreMeetingFromLog,
    recoverMissingHistory,
    firebaseStatus,
    updateSettings,
    updateBrother,
    addBrother,
    addBrothersBatch,
    removeBrother,
    applyMonthSchedule,
    selectWeekFromSchedule,
    removeMonthFromSchedule,
    clearMonthlySchedule
  };
}
