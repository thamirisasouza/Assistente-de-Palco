import React, { useEffect, useState } from 'react';
import { MeetingState, MeetingPart, TOTAL_PLANNED_MEETING_MINUTES } from '../types';
import { formatTime, cn, getBalanceColorClass, formatBalanceDisplay } from '../lib/utils';
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
  Info
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
  onConcludeMeeting: () => void;
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
  onConcludeMeeting,
  onEmergencyReset
}: MeetingStageProps) {
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAllPartsDone = state.currentPartIndex >= state.parts.length;
  const currentPart = state.parts[state.currentPartIndex] || state.parts[state.parts.length - 1];

  // Estimated end time calculation
  const remainingPlannedSeconds = state.parts
    .slice(state.currentPartIndex + (state.isCounselPhase ? 1 : 0))
    .reduce((sum, p) => sum + (p.plannedTime * 60) + (p.hasCounsel ? 60 : 0), 0);
  
  const totalRemainingSeconds = Math.max(0, currentTimerSeconds) + remainingPlannedSeconds;
  const estimatedEndTime = new Date(currentTime.getTime() + totalRemainingSeconds * 1000);
  
  const isWarning = !isAllPartsDone && currentTimerSeconds <= 60 && currentTimerSeconds > 0;
  const isOvertime = !isAllPartsDone && currentTimerSeconds <= 0 && isTimerRunning;

  // Standardized balance colors
  const balanceColors = getBalanceColorClass(state.timeBalance);

  // SVG Ring Progress calculations
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, progressPercent) / 100) * circumference;

  return (
    <div className={cn(
      "flex flex-col h-screen w-full bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-500",
      isWarning && "ring-4 ring-inset ring-amber-500/40",
      isOvertime && "ring-4 ring-inset ring-red-500/50"
    )}>
      {/* Top Bar (Estado sempre visível - RF04 / RF09) */}
      <header className="h-20 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-[#1E293B] shadow-sm shrink-0 z-20">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Relógio</span>
            <span className="text-xl md:text-2xl font-mono font-bold text-slate-800 dark:text-slate-100">
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

        {/* RF09: Anel de Progresso Central e Índice de Andamento */}
        <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="relative w-11 h-11 flex items-center justify-center">
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
            <span className="absolute text-[11px] font-mono font-bold text-slate-800 dark:text-slate-100">
              {progressPercent}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Andamento</span>
            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              {Math.round(state.totalElapsedSeconds / 60)} / {TOTAL_PLANNED_MEETING_MINUTES} min
            </span>
          </div>
        </div>

        {/* Saldo de Tempo Padronizado (Âmbar = Atrasado, Azul = Adiantado) */}
        <div className="flex items-center gap-4 text-right">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">
              Saldo da Reunião
            </span>
            <span className={cn(
              "text-xl md:text-2xl font-mono font-black tracking-tight",
              balanceColors.text
            )}>
              {formatBalanceDisplay(state.timeBalance)}
            </span>
          </div>
          
          <button 
            onClick={() => setShowExitConfirmModal(true)} 
            className="h-11 w-11 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            title="Opções de Saída"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* RF09: Barra de Progresso Segmentada por Parte (Sempre Visível) */}
      <div className="bg-slate-100 dark:bg-[#1E293B]/60 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-2.5 shrink-0">
        <div className="flex items-center gap-1.5 w-full">
          {state.parts.map((p, idx) => {
            const recorded = state.history.find(h => h.id === p.id);
            const isCompleted = idx < state.currentPartIndex || (isAllPartsDone && idx < state.parts.length);
            const isCurrent = !isAllPartsDone && idx === state.currentPartIndex;

            let segmentColor = "bg-slate-300 dark:bg-slate-700 opacity-50"; // Pendente
            if (isCompleted) {
              if (recorded?.status === 'Excedido') {
                segmentColor = "bg-amber-500"; // Atraso (Âmbar)
              } else if (recorded?.status === 'Abaixo do tempo') {
                segmentColor = "bg-sky-500"; // Adiantado (Azul)
              } else {
                segmentColor = "bg-emerald-500"; // No tempo (Verde)
              }
            } else if (isCurrent) {
              segmentColor = "bg-[#295E9F] dark:bg-[#4A6CA7] ring-2 ring-sky-400 ring-offset-1 dark:ring-offset-slate-900 animate-pulse";
            }

            return (
              <div 
                key={p.id}
                title={`${p.title} (${p.plannedTime}m)${recorded ? ` - ${recorded.status}` : isCurrent ? ' (Em andamento)' : ''}`}
                className={cn(
                  "h-2.5 flex-1 rounded-full transition-all duration-300",
                  segmentColor
                )}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          <span>Parte {Math.min(state.parts.length, state.currentPartIndex + 1)} de {state.parts.length}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> No tempo</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Atrasado</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500"></span> Adiantado</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">
        
        {/* Left Sidebar: Agenda com Status em Tempo Real */}
        <aside className="hidden md:flex col-span-3 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0F172A]/40 flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Agenda S-38-T</h2>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {state.parts.length} partes
            </span>
          </div>
          
          <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {state.parts.map((part, index) => {
              const isPast = index < state.currentPartIndex;
              const isPresent = index === state.currentPartIndex && !isAllPartsDone;
              const historyItem = state.history.find(h => h.id === part.id);

              return (
                <div 
                  key={part.id} 
                  className={cn(
                    "p-3 rounded-xl border transition-all duration-200 flex flex-col gap-1",
                    isPresent && "bg-white dark:bg-[#1E293B] border-[#295E9F] dark:border-[#4A6CA7] shadow-md ring-1 ring-[#295E9F]/20",
                    isPast && "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-90",
                    !isPast && !isPresent && "border-transparent opacity-40 hover:opacity-60"
                  )}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate pr-2">
                      {part.title}
                    </span>
                    <span className="font-mono text-[11px] shrink-0 text-slate-500 dark:text-slate-400">
                      {part.plannedTime}m
                    </span>
                  </div>

                  {!part.hideSpeaker && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {part.speaker || "Sem orador"}
                      {part.assistant && <span className="text-slate-400 dark:text-slate-500"> c/ {part.assistant}</span>}
                    </div>
                  )}

                  {isPast && historyItem && (
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] font-mono">
                      <span className="text-slate-500 dark:text-slate-400">
                        Real: {formatTime(historyItem.actualTime)}
                      </span>
                      <span className={cn(
                        "font-bold uppercase",
                        historyItem.status === 'Excedido' ? "text-amber-500 dark:text-amber-400" :
                        historyItem.status === 'Abaixo do tempo' ? "text-sky-500 dark:text-sky-400" :
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
        </aside>

        {/* Center Stage: Cronômetro Gigante & Informações de Palco */}
        <section className={cn(
          "col-span-1 md:col-span-6 flex flex-col items-center justify-center p-6 md:p-8 relative overflow-hidden transition-colors",
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
                  A programação foi finalizada. Clique no botão abaixo para encerrar a reunião e gerar o relatório imutável para a congregação.
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
                <div className="text-center space-y-2 mb-6 md:mb-8">
                  <div className={cn(
                    "px-4 py-1.5 border rounded-full text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2",
                    state.isCounselPhase 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                      : "bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] border-[#295E9F]/30"
                  )}>
                    {state.isCounselPhase ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Fase de Elogio / Conselho (1 min)
                      </>
                    ) : (
                      <>Parte {state.currentPartIndex + 1} de {state.parts.length}</>
                    )}
                  </div>

                  <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                    {state.isCounselPhase ? "Elogio e Conselho" : currentPart.title}
                  </h1>

                  {!currentPart.hideSpeaker && (
                    <p className="text-lg md:text-2xl text-slate-600 dark:text-slate-300 font-medium">
                      {currentPart.speaker || "Sem orador designado"}
                      {currentPart.assistant && (
                        <span className="text-slate-500 dark:text-slate-400 font-normal"> c/ {currentPart.assistant}</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Mostrador Numérico Extra-Bold */}
                <div className="relative my-2">
                  <div className={cn(
                    "text-[80px] sm:text-[110px] md:text-[150px] font-mono leading-none tracking-tighter font-black flex items-baseline select-none transition-colors",
                    isOvertime ? "text-red-500 animate-pulse" : isWarning ? "text-amber-500 dark:text-amber-400" : "text-slate-900 dark:text-white"
                  )}>
                    {formatTime(currentTimerSeconds)}
                  </div>
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mt-2">
                    {currentTimerSeconds >= 0 ? "Tempo Restante da Parte" : "Tempo Excedido da Parte"}
                  </div>
                </div>

                {/* Botões de Ajuste Manual de Toque Amplo (≥56px) */}
                <div className="mt-6 flex gap-3 z-20">
                  <button 
                    onClick={() => onAdjustTimer(-60)} 
                    className="min-h-[48px] min-w-[56px] px-3 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all"
                    title="Diminuir 1 minuto"
                  >
                    -1m
                  </button>
                  <button 
                    onClick={() => onAdjustTimer(-15)} 
                    className="min-h-[48px] min-w-[56px] px-3 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all"
                    title="Diminuir 15 segundos"
                  >
                    -15s
                  </button>
                  <button 
                    onClick={() => onAdjustTimer(15)} 
                    className="min-h-[48px] min-w-[56px] px-3 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all"
                    title="Aumentar 15 segundos"
                  >
                    +15s
                  </button>
                  <button 
                    onClick={() => onAdjustTimer(60)} 
                    className="min-h-[48px] min-w-[56px] px-3 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-mono text-sm font-bold border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all"
                    title="Aumentar 1 minuto"
                  >
                    +1m
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        {/* Right Sidebar: Métricas e Próxima Transição */}
        <aside className="hidden md:flex col-span-3 border-l border-slate-200 dark:border-slate-800 flex-col bg-white/50 dark:bg-[#0F172A]/40 p-5 space-y-6 justify-between">
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
                    {isOvertime ? "Atrasado" : isWarning ? "Atenção" : "No Tempo"}
                  </div>
                </div>
              </div>
            </div>

            {/* Próxima Transição */}
            {state.currentPartIndex + 1 < state.parts.length && !state.isCounselPhase && (
              <div>
                <h3 className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                  Próxima Transição
                </h3>
                <div className="bg-white dark:bg-[#1E293B] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] rounded text-[11px] font-mono font-bold">
                      {state.parts[state.currentPartIndex + 1].plannedTime}m
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                      {state.parts[state.currentPartIndex + 1].title}
                    </span>
                  </div>
                  {!state.parts[state.currentPartIndex + 1].hideSpeaker && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {state.parts[state.currentPartIndex + 1].speaker || "Sem orador designado"}
                      {state.parts[state.currentPartIndex + 1].assistant && ` c/ ${state.parts[state.currentPartIndex + 1].assistant}`}
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

      {/* RF03 & Princípio 2: Botão Primário Inteligente (Altura ≥ 56px, Maior Elemento da Tela) */}
      <footer className="h-24 md:h-28 bg-white dark:bg-[#1E293B] border-t border-slate-200 dark:border-slate-800 p-4 flex gap-4 shrink-0 z-30 shadow-lg">
        {isAllPartsDone ? (
          /* Botão Final de Encerramento (RF08) */
          <button 
            onClick={() => setShowEndConfirmModal(true)}
            className="flex-1 min-h-[56px] bg-[#295E9F] hover:bg-[#3474C2] text-white transition-all rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-[#295E9F]/30 active:scale-[0.99] cursor-pointer"
          >
            <CheckCheck className="w-7 h-7" />
            <span className="text-xl md:text-2xl font-black tracking-wider uppercase truncate">
              ENCERRAR REUNIÃO E GRAVAR HISTÓRICO
            </span>
          </button>
        ) : !isTimerRunning ? (
          /* Botão Iniciar Cronômetro */
          <button 
            onClick={onToggleTimer}
            className="flex-1 min-h-[56px] bg-[#295E9F] hover:bg-[#3474C2] text-white transition-all rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-[#295E9F]/30 active:scale-[0.99] cursor-pointer"
          >
            <Play className="w-7 h-7 fill-current" />
            <span className="text-xl md:text-2xl font-black tracking-wider uppercase truncate">
              INICIAR {state.isCounselPhase ? "CONSELHO" : "PARTE"}
            </span>
          </button>
        ) : state.isCounselPhase ? (
          /* Botão Concluir Conselho com Opção de Pular */
          <>
            <button 
              onClick={onNextPhase}
              className="flex-[2] min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white transition-all rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/30 active:scale-[0.99] cursor-pointer"
            >
              <CheckCircle2 className="w-7 h-7 shrink-0" />
              <span className="text-xl md:text-2xl font-black tracking-wider uppercase truncate">
                CONCLUIR CONSELHO
              </span>
            </button>
            <button 
              onClick={onSkipCounsel}
              className="flex-1 min-h-[56px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all rounded-2xl flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
            >
              <SkipForward className="w-5 h-5 shrink-0" />
              <span className="text-sm md:text-base font-bold uppercase tracking-wider truncate">
                Pular Elogio
              </span>
            </button>
          </>
        ) : (
          /* Botão Concluir Parte */
          <button 
            onClick={onNextPhase}
            className="flex-1 min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white transition-all rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/30 active:scale-[0.99] cursor-pointer"
          >
            <CheckCircle2 className="w-7 h-7" />
            <span className="text-xl md:text-2xl font-black tracking-wider uppercase truncate">
              CONCLUIR PARTE
            </span>
          </button>
        )}
      </footer>

      {/* RF08: Modal de Confirmação Única de Encerramento */}
      {showEndConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] rounded-2xl flex items-center justify-center mx-auto">
              <CheckCheck className="w-8 h-8" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Encerrar Reunião?
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Esta ação finalizará a sessão ao vivo e gravará o histórico imutável com todos os tempos e oradores para consulta do Superintendente.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  setShowEndConfirmModal(false);
                  onConcludeMeeting();
                }}
                className="w-full min-h-[56px] bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-lg rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Sim, Gravar e Exibir Resumo
              </button>
              <button
                onClick={() => setShowEndConfirmModal(false)}
                className="w-full min-h-[48px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl transition-all"
              >
                Voltar ao Palco
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Saída / Encerramento de Emergência */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Opções da Reunião
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Você pode encerrar a reunião agora gravando o histórico das partes já feitas ou descartar esta sessão.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  setShowExitConfirmModal(false);
                  onConcludeMeeting();
                }}
                className="w-full min-h-[52px] bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-base rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                Encerrar e Gravar Progresso Atual
              </button>
              <button
                onClick={() => {
                  setShowExitConfirmModal(false);
                  onEmergencyReset();
                }}
                className="w-full min-h-[52px] bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 font-bold text-base rounded-2xl border border-red-500/30 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Descartar Sessão e Voltar ao Início
              </button>
              <button
                onClick={() => setShowExitConfirmModal(false)}
                className="w-full min-h-[48px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl transition-all"
              >
                Continuar Reunião
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
