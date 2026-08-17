/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useMeetingTimer } from './hooks/useMeetingTimer';
import { useTheme } from './hooks/useTheme';
import { Setup } from './components/Setup';
import { MeetingStage } from './components/MeetingStage';
import { History } from './components/History';
import { Login } from './components/Login';
import { TopHeader } from './components/TopHeader';
import { BottomNavigation, NavTab } from './components/BottomNavigation';
import { DrawerMenu } from './components/DrawerMenu';
import { RotateCcw, Play, AlertCircle } from 'lucide-react';
import { cn } from './lib/utils';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

export default function App() {
  const timerContext = useMeetingTimer();
  const { theme, toggleTheme } = useTheme();
  const { state, pendingSavedSession } = timerContext;
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Controle de Navegação Inferior & Gaveta Lateral
  const [currentTab, setCurrentTab] = useState<NavTab>('programacao');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#295E9F] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onSuccess={() => {}} />;
  }

  const handleLogout = () => {
    signOut(auth).catch(console.error);
  };

  const isMeetingFinished = state.status === 'summary';

  return (
    <div className={cn(
      "min-h-screen font-sans antialiased transition-colors duration-500 flex flex-col",
      isMeetingFinished 
        ? "bg-emerald-600 dark:bg-emerald-800 text-white" 
        : "bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-100"
    )}>

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
                className="w-full min-h-[52px] bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse-attention"
              >
                <Play className="w-5 h-5 fill-current animate-pulse" /> Retomar de Onde Parou
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

      {/* TELA PRINCIPAL (ESTADO 'setup' ou navegação) */}
      {state.status === 'setup' && (
        <div className="flex flex-col min-h-screen">
          {/* Top Header com Saudação & Botão Hambúrguer (Screenshot 1) */}
          <TopHeader 
            userName={user.displayName || undefined}
            userEmail={user.email || undefined}
            congregationName={timerContext.settings.name}
            onOpenMenu={() => setIsDrawerOpen(true)}
          />

          {/* Conteúdo Central Limpo */}
          <main className="flex-1">
            <Setup 
              state={state}
              settings={timerContext.settings}
              archivedCount={timerContext.archivedMeetings.length}
              archivedMeetings={timerContext.archivedMeetings}
              firebaseStatus={timerContext.firebaseStatus}
              activeTab={currentTab}
              onTabChange={setCurrentTab}
              onUpdatePart={timerContext.updatePart}
              onApplyAllParts={timerContext.setAllParts}
              onStart={timerContext.startMeeting}
              onUpdateSettings={timerContext.updateSettings}
              onUpdateBrother={timerContext.updateBrother}
              onAddBrother={timerContext.addBrother}
              onAddBrothersBatch={timerContext.addBrothersBatch}
              onRemoveBrother={timerContext.removeBrother}
              onViewArchive={() => setCurrentTab('historico')}
              onViewArchivedMeeting={timerContext.viewArchivedMeeting}
              onDeleteMeeting={timerContext.deleteFromArchive}
              onApplyMonthSchedule={timerContext.applyMonthSchedule}
              onSelectWeek={timerContext.selectWeekFromSchedule}
              onClearMonthlySchedule={timerContext.clearMonthlySchedule}
              isImportModalOpen={isImportModalOpen}
              onSetIsImportModalOpen={setIsImportModalOpen}
            />
          </main>

          {/* Barra de Navegação Inferior (Screenshot 1) */}
          <BottomNavigation 
            activeTab={currentTab}
            onTabChange={setCurrentTab}
            onStartMeeting={timerContext.startMeeting}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            archivedCount={timerContext.archivedMeetings.length}
          />

          {/* Gaveta / Menu Lateral (Screenshot 2) */}
          <DrawerMenu 
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            userEmail={user.email || ''}
            userName={user.displayName || undefined}
            congregationName={timerContext.settings.name}
            theme={theme}
            onToggleTheme={toggleTheme}
            onNavigate={(tab) => {
              setCurrentTab(tab);
              setIsDrawerOpen(false);
            }}
            onOpenImportPdf={() => {
              setIsImportModalOpen(true);
            }}
            onLogout={handleLogout}
            archivedCount={timerContext.archivedMeetings.length}
          />
        </div>
      )}
      
      {/* TELA DE PALCO AO VIVO */}
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
          onPauseAndExit={timerContext.pauseAndReturnToSetup}
          onEmergencyReset={timerContext.resetToSetup}
        />
      )}

      {/* TELA DE RESUMO FINAL IMUTÁVEL */}
      {(state.status === 'summary' || state.status === 'history_list') && (
        <History 
          meeting={state.currentMeeting}
          archivedMeetings={timerContext.archivedMeetings}
          knownBrothers={timerContext.settings.brothers}
          onNewMeeting={timerContext.resetToSetup}
          onSelectMeeting={timerContext.viewArchivedMeeting}
          onDeleteMeeting={timerContext.deleteFromArchive}
        />
      )}
    </div>
  );
}
