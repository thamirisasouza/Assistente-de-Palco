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
import { Sun, Moon } from 'lucide-react';

export default function App() {
  const timerContext = useMeetingTimer();
  const { theme, toggleTheme } = useTheme();
  const { state } = timerContext;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] font-sans antialiased text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#4A6CA7] dark:hover:text-[#4A6CA7] shadow-sm hover:shadow transition-all"
        title="Alternar Tema"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {state.status === 'setup' && (
        <Setup 
          state={state}
          settings={timerContext.settings}
          onUpdatePart={timerContext.updatePart}
          onStart={timerContext.startMeeting}
          onUpdateSettings={timerContext.updateSettings}
          onUpdateBrother={timerContext.updateBrother}
          onAddBrother={timerContext.addBrother}
          onRemoveBrother={timerContext.removeBrother}
        />
      )}
      
      {state.status === 'running' && (
        <MeetingStage 
          state={state}
          currentTimerSeconds={timerContext.currentTimerSeconds}
          isTimerRunning={timerContext.isTimerRunning}
          onToggleTimer={timerContext.toggleTimer}
          onAdjustTimer={timerContext.adjustTimer}
          onNextPhase={timerContext.nextPhase}
          onSkipCounsel={timerContext.skipCounsel}
          onEndMeeting={timerContext.endMeeting}
        />
      )}

      {state.status === 'history' && (
        <History 
          state={state}
          onReset={timerContext.resetToSetup}
        />
      )}
    </div>
  );
}

