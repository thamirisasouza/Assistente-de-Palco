import React, { useState, useMemo, useEffect } from 'react';
import { MeetingState, MeetingPart, CongregationSettings, Role, Brother, WeekType, TOTAL_PLANNED_MEETING_MINUTES, CompletedMeeting, ActionLog } from '../types';
import { 
  Plus, Trash2, Clock, Users, Calendar, Building2, Edit2, X, Check, 
  FileText, CheckCircle2, CalendarX, 
  UserPlus, ClipboardPaste, ChevronLeft, ChevronRight,
  Cloud, RefreshCw, Search, Save, Settings as SettingsIcon, Download,
  ArrowRight, RotateCcw, ShieldCheck
} from 'lucide-react';
import { cn, addMinutesToTime, formatBalanceDisplay, getBalanceColorClass } from '../lib/utils';
import { ImportApostilaModal } from './ImportApostilaModal';
import { BatchBrothersModal } from './BatchBrothersModal';
import { groupPartsBySection } from '../lib/sectionColors';
import { AnalyticsCharts } from './AnalyticsCharts';
import { exportMeetingToPdf } from '../lib/pdfExporter';
import { NavTab } from './BottomNavigation';
import { ActionLogs } from './ActionLogs';
import { 
  MonthPdfParseResult, 
  findMatchingWeekForDate, 
  groupWeeksByMonth, 
  getWeekMonthInfo,
  ParsedWeekSchedule 
} from '../lib/apostilaParser';

interface SetupProps {
  state: MeetingState;
  settings: CongregationSettings;
  archivedCount: number;
  archivedMeetings: CompletedMeeting[];
  firebaseStatus?: 'synced' | 'syncing' | 'offline';
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
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
  onDeleteMeeting?: (id: string) => void;
  onRestoreLog?: (log: ActionLog) => void;
  onRecoverMissingHistory?: () => Promise<number>;
  onApplyMonthSchedule?: (result: MonthPdfParseResult) => void;
  onSelectWeek?: (weekId: string) => void;
  onRemoveMonthFromSchedule?: (monthKey: string) => void;
  onClearMonthlySchedule?: () => void;
  isImportModalOpen?: boolean;
  onSetIsImportModalOpen?: (open: boolean) => void;
}

export function Setup({ 
  state, settings, archivedMeetings,
  activeTab = 'programacao', onTabChange, onUpdatePart, onApplyAllParts,
  onUpdateSettings, onUpdateBrother, onAddBrother, onAddBrothersBatch, onRemoveBrother, 
  onViewArchive, onViewArchivedMeeting, onDeleteMeeting,
  onRestoreLog, onRecoverMissingHistory,
  onApplyMonthSchedule, onSelectWeek, onRemoveMonthFromSchedule, onClearMonthlySchedule,
  isImportModalOpen: controlledImportModalOpen,
  onSetIsImportModalOpen
}: SetupProps) {
  const [internalImportModalOpen, setInternalImportModalOpen] = useState(false);
  const isImportModalOpen = controlledImportModalOpen !== undefined ? controlledImportModalOpen : internalImportModalOpen;
  const setIsImportModalOpen = onSetIsImportModalOpen || setInternalImportModalOpen;

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [showConfirmClearSchedule, setShowConfirmClearSchedule] = useState(false);
  const [confirmDeleteMeetingId, setConfirmDeleteMeetingId] = useState<string | null>(null);

  // Estados para adição e busca de irmãos
  const [newBrotherName, setNewBrotherName] = useState('');
  const [newBrotherRole, setNewBrotherRole] = useState<Role>('Publicador');
  const [brotherSearch, setBrotherSearch] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Estados para edição de nome e privilégio do irmão
  const [editingBrotherId, setEditingBrotherId] = useState<string | null>(null);
  const [editingBrotherName, setEditingBrotherName] = useState('');
  const [editingBrotherRole, setEditingBrotherRole] = useState<Role>('Publicador');

  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [isRecoveringHistory, setIsRecoveringHistory] = useState(false);
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null);

  const handleSaveSettings = () => {
    setIsSavingSettings(true);
    setTimeout(() => {
      setIsSavingSettings(false);
    }, 1200);
  };

  const [importedWeekLabel, setImportedWeekLabel] = useState<string | null>(null);

  // Calcula horários previstos de cada parte em ordem sequencial
  const partStartTimes: string[] = [];
  let runningTime = settings.defaultTime || "19:30";
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
      setNewBrotherRole('Publicador');
    }
  };

  const handleStartEditBrother = (brother: Brother) => {
    setEditingBrotherId(brother.id);
    setEditingBrotherName(brother.name);
    setEditingBrotherRole(brother.role);
  };

  const handleSaveEditBrother = (id: string) => {
    const trimmed = editingBrotherName.trim();
    if (trimmed) {
      onUpdateBrother(id, { name: trimmed, role: editingBrotherRole });
    }
    setEditingBrotherId(null);
    setEditingBrotherName('');
  };

  const handleCancelEditBrother = () => {
    setEditingBrotherId(null);
    setEditingBrotherName('');
  };

  const handleExportMeetingPdf = (m: CompletedMeeting) => {
    setDownloadingPdfId(m.id);
    try {
      exportMeetingToPdf(m);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setDownloadingPdfId(null), 1000);
    }
  };

  const handleRecoverHistoryClick = async () => {
    if (!onRecoverMissingHistory) return;
    setIsRecoveringHistory(true);
    setRecoveryFeedback(null);
    try {
      const total = await onRecoverMissingHistory();
      setRecoveryFeedback(`Histórico sincronizado (${total} ${total === 1 ? 'reunião' : 'reuniões'} disponíveis)`);
      setTimeout(() => setRecoveryFeedback(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRecoveringHistory(false);
    }
  };

  // Agrupamento das semanas do PDF por Mês em ordem cronológica
  const monthGroups = useMemo(() => {
    if (!settings.monthlySchedule?.weeks || settings.monthlySchedule.weeks.length === 0) return [];
    return groupWeeksByMonth(settings.monthlySchedule.weeks);
  }, [settings.monthlySchedule]);

  // Semana vigente (correspondente à data de hoje)
  const currentMatchingWeek = useMemo(() => {
    if (!settings.monthlySchedule?.weeks || settings.monthlySchedule.weeks.length === 0) return null;
    return findMatchingWeekForDate(settings.monthlySchedule.weeks, new Date());
  }, [settings.monthlySchedule]);

  // Mês correspondente à semana vigente de hoje
  const currentDateMonthKey = useMemo(() => {
    if (currentMatchingWeek) {
      return getWeekMonthInfo(currentMatchingWeek).monthKey;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [currentMatchingWeek]);

  // Controle do mês visível no seletor de meses
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null);

  // Sincroniza automaticamente a aba de mês quando a semana selecionada (ou semana vigente) muda
  useEffect(() => {
    if (monthGroups.length === 0) {
      setActiveMonthKey(null);
      return;
    }

    const allWeeks: ParsedWeekSchedule[] = settings.monthlySchedule?.weeks || [];
    const selectedWeek = allWeeks.find(w => w.id === settings.selectedWeekId) || currentMatchingWeek || allWeeks[0];

    if (selectedWeek) {
      const targetMonthKey = getWeekMonthInfo(selectedWeek).monthKey;
      setActiveMonthKey(targetMonthKey);
    } else if (!activeMonthKey || !monthGroups.some(g => g.monthKey === activeMonthKey)) {
      setActiveMonthKey(monthGroups[0].monthKey);
    }
  }, [settings.selectedWeekId, currentMatchingWeek?.id, monthGroups.length]);

  const activeMonthIndex = useMemo(() => {
    if (monthGroups.length === 0) return 0;
    const idx = monthGroups.findIndex(g => g.monthKey === activeMonthKey);
    return idx >= 0 ? idx : 0;
  }, [monthGroups, activeMonthKey]);

  const activeMonthGroup = monthGroups[activeMonthIndex] || null;

  const handlePrevMonth = () => {
    if (activeMonthIndex > 0) {
      const prevGroup = monthGroups[activeMonthIndex - 1];
      setActiveMonthKey(prevGroup.monthKey);
    }
  };

  const handleNextMonth = () => {
    if (activeMonthIndex < monthGroups.length - 1) {
      const nextGroup = monthGroups[activeMonthIndex + 1];
      setActiveMonthKey(nextGroup.monthKey);
    }
  };

  const handleGoToCurrentMonthAndWeek = () => {
    if (currentMatchingWeek) {
      const targetMonthKey = getWeekMonthInfo(currentMatchingWeek).monthKey;
      setActiveMonthKey(targetMonthKey);
      if (onSelectWeek) {
        onSelectWeek(currentMatchingWeek.id);
      }
    }
  };

  const weekDisplay = importedWeekLabel || state.importedWeekLabel || settings.importedWeekLabel || 'Programação da Semana';

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#0F172A] flex flex-col items-center pb-28">
      <div className={cn(
        "w-full px-4 sm:px-6 py-4 sm:py-6 transition-all",
        activeTab === 'graficos' ? "max-w-4xl" : "max-w-2xl"
      )}>
        
        {/* ========================================================= */}
        {/* ABA 1: PROGRAMAÇÃO (DASHBOARD PRINCIPAL) */}
        {/* ========================================================= */}
        {activeTab === 'programacao' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            
            {/* Card Principal: Resumo da Reunião e Seletor de Semanas por Mês */}
            <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
              {/* Cabeçalho do Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7]">
                      1h 45m • Tempo Padrão
                    </span>
                    {settings.weekType === 'Visita do SC (Semana)' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        Visita do SC
                      </span>
                    )}
                    {monthGroups.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 font-mono">
                        {monthGroups.length} {monthGroups.length === 1 ? 'mês' : 'meses'} • {settings.monthlySchedule?.weeks?.length || 0} semanas
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {weekDisplay}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Início: <strong className="text-slate-800 dark:text-slate-200">{settings.defaultTime || '19:30'}</strong> • {state.parts.length} partes programadas
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-3.5 py-2 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 text-[#295E9F] dark:text-[#4A6CA7] border border-sky-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    title="Importar PDF da apostila mensal"
                  >
                    Importar PDF
                  </button>

                  {monthGroups.length > 0 && onClearMonthlySchedule && (
                    <button
                      type="button"
                      onClick={() => setShowConfirmClearSchedule(prev => !prev)}
                      className="p-2 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer border border-transparent hover:border-red-200"
                      title="Gerenciar / remover escala mensal de PDF"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Confirmação inline para excluir escala do mês ou todas (sem afetar o histórico) */}
              {showConfirmClearSchedule && activeMonthGroup && (
                <div className="p-3 rounded-2xl bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-2 animate-in fade-in duration-200">
                  <p className="text-xs font-semibold text-red-800 dark:text-red-200">
                    Deseja remover a escala de PDF? (O histórico de reuniões realizadas permanecerá salvo).
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {monthGroups.length > 1 && onRemoveMonthFromSchedule && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveMonthFromSchedule(activeMonthGroup.monthKey);
                          setShowConfirmClearSchedule(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Remover apenas {activeMonthGroup.monthLabel}
                      </button>
                    )}
                    {onClearMonthlySchedule && (
                      <button
                        type="button"
                        onClick={() => {
                          onClearMonthlySchedule();
                          setShowConfirmClearSchedule(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Remover todos os PDFs
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirmClearSchedule(false)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Seletor de Semanas Organizado por Mês com Setas (Anterior / Atual / Próximo) */}
              {activeMonthGroup && (
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                  
                  {/* Barra de Navegação de Meses */}
                  <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-[#0F172A] px-2.5 py-2 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      disabled={activeMonthIndex <= 0}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#1E293B] disabled:opacity-35 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                      title="Ver mês anterior"
                    >
                      <ChevronLeft className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                      <span className="hidden xs:inline">
                        {activeMonthIndex > 0 ? monthGroups[activeMonthIndex - 1].shortMonthLabel : 'Anterior'}
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap justify-center text-center">
                      <Calendar className="w-3.5 h-3.5 text-[#295E9F] dark:text-[#4A6CA7] shrink-0" />
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
                        {activeMonthGroup.monthLabel}
                      </span>

                      {activeMonthGroup.monthKey === currentDateMonthKey ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          Mês Atual
                        </span>
                      ) : (
                        currentMatchingWeek && (
                          <button
                            type="button"
                            onClick={handleGoToCurrentMonthAndWeek}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#295E9F]/15 text-[#295E9F] dark:text-sky-300 hover:bg-[#295E9F] hover:text-white transition-colors cursor-pointer"
                            title="Voltar para o mês e semana vigente"
                          >
                            Ir para Mês Atual
                          </button>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleNextMonth}
                      disabled={activeMonthIndex >= monthGroups.length - 1}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#1E293B] disabled:opacity-35 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                      title="Ver próximo mês"
                    >
                      <span className="hidden xs:inline">
                        {activeMonthIndex < monthGroups.length - 1 ? monthGroups[activeMonthIndex + 1].shortMonthLabel : 'Próximo'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                    </button>
                  </div>

                  {/* Semanas do Mês Selecionado */}
                  <div className={cn(
                    "grid gap-2",
                    activeMonthGroup.weeks.length >= 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"
                  )}>
                    {activeMonthGroup.weeks.map((week) => {
                      const isSelected = (settings.selectedWeekId === week.id) || (!settings.selectedWeekId && week.id === (currentMatchingWeek?.id || settings.monthlySchedule?.weeks[0]?.id));
                      const isCurrentDateWeek = currentMatchingWeek?.id === week.id;

                      return (
                        <button
                          key={week.id}
                          type="button"
                          onClick={() => onSelectWeek && onSelectWeek(week.id)}
                          className={cn(
                            "p-2.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer",
                            isSelected 
                              ? "bg-[#295E9F] text-white border-[#295E9F] shadow-sm shadow-[#295E9F]/20 ring-2 ring-[#295E9F]/30" 
                              : "bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-sky-300"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider truncate",
                              isSelected ? "text-sky-100" : "text-slate-400"
                            )}>
                              {week.date}
                            </span>
                            {isCurrentDateWeek && (
                              <span className={cn(
                                "text-[9px] px-1.5 py-0.2 rounded-md font-bold shrink-0",
                                isSelected ? "bg-emerald-400 text-emerald-950" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              )}>
                                Vigente
                              </span>
                            )}
                          </div>
                          <p className={cn(
                            "text-[11px] font-semibold line-clamp-1",
                            isSelected ? "text-white" : "text-slate-700 dark:text-slate-300"
                          )}>
                            {week.bibleReading || week.weekLabel}
                          </p>
                          {week.president && (
                            <span className={cn(
                              "text-[10px] truncate mt-0.5 block",
                              isSelected ? "text-sky-100/80" : "text-slate-400"
                            )}>
                              👤 {week.president}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Barra de Modalidade da Reunião */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Modalidade:</span>
                <select
                  value={settings.weekType}
                  onChange={(e) => onUpdateSettings({ weekType: e.target.value as WeekType })}
                  className="bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl px-2 py-1 outline-none cursor-pointer"
                >
                  <option value="Normal">Meio de Semana Normal</option>
                  <option value="Visita do SC (Semana)">Visita do SC (Discurso 30 min)</option>
                </select>
              </div>
            </div>

            {/* Resumo da Última Reunião Concluída */}
            {archivedMeetings.length > 0 && (
              <div className="bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Última Reunião: {archivedMeetings[0].data_formatada || archivedMeetings[0].data_reuniao_curta}
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", getBalanceColorClass(archivedMeetings[0].saldo_final_segundos).badge)}>
                        {formatBalanceDisplay(archivedMeetings[0].saldo_final_segundos)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {archivedMeetings[0].semana_apostila} • {archivedMeetings[0].duracao_real_minutos} min reais
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onTabChange ? onTabChange('historico') : onViewArchive()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-[#295E9F] hover:text-white text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  Histórico
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Lista de Partes com Design Minimalista & Limpo */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Ordem da Programação
                </h3>
                <span className="text-xs font-medium text-slate-400">
                  {state.parts.length} itens
                </span>
              </div>

              {state.parts.length === 0 ? (
                <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 p-8 rounded-3xl text-center space-y-3 shadow-xs">
                  <CalendarX className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Nenhuma parte carregada</h4>
                  <p className="text-xs text-slate-500">Importe o PDF da apostila ou selecione uma semana padrão.</p>
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-4 py-2 bg-[#295E9F] text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Importar PDF
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedSections.map((group) => {
                    return (
                      <div 
                        key={group.section.id}
                        className="bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden"
                      >
                        {/* Seção Header */}
                        <div 
                          className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60"
                          style={{ backgroundColor: `${group.section.color}10` }}
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: group.section.color }}
                            />
                            <span 
                              className="text-xs font-bold tracking-wide uppercase"
                              style={{ color: group.section.color }}
                            >
                              {group.section.name}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 font-semibold">
                            {group.parts.reduce((sum, item) => sum + item.part.plannedTime + (item.part.hasCounsel ? 1 : 0), 0)} min
                          </span>
                        </div>

                        {/* Partes da Seção */}
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {group.parts.map(({ part, originalIndex }) => {
                            const startTimeStr = partStartTimes[originalIndex];

                            return (
                              <div 
                                key={part.id}
                                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                              >
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  {/* Horário estimado */}
                                  <div className="shrink-0 pt-0.5">
                                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg inline-block">
                                      {startTimeStr || `${originalIndex + 1}`}
                                    </span>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {part.partNumber != null && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                                          Nº {part.partNumber}
                                        </span>
                                      )}
                                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                        {part.title}
                                      </h4>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                                        {part.plannedTime} min
                                      </span>
                                      {part.hasCounsel && (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                          • +1 min conselho
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Seletor de Orador/Leitor */}
                                <div className="w-full sm:w-56 shrink-0 space-y-1.5">
                                  {!part.hideSpeaker ? (
                                    <>
                                      <select 
                                        value={part.speaker || ""}
                                        onChange={(e) => onUpdatePart(originalIndex, { speaker: e.target.value })}
                                        className="w-full min-h-[38px] bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:border-[#295E9F] outline-none font-medium truncate cursor-pointer"
                                      >
                                        <option value="">👤 Selecionar Orador...</option>
                                        {settings.brothers.map(b => (
                                          <option key={b.id} value={b.name}>{b.name} ({b.role})</option>
                                        ))}
                                      </select>

                                      {part.supportsAssistant && (
                                        <select 
                                          value={part.assistant || ""}
                                          onChange={(e) => onUpdatePart(originalIndex, { assistant: e.target.value })}
                                          className="w-full min-h-[38px] bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:border-[#295E9F] outline-none font-medium truncate cursor-pointer"
                                        >
                                          <option value="">📖 Leitor / Ajudante...</option>
                                          {settings.brothers.map(b => (
                                            <option key={b.id} value={b.name}>{b.name} ({b.role})</option>
                                          ))}
                                        </select>
                                      )}
                                    </>
                                  ) : (
                                    <div className="w-full bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-slate-800 text-slate-400 rounded-xl px-2.5 py-2 text-[11px] text-center italic">
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

          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 2: PUBLICADORES (IRMÃOS) COM EDIÇÃO DE NOME */}
        {/* ========================================================= */}
        {activeTab === 'publicadores' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#295E9F]" />
                    Irmãos e Publicadores
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {settings.brothers.length} irmãos cadastrados na congregação • Clique no lápis para editar o nome
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(true)}
                  className="px-4 py-2.5 bg-[#295E9F]/10 hover:bg-[#295E9F]/20 text-[#295E9F] dark:text-[#4A6CA7] font-bold text-xs rounded-2xl border border-[#295E9F]/20 flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
                >
                  <ClipboardPaste className="w-4 h-4" />
                  Importar em Lote
                </button>
              </div>

              {/* Form Adicionar */}
              <form onSubmit={handleAddBrotherSubmit} className="p-3.5 bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#295E9F]" />
                  Adicionar Novo Irmão
                </span>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={newBrotherName}
                    onChange={(e) => setNewBrotherName(e.target.value)}
                    placeholder="Nome completo do irmão..."
                    className="flex-1 min-h-[42px] bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:border-[#295E9F] outline-none"
                  />
                  <select
                    value={newBrotherRole}
                    onChange={(e) => setNewBrotherRole(e.target.value as Role)}
                    className="min-h-[42px] bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:border-[#295E9F] outline-none font-medium"
                  >
                    <option value="Publicador">Publicador</option>
                    <option value="Servo Ministerial">Servo Ministerial</option>
                    <option value="Ancião">Ancião</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!newBrotherName.trim()}
                    className="min-h-[42px] px-4 bg-[#295E9F] hover:bg-[#3474C2] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
              </form>

              {/* Busca e Lista */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={brotherSearch}
                    onChange={(e) => setBrotherSearch(e.target.value)}
                    placeholder="Buscar por nome ou privilégio..."
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-[#295E9F]"
                  />
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredBrothers.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      {brotherSearch ? "Nenhum irmão encontrado." : "Nenhum irmão cadastrado ainda."}
                    </div>
                  ) : (
                    filteredBrothers.map((b) => {
                      const isEditing = editingBrotherId === b.id;

                      return (
                        <div key={b.id} className="py-2.5 flex items-center justify-between gap-2">
                          {isEditing ? (
                            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 dark:bg-[#0F172A] p-2 rounded-xl border border-[#295E9F]/40">
                              <input
                                type="text"
                                value={editingBrotherName}
                                onChange={(e) => setEditingBrotherName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEditBrother(b.id);
                                  if (e.key === 'Escape') handleCancelEditBrother();
                                }}
                                autoFocus
                                placeholder="Nome do irmão..."
                                className="flex-1 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-[#295E9F]"
                              />
                              <div className="flex items-center gap-1.5 justify-end">
                                <select
                                  value={editingBrotherRole}
                                  onChange={(e) => setEditingBrotherRole(e.target.value as Role)}
                                  className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold outline-none"
                                >
                                  <option value="Publicador">Publicador</option>
                                  <option value="Servo Ministerial">Servo Ministerial</option>
                                  <option value="Ancião">Ancião</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditBrother(b.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                                  title="Salvar alterações"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditBrother}
                                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center font-bold text-xs shrink-0">
                                  {b.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <span 
                                    onClick={() => handleStartEditBrother(b)}
                                    className="text-xs font-bold text-slate-900 dark:text-white block truncate hover:text-[#295E9F] dark:hover:text-[#4A6CA7] cursor-pointer"
                                    title="Clique para editar o nome"
                                  >
                                    {b.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-medium">
                                    {b.role}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditBrother(b)}
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-[#295E9F] dark:hover:text-[#4A6CA7] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
                                  title="Editar nome do irmão"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextRole: Role = b.role === 'Publicador' ? 'Servo Ministerial' : b.role === 'Servo Ministerial' ? 'Ancião' : 'Publicador';
                                    onUpdateBrother(b.id, { role: nextRole });
                                  }}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                                  title="Alterar privilégio"
                                >
                                  {b.role}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRemoveBrother(b.id)}
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 flex items-center justify-center cursor-pointer"
                                  title="Remover irmão"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 3: CONFIGURAÇÕES DA CONGREGAÇÃO */}
        {/* ========================================================= */}
        {activeTab === 'configuracoes' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-[#295E9F]" />
                    Configurações da Reunião
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Dados da congregação e padrões sincronizados na nuvem
                  </p>
                </div>

                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingSettings ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {isSavingSettings ? "Salvo!" : "Salvar"}
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#295E9F]" />
                    Nome da Congregação
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => onUpdateSettings({ name: e.target.value })}
                    placeholder="Ex: Jd. Rosana - Ferraz de Vasconcelos, SP"
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:border-[#295E9F] outline-none font-medium"
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
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:border-[#295E9F] outline-none font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#295E9F]" />
                    Presidente da Reunião Habitual (Opcional)
                  </label>
                  <input
                    type="text"
                    value={settings.presidentName}
                    onChange={(e) => onUpdateSettings({ presidentName: e.target.value })}
                    placeholder="Nome do Presidente da Reunião"
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:border-[#295E9F] outline-none font-medium"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-xs text-slate-500">
                <Cloud className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Sincronização em tempo real ativada com o Firebase Firestore.</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 4: HISTÓRICO DE REUNIÕES (PERSISTENTE E INDEPENDENTE) */}
        {/* ========================================================= */}
        {activeTab === 'historico' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#295E9F]" />
                    Histórico de Reuniões Gravadas
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>{archivedMeetings.length} {archivedMeetings.length === 1 ? 'reunião salva' : 'reuniões salvas'} permanentemente</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> Persistente (independente de PDFs)
                    </span>
                  </p>
                </div>

                {onRecoverMissingHistory && (
                  <button
                    type="button"
                    onClick={handleRecoverHistoryClick}
                    disabled={isRecoveringHistory}
                    className="px-3.5 py-2 rounded-2xl bg-[#295E9F]/10 hover:bg-[#295E9F]/20 text-[#295E9F] dark:text-[#4A6CA7] border border-[#295E9F]/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
                    title="Recuperar históricos de reuniões a partir da nuvem e logs"
                  >
                    <RotateCcw className={cn("w-3.5 h-3.5", isRecoveringHistory && "animate-spin")} />
                    {isRecoveringHistory ? "Recuperando..." : "Recuperar / Sincronizar"}
                  </button>
                )}
              </div>

              {recoveryFeedback && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{recoveryFeedback}</span>
                </div>
              )}

              {archivedMeetings.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-3">
                  <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs">Nenhuma reunião encontrada no momento.</p>
                  {onRecoverMissingHistory && (
                    <button
                      type="button"
                      onClick={handleRecoverHistoryClick}
                      className="px-4 py-2 rounded-xl bg-[#295E9F] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Buscar e Recuperar Históricos
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {archivedMeetings.map((m) => {
                    const balanceColors = getBalanceColorClass(m.saldo_final_segundos);
                    const isDownloading = downloadingPdfId === m.id;
                    const isConfirmingDelete = confirmDeleteMeetingId === m.id;

                    return (
                      <div key={m.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors rounded-2xl px-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {m.data_formatada || m.data_reuniao_curta}
                            </span>
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", balanceColors.badge)}>
                              {formatBalanceDisplay(m.saldo_final_segundos)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {m.semana_apostila} • {m.duracao_real_minutos} min reais
                          </p>
                          {(m.salvo_por_email || m.user_email) && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              👤 Salvo por: {m.salvo_por_email || m.user_email}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <button
                            onClick={() => handleExportMeetingPdf(m)}
                            disabled={isDownloading}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-200 cursor-pointer"
                            title="Baixar PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>

                          {onViewArchivedMeeting && (
                            <button
                              onClick={() => onViewArchivedMeeting(m)}
                              className="px-3 py-1.5 rounded-xl bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] text-xs font-bold hover:bg-[#295E9F]/20 cursor-pointer"
                            >
                              Ver Resumo
                            </button>
                          )}

                          {onDeleteMeeting && (
                            isConfirmingDelete ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteMeeting(m.id);
                                    setConfirmDeleteMeetingId(null);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMeetingId(null)}
                                  className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteMeetingId(m.id)}
                                className="w-8 h-8 rounded-xl text-slate-400 hover:text-red-500 flex items-center justify-center cursor-pointer"
                                title="Excluir do histórico"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 5: GRÁFICOS */}
        {/* ========================================================= */}
        {activeTab === 'graficos' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <AnalyticsCharts
              archivedMeetings={archivedMeetings}
              knownBrothers={settings.brothers}
              onViewMeeting={onViewArchivedMeeting}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA 6: LOGS */}
        {/* ========================================================= */}
        {activeTab === 'log' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <ActionLogs 
              archivedMeetings={archivedMeetings}
              onRestoreLog={onRestoreLog}
            />
          </div>
        )}

      </div>

      {/* Modal de Importação Mensal de PDF */}
      <ImportApostilaModal
        isOpen={isImportModalOpen}
        currentParts={state.parts}
        existingBrothers={settings.brothers}
        onClose={() => setIsImportModalOpen(false)}
        onApplyMonthSchedule={onApplyMonthSchedule}
        onApplyWeek={(newParts, week, allBrothersFound, congregationName) => {
          onApplyAllParts(newParts);
          setImportedWeekLabel(week.weekLabel);

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
    </div>
  );
}
