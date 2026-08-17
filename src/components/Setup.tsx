import React, { useState, useMemo } from 'react';
import { MeetingState, MeetingPart, CongregationSettings, Role, Brother, WeekType, TOTAL_PLANNED_MEETING_MINUTES, CompletedMeeting } from '../types';
import { 
  Play, Plus, Trash2, Clock, Users, Calendar, Building2, Edit2, X, Check, 
  FileText, CheckCircle2, AlertCircle, Sparkles, BookOpen, CalendarX, 
  UserPlus, ClipboardPaste, ChevronDown, ChevronUp, ChevronRight, BarChart3,
  Cloud, RefreshCw, Search, Save
} from 'lucide-react';
import { cn, addMinutesToTime } from '../lib/utils';
import { ImportApostilaModal } from './ImportApostilaModal';
import { BatchBrothersModal } from './BatchBrothersModal';

import { groupPartsBySection, SECTIONS } from '../lib/sectionColors';
import { AnalyticsCharts } from './AnalyticsCharts';

interface SetupProps {
  state: MeetingState;
  settings: CongregationSettings;
  archivedCount: number;
  archivedMeetings: CompletedMeeting[];
  firebaseStatus?: 'synced' | 'syncing' | 'offline';
  onUpdatePart: (index: number, updates: Partial<MeetingPart>) => void;
  onApplyAllParts: (newParts: MeetingPart[]) => void;
  onStart: () => void;
  onUpdateSettings: (updates: Partial<CongregationSettings>) => void;
  onUpdateBrother: (id: string, updates: Partial<Brother>) => void;
  onAddBrother: (name: string, role: Role) => void;
  onAddBrothersBatch: (items: Array<string | { name: string; role?: Role }>, defaultRole?: Role) => void;
  onRemoveBrother: (id: string) => void;
  onViewArchive: () => void;
  onViewArchivedMeeting?: (meeting: CompletedMeeting) => void;
}

export function Setup({ 
  state, settings, archivedCount, archivedMeetings, firebaseStatus = 'synced', onUpdatePart, onApplyAllParts, onStart, 
  onUpdateSettings, onUpdateBrother, onAddBrother, onAddBrothersBatch, onRemoveBrother, onViewArchive, onViewArchivedMeeting
}: SetupProps) {
  const [activeTab, setActiveTab] = useState<'programacao' | 'congregacao' | 'graficos'>('programacao');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isPdfSectionOpen, setIsPdfSectionOpen] = useState(false);

  const [newBrotherName, setNewBrotherName] = useState('');
  const [newBrotherRole, setNewBrotherRole] = useState<Role>('Publicador');
  const [brotherSearch, setBrotherSearch] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const handleSaveSettings = () => {
    setIsSavingSettings(true);
    setTimeout(() => {
      setIsSavingSettings(false);
    }, 1500);
  };

  const [importedWeekLabel, setImportedWeekLabel] = useState<string | null>(null);

  const totalPlannedMinutes = state.parts.reduce((sum, p) => sum + p.plannedTime + (p.hasCounsel ? 1 : 0), 0);
  const is105Standard = totalPlannedMinutes === TOTAL_PLANNED_MEETING_MINUTES;
  
  // Calcula horários previstos de cada parte em ordem sequencial
  const partStartTimes: string[] = [];
  let runningTime = settings.defaultTime || "";
  state.parts.forEach((p, idx) => {
    partStartTimes[idx] = runningTime;
    if (runningTime) {
      runningTime = addMinutesToTime(runningTime, p.plannedTime + (p.hasCounsel ? 1 : 0));
    }
  });

  const groupedSections = groupPartsBySection(state.parts);

  const filteredBrothers = useMemo(() => {
    if (!brotherSearch.trim()) return settings.brothers;
    const q = brotherSearch.toLowerCase();
    return settings.brothers.filter(b => 
      b.name.toLowerCase().includes(q) || b.role.toLowerCase().includes(q)
    );
  }, [settings.brothers, brotherSearch]);

  const handleAddBrotherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBrotherName.trim()) {
      onAddBrother(newBrotherName.trim(), newBrotherRole);
      setNewBrotherName('');
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#0F172A] flex flex-col items-center">
      <div className={cn("w-full p-4 sm:p-6 md:py-10 pb-36 transition-all", activeTab === 'graficos' ? "max-w-4xl" : "max-w-3xl")}>
        <header className="mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] border border-[#295E9F]/20">
                  1h 45m • Tempo Padrão
                </div>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Assistente de Palco
              </h1>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {archivedCount > 0 && (
                <button
                  onClick={onViewArchive}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#295E9F] transition-all flex items-center gap-1.5 shadow-sm shrink-0"
                  title="Ver reuniões passadas"
                >
                  <FileText className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                  Histórico ({archivedCount})
                </button>
              )}

              <div className="flex bg-white dark:bg-[#1E293B] p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                <button 
                  onClick={() => setActiveTab('programacao')}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2", 
                    activeTab === 'programacao' ? "bg-[#295E9F] text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  Programação
                </button>
                <button 
                  onClick={() => setActiveTab('congregacao')}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2", 
                    activeTab === 'congregacao' ? "bg-[#295E9F] text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  <Building2 className="w-4 h-4" />
                  Congregação
                </button>
                <button 
                  onClick={() => setActiveTab('graficos')}
                  className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2", 
                    activeTab === 'graficos' ? "bg-[#295E9F] text-white shadow-sm" : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  Gráficos
                </button>
              </div>
            </div>
          </div>
        </header>

        {activeTab === 'congregacao' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Configurações da Reunião / Congregação */}
            <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center font-bold shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Configurações da Congregação
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Defina o nome oficial da congregação e o horário habitual de início das reuniões.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSaveSettings}
                  className="min-h-[40px] px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  {isSavingSettings ? (
                    <>
                      <Check className="w-4 h-4 animate-in zoom-in" />
                      Sincronizado!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#295E9F]" />
                    Nome da Congregação
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => onUpdateSettings({ name: e.target.value })}
                    placeholder="Ex: Central"
                    className="w-full min-h-[44px] bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] outline-none font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#295E9F]" />
                    Horário Padrão de Início
                  </label>
                  <input
                    type="time"
                    value={settings.defaultTime}
                    onChange={(e) => onUpdateSettings({ defaultTime: e.target.value })}
                    className="w-full min-h-[44px] bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] outline-none font-medium"
                  />
                </div>
              </div>
            </section>

            {/* Gestão dos Irmãos e Publicadores */}
            <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center font-bold shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        Lista de Irmãos e Publicadores
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {settings.brothers.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cadastre e gerencie os nomes para seleção rápida de partes na programação.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(true)}
                  className="min-h-[40px] px-4 bg-[#295E9F]/10 hover:bg-[#295E9F]/20 text-[#295E9F] dark:text-[#4A6CA7] font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 border border-[#295E9F]/20 cursor-pointer self-start sm:self-auto"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  Importar Vários (Colar Lista)
                </button>
              </div>

              {/* Form de Adicionar Irmão Individual */}
              <form onSubmit={handleAddBrotherSubmit} className="p-4 bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#295E9F]" />
                  Adicionar Novo Irmão
                </span>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newBrotherName}
                    onChange={(e) => setNewBrotherName(e.target.value)}
                    placeholder="Nome completo do irmão..."
                    className="flex-1 min-h-[44px] bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2 text-xs sm:text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] outline-none"
                  />
                  <select
                    value={newBrotherRole}
                    onChange={(e) => setNewBrotherRole(e.target.value as Role)}
                    className="min-h-[44px] bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs sm:text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] outline-none font-medium"
                  >
                    <option value="Publicador">Publicador</option>
                    <option value="Servo Ministerial">Servo Ministerial</option>
                    <option value="Ancião">Ancião</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!newBrotherName.trim()}
                    className="min-h-[44px] px-5 bg-[#295E9F] hover:bg-[#3474C2] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
              </form>

              {/* Busca e Lista de Irmãos */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={brotherSearch}
                    onChange={(e) => setBrotherSearch(e.target.value)}
                    placeholder="Buscar por nome ou cargo..."
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#295E9F]"
                  />
                </div>

                <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {filteredBrothers.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      {brotherSearch ? "Nenhum irmão encontrado com esse termo." : "Nenhum irmão cadastrado ainda. Adicione acima ou cole uma lista."}
                    </div>
                  ) : (
                    filteredBrothers.map((brother) => (
                      <div
                        key={brother.id}
                        className="p-3 bg-slate-50 dark:bg-[#0F172A]/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                            brother.role === 'Ancião' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                            brother.role === 'Servo Ministerial' ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" :
                            "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          )}>
                            {brother.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {brother.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={brother.role}
                            onChange={(e) => onUpdateBrother(brother.id, { role: e.target.value as Role })}
                            className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg px-2 py-1 outline-none focus:border-[#295E9F]"
                          >
                            <option value="Publicador">Publicador</option>
                            <option value="Servo Ministerial">Servo Ministerial</option>
                            <option value="Ancião">Ancião</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => onRemoveBrother(brother.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Remover irmão"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'programacao' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Seção Ocultável: Importar PDF da Programação do Mês */}
            <div className="bg-white/40 dark:bg-[#1E293B]/40 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-3xl overflow-hidden shadow-lg transition-all">
              {/* Cabeçalho Clicável para Mostrar / Ocultar */}
              <button
                type="button"
                onClick={() => setIsPdfSectionOpen(!isPdfSectionOpen)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                aria-expanded={isPdfSectionOpen}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                        Importar PDF da Programação do Mês
                      </h3>
                      {importedWeekLabel ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          ✅ Aplicada: {importedWeekLabel}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Opcional
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {isPdfSectionOpen 
                        ? "Clique para ocultar o painel de importação" 
                        : "Clique para abrir e enviar o arquivo PDF da congregação"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-[#295E9F] dark:text-[#4A6CA7] hidden sm:inline">
                    {isPdfSectionOpen ? "Ocultar" : "Mostrar"}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                    {isPdfSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {/* Conteúdo Expandido */}
              {isPdfSectionOpen && (
                <div className="p-4 sm:p-5 pt-0 border-t border-slate-200/50 dark:border-slate-700/50 space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 bg-white/60 dark:bg-[#0F172A]/60 backdrop-blur-md rounded-2xl border border-white/50 dark:border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                        Envie o arquivo PDF da programação mensal da congregação. O sistema preenche automaticamente todos os temas, oradores, leitores e cânticos.
                      </p>
                      {importedWeekLabel && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          Programação atual carregada: {importedWeekLabel}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="min-h-[48px] px-6 bg-[#295E9F] hover:bg-[#3474C2] text-white rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-[#295E9F]/20 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer w-full sm:w-auto"
                    >
                      <Sparkles className="w-4 h-4" />
                      {importedWeekLabel ? "Reimportar / Trocar Semana" : "Selecionar Arquivo PDF (.pdf)"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tipo de Reunião / Semana */}
            <div className="bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Tipo de Reunião / Semana
              </label>
              <select
                value={settings.weekType}
                onChange={(e) => onUpdateSettings({ weekType: e.target.value as WeekType })}
                className="w-full min-h-[44px] bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] appearance-none font-medium"
              >
                <option value="Normal">Meio de Semana Normal (Apostila)</option>
                <option value="Visita do SC (Semana)">Visita do SC: Meio de Semana (Discurso no lugar do livro)</option>
              </select>
            </div>

            {settings.weekType === 'Visita do SC (Semana)' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300">
                <span className="font-bold uppercase text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full shrink-0">Visita SC</span>
                <span><strong>Meio de Semana:</strong> A reunião segue a programação padrão, com o <strong>Discurso de Serviço do SC (30 min)</strong> substituindo o livro final (Estudo Bíblico de Congregação).</span>
              </div>
            )}

            {/* Duração e Visão Geral */}
            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
               <div className="flex flex-col">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Início Previsto</span>
                 <span className="text-xl font-mono font-bold text-slate-900 dark:text-white">
                   {settings.defaultTime || '—'}
                 </span>
               </div>

               <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-800">
                 {is105Standard ? (
                   <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                     <CheckCircle2 className="w-4 h-4" /> 105 min (1h 45m)
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
                   {`${Math.floor(totalPlannedMinutes / 60)}h ${(totalPlannedMinutes % 60).toString().padStart(2, '0')}m`}
                 </span>
               </div>
            </div>

            {/* Part List Agrupada em Cards Separados por Cores */}
            {state.parts.length === 0 ? (
              <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 p-8 sm:p-12 rounded-3xl text-center space-y-3 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-sky-500/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center mx-auto">
                  <CalendarX className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nenhuma Parte Configurada
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Não há partes configuradas para a reunião. Por favor, adicione as partes ou faça a importação da apostila.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onUpdateSettings({ weekType: 'Normal' })}
                    className="text-xs text-[#295E9F] dark:text-[#4A6CA7] font-bold hover:underline cursor-pointer"
                  >
                    Carregar Programação Padrão
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedSections.map((group) => {
                  const sectionTotalMin = group.parts.reduce(
                    (acc, item) => acc + item.part.plannedTime + (item.part.hasCounsel ? 1 : 0), 
                    0
                  );

                  return (
                    <div 
                      key={group.section.id} 
                      className={cn(
                        "rounded-3xl border shadow-sm overflow-hidden bg-white dark:bg-[#1E293B] transition-all",
                        group.section.cardBorder
                      )}
                    >
                      {/* Cabeçalho Distinto da Seção com Barra de Cor Oficial */}
                      <div 
                        className={cn(
                          "p-3.5 sm:p-4.5 border-b flex flex-wrap items-center justify-between gap-2.5",
                          group.section.cardHeaderBg,
                          group.section.cardBorder
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-7 rounded-full shrink-0"
                            style={{ backgroundColor: group.section.color }}
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span 
                                className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-white shadow-2xs"
                                style={{ backgroundColor: group.section.color }}
                              >
                                {group.section.shortName}
                              </span>
                              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                {group.section.name}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {group.section.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/60 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span>{group.parts.length} {group.parts.length === 1 ? 'parte' : 'partes'}</span>
                          <span>•</span>
                          <span>{sectionTotalMin} min</span>
                        </div>
                      </div>

                      {/* Lista de Partes desta Seção */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {group.parts.map(({ part, originalIndex }) => {
                          const startTimeStr = partStartTimes[originalIndex];

                          return (
                            <div 
                              key={part.id} 
                              className="p-4 sm:p-4.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                            >
                              {/* Horário e Título */}
                              <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                                <div className="shrink-0 pt-0.5 sm:pt-0">
                                  <span 
                                    className="font-mono font-black px-3 py-1 rounded-xl text-xs sm:text-sm border shadow-2xs inline-block"
                                    style={{ 
                                      backgroundColor: `${group.section.color}15`, 
                                      color: group.section.color,
                                      borderColor: `${group.section.color}30` 
                                    }}
                                  >
                                    {startTimeStr || `Parte ${originalIndex + 1}`}
                                  </span>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {part.partNumber != null && (
                                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-black text-xs border border-slate-300 dark:border-slate-700 shadow-2xs">
                                        Nº {part.partNumber}
                                      </span>
                                    )}
                                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                      {part.title}
                                    </h4>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                      {part.plannedTime} min
                                    </span>
                                    {part.hasCounsel && (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                                        + 1 min conselho
                                      </span>
                                    )}
                                    {part.flexible && (
                                      <span className="text-sky-600 dark:text-sky-400 font-mono font-semibold bg-sky-500/10 px-1.5 py-0.5 rounded-md">
                                        • Tempo Flexível
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Seleção de Orador e Leitor / Ajudante com Toque Amplo */}
                              <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-2 pt-1 lg:pt-0">
                                {!part.hideSpeaker ? (
                                  <>
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                        Orador:
                                      </label>
                                      <select 
                                        value={part.speaker || ""}
                                        onChange={(e) => onUpdatePart(originalIndex, { speaker: e.target.value })}
                                        className="w-full min-h-[44px] bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] appearance-none font-medium"
                                      >
                                        <option value="">Escolher Orador...</option>
                                        {settings.brothers.map(b => (
                                          <option key={b.id} value={b.name}>{b.name} ({b.role})</option>
                                        ))}
                                      </select>
                                    </div>

                                    {part.supportsAssistant && (
                                      <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                          Leitor / Ajudante:
                                        </label>
                                        <select 
                                          value={part.assistant || ""}
                                          onChange={(e) => onUpdatePart(originalIndex, { assistant: e.target.value })}
                                          className="w-full min-h-[44px] bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] appearance-none font-medium"
                                        >
                                          <option value="">Ajudante / Leitor (Opcional)...</option>
                                          {settings.brothers.map(b => (
                                            <option key={b.id} value={b.name}>{b.name}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="w-full bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-slate-800 text-slate-400 rounded-xl px-3 py-2 text-xs text-center italic cursor-not-allowed min-h-[44px] flex items-center justify-center font-medium">
                                    Cântico Congregacional
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'graficos' && (
          <AnalyticsCharts
            archivedMeetings={archivedMeetings}
            knownBrothers={settings.brothers}
            onViewMeeting={onViewArchivedMeeting}
          />
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

      {/* Modal de Adição em Lote de Irmãos */}
      <BatchBrothersModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        existingBrothers={settings.brothers}
        onAddBrothers={(newBrothers) => {
          onAddBrothersBatch(newBrothers);
          setIsBatchModalOpen(false);
        }}
      />

      {/* Botão Primário Inteligente (Princípio 2: Altura ≥ 56px) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-40">
        <div className="max-w-3xl mx-auto">
          {state.parts.length === 0 ? (
            <div className="w-full min-h-[56px] bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 font-bold tracking-wide text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2.5 px-4 text-center select-none">
              <CalendarX className="w-5 h-5 text-sky-500 shrink-0" />
              <span>Sem partes configuradas para iniciar</span>
            </div>
          ) : (
            <button 
              onClick={onStart}
              className="w-full min-h-[56px] bg-[#295E9F] hover:bg-[#3474C2] text-white font-black tracking-widest uppercase text-lg rounded-2xl shadow-lg shadow-[#295E9F]/30 transition-all flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer animate-pulse-attention"
            >
              <Play className="w-6 h-6 fill-current animate-pulse" />
              INICIAR REUNIÃO
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
