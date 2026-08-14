import { useState, useEffect, useRef } from 'react';
import { MeetingState, MeetingPart, DEFAULT_PARTS, CongregationSettings, DEFAULT_BROTHERS, Role } from '../types';

export function useMeetingTimer() {
  const [settings, setSettings] = useState<CongregationSettings>(() => {
    const saved = localStorage.getItem('jw_stage_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      name: "Minha Congregação",
      defaultTime: "19:30",
      brothers: DEFAULT_BROTHERS
    };
  });

  useEffect(() => {
    localStorage.setItem('jw_stage_settings', JSON.stringify(settings));
  }, [settings]);

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
      const newBrothers = [...prev.brothers, { id: `br-${Date.now()}`, name, role }];
      return { ...prev, brothers: newBrothers.sort((a, b) => a.name.localeCompare(b.name)) };
    });
  };

  const [state, setState] = useState<MeetingState>({
    status: 'setup',
    parts: JSON.parse(JSON.stringify(DEFAULT_PARTS)),
    currentPartIndex: 0,
    isCounselPhase: false,
    timeBalance: 0,
    history: []
  });

  const [currentTimerSeconds, setCurrentTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickTimeRef = useRef<number | null>(null);

  // Setup functions
  const updatePart = (index: number, updates: Partial<MeetingPart>) => {
    setState(prev => {
      const newParts = [...prev.parts];
      newParts[index] = { ...newParts[index], ...updates };
      return { ...prev, parts: newParts };
    });
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
    setState(prev => ({
      ...prev,
      status: 'running',
      startTime: new Date(),
      currentPartIndex: 0,
      isCounselPhase: false,
      timeBalance: 0,
      history: []
    }));
    setTargetDurationSeconds(state.parts[0].plannedTime * 60);
    setCurrentTimerSeconds(state.parts[0].plannedTime * 60);
    setIsTimerRunning(false);
  };

  // Timer logic
  useEffect(() => {
    if (isTimerRunning) {
      lastTickTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = now - (lastTickTimeRef.current || now);
        lastTickTimeRef.current = now;
        
        setCurrentTimerSeconds(prev => prev - (delta / 1000));
      }, 100); // 100ms for smoother visual updates, though we display seconds
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const adjustTimer = (secondsDelta: number) => {
    setCurrentTimerSeconds(prev => prev + secondsDelta);
  };

  const nextPhase = () => {
    setIsTimerRunning(false);
    
    setState(prev => {
      const currentPart = prev.parts[prev.currentPartIndex];
      const newState = { ...prev };
      
      // Calculate actual time spent
      const actualTimeSpent = targetDurationSeconds - currentTimerSeconds;
      
      if (prev.isCounselPhase) {
        // Just finished counsel phase, move to next part
        // We don't log counsel time in history
        newState.isCounselPhase = false;
        newState.currentPartIndex++;
        
      } else {
        // Just finished a main part
        const overTime = actualTimeSpent - (currentPart.plannedTime * 60);
        newState.timeBalance += overTime;
        
        // Recalculate flexible parts
        if (overTime > 0) {
           let remainingOvertime = overTime;
           // First try to absorb from next flexible parts
           for (let i = prev.currentPartIndex + 1; i < newState.parts.length; i++) {
             if (newState.parts[i].flexible && remainingOvertime > 0) {
               // reduce time, but keep at least 1 min if possible
               const possibleReduction = Math.max(0, newState.parts[i].plannedTime * 60 - 60);
               const reduction = Math.min(possibleReduction, remainingOvertime);
               
               if (reduction > 0) {
                 // We don't actually change the plannedTime in the UI definition so history shows original,
                 // but we can adjust it for the running timer when we get there.
                 // Actually, the PRD says "O aplicativo recalcula e absorve o impacto reduzindo proporcionalmente o tempo planejado dos blocos flexíveis subsequentes".
                 newState.parts[i].plannedTime = parseFloat(((newState.parts[i].plannedTime * 60 - reduction) / 60).toFixed(1));
                 remainingOvertime -= reduction;
               }
             }
           }
        }
        
        // Add to history
        newState.history.push({
          partId: currentPart.id,
          title: currentPart.title,
          speaker: currentPart.speaker,
          assistant: currentPart.assistant,
          hideSpeaker: currentPart.hideSpeaker,
          plannedTime: currentPart.plannedTime,
          actualTime: actualTimeSpent,
          status: overTime > 15 ? 'Excedido' : overTime < -15 ? 'Abaixo do tempo' : 'No tempo'
        });

        if (currentPart.hasCounsel) {
          newState.isCounselPhase = true;
        } else {
          newState.currentPartIndex++;
        }
      }

      // Check if meeting ended
      if (newState.currentPartIndex >= newState.parts.length) {
        newState.status = 'history';
      } else {
        // Set next timer
        if (newState.isCounselPhase) {
          setTargetDurationSeconds(60);
          setCurrentTimerSeconds(60);
        } else {
          setTargetDurationSeconds(newState.parts[newState.currentPartIndex].plannedTime * 60);
          setCurrentTimerSeconds(newState.parts[newState.currentPartIndex].plannedTime * 60);
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
        newState.status = 'history';
      } else {
        setTargetDurationSeconds(newState.parts[newState.currentPartIndex].plannedTime * 60);
        setCurrentTimerSeconds(newState.parts[newState.currentPartIndex].plannedTime * 60);
      }
      return newState;
    });
  };

  const endMeeting = () => {
    setState(prev => ({...prev, status: 'history'}));
  };

  const resetToSetup = () => {
    setState(prev => ({
      ...prev,
      status: 'setup',
      parts: JSON.parse(JSON.stringify(DEFAULT_PARTS)),
    }));
  };

  return {
    state,
    settings,
    currentTimerSeconds,
    isTimerRunning,
    updatePart,
    addPart,
    removePart,
    startMeeting,
    toggleTimer,
    adjustTimer,
    nextPhase,
    skipCounsel,
    endMeeting,
    resetToSetup,
    updateSettings,
    updateBrother,
    addBrother,
    removeBrother
  };
}
