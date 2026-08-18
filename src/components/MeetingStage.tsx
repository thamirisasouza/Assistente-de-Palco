import React, { useEffect, useState, useRef } from 'react';
import { MeetingState, MeetingPart, TOTAL_PLANNED_MEETING_MINUTES } from '../types';
import { formatTime, cn, getBalanceColorClass, formatBalanceDisplay } from '../lib/utils';
import { getPartSection, SECTIONS, groupPartsBySection } from '../lib/sectionColors';
import { safeStorage } from '../lib/storage';
import { 
  requestScreenWakeLock, 
  releaseScreenWakeLock, 
  playAlertTone, 
  safeVibrate, 
  toggleFullscreen 
} from '../lib/mobileCompat';
import { 
  Play, 
  CheckCircle2, 
  SkipForward, 
  AlertTriangle, 
  Clock, 
  CheckCheck,
  X,
  RotateCcw,
  Sparkles,
  Info,
  Flag,
  BookOpen,
  Users,
  HeartHandshake,
  Music,
  PauseCircle,
  ArrowLeft,
  ArrowUpDown,
  ArrowRight,
  ListOrdered,
  Volume2,
  VolumeX,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MeetingStageProps {
  state: MeetingState;
  currentTimerSeconds: number;
  isTimerRunning: boolean;
  progressPercent: number;
  onToggleTimer: () => void;
  onAdjustTimer: (delta: number) => void;
  onNextPhase: () => void;
  onSkipCounsel: () => void;
  onJumpToPart?: (targetIndex: number) => void;
  onConcludeMeeting: () => void;
  onPauseAndExit?: () => void;
  onEmergencyReset: () => void;
}

export function MeetingStage({ 
  state, 
  currentTimerSeconds, 
  isTimerRunning, 
  progressPercent,
  onToggleTimer, 
  onAdjustTimer,
  onNextPhase,
  onSkipCounsel,
  onJumpToPart,
  onConcludeMeeting,
  onPauseAndExit,
  onEmergencyReset
}: MeetingStageProps) {
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [showPartsOrderModal, setShowPartsOrderModal] = useState(false);
  const [partToJump, setPartToJump] = useState<{ index: number; part: MeetingPart } | null>(null);
  
  // Preferência de alertas sonoros suaves (persistida com segurança)
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    return safeStorage.getItem('jw_stage_sound_alert') !== 'false';
  });

  const prevSecondsRef = useRef(currentTimerSeconds);

  // Mantém a tela acesa (Wake Lock) durante toda a reunião no palco
  useEffect(() => {
    requestScreenWakeLock().catch(() => {});
    return () => {
      releaseScreenWakeLock().catch(() => {});
    };
  }, []);

  // Alertas sonoros e táteis automáticos nos momentos críticos (60s e tempo esgotado)
  useEffect(() => {
    const prev = prevSecondsRef.current;
    prevSecondsRef.current = currentTimerSeconds;

    if (!isTimerRunning) return;

    // Alerta de 1 minuto restante (cruzou de >60 para <=60)
    if (prev > 60 && currentTimerSeconds <= 60 && currentTimerSeconds > 0) {
      if (isSoundEnabled) {
        playAlertTone('warning');
      }
      safeVibrate([180, 100, 180]);
    }

    // Alerta de Tempo Esgotado (cruzou de >0 para <=0)
    if (prev > 0 && currentTimerSeconds <= 0) {
      if (isSoundEnabled) {
        playAlertTone('overtime');
      }
      safeVibrate([350]);
    }
  }, [currentTimerSeconds, isTimerRunning, isSoundEnabled]);

  const toggleSound = () => {
    setIsSoundEnabled(prev => {
      const next = !prev;
      safeStorage.setItem('jw_stage_sound_alert', String(next));
      if (next) {
        playAlertTone('bell');
        safeVibrate(100);
      }
      return next;
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAllPartsDone = state.parts.every(p => state.history.some(h => h.id === p.id)) || state.currentPartIndex >= state.parts.length;
  const currentPart = state.parts[state.currentPartIndex] || state.parts[state.parts.length - 1];

  // Seção ativa atual (com base nas cores e estrutura oficial do PDF S-38-T)
  const currentSection = getPartSection(currentPart, state.currentPartIndex);

  // Agrupamento de partes para a barra lateral
  const sectionGroups = groupPartsBySection(state.parts);

  // Partes que foram puladas/adiantadas e ficaram pendentes de retorno
  const highestTouchedIndex = Math.max(
    state.currentPartIndex,
    ...state.history.map(h => state.parts.findIndex(p => p.id === h.id))
  );

  const pendingParts = state.parts
    .map((p, index) => ({ part: p, index }))
    .filter(({ part, index }) => {
      const isCompleted = state.history.some(h => h.id === part.id);
      const isCurrent = !isAllPartsDone && index === state.currentPartIndex;
      return !isCompleted && !isCurrent && index < highestTouchedIndex;
    });

  // Próxima parte a ser executada no fluxo (primeira não concluída)
  let nextUncompletedIdx: number | null = null;
  for (let i = state.currentPartIndex + 1; i < state.parts.length; i++) {
    if (!state.history.some(h => h.id === state.parts[i].id)) {
      nextUncompletedIdx = i;
      break;
    }
  }
  if (nextUncompletedIdx === null) {
    for (let i = 0; i < state.currentPartIndex; i++) {
      if (!state.history.some(h => h.id === state.parts[i].id)) {
        nextUncompletedIdx = i;
        break;
      }
    }
  }
  const nextPart = nextUncompletedIdx !== null ? state.parts[nextUncompletedIdx] : null;

  // Cálculo de término previsto considerando partes restantes reais (não concluídas)
  const remainingPlannedSeconds = state.parts
    .filter(p => !state.history.some(h => h.id === p.id) && p.id !== currentPart?.id)
    .reduce((sum, p) => sum + (p.plannedTime * 60) + (p.hasCounsel ? 60 : 0), 0);
  
  const totalRemainingSeconds = Math.max(0, currentTimerSeconds) + remainingPlannedSeconds + (state.isCounselPhase ? 60 : 0);
  const estimatedEndTime = new Date(currentTime.getTime() + totalRemainingSeconds * 1000);
  
  const isWarning = !isAllPartsDone && currentTimerSeconds <= 60 && currentTimerSeconds > 0;
  const isOvertime = !isAllPartsDone && currentTimerSeconds <= 0 && isTimerRunning;

  // Cores padronizadas de saldo
  const balanceColors = getBalanceColorClass(state.timeBalance);

  // Cálculo SVG do Anel de Progresso
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, progressPercent) / 100) * circumference;

  return (
    <div className={cn(
      "flex flex-col h-screen-safe min-h-screen-safe w-full font-sans overflow-hidden transition-colors duration-500",
      isAllPartsDone
        ? "bg-emerald-50/70 dark:bg-[#062017] text-slate-900 dark:text-slate-100 ring-8 ring-inset ring-emerald-500/50"
        : "bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100",
      isWarning && "ring-4 ring-inset ring-amber-500/40",
      isOvertime && "ring-4 ring-inset ring-red-500/50"
    )}>
      
      {/* 1. Header Top Bar (Relógio, Andamento, Saldo, Som, Botão Finalizar e Botão Fechar Tela) */}
      <header className={cn(
        "h-20 border-b flex items-center justify-between px-3 sm:px-6 md:px-8 shadow-sm shrink-0 z-30 transition-colors pt-safe",
        isAllPartsDone
          ? "bg-emerald-100/60 dark:bg-[#0A2E22] border-emerald-500/30"
          : "bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-800"
      )}>
        
        {/* Esquerda: Relógio & Término Previsto */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Relógio</span>
            <span className="text-lg sm:text-2xl font-mono font-bold text-slate-800 dark:text-slate-100">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          
          <div className="flex flex-col hidden sm:flex">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Término Previsto</span>
            <span className="text-xl md:text-2xl font-mono font-bold text-slate-700 dark:text-slate-200">
              {estimatedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Centro: Anel de Progresso & Índice de Andamento */}
        <div className="flex items-center gap-2.5 sm:gap-3 px-2.5 sm:px-3 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r={radius}
                className="text-slate-300 dark:text-slate-700 stroke-current"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r={radius}
                className="text-[#295E9F] dark:text-[#4A6CA7] stroke-current transition-all duration-500 ease-out"
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="absolute text-[10px] sm:text-[11px] font-mono font-bold text-slate-800 dark:text-slate-100">
              {progressPercent}%
            </span>
          </div>
          <div className="flex flex-col hidden xs:flex">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Andamento</span>
            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              {Math.round(state.totalElapsedSeconds / 60)} / {TOTAL_PLANNED_MEETING_MINUTES} min
            </span>
          </div>
        </div>

        {/* Direita: Saldo de Tempo + Botão Som + Botão Ordem + Botão Finalizar + Fechar */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex flex-col items-end mr-1">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">
              Saldo
            </span>
            <span className={cn(
              "text-lg sm:text-2xl font-mono font-black tracking-tight",
              balanceColors.text
            )}>
              {formatBalanceDisplay(state.timeBalance)}
            </span>
          </div>

          {/* Botão de Som / Alerta Silencioso */}
          <button
            onClick={toggleSound}
            className={cn(
              "h-10 sm:h-11 w-10 sm:w-11 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 border",
              isSoundEnabled 
                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700" 
                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20"
            )}
            title={isSoundEnabled ? "Alertas sonoros ativados (Clique para silenciar)" : "Silencioso (Clique para ativar alertas)"}
            aria-label="Controle de Som"
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Botão de Ordem das Partes / Adiantar */}
          <button 
            onClick={() => setShowPartsOrderModal(true)} 
            className="h-10 sm:h-11 px-2 sm:px-3.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded-xl flex items-center gap-1.5 font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Ordem das Partes / Adiantar se alguém atrasou"
          >
            <ArrowUpDown className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="hidden md:inline">Ordem das Partes</span>
            <span className="md:hidden">Ordem</span>
          </button>

          {/* Botão de Finalizar Reunião (Sempre acessível para o presidente) */}
          <button 
            onClick={() => setShowEndConfirmModal(true)} 
            className="h-10 sm:h-11 px-2.5 sm:px-4 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl flex items-center gap-1.5 sm:gap-2 font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Finalizar Reunião e Gerar Relatório"
          >
            <Flag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden lg:inline">Finalizar Reunião</span>
            <span className="lg:hidden">Finalizar</span>
          </button>
          
          {/* Botão de Fechar Tela (Sair / Minimizar / Pausar) */}
          <button 
            onClick={() => setShowExitConfirmModal(true)} 
            className="h-10 sm:h-11 px-2.5 sm:px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-1.5 font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Fechar Tela / Opções de Saída"
          >
            <X className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </header>

      {/* 2. FAIXA COLORIDA DE SEÇÃO (Cores fiéis ao modelo do PDF da Apostila) */}
      <motion.div 
        layout
        initial={false}
        animate={{ backgroundColor: currentSection.color }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full px-4 sm:px-6 md:px-8 py-2 text-white shadow-md flex items-center justify-between z-20 shrink-0 border-b border-black/10 transition-colors"
        style={{ backgroundColor: currentSection.color }}
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
            {currentSection.id === 'tesouros' && <BookOpen className="w-4 h-4 text-white" />}
            {currentSection.id === 'ministerio' && <Users className="w-4 h-4 text-white" />}
            {currentSection.id === 'vida' && <HeartHandshake className="w-4 h-4 text-white" />}
            {currentSection.id === 'abertura' && <Music className="w-4 h-4 text-white" />}
          </div>
          <div className="flex items-baseline gap-2 truncate">
            <span className="text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-white drop-shadow-sm truncate">
              {currentSection.name}
            </span>
            <span className="hidden lg:inline-block text-[11px] text-white/85 font-medium truncate">
              — {currentSection.description}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold bg-black/25 px-2.5 py-0.5 rounded-full text-white backdrop-blur-sm border border-white/15 shadow-sm">
            {currentPart.partNumber != null ? (
              `Parte ${currentPart.partNumber} • ${currentSection.shortName}`
            ) : (
              currentSection.shortName
            )}
          </span>
        </div>
      </motion.div>

      {/* Banner de Atenção: Partes Pendentes (Irmão atrasou e foi pulada) */}
      {pendingParts.length > 0 && !isAllPartsDone && (
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border-b border-amber-500/40 px-3 sm:px-6 md:px-8 py-2 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 z-10 shrink-0 shadow-xs">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold truncate">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <span className="font-bold text-amber-800 dark:text-amber-300 shrink-0">
              Parte Pendente ({pendingParts.length}):
            </span>
            <span className="truncate text-slate-800 dark:text-slate-200">
              {pendingParts.map(p => `${p.part.partNumber != null ? `Parte ${p.part.partNumber}` : p.part.title}${p.part.speaker ? ` (${p.part.speaker})` : ''}`).join(', ')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pendingParts.map(({ part, index }) => (
              <button
                key={part.id}
                onClick={() => setPartToJump({ index, part })}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 animate-pulse"
                title="Clique para retornar e iniciar esta parte pendente"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Iniciar Pendente</span>
                <span className="sm:hidden">Retornar</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Barra de Progresso Segmentada por Parte */}
      <div className="bg-slate-100 dark:bg-[#1E293B]/60 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-2 shrink-0">
        <div className="flex items-center gap-1.5 w-full">
          {state.parts.map((p, idx) => {
            const recorded = state.history.find(h => h.id === p.id);
            const isCompleted = Boolean(recorded);
            const isCurrent = !isAllPartsDone && idx === state.currentPartIndex;
            const isPending = !isCompleted && !isCurrent && pendingParts.some(item => item.index === idx);
            const partSec = getPartSection(p, idx);

            let segmentClass = "bg-slate-300 dark:bg-slate-700 opacity-40 hover:opacity-75";
            let customStyle = {};

            if (isPending) {
              // PISCANDO PARA CLICAR AQUI E VOLTAR
              segmentClass = "bg-amber-500 ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-slate-900 animate-pulse shadow-md shadow-amber-500/50 scale-y-125 z-10";
            } else if (isCompleted) {
              if (recorded?.status === 'Excedido' || (recorded && recorded.actualTime > recorded.plannedTime * 60)) {
                segmentClass = "bg-red-500"; // Excedido (Vermelho)
              } else if (recorded?.status === 'Terminou antes do tempo') {
                segmentClass = "bg-sky-500"; // Abaixo do tempo (Azul)
              } else {
                segmentClass = "bg-emerald-500"; // No tempo correto (Verde)
              }
            } else if (isCurrent) {
              segmentClass = "ring-2 ring-white ring-offset-1 dark:ring-offset-slate-900 animate-pulse scale-y-110";
              customStyle = { backgroundColor: partSec.color };
            }

            return (
              <button 
                key={p.id}
                onClick={() => {
                  if (idx !== state.currentPartIndex) {
                    setPartToJump({ index: idx, part: p });
                  }
                }}
                title={
                  isPending 
                    ? `⚠️ PENDENTE: ${p.title} (${p.speaker || 'Sem orador'}) - Clique para retornar!` 
                    : `Parte ${p.partNumber || idx + 1}: ${p.title} (${p.plannedTime}m)${isCompleted ? ' (Concluída)' : ''} - Clique para ir`
                }
                style={customStyle}
                className={cn(
                  "h-2.5 flex-1 rounded-full transition-all duration-300 cursor-pointer focus:outline-none",
                  segmentClass
                )}
              />
            );
          })}
        </div>
      </div>

      {/* 4. Main Content Grid */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">
        
        {/* Left Sidebar: Agenda S-38-T com Seções Coloridas Idênticas ao PDF */}
        <aside className="hidden md:flex col-span-3 lg:col-span-3 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/40 flex-col overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-100/50 dark:bg-slate-800/30">
            <h2 className="text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> Agenda S-38-T
            </h2>
            <button
              onClick={() => setShowPartsOrderModal(true)}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ArrowUpDown className="w-3 h-3" /> Trocar Ordem
            </button>
          </div>
          
          <div className="flex-1 p-3 space-y-3 overflow-y-auto">
            {sectionGroups.map((group) => {
              const isGroupActive = group.parts.some(p => p.originalIndex === state.currentPartIndex);
              
              return (
                <div key={group.section.id} className="space-y-1.5">
                  {/* Faixa / Cabeçalho da Seção na Barra Lateral */}
                  <div 
                    className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider text-white flex items-center justify-between shadow-xs"
                    style={{ backgroundColor: group.section.color }}
                  >
                    <span className="truncate">{group.section.shortName}</span>
                    {isGroupActive && (
                      <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    )}
                  </div>

                  {/* Partes da Seção */}
                  <div className="space-y-1 pl-1">
                    {group.parts.map(({ part, originalIndex }) => {
                      const isCompleted = state.history.some(h => h.id === part.id);
                      const isPresent = originalIndex === state.currentPartIndex && !isAllPartsDone;
                      const isPending = !isCompleted && !isPresent && pendingParts.some(item => item.index === originalIndex);
                      const historyItem = state.history.find(h => h.id === part.id);
                      const isClickable = !isPresent;

                      return (
                        <div 
                          key={part.id} 
                          onClick={() => {
                            if (isClickable) {
                              setPartToJump({ index: originalIndex, part });
                            }
                          }}
                          className={cn(
                            "p-2.5 rounded-xl border transition-all duration-200 flex flex-col gap-0.5 relative group",
                            isPresent && "bg-white dark:bg-[#1E293B] shadow-md ring-2",
                            isPending && "bg-amber-500/10 border-amber-500/60 ring-2 ring-amber-500/40 shadow-sm animate-pulse cursor-pointer",
                            isCompleted && "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-90 hover:opacity-100 cursor-pointer",
                            !isCompleted && !isPresent && !isPending && "bg-white/40 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-60 hover:opacity-100 hover:border-amber-500/50 hover:shadow-sm cursor-pointer"
                          )}
                          style={isPresent ? { borderColor: group.section.color, ringColor: `${group.section.color}40` } : {}}
                          title={isClickable ? (isPending ? "⚠️ PARTE PENDENTE - Clique para iniciar agora" : "Clique para ir ou adiantar esta parte") : undefined}
                        >
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1.5 truncate pr-2">
                              {part.partNumber != null ? (
                                <span className={cn(
                                  "w-5 h-5 rounded-md font-mono font-black text-[10px] flex items-center justify-center shrink-0",
                                  isPending ? "bg-amber-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                )}>
                                  {part.partNumber}
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500 font-mono text-xs">
                                  •
                                </span>
                              )}
                              <span className={cn(
                                "font-bold truncate",
                                isPending ? "text-amber-800 dark:text-amber-300" :
                                isPresent ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                              )}>
                                {part.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {part.plannedTime}m
                              </span>
                              {isPending && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-extrabold uppercase">
                                  Pendente
                                </span>
                              )}
                              {!isPresent && !isCompleted && !isPending && (
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                  <ArrowRight className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>

                          {!part.hideSpeaker && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {part.speaker || "Sem orador"}
                              {part.assistant && <span className="text-slate-400 dark:text-slate-500"> c/ {part.assistant}</span>}
                            </div>
                          )}

                          {isCompleted && historyItem && (
                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] font-mono">
                              <span className="text-slate-500 dark:text-slate-400">
                                Real: {formatTime(historyItem.actualTime)}
                              </span>
                              <span className={cn(
                                "font-bold uppercase",
                                historyItem.status === 'Excedido' ? "text-amber-500 dark:text-amber-400" :
                                historyItem.status === 'Terminou antes do tempo' ? "text-sky-500 dark:text-sky-400" :
                                "text-emerald-500 dark:text-emerald-400"
                              )}>
                                {historyItem.status}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center Stage: Cronômetro Gigante & Informações de Palco */}
        <section className={cn(
          "col-span-1 md:col-span-9 lg:col-span-6 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden transition-colors",
          isOvertime ? "bg-red-500/5" : isWarning ? "bg-amber-500/5" : "bg-transparent"
        )}>
          {isAllPartsDone ? (
            /* Estado Final da Reunião */
            <div className="flex flex-col items-center text-center max-w-lg space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center border border-emerald-500/20 shadow-lg">
                <CheckCheck className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Todas as Partes Concluídas!
                </h1>
                <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base">
                  A programação foi finalizada com sucesso. Clique no botão abaixo para encerrar a reunião e gerar o relatório oficial e PDF.
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full grid grid-cols-2 gap-4 text-left">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Tempo Total</span>
                  <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">
                    {Math.round(state.totalElapsedSeconds / 60)} min
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Saldo Final</span>
                  <p className={cn("text-xl font-bold font-mono", balanceColors.text)}>
                    {formatBalanceDisplay(state.timeBalance)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Parte em Andamento */
            <AnimatePresence mode="wait">
              <motion.div 
                key={state.isCounselPhase ? 'counsel' : currentPart.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center text-center w-full max-w-2xl z-10"
              >
                <div className="text-center space-y-2 mb-4 sm:mb-6 md:mb-8">
                  {/* Badge de Identificação com a Cor Oficial da Seção */}
                  <div 
                    className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 shadow-sm text-white transition-colors"
                    style={{ backgroundColor: state.isCounselPhase ? '#059669' : currentSection.color }}
                  >
                    {state.isCounselPhase ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Fase de Elogio / Conselho (1 min)
                      </>
                    ) : (
                      <>
                        {currentPart.partNumber != null && (
                          <span className="bg-black/25 px-2 py-0.5 rounded-md font-mono font-black text-xs">
                            Nº {currentPart.partNumber}
                          </span>
                        )}
                        <span>{currentSection.shortName}</span>
                      </>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight px-2">
                    {state.isCounselPhase ? "Elogio e Conselho" : currentPart.title}
                  </h1>

                  {!currentPart.hideSpeaker && (
                    <p className="text-base sm:text-xl md:text-2xl text-slate-600 dark:text-slate-300 font-medium">
                      {currentPart.speaker || "Sem orador designado"}
                      {currentPart.assistant && (
                        <span className="text-slate-500 dark:text-slate-400 font-normal"> c/ {currentPart.assistant}</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Mostrador Numérico Extra-Bold */}
                <div className="relative my-1 sm:my-2">
                  <div className={cn(
                    "text-[72px] xs:text-[90px] sm:text-[120px] md:text-[145px] font-mono leading-none tracking-tighter font-black flex items-baseline justify-center select-none transition-colors",
                    isOvertime ? "text-red-500 animate-pulse" : isWarning ? "text-amber-500 dark:text-amber-400" : "text-slate-900 dark:text-white"
                  )}>
                    {formatTime(currentTimerSeconds)}
                  </div>
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mt-2">
                    {currentTimerSeconds >= 0 ? "Tempo Restante da Parte" : "Tempo Excedido da Parte"}
                  </div>
                </div>

                {/* Botões de Ajuste Manual de Toque Amplo */}
                <div className="mt-3 sm:mt-5 flex gap-2 sm:gap-3 z-20">
                  <button 
                    onClick={() => onAdjustTimer(-60)} 
                    className="min-h-[44px] sm:min-h-[48px] min-w-[50px] sm:min-w-[56px] px-3 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all cursor-pointer"
                    title="Diminuir 1 minuto"
                  >
                    -1m
                  </button>
                  <button 
                    onClick={() => onAdjustTimer(-15)} 
                    className="min-h-[44px] sm:min-h-[48px] min-w-[50px] sm:min-w-[56px] px-3 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all cursor-pointer"
                    title="Diminuir 15 segundos"
                  >
                    -15s
                  </button>
                  <button 
                    onClick={() => onAdjustTimer(15)} 
                    className="min-h-[44px] sm:min-h-[48px] min-w-[50px] sm:min-w-[56px] px-3 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all cursor-pointer"
                    title="Aumentar 15 segundos"
                  >
                    +15s
                  </button>
                  <button 
                    onClick={() => onAdjustTimer(60)} 
                    className="min-h-[44px] sm:min-h-[48px] min-w-[50px] sm:min-w-[56px] px-3 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all cursor-pointer"
                    title="Aumentar 1 minuto"
                  >
                    +1m
                  </button>
                </div>

                {/* Botão de Atalho para Irmão Atrasado / Trocar de Parte */}
                <button
                  onClick={() => setShowPartsOrderModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Irmão atrasou? Adiantar outra parte</span>
                </button>
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        {/* Right Sidebar: Métricas e Próxima Transição */}
        <aside className="hidden lg:flex col-span-3 border-l border-slate-200 dark:border-slate-800 flex-col bg-white/50 dark:bg-[#0F172A]/40 p-5 space-y-6 justify-between">
          <div className="space-y-6">
            <div>
              <h3 className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                Métricas Desta Parte
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-[#1E293B] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Planejado</div>
                  <div className="text-lg font-mono font-bold text-slate-800 dark:text-slate-200">
                    {state.isCounselPhase ? "1 min" : `${currentPart?.plannedTime || 5} min`}
                  </div>
                </div>
                <div className="bg-white dark:bg-[#1E293B] p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Ritmo Atual</div>
                  <div className={cn(
                    "text-lg font-mono font-bold",
                    isOvertime ? "text-red-500" : isWarning ? "text-amber-500" : "text-emerald-500"
                  )}>
                    {isOvertime ? "Excedido" : isWarning ? "Atenção" : "No tempo correto"}
                  </div>
                </div>
              </div>
            </div>

            {/* Próxima Transição Inteligente */}
            {nextPart && !state.isCounselPhase && (
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">
                    Próxima Transição
                  </h3>
                  {nextUncompletedIdx !== null && (
                    <button
                      onClick={() => {
                        setPartToJump({ index: nextUncompletedIdx!, part: nextPart });
                      }}
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      Adiantar <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                <div className="bg-white dark:bg-[#1E293B] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    {nextPart.partNumber != null && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-mono font-black border border-slate-300 dark:border-slate-700">
                        Nº {nextPart.partNumber}
                      </span>
                    )}
                    <span 
                      className="px-2 py-0.5 text-white rounded text-[11px] font-mono font-bold"
                      style={{ backgroundColor: getPartSection(nextPart, nextUncompletedIdx || 0).color }}
                    >
                      {nextPart.plannedTime}m
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                      {nextPart.title}
                    </span>
                  </div>
                  {!nextPart.hideSpeaker && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {nextPart.speaker || "Sem orador designado"}
                      {nextPart.assistant && ` c/ ${nextPart.assistant}`}
                    </p>
                  )}
                  {pendingParts.some(p => p.index === state.currentPartIndex) && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold pt-1 border-t border-slate-200 dark:border-slate-800">
                      Retomando a ordem normal após concluir esta parte pendente.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Compliance S-38-T */}
          <div className="p-3 bg-slate-100 dark:bg-[#1E293B]/60 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              S-38-T Edição 8/26
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Alarme silencioso e absorção automática
            </div>
          </div>
        </aside>
      </main>

      {/* 5. Footer: Botão Primário Inteligente (Altura ≥ 56px, Maior Elemento da Tela, Safe-Area Resiliente) */}
      <footer className="min-h-24 md:min-h-28 bg-white dark:bg-[#1E293B] border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 pb-safe flex gap-2 sm:gap-4 shrink-0 z-30 shadow-lg">
        {isAllPartsDone ? (
          /* Botão Final de Encerramento */
          <button 
            onClick={() => setShowEndConfirmModal(true)}
            className="flex-1 min-h-[52px] sm:min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white transition-all rounded-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-emerald-600/30 active:scale-[0.99] cursor-pointer"
          >
            <CheckCheck className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            <span className="text-base sm:text-2xl font-black tracking-wider uppercase truncate">
              ENCERRAR REUNIÃO E GRAVAR HISTÓRICO
            </span>
          </button>
        ) : !isTimerRunning ? (
          /* Botão Iniciar Cronômetro com Efeito Piscante */
          <button 
            onClick={onToggleTimer}
            className="flex-1 min-h-[52px] sm:min-h-[56px] bg-[#295E9F] hover:bg-[#3474C2] text-white transition-all rounded-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-[#295E9F]/30 active:scale-[0.99] cursor-pointer animate-pulse-attention"
          >
            <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current animate-pulse shrink-0" />
            <span className="text-base sm:text-2xl font-black tracking-wider uppercase truncate">
              INICIAR {state.isCounselPhase ? "CONSELHO" : "PARTE"}
            </span>
          </button>
        ) : state.isCounselPhase ? (
          /* Botão Concluir Conselho com Opção de Pular */
          <>
            <button 
              onClick={onNextPhase}
              className="flex-[2] min-h-[52px] sm:min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white transition-all rounded-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-emerald-600/30 active:scale-[0.99] cursor-pointer"
            >
              <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
              <span className="text-sm sm:text-2xl font-black tracking-wider uppercase truncate">
                CONCLUIR CONSELHO
              </span>
            </button>
            <button 
              onClick={onSkipCounsel}
              className="flex-1 min-h-[52px] sm:min-h-[56px] px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all rounded-2xl flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.99] cursor-pointer"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="text-xs sm:text-base font-bold uppercase tracking-wider truncate">
                Pular Elogio
              </span>
            </button>
          </>
        ) : (
          /* Botão Concluir Parte */
          <button 
            onClick={onNextPhase}
            className="flex-1 min-h-[52px] sm:min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white transition-all rounded-2xl flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-emerald-600/30 active:scale-[0.99] cursor-pointer"
          >
            <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            <span className="text-base sm:text-2xl font-black tracking-wider uppercase truncate">
              CONCLUIR PARTE
            </span>
          </button>
        )}
      </footer>

      {/* MODAL: Ordem das Partes & Adiantamento Flexível */}
      {showPartsOrderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ArrowUpDown className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Ordem das Partes
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecione qualquer parte para adiantar ou retornar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPartsOrderModal(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista com todas as partes agrupadas */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {sectionGroups.map((group) => (
                <div key={group.section.id} className="space-y-2">
                  <div 
                    className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: group.section.color }}
                  >
                    {group.section.name}
                  </div>

                  <div className="space-y-1.5 pl-1">
                    {group.parts.map(({ part, originalIndex }) => {
                      const isCompleted = state.history.some(h => h.id === part.id);
                      const isPresent = originalIndex === state.currentPartIndex && !isAllPartsDone;
                      const isPending = !isCompleted && !isPresent && pendingParts.some(item => item.index === originalIndex);
                      const historyItem = state.history.find(h => h.id === part.id);

                      return (
                        <div
                          key={part.id}
                          className={cn(
                            "p-3 rounded-2xl border transition-all flex items-center justify-between gap-3",
                            isPresent 
                              ? "bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/30" 
                              : isPending
                              ? "bg-amber-500/15 border-amber-500/50 ring-2 ring-amber-500/30"
                              : isCompleted
                              ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60"
                              : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:border-sky-500"
                          )}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            {part.partNumber != null ? (
                              <span className={cn(
                                "w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0",
                                isPending ? "bg-amber-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                              )}>
                                {part.partNumber}
                              </span>
                            ) : (
                              <span className="w-6 h-6 flex items-center justify-center shrink-0 text-slate-400 font-bold">•</span>
                            )}
                            <div className="truncate">
                              <p className={cn(
                                "text-sm font-bold truncate",
                                isPending ? "text-amber-800 dark:text-amber-300" :
                                isPresent ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white"
                              )}>
                                {part.title}
                              </p>
                              {!part.hideSpeaker && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {part.speaker || "Sem orador designado"}
                                  {part.assistant && ` c/ ${part.assistant}`}
                                </p>
                              )}
                              {isCompleted && historyItem && (
                                <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  ✓ Concluída em {formatTime(historyItem.actualTime)} ({historyItem.status})
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              {part.plannedTime}m
                            </span>
                            
                            {isPresent ? (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold">
                                Ativa
                              </span>
                            ) : isPending ? (
                              <button
                                onClick={() => {
                                  setShowPartsOrderModal(false);
                                  setPartToJump({ index: originalIndex, part });
                                }}
                                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm animate-pulse"
                              >
                                <RotateCcw className="w-3 h-3" /> Iniciar Pendente
                              </button>
                            ) : isCompleted ? (
                              <button
                                onClick={() => {
                                  setShowPartsOrderModal(false);
                                  setPartToJump({ index: originalIndex, part });
                                }}
                                className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" /> Reabrir
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowPartsOrderModal(false);
                                  setPartToJump({ index: originalIndex, part });
                                }}
                                className="px-3 py-1 rounded-lg bg-[#295E9F] hover:bg-[#3474C2] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                              >
                                <Play className="w-3 h-3 fill-current" /> Iniciar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação de Troca/Adiantamento de Parte */}
      {partToJump && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20 shadow-xs">
              <ArrowUpDown className="w-7 h-7" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Adiantar / Trocar Parte
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                O cronômetro passará imediatamente para esta parte. Você poderá retornar à parte anterior a qualquer momento.
              </p>
            </div>

            {/* Card com Detalhes da Parte Selecionada */}
            <div className="p-4 bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div 
                className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold text-white uppercase"
                style={{ backgroundColor: getPartSection(partToJump.part, partToJump.index).color }}
              >
                {getPartSection(partToJump.part, partToJump.index).name}
              </div>

              <div className="font-bold text-base text-slate-900 dark:text-white">
                {partToJump.part.partNumber != null && `Parte ${partToJump.part.partNumber} • `}
                {partToJump.part.title}
              </div>

              {!partToJump.part.hideSpeaker && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Orador:</span> {partToJump.part.speaker || "Sem orador designado"}
                  {partToJump.part.assistant && ` • Ajudante: ${partToJump.part.assistant}`}
                </div>
              )}

              <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 flex justify-between">
                <span>Duração prevista:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{partToJump.part.plannedTime} minutos</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => {
                  if (onJumpToPart) {
                    onJumpToPart(partToJump.index);
                  }
                  setPartToJump(null);
                }}
                className="w-full min-h-[50px] bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Iniciar Esta Parte Agora
              </button>
              <button
                onClick={() => setPartToJump(null)}
                className="w-full min-h-[46px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-2xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Confirmação de Finalizar Reunião */}
      {showEndConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-xs">
              <Flag className="w-8 h-8" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Finalizar Reunião Agora?
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Esta ação encerrará a reunião, gravará o histórico imutável das partes realizadas e abrirá o relatório com opção de exportar em PDF.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Partes Concluídas:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {state.history.length} de {state.parts.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tempo Decorrido:</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {Math.round(state.totalElapsedSeconds / 60)} min
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Saldo Atual:</span>
                <span className={cn("font-bold font-mono", balanceColors.text)}>
                  {formatBalanceDisplay(state.timeBalance)}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <button
                onClick={() => {
                  setShowEndConfirmModal(false);
                  onConcludeMeeting();
                }}
                className="w-full min-h-[52px] bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCheck className="w-5 h-5" /> Sim, Gravar e Exibir Resumo
              </button>
              <button
                onClick={() => setShowEndConfirmModal(false)}
                className="w-full min-h-[48px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl transition-all cursor-pointer"
              >
                Continuar Reunião
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Fechar Tela / Opções de Saída */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl flex items-center justify-center mx-auto border border-slate-200 dark:border-slate-700">
              <X className="w-8 h-8" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Fechar Tela da Reunião
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Escolha como deseja proceder com a sessão atual:
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Opção 1: Pausar e Voltar à Programação */}
              {onPauseAndExit && (
                <button
                  onClick={() => {
                    setShowExitConfirmModal(false);
                    onPauseAndExit();
                  }}
                  className="w-full min-h-[50px] p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-2xl border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PauseCircle className="w-4 h-4 text-sky-500" />
                  Pausar e Voltar à Programação
                </button>
              )}

              {/* Opção 2: Finalizar Reunião Agora */}
              <button
                onClick={() => {
                  setShowExitConfirmModal(false);
                  onConcludeMeeting();
                }}
                className="w-full min-h-[50px] p-3 bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                Finalizar Reunião e Gravar Relatório
              </button>

              {/* Opção 3: Descartar Sessão */}
              <button
                onClick={() => {
                  setShowExitConfirmModal(false);
                  onEmergencyReset();
                }}
                className="w-full min-h-[46px] p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold text-xs rounded-2xl border border-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Descartar Sessão e Limpar
              </button>

              {/* Opção 4: Cancelar / Continuar */}
              <button
                onClick={() => setShowExitConfirmModal(false)}
                className="w-full min-h-[44px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium text-xs transition-all cursor-pointer pt-1"
              >
                Voltar para o Palco
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
