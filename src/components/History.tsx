import React from 'react';
import { MeetingState } from '../types';
import { formatTimeHours } from '../lib/utils';
import { RefreshCw, ClipboardList, CheckCircle2, AlertCircle, TrendingDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface HistoryProps {
  state: MeetingState;
  onReset: () => void;
}

export function History({ state, onReset }: HistoryProps) {
  
  return (
    <div className="max-w-4xl mx-auto p-4 pb-32">
      <header className="mb-8 pt-8">
        <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Reunião Concluída</h1>
        <p className="text-slate-400">Resumo pedagógico e histórico de oradores.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1E293B]/50 border border-slate-800 p-6 rounded-2xl">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-1">Partes Registradas</p>
          <p className="text-3xl font-bold text-white">{state.history.length}</p>
        </div>
        <div className="bg-[#1E293B]/50 border border-slate-800 p-6 rounded-2xl">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-1">Saldo Final</p>
          <p className={cn(
            "text-3xl font-bold font-mono tracking-tight",
            state.timeBalance > 15 ? "text-red-400" : state.timeBalance < -15 ? "text-emerald-400" : "text-white"
          )}>
            {state.timeBalance > 0 ? '+' : ''}{formatTimeHours(state.timeBalance)}
          </p>
        </div>
        <div className="bg-[#1E293B]/50 border border-slate-800 p-6 rounded-2xl">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-1">Status Geral</p>
          <p className="text-xl font-medium text-white flex items-center gap-2 mt-2">
            {state.timeBalance > 60 ? (
              <><AlertCircle className="w-5 h-5 text-red-400" /> Atraso Significativo</>
            ) : state.timeBalance < -60 ? (
              <><TrendingDown className="w-5 h-5 text-emerald-400" /> Terminou Mais Cedo</>
            ) : (
              <><CheckCircle2 className="w-5 h-5 text-slate-300" /> Dentro do Horário</>
            )}
          </p>
        </div>
      </div>

      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-[#1E293B]/50 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-white">Relatório de Oradores</h3>
        </div>
        <div className="divide-y divide-slate-800/50">
          {state.history.map((record, i) => (
            <div key={i} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center hover:bg-[#1E293B]/30 transition-colors">
              <div>
                <p className="font-medium text-white text-lg mb-1">{record.title}</p>
                {!record.hideSpeaker && (
                  <p className="text-slate-400">
                    {record.speaker || "Sem orador designado"}
                    {record.assistant && ` c/ ${record.assistant}`}
                  </p>
                )}
              </div>
              
              <div className="flex flex-row sm:flex-col items-center sm:items-end gap-4 sm:gap-1 w-full sm:w-auto">
                <div className="flex flex-col sm:items-end flex-1 sm:flex-initial">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Tempo Utilizado</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-slate-200">{formatTimeHours(record.actualTime)}</span>
                    <span className="text-sm text-slate-500 font-mono">/ {record.plannedTime}m</span>
                  </div>
                </div>
                
                <span className={cn(
                  "px-2.5 py-1 text-xs font-medium uppercase tracking-wider rounded-full shrink-0",
                  record.status === 'No tempo' && "bg-slate-800 text-slate-300 border border-slate-700",
                  record.status === 'Excedido' && "bg-red-950/30 text-red-400 border border-red-900/50",
                  record.status === 'Abaixo do tempo' && "bg-emerald-950/30 text-emerald-400 border border-emerald-900/50",
                )}>
                  {record.status}
                </span>
              </div>
            </div>
          ))}
          {state.history.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              Nenhuma parte foi registrada.
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1E293B]/80 backdrop-blur-md border-t border-slate-800">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={onReset}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-lg py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <RefreshCw className="w-5 h-5" />
            NOVA REUNIÃO
          </button>
        </div>
      </div>
    </div>
  );
}
