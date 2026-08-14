import React, { useEffect, useState } from 'react';
import { MeetingState, MeetingPart } from '../types';
import { formatTime, cn } from '../lib/utils';
import { Play, CheckCircle2, Clock, SkipForward, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MeetingStageProps {
  state: MeetingState;
  currentTimerSeconds: number;
  isTimerRunning: boolean;
  onToggleTimer: () => void;
  onAdjustTimer: (delta: number) => void;
  onNextPhase: () => void;
  onSkipCounsel: () => void;
  onEndMeeting: () => void;
}

export function MeetingStage({ 
  state, 
  currentTimerSeconds, 
  isTimerRunning, 
  onToggleTimer, 
  onAdjustTimer,
  onNextPhase,
  onSkipCounsel,
  onEndMeeting
}: MeetingStageProps) {
  
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentPart = state.parts[state.currentPartIndex];
  
  if (!currentPart && state.status === 'running') {
     // Failsafe
     onEndMeeting();
     return null;
  }

  // Calculate estimated end time
  const remainingPlannedSeconds = state.parts
    .slice(state.currentPartIndex + (state.isCounselPhase ? 1 : 0))
    .reduce((sum, p) => sum + (p.plannedTime * 60) + (p.hasCounsel ? 60 : 0), 0);
  
  const totalRemainingSeconds = currentTimerSeconds + remainingPlannedSeconds;
  
  const estimatedEndTime = new Date(currentTime.getTime() + totalRemainingSeconds * 1000);
  
  const isWarning = currentTimerSeconds <= 60 && currentTimerSeconds > 0;
  const isOvertime = currentTimerSeconds <= 0;

  // Determine button state
  const buttonState = !isTimerRunning ? 'start' : state.isCounselPhase ? 'counsel' : 'running';

  return (
    <div className={cn(
      "flex flex-col h-screen w-full bg-slate-50 dark:bg-[#0F172A] text-slate-100 font-sans overflow-hidden transition-colors duration-1000",
      isWarning && "border-t-4 border-amber-500",
      isOvertime && "border-t-4 border-red-500/50"
    )}>
      {/* Top Bar */}
      <header className="h-20 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-[#1E293B] shadow-lg shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Relógio</span>
            <span className="text-xl md:text-2xl font-mono font-medium">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="h-8 w-[1px] bg-slate-700 hidden md:block"></div>
          <div className="flex flex-col hidden md:flex">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Término Previsto</span>
            <span className="text-2xl font-mono font-medium">
              {estimatedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center hidden md:flex">
          <div className="text-[11px] uppercase tracking-widest text-[#4A6CA7] font-bold mb-1">Assistente de Palco — V.1.0</div>
          <div className="h-1 w-48 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#4A6CA7] shadow-[0_0_10px_#4A6CA7] transition-all duration-1000" 
              style={{ width: `${Math.max(0, Math.min(100, (state.currentPartIndex / Math.max(1, state.parts.length)) * 100))}%` }}
            ></div>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6 text-right">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold font-mono">Saldo Total</span>
            <span className={cn(
              "text-xl md:text-2xl font-mono font-bold",
              state.timeBalance > 15 ? "text-red-400" : state.timeBalance < -15 ? "text-emerald-400" : "text-sky-400"
            )}>
              {state.timeBalance > 0 ? '+' : ''}{formatTime(state.timeBalance)}
            </span>
          </div>
          <button 
            onClick={onEndMeeting} 
            className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors"
            title="Encerrar Reunião"
          >
            <div className="w-4 h-4 border-2 border-slate-400 rounded-sm"></div>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">
        <aside className="hidden md:flex col-span-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A]/50 flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-900/30 shrink-0">
            <h2 className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Agenda da Reunião</h2>
          </div>
          <div className="flex-1 p-2 space-y-1 overflow-y-auto opacity-90">
            {state.parts.map((part, index) => {
              let statusClass = "p-3 border-l-4 flex flex-col transition-colors ";
              let statusTitle = "";
              if (index < state.currentPartIndex) {
                statusClass += "bg-emerald-500/10 border-emerald-500 rounded";
                statusTitle = "Concluído";
              } else if (index === state.currentPartIndex) {
                statusClass += "bg-white dark:bg-[#1E293B] border-[#4A6CA7] rounded ring-1 ring-[#4A6CA7]/30";
                statusTitle = "Em Execução";
              } else {
                statusClass += "border-transparent opacity-40";
              }
              return (
                <div key={part.id} className={statusClass}>
                  {(index <= state.currentPartIndex) && (
                    <div className="flex justify-between items-start">
                      <span className={cn("text-[10px] font-bold uppercase", index < state.currentPartIndex ? "text-emerald-400" : "text-[#4A6CA7]")}>
                        {statusTitle}
                      </span>
                      <span className="text-[10px] font-mono">{part.plannedTime}:00</span>
                    </div>
                  )}
                  {(index > state.currentPartIndex) && (
                    <span className="text-[10px] font-mono mb-1">{part.plannedTime}:00</span>
                  )}
                  <span className={cn("text-sm", index === state.currentPartIndex ? "font-bold text-white" : "font-medium")}>
                    {part.title}
                  </span>
                  {!part.hideSpeaker && (
                    <span className={cn("text-xs", index === state.currentPartIndex ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400")}>
                      {part.speaker || "Sem orador designado"}
                      {part.assistant && ` c/ ${part.assistant}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <section className={cn(
          "col-span-1 md:col-span-6 flex flex-col items-center justify-center p-8 relative overflow-hidden transition-colors",
          isOvertime ? "bg-red-950/10" : isWarning ? "bg-amber-950/10" : "bg-[#020617]"
        )}>
          <AnimatePresence mode="wait">
            <motion.div 
              key={state.isCounselPhase ? 'counsel' : currentPart.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center w-full max-w-2xl z-10"
            >
              <div className="text-center space-y-2 mb-8">
                <div className={cn(
                  "px-4 py-1 border rounded-full text-xs font-bold uppercase tracking-widest inline-block",
                  state.isCounselPhase ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-[#4A6CA7]/10 text-[#4A6CA7] border-[#4A6CA7]/20"
                )}>
                  {state.isCounselPhase ? "Fase de Elogio / Conselho" : "Parte em Andamento"}
                </div>
                <h1 className="text-3xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white leading-tight">
                  {state.isCounselPhase ? "Elogio e Conselho" : currentPart.title}
                </h1>
                {!currentPart.hideSpeaker && (
                  <p className="text-xl text-slate-500 dark:text-slate-400 font-medium">
                    {currentPart.speaker || "Sem orador designado"}
                    {currentPart.assistant && <span className="text-slate-500 text-lg"> c/ {currentPart.assistant}</span>}
                  </p>
                )}
              </div>

              <div className="relative">
                <div className={cn(
                  "text-[100px] md:text-[180px] font-mono leading-none tracking-tighter font-bold flex items-baseline transition-colors",
                  isOvertime ? "text-red-500" : isWarning ? "text-amber-400" : "text-slate-900 dark:text-white"
                )}>
                  {formatTime(currentTimerSeconds)}
                </div>
                <div className="absolute -right-16 top-1/2 -translate-y-1/2 rotate-90 text-[10px] tracking-[0.3em] font-bold text-slate-600 uppercase whitespace-nowrap hidden lg:block">
                  Tempo Restante
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Manual adjustments */}
          <div className="absolute bottom-8 flex gap-4 opacity-30 hover:opacity-100 transition-opacity z-20">
             <button onClick={() => onAdjustTimer(-60)} className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:bg-slate-800 font-mono text-xs md:text-sm border border-slate-200 dark:border-slate-800 transition-colors">-1m</button>
             <button onClick={() => onAdjustTimer(-15)} className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:bg-slate-800 font-mono text-xs md:text-sm border border-slate-200 dark:border-slate-800 transition-colors">-15s</button>
             <button onClick={() => onAdjustTimer(15)} className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:bg-slate-800 font-mono text-xs md:text-sm border border-slate-200 dark:border-slate-800 transition-colors">+15s</button>
             <button onClick={() => onAdjustTimer(60)} className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:bg-slate-800 font-mono text-xs md:text-sm border border-slate-200 dark:border-slate-800 transition-colors">+1m</button>
          </div>
        </section>

        <aside className="hidden md:flex col-span-3 border-l border-slate-200 dark:border-slate-800 flex-col bg-slate-50 dark:bg-[#0F172A]/50">
          <div className="p-6 space-y-8 flex-1 flex flex-col">
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 pb-2">Métricas da Parte</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-[9px] uppercase text-slate-500 mb-1">Tempo Previsto</div>
                  <div className="text-lg font-mono text-slate-600 dark:text-slate-300">
                    {state.isCounselPhase ? "1 min" : `${currentPart.plannedTime} min`}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-[9px] uppercase text-slate-500 mb-1">Status</div>
                  <div className={cn(
                    "text-lg font-mono",
                    isOvertime ? "text-red-400" : isWarning ? "text-amber-400" : "text-sky-400"
                  )}>
                    {isOvertime ? "Excedido" : "No Ritmo"}
                  </div>
                </div>
              </div>
            </div>
            
            {state.currentPartIndex + 1 < state.parts.length && !state.isCounselPhase && (
              <div className="space-y-4">
                <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800 pb-2">Próxima Transição</h3>
                <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-300 dark:border-slate-700">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                    <span className="font-bold">{state.parts[state.currentPartIndex + 1].title.substring(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate">{state.parts[state.currentPartIndex + 1].title}</span>
                    {!state.parts[state.currentPartIndex + 1].hideSpeaker && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 italic font-mono truncate">
                        {state.parts[state.currentPartIndex + 1].speaker || "Sem orador"}
                        {state.parts[state.currentPartIndex + 1].assistant && ` c/ ${state.parts[state.currentPartIndex + 1].assistant}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 mt-auto pt-8">
              <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500">Alarme Silencioso</span>
                <div className="w-10 h-5 bg-emerald-600 rounded-full relative p-1">
                  <div className="h-3 w-3 bg-white rounded-full ml-auto shadow-sm"></div>
                </div>
              </div>
              <p className="text-[9px] text-slate-500 text-center uppercase tracking-tighter opacity-50">Diretriz S-38-T Compliance</p>
            </div>
          </div>
        </aside>
      </main>

      {/* 1-Tap Focus Bottom Bar */}
      <footer className="h-20 md:h-24 bg-white dark:bg-[#1E293B] border-t border-slate-200 dark:border-slate-800 p-4 flex gap-4 shrink-0 z-50">
        {buttonState === 'start' && (
          <button 
            onClick={onToggleTimer}
            className="flex-1 bg-[#295E9F] hover:bg-[#3474C2] transition-colors rounded-xl flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(41,94,159,0.3)] text-white"
          >
            <Play className="w-5 h-5 md:w-6 md:h-6 fill-current" />
            <span className="text-lg md:text-2xl font-black tracking-widest uppercase truncate">INICIAR {state.isCounselPhase ? "CONSELHO" : "PARTE"}</span>
          </button>
        )}

        {buttonState === 'running' && (
          <button 
            onClick={onNextPhase}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-xl flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(16,185,129,0.3)] text-white"
          >
            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
            <span className="text-lg md:text-2xl font-black tracking-widest uppercase truncate">Concluir Parte</span>
          </button>
        )}

        {buttonState === 'counsel' && (
          <>
            <button 
              onClick={onNextPhase}
              className="flex-[2] bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-xl flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(16,185,129,0.3)] text-white"
            >
              <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 shrink-0" />
              <span className="text-lg md:text-2xl font-black tracking-widest uppercase truncate">Concluir Conselho</span>
            </button>
            <button 
              onClick={onSkipCounsel}
              className="flex-1 bg-slate-50 dark:bg-[#0F172A] hover:bg-black transition-colors rounded-xl flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <SkipForward className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span className="text-xs md:text-sm font-bold uppercase tracking-wider truncate">Pular Elogio</span>
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
