import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MeetingState, 
  MeetingPart, 
  DEFAULT_PARTS, 
  CongregationSettings, 
  DEFAULT_BROTHERS, 
  Role, 
  Brother, 
  PartRecord, 
  CompletedMeeting, 
  ActiveMeetingSession,
  TOTAL_PLANNED_MEETING_MINUTES
} from '../types';

const STORAGE_SETTINGS_KEY = 'jw_stage_settings';
const STORAGE_ACTIVE_SESSION_KEY = 'jw_stage_active_session';
const STORAGE_ARCHIVE_KEY = 'jw_stage_meetings_archive';

export function useMeetingTimer() {
  // Settings
  const [settings, setSettings] = useState<CongregationSettings>(() => {
    const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
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
          defaultTime: parsed.defaultTime || "19:30",
          presidentName: parsed.presidentName || "Presidente da Reunião",
          weekType: parsed.weekType || "Normal",
          brothers: sanitizedBrothers
        };
      } catch (e) {}
    }
    return {
      name: "Minha Congregação",
      defaultTime: "19:30",
      presidentName: "Presidente da Reunião",
      weekType: "Normal",
      brothers: DEFAULT_BROTHERS
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Archive of completed meetings
  const [archivedMeetings, setArchivedMeetings] = useState<CompletedMeeting[]>(() => {
    const saved = localStorage.getItem(STORAGE_ARCHIVE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  const saveToArchive = (meeting: CompletedMeeting) => {
    setArchivedMeetings(prev => {
      const updated = [meeting, ...prev.filter(m => m.id !== meeting.id)];
      localStorage.setItem(STORAGE_ARCHIVE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const deleteFromArchive = (id: string) => {
    setArchivedMeetings(prev => {
      const updated = prev.filter(m => m.id !== id);
      localStorage.setItem(STORAGE_ARCHIVE_KEY, JSON.stringify(updated));
      return updated;
    });
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
    const saved = localStorage.getItem(STORAGE_ACTIVE_SESSION_KEY);
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
    localStorage.setItem(STORAGE_ACTIVE_SESSION_KEY, JSON.stringify(session));
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
    localStorage.removeItem(STORAGE_ACTIVE_SESSION_KEY);
    setPendingSavedSession(null);
  };

  // Settings operations
  const updateSettings = (updates: Partial<CongregationSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const updateBrother = (id: string, updates: Partial<Brother>) => {
    setSettings(prev => ({
      ...prev,
      brothers: prev.brothers.map(b => b.id === id ? { ...b, ...updates } : b).sort((a, b) => a.name.localeCompare(b.name))
    }));
  };

  const removeBrother = (id: string) => {
    setSettings(prev => ({
      ...prev,
      brothers: prev.brothers.filter(b => b.id !== id)
    }));
  };

  const addBrother = (name: string, role: Role) => {
    if (!name.trim()) return;
    setSettings(prev => {
      if (prev.brothers.some(b => b.name.toLowerCase() === name.toLowerCase())) return prev;
      const uniqueId = `br-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newBrothers = [...prev.brothers, { id: uniqueId, name, role }];
      return { ...prev, brothers: newBrothers.sort((a, b) => a.name.localeCompare(b.name)) };
    });
  };

  const addBrothersBatch = (names: string[], defaultRole: Role = "Publicador") => {
    if (!names.length) return;
    setSettings(prev => {
      const existingMap = new Set(prev.brothers.map(b => b.name.toLowerCase().trim()));
      const toAdd: Brother[] = [];
      
      names.forEach((rawName, index) => {
        const cleanName = rawName.trim();
        if (cleanName && !existingMap.has(cleanName.toLowerCase())) {
          existingMap.add(cleanName.toLowerCase());
          toAdd.push({
            id: `br-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
            name: cleanName,
            role: defaultRole
          });
        }
      });

      if (toAdd.length === 0) return prev;
      const combined = [...prev.brothers, ...toAdd];
      return { ...prev, brothers: combined.sort((a, b) => a.name.localeCompare(b.name)) };
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

  // Conclude current phase (part or counsel)
  const nextPhase = () => {
    setIsTimerRunning(false);
    
    setState(prev => {
      const currentPart = prev.parts[prev.currentPartIndex];
      const newState = { ...prev };
      
      // Calculate actual time spent on this part
      const actualTimeSpent = targetDurationSeconds - currentTimerSeconds;
      
      if (prev.isCounselPhase) {
        // Finishing counsel phase
        newState.isCounselPhase = false;
        newState.currentPartIndex++;
      } else {
        // Finishing a main meeting part
        const overTime = actualTimeSpent - (currentPart.plannedTime * 60);
        newState.timeBalance += overTime;
        
        // S-38-T: Flexible parts absorption if delayed
        if (overTime > 0) {
          let remainingOvertime = overTime;
          for (let i = prev.currentPartIndex + 1; i < newState.parts.length; i++) {
            if (newState.parts[i].flexible && remainingOvertime > 0) {
              const possibleReduction = Math.max(0, newState.parts[i].plannedTime * 60 - 60);
              const reduction = Math.min(possibleReduction, remainingOvertime);
              
              if (reduction > 0) {
                newState.parts[i].plannedTime = parseFloat(((newState.parts[i].plannedTime * 60 - reduction) / 60).toFixed(1));
                remainingOvertime -= reduction;
              }
            }
          }
        }
        
        // Add to history records
        newState.history.push({
          id: currentPart.id,
          title: currentPart.title,
          speaker: currentPart.speaker,
          assistant: currentPart.assistant,
          hideSpeaker: currentPart.hideSpeaker,
          plannedTime: currentPart.plannedTime,
          actualTime: Math.max(0, Math.round(actualTimeSpent)),
          status: overTime > 15 ? 'Excedido' : overTime < -15 ? 'Abaixo do tempo' : 'No tempo',
          hasCounsel: currentPart.hasCounsel,
          counselRecorded: currentPart.hasCounsel
        });

        if (currentPart.hasCounsel) {
          newState.isCounselPhase = true;
        } else {
          newState.currentPartIndex++;
        }
      }

      // If finished all parts, we remain at last index ready for "Encerrar Reunião"
      if (newState.currentPartIndex >= newState.parts.length) {
        // All parts done, prompt "Encerrar Reunião"
        // Target duration reset to 0
        setTargetDurationSeconds(0);
        setCurrentTimerSeconds(0);
      } else {
        // Next timer target
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
      newState.currentPartIndex++;
      
      if (newState.currentPartIndex >= newState.parts.length) {
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
      partes: state.history
    };

    saveToArchive(completed);
    localStorage.removeItem(STORAGE_ACTIVE_SESSION_KEY);
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
    localStorage.setItem(STORAGE_ACTIVE_SESSION_KEY, JSON.stringify(session));
    setPendingSavedSession(session);

    setState(prev => ({
      ...prev,
      status: 'setup'
    }));
  };

  const resetToSetup = () => {
    localStorage.removeItem(STORAGE_ACTIVE_SESSION_KEY);
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
    concludeMeeting,
    pauseAndReturnToSetup,
    resetToSetup,
    viewArchivedMeeting,
    viewArchiveList,
    deleteFromArchive,
    updateSettings,
    updateBrother,
    addBrother,
    addBrothersBatch,
    removeBrother
  };
}
