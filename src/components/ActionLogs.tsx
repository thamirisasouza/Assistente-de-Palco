import React, { useEffect, useState } from 'react';
import { Activity, Trash2, PlusCircle, Calendar, Clock, User, RotateCcw, CheckCircle2 } from 'lucide-react';
import { subscribeToFirebaseLogs } from '../lib/firebase';
import { ActionLog, CompletedMeeting } from '../types';

interface ActionLogsProps {
  archivedMeetings?: CompletedMeeting[];
  onRestoreLog?: (log: ActionLog) => void;
}

export function ActionLogs({ archivedMeetings = [], onRestoreLog }: ActionLogsProps) {
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [restoredId, setRestoredId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToFirebaseLogs((data) => {
      setLogs(data);
    });
    return () => unsubscribe();
  }, []);

  const existingIds = new Set(archivedMeetings.map(m => m.id));

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl sm:rounded-3xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto w-full">
      <div className="bg-[#295E9F] dark:bg-[#1E3A5F] px-4 sm:px-8 py-5 sm:py-6 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-white/90" />
          <h2 className="text-lg sm:text-xl font-bold">Logs de Atividade</h2>
        </div>
      </div>
      
      <div className="p-4 sm:p-8">
        {logs.length === 0 ? (
          <div className="text-center py-10">
            <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">Nenhum log de atividade registrado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const isMissingInArchive = log.meetingId && !existingIds.has(log.meetingId);
              const isJustRestored = restoredId === log.id;

              return (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className={`p-2 rounded-lg shrink-0 ${log.action === 'create_history' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {log.action === 'create_history' ? <PlusCircle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {log.action === 'create_history' ? 'Histórico Adicionado' : 'Histórico Excluído'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {log.meetingDate || 'Data desconhecida'}</span>
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {log.userEmail || 'Usuário desconhecido'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0">
                    {isMissingInArchive && onRestoreLog && (
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreLog(log);
                          setRestoredId(log.id);
                          setTimeout(() => setRestoredId(null), 2000);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Restaurar esta reunião de volta para o histórico"
                      >
                        {isJustRestored ? <CheckCircle2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        {isJustRestored ? "Restaurado!" : "Restaurar Histórico"}
                      </button>
                    )}
                    <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
