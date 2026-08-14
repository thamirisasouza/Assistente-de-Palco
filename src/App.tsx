/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useMeetingTimer } from './hooks/useMeetingTimer';
import { useTheme } from './hooks/useTheme';
import { Setup } from './components/Setup';
import { MeetingStage } from './components/MeetingStage';
import { History } from './components/History';
import { Sun, Moon, RotateCcw, Play, AlertCircle } from 'lucide-react';

export default function App() {
  const timerContext = useMeetingTimer();
  const { theme, toggleTheme } = useTheme();
  const { state, pendingSavedSession } = timerContext;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] font-sans antialiased text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Botão de Tema Flutuante */}
      <button
        onClick={toggleTheme}
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#295E9F] dark:hover:text-[#4A6CA7] shadow-md flex items-center justify-center transition-all cursor-pointer"
        title="Alternar Tema Claro / Escuro"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
      </button>

      {/* Modal de Restauração de Sessão Ativa em Andamento (PRD 10.5 & 11) */}
      {pendingSavedSession && state.status === 'setup' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Reunião em Andamento Detectada
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Uma sessão ativa iniciada em {new Date(pendingSavedSession.iniciada_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} na congregação <strong className="text-slate-800 dark:text-slate-100">{pendingSavedSession.congregacao}</strong> foi recuperada automaticamente.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Parte Atual:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {pendingSavedSession.parts[pendingSavedSession.currentPartIndex]?.title || 'Final'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tempo Decorrido:</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {Math.round(pendingSavedSession.totalElapsedSeconds / 60)} min
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={timerContext.resumeSavedMeeting}
                className="w-full min-h-[52px] bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" /> Retomar de Onde Parou
              </button>
              <button
                onClick={timerContext.discardSavedMeeting}
                className="w-full min-h-[48px] bg-slate-100 dark:bg-slate-800 hover:bg-red-500/10 hover:text-red-500 text-slate-600 dark:text-slate-400 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Descartar e Iniciar Nova
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tela 1: Setup & Programação */}
      {state.status === 'setup' && (
        <Setup 
          state={state}
          settings={timerContext.settings}
          archivedCount={timerContext.archivedMeetings.length}
          onUpdatePart={timerContext.updatePart}
          onApplyAllParts={timerContext.setAllParts}
          onStart={timerContext.startMeeting}
          onUpdateSettings={timerContext.updateSettings}
          onUpdateBrother={timerContext.updateBrother}
          onAddBrother={timerContext.addBrother}
          onRemoveBrother={timerContext.removeBrother}
          onViewArchive={timerContext.viewArchiveList}
        />
      )}
      
      {/* Tela 2: Palco ao Vivo */}
      {state.status === 'running' && (
        <MeetingStage 
          state={state}
          currentTimerSeconds={timerContext.currentTimerSeconds}
          isTimerRunning={timerContext.isTimerRunning}
          progressPercent={timerContext.progressPercent}
          onToggleTimer={timerContext.toggleTimer}
          onAdjustTimer={timerContext.adjustTimer}
          onNextPhase={timerContext.nextPhase}
          onSkipCounsel={timerContext.skipCounsel}
          onConcludeMeeting={timerContext.concludeMeeting}
          onEmergencyReset={timerContext.resetToSetup}
        />
      )}

      {/* Tela 3: Resumo Imutável & Histórico Arquivado */}
      {(state.status === 'summary' || state.status === 'history_list') && (
        <History 
          meeting={state.currentMeeting}
          archivedMeetings={timerContext.archivedMeetings}
          onNewMeeting={timerContext.resetToSetup}
          onSelectMeeting={timerContext.viewArchivedMeeting}
          onDeleteMeeting={timerContext.deleteFromArchive}
        />
      )}
    </div>
  );
}
