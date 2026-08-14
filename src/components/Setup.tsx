import React, { useState } from 'react';
import { MeetingState, MeetingPart, CongregationSettings, Role, Brother } from '../types';
import { Play, Plus, Trash2, Clock, Users, Calendar, Building2, Upload, Edit2, X, Check } from 'lucide-react';
import { cn, addMinutesToTime } from '../lib/utils';

interface SetupProps {
  state: MeetingState;
  settings: CongregationSettings;
  onUpdatePart: (index: number, updates: Partial<MeetingPart>) => void;
  onStart: () => void;
  onUpdateSettings: (updates: Partial<CongregationSettings>) => void;
  onUpdateBrother: (id: string, updates: Partial<Brother>) => void;
  onAddBrother: (name: string, role: Role) => void;
  onRemoveBrother: (id: string) => void;
}

export function Setup({ 
  state, settings, onUpdatePart, onStart, 
  onUpdateSettings, onUpdateBrother, onAddBrother, onRemoveBrother 
}: SetupProps) {
  const [activeTab, setActiveTab] = useState<'programacao' | 'congregacao'>('programacao');
  const [newBrotherName, setNewBrotherName] = useState("");
  const [newBrotherRole, setNewBrotherRole] = useState<Role>("Publicador");

  // Edit state
  const [editingBrotherId, setEditingBrotherId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("Publicador");

  const totalPlannedMinutes = state.parts.reduce((sum, p) => sum + p.plannedTime + (p.hasCounsel ? 1 : 0), 0);
  
  let currentStartTime = settings.defaultTime;

  const handleAddManual = () => {
    if (newBrotherName.trim()) {
      onAddBrother(newBrotherName, newBrotherRole);
      setNewBrotherName("");
    }
  };

  const startEditing = (b: Brother) => {
    setEditingBrotherId(b.id);
    setEditName(b.name);
    setEditRole(b.role);
  };

  const saveEdit = (id: string) => {
    if (editName.trim()) {
      onUpdateBrother(id, { name: editName, role: editRole });
    }
    setEditingBrotherId(null);
  };

  return (
    <div className="w-full min-h-screen bg-[#0F172A] flex flex-col items-center">
      <div className="w-full max-w-3xl p-4 sm:p-6 md:py-12 pb-32">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Assistente de Palco</h1>
              <p className="text-slate-400 text-sm">Organize a reunião de forma rápida e eficiente.</p>
            </div>
            <div className="flex bg-[#1E293B] p-1 rounded-xl border border-slate-800 shrink-0">
              <button 
                onClick={() => setActiveTab('programacao')}
                className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2", 
                  activeTab === 'programacao' ? "bg-[#295E9F] text-white shadow-md" : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Calendar className="w-4 h-4" />
                Programação
              </button>
              <button 
                onClick={() => setActiveTab('congregacao')}
                className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2", 
                  activeTab === 'congregacao' ? "bg-[#295E9F] text-white shadow-md" : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Building2 className="w-4 h-4" />
                Congregação
              </button>
            </div>
          </div>
        </header>

        {activeTab === 'congregacao' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Congregation Settings */}
            <section className="bg-[#1E293B] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#4A6CA7]" />
                Dados Principais
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Nome da Congregação</label>
                  <input 
                    type="text" 
                    value={settings.name}
                    onChange={(e) => onUpdateSettings({ name: e.target.value })}
                    className="w-full bg-[#0F172A] border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:border-[#4A6CA7] focus:ring-1 focus:ring-[#4A6CA7] transition-all"
                    placeholder="Ex: Congregação Central"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Horário Padrão</label>
                  <select 
                    value={settings.defaultTime}
                    onChange={(e) => onUpdateSettings({ defaultTime: e.target.value })}
                    className="w-full bg-[#0F172A] border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:border-[#4A6CA7] focus:ring-1 focus:ring-[#4A6CA7] transition-all appearance-none"
                  >
                    <option value="19:00">19:00</option>
                    <option value="19:30">19:30</option>
                    <option value="20:00">20:00</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Brothers Database */}
            <section className="bg-[#1E293B] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4A6CA7]" />
                Base de Publicadores ({settings.brothers.length})
              </h2>
              
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    value={newBrotherName}
                    onChange={(e) => setNewBrotherName(e.target.value)}
                    placeholder="Adicionar nome..."
                    className="flex-1 bg-[#0F172A] border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:border-[#4A6CA7] focus:ring-1 focus:ring-[#4A6CA7]"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
                  />
                  <select
                    value={newBrotherRole}
                    onChange={(e) => setNewBrotherRole(e.target.value as Role)}
                    className="bg-[#0F172A] border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:border-[#4A6CA7] focus:ring-1 focus:ring-[#4A6CA7]"
                  >
                    <option value="Publicador">Publicador</option>
                    <option value="Servo Ministerial">Servo Ministerial</option>
                    <option value="Ancião">Ancião</option>
                  </select>
                  <button 
                    onClick={handleAddManual}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center h-[46px]"
                  >
                    Adicionar
                  </button>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-1 bg-[#0F172A] p-2 rounded-xl border border-slate-800">
                  {settings.brothers.map(b => (
                    <div key={b.id} className="flex flex-col p-3 hover:bg-[#1E293B] rounded-lg group transition-colors border-b border-slate-800/50 last:border-0">
                      {editingBrotherId === b.id ? (
                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                          <input 
                            type="text" 
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="flex-1 bg-[#0F172A] border border-[#4A6CA7] text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(b.id)}
                          />
                          <select
                            value={editRole}
                            onChange={e => setEditRole(e.target.value as Role)}
                            className="bg-[#0F172A] border border-[#4A6CA7] text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                          >
                            <option value="Publicador">Publicador</option>
                            <option value="Servo Ministerial">Servo Ministerial</option>
                            <option value="Ancião">Ancião</option>
                          </select>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => saveEdit(b.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg" title="Salvar">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingBrotherId(null)} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg" title="Cancelar">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-200">{b.name}</span>
                            <span className={cn(
                              "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full",
                              b.role === 'Ancião' ? "bg-amber-500/10 text-amber-500" :
                              b.role === 'Servo Ministerial' ? "bg-sky-500/10 text-sky-400" :
                              "bg-slate-500/10 text-slate-400"
                            )}>
                              {b.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => startEditing(b)}
                              className="text-slate-500 hover:text-[#4A6CA7] p-1.5 rounded hover:bg-slate-800 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => onRemoveBrother(b.id)}
                              className="text-slate-500 hover:text-red-400 p-1.5 rounded hover:bg-slate-800 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {settings.brothers.length === 0 && (
                    <div className="p-6 text-center text-slate-500 text-sm">
                      Nenhum publicador cadastrado.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'programacao' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#1E293B] p-4 rounded-xl border border-slate-800 flex justify-between items-center shadow-md">
               <div className="flex flex-col">
                 <span className="text-[10px] font-bold text-[#4A6CA7] uppercase tracking-widest">Início Programado</span>
                 <span className="text-xl font-mono text-white">{settings.defaultTime}</span>
               </div>
               <div className="flex flex-col text-right">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duração Total</span>
                 <span className="text-xl font-mono text-white">{formatTotalDuration(totalPlannedMinutes)}</span>
               </div>
            </div>

            <div className="space-y-2">
              {state.parts.map((part, index) => {
                const partStartTime = currentStartTime;
                // Calculate next start time
                currentStartTime = addMinutesToTime(currentStartTime, part.plannedTime + (part.hasCounsel ? 1 : 0));

                return (
                  <div key={part.id} className="bg-[#1E293B]/80 hover:bg-[#1E293B] border border-slate-800/80 p-3 sm:p-4 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-4 min-w-[100px]">
                      <span className="font-mono text-[#4A6CA7] font-bold bg-[#4A6CA7]/10 px-2 py-1 rounded text-sm">
                        [{partStartTime}]
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-200 truncate">{part.title}</h3>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                        {part.plannedTime} min {part.hasCounsel ? '+ 1m conselho' : ''}
                      </p>
                    </div>

                    <div className="w-full sm:w-[220px] shrink-0 flex flex-col gap-2">
                      {!part.hideSpeaker ? (
                        <>
                          <select 
                            value={part.speaker || ""}
                            onChange={(e) => onUpdatePart(index, { speaker: e.target.value })}
                            className="w-full bg-[#0F172A] border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-[#4A6CA7] focus:ring-1 focus:ring-[#4A6CA7] appearance-none"
                          >
                            <option value="">Escolher Irmão...</option>
                            {settings.brothers.map(b => (
                              <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                          </select>
                          {part.supportsAssistant && (
                            <select 
                              value={part.assistant || ""}
                              onChange={(e) => onUpdatePart(index, { assistant: e.target.value })}
                              className="w-full bg-[#0F172A] border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:border-[#4A6CA7] focus:ring-1 focus:ring-[#4A6CA7] appearance-none"
                            >
                              <option value="">Ajudante (Opcional)...</option>
                              {settings.brothers.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                              ))}
                            </select>
                          )}
                        </>
                      ) : (
                        <div className="w-full bg-[#0F172A]/50 border border-slate-700/30 text-slate-500 rounded-lg px-3 py-2 text-sm text-center italic cursor-not-allowed h-[38px] flex items-center justify-center">
                          Automático
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0F172A]/90 backdrop-blur-xl border-t border-slate-800 z-50">
        <div className="max-w-3xl mx-auto">
          <button 
            onClick={onStart}
            className="w-full bg-[#295E9F] hover:bg-[#3474C2] text-white font-black tracking-widest uppercase text-lg py-4 px-6 rounded-xl shadow-[0_4px_20px_rgba(41,94,159,0.4)] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-current" />
            Iniciar Reunião
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTotalDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}
