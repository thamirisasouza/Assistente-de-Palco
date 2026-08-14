import React, { useState } from 'react';
import { MeetingState, MeetingPart, CongregationSettings, Role, Brother, WeekType, TOTAL_PLANNED_MEETING_MINUTES } from '../types';
import { Play, Plus, Trash2, Clock, Users, Calendar, Building2, Edit2, X, Check, FileText, CheckCircle2, AlertCircle, Sparkles, BookOpen } from 'lucide-react';
import { cn, addMinutesToTime } from '../lib/utils';
import { ImportApostilaModal } from './ImportApostilaModal';

interface SetupProps {
  state: MeetingState;
  settings: CongregationSettings;
  archivedCount: number;
  onUpdatePart: (index: number, updates: Partial<MeetingPart>) => void;
  onApplyAllParts: (newParts: MeetingPart[]) => void;
  onStart: () => void;
  onUpdateSettings: (updates: Partial<CongregationSettings>) => void;
  onUpdateBrother: (id: string, updates: Partial<Brother>) => void;
  onAddBrother: (name: string, role: Role) => void;
  onAddBrothersBatch: (names: string[], defaultRole?: Role) => void;
  onRemoveBrother: (id: string) => void;
  onViewArchive: () => void;
}

export function Setup({ 
  state, settings, archivedCount, onUpdatePart, onApplyAllParts, onStart, 
  onUpdateSettings, onUpdateBrother, onAddBrother, onAddBrothersBatch, onRemoveBrother, onViewArchive 
}: SetupProps) {
  const [activeTab, setActiveTab] = useState<'programacao' | 'congregacao'>('programacao');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedWeekLabel, setImportedWeekLabel] = useState<string | null>(null);
  const [newBrotherName, setNewBrotherName] = useState("");
  const [newBrotherRole, setNewBrotherRole] = useState<Role>("Publicador");

  // Edit state
  const [editingBrotherId, setEditingBrotherId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("Publicador");

  const totalPlannedMinutes = state.parts.reduce((sum, p) => sum + p.plannedTime + (p.hasCounsel ? 1 : 0), 0);
  const is105Standard = totalPlannedMinutes === TOTAL_PLANNED_MEETING_MINUTES;
  
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
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#0F172A] flex flex-col items-center">
      <div className="w-full max-w-3xl p-4 sm:p-6 md:py-10 pb-36">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] mb-1.5 border border-[#295E9F]/20">
                S-38-T (Ed. 8/26) • 1h 45m
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Assistente de Palco
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Cronômetro de alta precisão e gestão da reunião ao vivo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {archivedCount > 0 && (
                <button
                  onClick={onViewArchive}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#295E9F] transition-all flex items-center gap-1.5 shadow-sm"
                  title="Ver reuniões passadas"
                >
                  <FileText className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                  Relatórios ({archivedCount})
                </button>
              )}

              <div className="flex bg-white dark:bg-[#1E293B] p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                <button 
                  onClick={() => setActiveTab('programacao')}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2", 
                    activeTab === 'programacao' ? "bg-[#295E9F] text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  Programação
                </button>
                <button 
                  onClick={() => setActiveTab('congregacao')}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2", 
                    activeTab === 'congregacao' ? "bg-[#295E9F] text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"
                  )}
                >
                  <Building2 className="w-4 h-4" />
                  Congregação
                </button>
              </div>
            </div>
          </div>
        </header>

        {activeTab === 'congregacao' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Congregation Settings */}
            <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                Dados da Congregação
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Nome da Congregação</label>
                  <input 
                    type="text" 
                    value={settings.name}
                    onChange={(e) => onUpdateSettings({ name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] transition-all"
                    placeholder="Ex: Congregação Central"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Horário Padrão</label>
                  <select 
                    value={settings.defaultTime}
                    onChange={(e) => onUpdateSettings({ defaultTime: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] transition-all appearance-none"
                  >
                    <option value="19:00">19:00</option>
                    <option value="19:30">19:30</option>
                    <option value="20:00">20:00</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Brothers Database */}
            <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                Base de Publicadores ({settings.brothers.length})
              </h2>
              
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    value={newBrotherName}
                    onChange={(e) => setNewBrotherName(e.target.value)}
                    placeholder="Adicionar nome..."
                    className="flex-1 bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F]"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
                  />
                  <select
                    value={newBrotherRole}
                    onChange={(e) => setNewBrotherRole(e.target.value as Role)}
                    className="bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F]"
                  >
                    <option value="Publicador">Publicador</option>
                    <option value="Servo Ministerial">Servo Ministerial</option>
                    <option value="Ancião">Ancião</option>
                  </select>
                  <button 
                    onClick={handleAddManual}
                    className="min-h-[44px] bg-[#295E9F] hover:bg-[#3474C2] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                  >
                    Adicionar
                  </button>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-1 bg-slate-50 dark:bg-[#0F172A] p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
                  {settings.brothers.map(b => (
                    <div key={b.id} className="flex flex-col p-3 hover:bg-white dark:hover:bg-[#1E293B] rounded-xl group transition-colors border-b border-slate-200/60 dark:border-slate-800/60 last:border-0">
                      {editingBrotherId === b.id ? (
                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                          <input 
                            type="text" 
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-[#0F172A] border border-[#295E9F] text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(b.id)}
                          />
                          <select
                            value={editRole}
                            onChange={e => setEditRole(e.target.value as Role)}
                            className="bg-slate-50 dark:bg-[#0F172A] border border-[#295E9F] text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
                          >
                            <option value="Publicador">Publicador</option>
                            <option value="Servo Ministerial">Servo Ministerial</option>
                            <option value="Ancião">Ancião</option>
                          </select>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => saveEdit(b.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 rounded-xl" title="Salvar">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingBrotherId(null)} className="bg-slate-700 hover:bg-slate-600 text-white p-2.5 rounded-xl" title="Cancelar">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{b.name}</span>
                            <span className={cn(
                              "text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border",
                              b.role === 'Ancião' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                              b.role === 'Servo Ministerial' ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" :
                              "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                            )}>
                              {b.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => startEditing(b)}
                              className="text-slate-400 hover:text-[#295E9F] p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => onRemoveBrother(b.id)}
                              className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
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
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Banner: Importar Escala Mensal (PDF Padrão) */}
            <div className="bg-gradient-to-r from-[#295E9F]/10 via-sky-500/10 to-indigo-500/10 dark:from-[#295E9F]/20 dark:via-sky-500/20 dark:to-indigo-500/20 border border-[#295E9F]/30 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#295E9F] text-white tracking-wider uppercase">
                    Escala Mensal
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                    Importar PDF da Programação do Mês
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {importedWeekLabel 
                    ? `Programação aplicada para: ${importedWeekLabel}` 
                    : "Importe o PDF da congregação para preencher automaticamente temas, oradores, leitores, ajudantes e cânticos."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="min-h-[44px] px-5 bg-white dark:bg-[#1E293B] hover:bg-slate-50 dark:hover:bg-[#28384E] text-[#295E9F] dark:text-[#688EC9] border border-[#295E9F]/30 hover:border-[#295E9F] rounded-2xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                {importedWeekLabel ? "Reimportar / Trocar Semana" : "Importar Arquivo PDF (.pdf)"}
              </button>
            </div>

            {/* Informações da Sessão (Presidente e Semana) */}
            <div className="bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Presidente da Reunião
                </label>
                <select
                  value={settings.presidentName}
                  onChange={(e) => onUpdateSettings({ presidentName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] appearance-none"
                >
                  <option value="Presidente da Reunião">Presidente da Reunião (Padrão)</option>
                  {settings.brothers
                    .filter(b => b.role === 'Ancião' || b.role === 'Servo Ministerial')
                    .map(b => (
                      <option key={b.id} value={b.name}>{b.name} ({b.role})</option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Tipo de Semana
                </label>
                <select
                  value={settings.weekType}
                  onChange={(e) => onUpdateSettings({ weekType: e.target.value as WeekType })}
                  className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] appearance-none"
                >
                  <option value="Normal">Semana Normal</option>
                  <option value="Visita do SC">Visita do Superintendente de Circuito</option>
                  <option value="Semana de Assembleia">Semana de Assembleia</option>
                </select>
              </div>
            </div>

            {/* Duração e Compliance S-38-T */}
            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
               <div className="flex flex-col">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Início Previsto</span>
                 <span className="text-xl font-mono font-bold text-slate-900 dark:text-white">{settings.defaultTime}</span>
               </div>

               <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-800">
                 {is105Standard ? (
                   <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                     <CheckCircle2 className="w-4 h-4" /> 105 min (1h 45m) S-38-T
                   </span>
                 ) : (
                   <span className="text-amber-500 font-bold text-xs flex items-center gap-1.5">
                     <AlertCircle className="w-4 h-4" /> {totalPlannedMinutes} min (diferente de 105 min)
                   </span>
                 )}
               </div>

               <div className="flex flex-col text-right">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duração Total</span>
                 <span className="text-xl font-mono font-bold text-slate-900 dark:text-white">
                   {Math.floor(totalPlannedMinutes / 60)}h {(totalPlannedMinutes % 60).toString().padStart(2, '0')}m
                 </span>
               </div>
            </div>

            {/* Part List */}
            <div className="space-y-2.5">
              {state.parts.map((part, index) => {
                const partStartTime = currentStartTime;
                currentStartTime = addMinutesToTime(currentStartTime, part.plannedTime + (part.hasCounsel ? 1 : 0));

                return (
                  <div key={part.id} className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 rounded-2xl transition-all shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-[90px]">
                      <span className="font-mono text-[#295E9F] dark:text-[#4A6CA7] font-bold bg-[#295E9F]/10 px-2.5 py-1 rounded-xl text-xs">
                        {partStartTime}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{part.title}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                        {part.plannedTime} min {part.hasCounsel ? '+ 1m conselho' : ''}
                        {part.flexible && <span className="text-sky-500 ml-2 font-mono">• Flexível S-38-T</span>}
                      </p>
                    </div>

                    <div className="w-full sm:w-[240px] shrink-0 flex flex-col gap-1.5">
                      {!part.hideSpeaker ? (
                        <>
                          <select 
                            value={part.speaker || ""}
                            onChange={(e) => onUpdatePart(index, { speaker: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] appearance-none"
                          >
                            <option value="">Escolher Orador...</option>
                            {settings.brothers.map(b => (
                              <option key={b.id} value={b.name}>{b.name} ({b.role})</option>
                            ))}
                          </select>
                          {part.supportsAssistant && (
                            <select 
                              value={part.assistant || ""}
                              onChange={(e) => onUpdatePart(index, { assistant: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] appearance-none"
                            >
                              <option value="">Ajudante (Opcional)...</option>
                              {settings.brothers.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                              ))}
                            </select>
                          )}
                        </>
                      ) : (
                        <div className="w-full bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-slate-800 text-slate-400 rounded-xl px-3 py-2 text-xs text-center italic cursor-not-allowed h-[34px] flex items-center justify-center font-medium">
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

      {/* Modal de Importação Mensal de PDF */}
      <ImportApostilaModal
        isOpen={isImportModalOpen}
        currentParts={state.parts}
        existingBrothers={settings.brothers}
        onClose={() => setIsImportModalOpen(false)}
        onApplyWeek={(newParts, week, allBrothersFound, congregationName) => {
          onApplyAllParts(newParts);
          setImportedWeekLabel(week.weekLabel);

          // Atualiza dados da congregação e presidente
          const updates: Partial<CongregationSettings> = {
            importedWeekLabel: week.weekLabel
          };
          if (week.president) {
            updates.presidentName = week.president;
          }
          if (congregationName && congregationName.length > 3) {
            updates.name = congregationName;
          }
          onUpdateSettings(updates);

          // Auto-registra irmãos encontrados que ainda não estejam na lista
          onAddBrothersBatch(allBrothersFound, 'Publicador');
        }}
      />

      {/* Botão Primário Inteligente (Princípio 2: Altura ≥ 56px) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-40">
        <div className="max-w-3xl mx-auto">
          <button 
            onClick={onStart}
            className="w-full min-h-[56px] bg-[#295E9F] hover:bg-[#3474C2] text-white font-black tracking-widest uppercase text-lg rounded-2xl shadow-lg shadow-[#295E9F]/30 transition-all flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer"
          >
            <Play className="w-6 h-6 fill-current" />
            INICIAR REUNIÃO AO VIVO
          </button>
        </div>
      </div>
    </div>
  );
}
