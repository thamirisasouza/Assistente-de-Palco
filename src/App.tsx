/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useMeetingTimer } from './hooks/useMeetingTimer';
import { Setup } from './components/Setup';
import { MeetingStage } from './components/MeetingStage';
import { History } from './components/History';

export default function App() {
  const timerContext = useMeetingTimer();
  const { state } = timerContext;

  return (
    <div className="min-h-screen bg-[#0F172A] font-sans antialiased text-slate-100">
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

