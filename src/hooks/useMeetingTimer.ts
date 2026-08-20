import { useState, useEffect, useRef, useCallback } from 'react';
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
  subscribeToFirebaseSettings
} from '../lib/firebase';
import {
  MonthPdfParseResult,
  ParsedWeekSchedule,
  applyPdfWeekToMeetingParts,
  findMatchingWeekForDate
} from '../lib/apostilaParser';

const STORAGE_SETTINGS_KEY = 'jw_stage_settings';
const STORAGE_ACTIVE_SESSION_KEY = 'jw_stage_active_session';

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

export function useMeetingTimer() {
  // Garantir a exclusão completa de qualquer histórico local anterior que possa ter ficado no navegador
  useEffect(() => {
    safeStorage.removeItem('jw_stage_meetings_archive');
  }, []);
  const [firebaseStatus, setFirebaseStatus] = useState<'synced' | 'syncing' | 'offline'>('syncing');

  // Settings
  const [settings, setSettings] = useState<CongregationSettings>(() => {
    const saved = safeStorage.getItem(STORAGE_SETTINGS_KEY);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        const rawLoadedBrothers: Brother[] = parsed.brothers?.length ? parsed.brothers : DEFAULT_BROTHERS;
        
        // Garante que cada irmão tenha um ID estritamente único
        const seenIds = new Set<string>();
        const sanitizedBrothers: Brother[] = rawLoadedBrothers.map((b, idx) => {
          let brotherId = b.id;
          if (!brotherId || seenIds.has(brotherId)) {
            brotherId = `br-sanitized-${idx}-${Math.random().toString(36).substring(2, 7)}`;
          }
          seenIds.add(brotherId);
          return { ...b, id: brotherId };
        });

        return {
          name: parsed.name || "Minha Congregação",
          defaultTime: parsed.defaultTime !== undefined ? parsed.defaultTime : "",
          presidentName: parsed.presidentName || "Presidente da Reunião",
          weekType: parsed.weekType || "Normal",
          brothers: sanitizedBrothers
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

  useEffect(() => {
    safeStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    // saveFirebaseSettings is now handled per-action to avoid infinite loops with realtime sync
  }, [settings]);

  // Archive of completed meetings - strictly backed by Cloud Firestore
  const [archivedMeetings, setArchivedMeetings] = useState<CompletedMeeting[]>([]);

  // Carregar dados oficiais e sincronizar estritamente com o Firebase
  useEffect(() => {
    let isMounted = true;

    async function syncWithFirebase() {
      try {
        setFirebaseStatus('syncing');
        
        // 1. Sincronizar configurações da congregação
        const remoteSettings = await fetchFirebaseSettings();
        if (remoteSettings && isMounted) {
          if (remoteSettings.name || remoteSettings.brothers?.length) {
            setSettings(remoteSettings);
            safeStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(remoteSettings));
          }
        } else if (settings && isMounted) {
          await saveFirebaseSettings(settings);
        }

        // 2. Sincronizar histórico de reuniões: mantém SOMENTE o que existe no banco de dados oficial
        const remoteMeetings = await fetchFirebaseMeetings();
        if (isMounted) {
          // Filtra demos caso algum tenha sido salvo anteriormente e sanitiza plannedTimes
          const cleanRemote = (remoteMeetings || [])
            .filter(m => !m.id.startsWith('demo-'))
            .map(sanitizeCompletedMeeting);
          setArchivedMeetings(cleanRemote);
          setFirebaseStatus('synced');
        }
      } catch (err) {
        console.warn("Firebase sync notice:", err);
        if (isMounted) setFirebaseStatus('synced');
      }
    }

    syncWithFirebase();

    // Inscrição em tempo real para sincronização com o banco de dados oficial
    const unsubscribeSettings = subscribeToFirebaseSettings((liveSettings) => {
      if (!isMounted || !liveSettings) return;
      if (liveSettings.name || liveSettings.brothers?.length) {
        setSettings(liveSettings);
        safeStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(liveSettings));
      }
    });

    const unsubscribe = subscribeToFirebaseMeetings((liveMeetings) => {
      if (!isMounted) return;
      const cleanLive = (liveMeetings || [])
        .filter(m => !m.id.startsWith('demo-'))
        .map(sanitizeCompletedMeeting);
      setArchivedMeetings(cleanLive);
      setFirebaseStatus('synced');
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof unsubscribeSettings === 'function') unsubscribeSettings();
    };
  }, []);

  const saveToArchive = (meeting: CompletedMeeting) => {
    // Apenas salva no Firebase, o realtime listener (subscribeToFirebaseMeetings) atualizará a lista local
    saveFirebaseMeeting(meeting).catch(e => console.error("Error saving meeting to Firebase:", e));
  };

  const deleteFromArchive = (id: string) => {
    // Remove do Firebase, o realtime listener (subscribeToFirebaseMeetings) atualizará a lista local
    deleteFirebaseMeeting(id).catch(e => console.error("Error deleting meeting from Firebase:", e));
  };

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

  // Save whenever key state points change
  useEffect(() => {
    if (state.status === 'running') {
      saveActiveSession();
    }
  }, [state.status, state.currentPartIndex, state.isCounselPhase, state.timeBalance, state.history, saveActiveSession]);

  // Resume or Discard saved session
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
    setIsTimerRunning(false); // keep paused upon reload for safety
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
    setSettings(prev => {
      const next = {
        ...prev,
        brothers: prev.brothers.map(b => b.id === id ? { ...b, ...updates } : b).sort((a, b) => a.name.localeCompare(b.name))
      };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
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
      if (prev.brothers.some(b => b.name.toLowerCase() === name.toLowerCase())) return prev;
      const uniqueId = `br-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newBrothers = [...prev.brothers, { id: uniqueId, name, role }];
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

  // Aplica uma programação mensal completa importada (salva todas as semanas)
  // e seleciona automaticamente a semana correspondente a hoje
  const applyMonthSchedule = (parseResult: MonthPdfParseResult) => {
    if (!parseResult || !parseResult.weeks || parseResult.weeks.length === 0) return;

    // Encontra a semana de hoje automaticamente (ex: dia 18 na semana do dia 17)
    const matchingWeek = findMatchingWeekForDate(parseResult.weeks, new Date()) || parseResult.weeks[0];

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
      monthlySchedule: parseResult,
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

  // Exclui a programação mensal salva
  const clearMonthlySchedule = () => {
    const baseParts = getPartsForWeekType(settings.weekType);
    setState(prev => ({
      ...prev,
      parts: baseParts,
      importedWeekLabel: undefined
    }));

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

  // Ao iniciar ou trocar settings, se houver programação mensal e estiver em setup,
  // garante que a semana correspondente à data de hoje esteja carregada
  useEffect(() => {
    if (state.status !== 'setup') return;
    if (!settings.monthlySchedule?.weeks || settings.monthlySchedule.weeks.length === 0) return;

    const currentMatchingWeek = findMatchingWeekForDate(settings.monthlySchedule.weeks, new Date());
    if (!currentMatchingWeek) return;

    // Se a semana salva for a de hoje ou se nada estiver selecionado ainda
    const targetWeekId = settings.selectedWeekId || currentMatchingWeek.id;
    const targetWeek = settings.monthlySchedule.weeks.find((w: ParsedWeekSchedule) => w.id === targetWeekId) || currentMatchingWeek;

    // Apenas aplica se ainda não tiver sido carregada
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

  // Helper interno para encontrar o próximo índice não concluído no fluxo
  const getNextUncompletedIndex = (parts: MeetingPart[], history: PartRecord[], currentIndex: number): number => {
    // 1. Procura primeiro para frente (currentIndex + 1 até o final)
    for (let i = currentIndex + 1; i < parts.length; i++) {
      if (!history.some(h => h.id === parts[i].id)) {
        return i;
      }
    }
    // 2. Se não houver à frente, procura do início (0 até currentIndex - 1) para partes pendentes
    for (let i = 0; i < currentIndex; i++) {
      if (!history.some(h => h.id === parts[i].id)) {
        return i;
      }
    }
    // 3. Todas as partes foram concluídas
    return parts.length;
  };

  // Conclude current phase (part or counsel)
  const nextPhase = () => {
    setIsTimerRunning(false);
    
    setState(prev => {
      const currentPart = prev.parts[prev.currentPartIndex];
      const newState = { ...prev };
      
      // Calculate actual time spent on this part
      const actualTimeSpent = Math.max(0, targetDurationSeconds - currentTimerSeconds);
      
      if (prev.isCounselPhase) {
        // Finishing counsel phase -> avança para a próxima parte não concluída
        newState.isCounselPhase = false;
        newState.currentPartIndex = getNextUncompletedIndex(newState.parts, newState.history, newState.currentPartIndex);
      } else {
        // Finishing a main meeting part
        const overTime = actualTimeSpent - (currentPart.plannedTime * 60);
        newState.timeBalance += overTime;
        
        // Grava ou atualiza no histórico (sem duplicar)
        const record: PartRecord = {
          id: currentPart.id,
          partNumber: currentPart.partNumber,
          title: currentPart.title,
          speaker: currentPart.speaker,
          assistant: currentPart.assistant,
          hideSpeaker: currentPart.hideSpeaker,
          plannedTime: currentPart.plannedTime,
          actualTime: Math.max(0, Math.round(actualTimeSpent)),
          status: overTime > 0 ? 'Excedido' : (actualTimeSpent < (currentPart.plannedTime * 60) / 2 ? 'Terminou antes do tempo' : 'No tempo correto'),
          hasCounsel: currentPart.hasCounsel,
          counselRecorded: currentPart.hasCounsel
        };

        const existingIndex = newState.history.findIndex(h => h.id === currentPart.id);
        if (existingIndex >= 0) {
          newState.history[existingIndex] = record;
        } else {
          newState.history.push(record);
        }

        if (currentPart.hasCounsel) {
          newState.isCounselPhase = true;
        } else {
          newState.currentPartIndex = getNextUncompletedIndex(newState.parts, newState.history, newState.currentPartIndex);
        }
      }

      // Se todas as partes estiverem concluídas
      const allDone = newState.parts.every(p => newState.history.some(h => h.id === p.id)) || newState.currentPartIndex >= newState.parts.length;

      if (allDone) {
        newState.currentPartIndex = newState.parts.length;
        setTargetDurationSeconds(0);
        setCurrentTimerSeconds(0);
      } else {
        // Próximo alvo do cronômetro
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

  // Pular ou adiantar para uma parte específica (ex: irmão atrasado)
  const jumpToPart = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= state.parts.length || targetIndex === state.currentPartIndex) return;

    setIsTimerRunning(false);
    setState(prev => {
      const currentPart = prev.parts[prev.currentPartIndex];
      const newState = { ...prev };
      
      // Se houve tempo decorrido na parte atual (> 3 segundos), grava o tempo consumido
      const actualTimeSpent = Math.max(0, targetDurationSeconds - currentTimerSeconds);
      if (actualTimeSpent > 3) {
        const existingHistoryIndex = newState.history.findIndex(h => h.id === currentPart.id);
        const overTime = actualTimeSpent - (currentPart.plannedTime * 60);
        const record: PartRecord = {
          id: currentPart.id,
          partNumber: currentPart.partNumber,
          title: currentPart.title,
          speaker: currentPart.speaker,
          assistant: currentPart.assistant,
          hideSpeaker: currentPart.hideSpeaker,
          plannedTime: currentPart.plannedTime,
          actualTime: Math.max(0, Math.round(actualTimeSpent)),
          status: overTime > 0 ? 'Excedido' : (actualTimeSpent < (currentPart.plannedTime * 60) / 2 ? 'Terminou antes do tempo' : 'No tempo correto'),
          hasCounsel: currentPart.hasCounsel
        };
        
        if (existingHistoryIndex >= 0) {
          newState.history[existingHistoryIndex] = record;
        } else {
          newState.history.push(record);
        }
      }

      newState.currentPartIndex = targetIndex;
      newState.isCounselPhase = false;

      const nextTarget = (newState.parts[targetIndex]?.plannedTime || 5) * 60;
      setTargetDurationSeconds(nextTarget);
      setCurrentTimerSeconds(nextTarget);

      return newState;
    });
  };

  // RF08: Encerramento explícito e gravação imutável
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
      partes: state.history
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
    
    // Salva a sessão ativa antes de sair da tela
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

  // RF09: Índice de Andamento
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
    firebaseStatus,
    updateSettings,
    updateBrother,
    addBrother,
    addBrothersBatch,
    removeBrother,
    applyMonthSchedule,
    selectWeekFromSchedule,
    clearMonthlySchedule
  };
}
