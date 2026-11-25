import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  parseMonthlyPdfText, 
  ParsedWeekSchedule, 
  MonthPdfParseResult, 
  applyPdfWeekToMeetingParts,
  findMatchingWeekForDate,
  groupWeeksByMonth,
  getWeekMonthInfo
} from '../lib/apostilaParser';
import { readPdfFile } from '../lib/pdfReader';
import { MeetingPart, Brother } from '../types';
import { 
  FileText, 
  Check, 
  X, 
  ArrowRight, 
  Music, 
  CheckCircle2, 
  RefreshCw, 
  UploadCloud, 
  Calendar, 
  User, 
  Building2, 
  FileCheck2, 
  FileCode, 
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ImportApostilaModalProps {
  isOpen: boolean;
  currentParts: MeetingPart[];
  existingBrothers: Brother[];
  onClose: () => void;
  onApplyWeek: (
    newParts: MeetingPart[], 
    week: ParsedWeekSchedule, 
    allBrothersFound: string[], 
    congregationName?: string
  ) => void;
  onApplyMonthSchedule?: (result: MonthPdfParseResult) => void;
}

export function ImportApostilaModal({
  isOpen,
  currentParts,
  onClose,
  onApplyWeek,
  onApplyMonthSchedule
}: ImportApostilaModalProps) {
  const [activeInputMode, setActiveInputMode] = useState<'upload' | 'paste'>('upload');
  const [inputText, setInputText] = useState("");
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [loadedPdfs, setLoadedPdfs] = useState<{id: string, name: string, text: string}[]>([]);
  const [parseResult, setParseResult] = useState<MonthPdfParseResult | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monthGroups = useMemo(() => {
    if (!parseResult?.weeks?.length) return [];
    return groupWeeksByMonth(parseResult.weeks);
  }, [parseResult]);

  const currentMatchingWeek = useMemo(() => {
    if (!parseResult?.weeks?.length) return null;
    return findMatchingWeekForDate(parseResult.weeks, new Date());
  }, [parseResult]);

  const currentMatchingMonthKey = useMemo(() => {
    if (!currentMatchingWeek) return null;
    return getWeekMonthInfo(currentMatchingWeek).monthKey;
  }, [currentMatchingWeek]);

  // Garante que o mês ativo e a semana selecionada estejam sincronizados
  useEffect(() => {
    if (!parseResult?.weeks?.length) return;
    const targetWeek = parseResult.weeks.find(w => w.id === selectedWeekId) || currentMatchingWeek || parseResult.weeks[0];
    if (targetWeek) {
      if (selectedWeekId !== targetWeek.id) {
        setSelectedWeekId(targetWeek.id);
      }
      if (!activeMonthKey || !monthGroups.some(g => g.monthKey === activeMonthKey)) {
        setActiveMonthKey(getWeekMonthInfo(targetWeek).monthKey);
      }
    }
  }, [parseResult, selectedWeekId, currentMatchingWeek, activeMonthKey, monthGroups]);

  const activeMonthIndex = useMemo(() => {
    if (!monthGroups.length) return 0;
    const idx = monthGroups.findIndex(g => g.monthKey === activeMonthKey);
    return idx >= 0 ? idx : 0;
  }, [monthGroups, activeMonthKey]);

  const activeMonthGroup = monthGroups[activeMonthIndex] || null;

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    
    const filesToProcess = files.slice(0, 10);
    setIsProcessingPdf(true);

    try {
      const newPdfs = [];
      for (const file of filesToProcess) {
        const extracted = await readPdfFile(file);
        newPdfs.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          text: extracted.fullText
        });
      }
      
      const allPdfs = [...loadedPdfs, ...newPdfs];
      setLoadedPdfs(allPdfs);
      
      const combinedText = allPdfs.map(p => p.text).join("\n\n--- NOVA PÁGINA ---\n\n");
      
      setInputText(combinedText);
      const parsed = parseMonthlyPdfText(combinedText);
      setParseResult(parsed);

      const matchingWeek = findMatchingWeekForDate(parsed.weeks, new Date()) || parsed.weeks[0];
      if (matchingWeek) {
        setSelectedWeekId(matchingWeek.id);
        setActiveMonthKey(getWeekMonthInfo(matchingWeek).monthKey);
      }
      setStep('review');
    } catch (err) {
      console.error("Erro ao ler PDF(s):", err);
      setActiveInputMode('paste');
    } finally {
      setIsProcessingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePdf = (id: string) => {
    const updatedPdfs = loadedPdfs.filter(p => p.id !== id);
    setLoadedPdfs(updatedPdfs);
    
    if (updatedPdfs.length === 0) {
      setInputText("");
      setParseResult(null);
      setSelectedWeekId(null);
      setActiveMonthKey(null);
      setStep('input');
      return;
    }
    
    const combinedText = updatedPdfs.map(p => p.text).join("\n\n--- NOVA PÁGINA ---\n\n");
    setInputText(combinedText);
    const parsed = parseMonthlyPdfText(combinedText);
    setParseResult(parsed);
    
    const matchingWeek = findMatchingWeekForDate(parsed.weeks, new Date()) || parsed.weeks[0];
    if (matchingWeek) {
      setSelectedWeekId(matchingWeek.id);
      setActiveMonthKey(getWeekMonthInfo(matchingWeek).monthKey);
    }
  };

  const handleProcessText = () => {
    if (!inputText.trim()) return;
    const parsed = parseMonthlyPdfText(inputText);
    setParseResult(parsed);

    const matchingWeek = findMatchingWeekForDate(parsed.weeks, new Date()) || parsed.weeks[0];
    if (matchingWeek) {
      setSelectedWeekId(matchingWeek.id);
      setActiveMonthKey(getWeekMonthInfo(matchingWeek).monthKey);
    }
    setStep('review');
  };

  const selectedWeek: ParsedWeekSchedule | null = 
    parseResult?.weeks.find(w => w.id === selectedWeekId) ||
    parseResult?.weeks[0] ||
    null;

  const handleApplyCurrentWeek = () => {
    if (!selectedWeek || !parseResult) return;

    if (onApplyMonthSchedule) {
      onApplyMonthSchedule(parseResult);
    } else {
      const updatedParts = applyPdfWeekToMeetingParts(currentParts, selectedWeek);
      onApplyWeek(
        updatedParts, 
        selectedWeek, 
        parseResult.allBrothersFound, 
        parseResult.congregationName
      );
    }
    onClose();
  };

  const handlePrevMonth = () => {
    if (activeMonthIndex > 0) {
      const prevGroup = monthGroups[activeMonthIndex - 1];
      setActiveMonthKey(prevGroup.monthKey);
      if (prevGroup.weeks[0]) {
        setSelectedWeekId(prevGroup.weeks[0].id);
      }
    }
  };

  const handleNextMonth = () => {
    if (activeMonthIndex < monthGroups.length - 1) {
      const nextGroup = monthGroups[activeMonthIndex + 1];
      setActiveMonthKey(nextGroup.monthKey);
      if (nextGroup.weeks[0]) {
        setSelectedWeekId(nextGroup.weeks[0].id);
      }
    }
  };

  const handleGoToCurrentMonth = () => {
    if (currentMatchingWeek && currentMatchingMonthKey) {
      setActiveMonthKey(currentMatchingMonthKey);
      setSelectedWeekId(currentMatchingWeek.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0F172A]/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center shadow-inner">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Importador Mensal de Programação (PDF)
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Organiza as semanas por mês automaticamente e seleciona a semana vigente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="application/pdf"
            multiple
            className="hidden"
          />
          {step === 'input' ? (
            /* ETAPA 1: ESCOLHA DE ENTRADA (PDF OU TEXTO) */
            <div className="space-y-5">
              
              {/* Abas de Modo */}
              <div className="flex bg-slate-100 dark:bg-[#0F172A] p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('upload')}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                    activeInputMode === 'upload'
                      ? "bg-white dark:bg-[#1E293B] text-[#295E9F] dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <UploadCloud className="w-4 h-4" />
                  Carregar Arquivo PDF (.pdf)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInputMode('paste')}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                    activeInputMode === 'paste'
                      ? "bg-white dark:bg-[#1E293B] text-[#295E9F] dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <FileCode className="w-4 h-4" />
                  Colar Texto / OCR
                </button>
              </div>

              {activeInputMode === 'upload' ? (
                /* UPLOAD DRAG & DROP */
                <div className="space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#295E9F] dark:hover:border-[#4A6CA7] rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-[#0F172A]/30 hover:bg-[#295E9F]/5 flex flex-col items-center justify-center gap-3 group"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-[#295E9F]/10 dark:bg-[#295E9F]/20 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        {isProcessingPdf ? "Lendo e interpretando PDFs..." : "Clique para selecionar ou arraste até 10 PDFs"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Você pode selecionar vários PDFs de diferentes meses de uma vez
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessingPdf}
                      className="mt-2 px-5 py-2.5 bg-[#295E9F] hover:bg-[#3474C2] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      {isProcessingPdf ? "Processando..." : "Selecionar Arquivos PDF"}
                    </button>
                  </div>
                </div>
              ) : (
                /* COLAGEM DE TEXTO */
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Texto do PDF da Reunião:
                    </label>
                  </div>

                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    rows={10}
                    placeholder="Cole aqui o texto copiado do PDF (ex: '3 de agosto de 2026 | JEREMIAS 22-23 Presidente José Carlos...')"
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl p-4 text-xs font-mono focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] resize-none"
                  />
                </div>
              )}

              {/* Informações sobre o Reconhecimento */}
              <div className="bg-slate-100/80 dark:bg-[#0F172A]/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  O que o sistema faz automaticamente:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Separa e organiza as semanas por Mês</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Seleciona automaticamente a semana vigente</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Presidente, Orações, Discurso, Joias e Leitura</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Ministério, Vida Cristã e Estudo Bíblico</span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* ETAPA 2: REVISÃO E SELEÇÃO DE SEMANA POR MÊS */
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Cabeçalho da Congregação e Navegação por Mês */}
              <div className="bg-slate-100 dark:bg-[#0F172A] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                      {parseResult?.congregationName || "Congregação Detectada"}
                    </span>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-[#295E9F] dark:text-[#4A6CA7] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Adicionar outro PDF
                  </button>
                </div>

                {loadedPdfs.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      PDFs Carregados ({loadedPdfs.length}):
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {loadedPdfs.map(pdf => (
                        <div key={pdf.id} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate flex-1 mr-2">{pdf.name}</span>
                          <button
                            type="button"
                            onClick={() => handleDeletePdf(pdf.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Remover este PDF"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seletor de Mês com Setas Anterior / Atual / Próximo */}
                {activeMonthGroup && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#1E293B] p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        disabled={activeMonthIndex <= 0}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                        title="Mês anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {activeMonthIndex > 0 ? monthGroups[activeMonthIndex - 1].shortMonthLabel : 'Anterior'}
                        </span>
                      </button>

                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        <Calendar className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                          {activeMonthGroup.monthLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {activeMonthGroup.weeks.length} {activeMonthGroup.weeks.length === 1 ? 'semana' : 'semanas'}
                        </span>
                        {currentMatchingMonthKey && activeMonthGroup.monthKey !== currentMatchingMonthKey && (
                          <button
                            type="button"
                            onClick={handleGoToCurrentMonth}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                          >
                            Ir para Mês Atual
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleNextMonth}
                        disabled={activeMonthIndex >= monthGroups.length - 1}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                        title="Próximo mês"
                      >
                        <span className="hidden sm:inline">
                          {activeMonthIndex < monthGroups.length - 1 ? monthGroups[activeMonthIndex + 1].shortMonthLabel : 'Próximo'}
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Semanas do Mês Selecionado */}
                    <div className={cn(
                      "grid gap-2",
                      activeMonthGroup.weeks.length >= 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"
                    )}>
                      {activeMonthGroup.weeks.map((w, idx) => {
                        const isSelected = selectedWeek?.id === w.id;
                        const isCurrentWeek = currentMatchingWeek?.id === w.id;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWeekId(w.id)}
                            className={cn(
                              "p-2.5 rounded-xl text-left border transition-all flex flex-col gap-0.5 cursor-pointer",
                              isSelected
                                ? "bg-[#295E9F] text-white border-[#295E9F] shadow-md scale-[1.02]"
                                : "bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#295E9F]"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] uppercase font-bold opacity-80">
                                Semana {idx + 1}
                              </span>
                              {isCurrentWeek && (
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.2 rounded-md font-bold",
                                  isSelected ? "bg-emerald-400 text-emerald-950" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                )}>
                                  Hoje
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-bold truncate">
                              {w.date}
                            </span>
                            {w.bibleReading && (
                              <span className="text-[10px] truncate opacity-75">
                                {w.bibleReading}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Detalhes da Semana Selecionada */}
              {selectedWeek && (
                <div className="space-y-4">
                  
                  {/* Bloco Presidente e Oração */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-[#0F172A]/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Presidente da Reunião
                      </span>
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <User className="w-4 h-4 text-[#295E9F]" />
                        <span>{selectedWeek.president || "Não identificado"}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#0F172A]/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Oração Inicial
                      </span>
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>{selectedWeek.openingPrayer || "Não identificado"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cântico Inicial */}
                  {selectedWeek.openingSong && (
                    <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0F172A]/40 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Music className="w-4 h-4 text-[#295E9F]" />
                      <span>{selectedWeek.openingSong}</span>
                    </div>
                  )}

                  {/* TESOUROS */}
                  <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase font-bold text-[#295E9F] dark:text-[#688EC9] tracking-wider">
                        1. Tesouros da Palavra de Deus
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#0F172A]/40 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            Discurso (10 min): {selectedWeek.treasuresTheme || "Discurso"}
                          </span>
                        </div>
                        <span className="font-bold text-[#295E9F] dark:text-[#4A6CA7]">
                          {selectedWeek.treasuresSpeaker || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Joias Espirituais (10 min)
                        </span>
                        <span className="font-bold text-[#295E9F] dark:text-[#4A6CA7]">
                          {selectedWeek.spiritualGemsSpeaker || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Leitura da Bíblia (4 min)
                        </span>
                        <span className="font-bold text-[#295E9F] dark:text-[#4A6CA7]">
                          {selectedWeek.bibleReadingSpeaker || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* MINISTÉRIO */}
                  <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                    <span className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                      2. Faça Seu Melhor no Ministério
                    </span>
                    <div className="bg-slate-50 dark:bg-[#0F172A]/40 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                      {selectedWeek.ministryParts.map((mp, i) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60 last:border-b-0">
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {mp.title} ({mp.minutes} min)
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {mp.speaker || "—"}
                            </span>
                            {mp.assistant && (
                              <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-1.5">
                                / {mp.assistant}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* VIDA CRISTÃ */}
                  <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                    <span className="text-[11px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">
                      3. Nossa Vida Cristã
                    </span>
                    
                    {selectedWeek.middleSong && (
                      <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#0F172A]/40 text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Music className="w-3.5 h-3.5 text-rose-500" />
                        <span>{selectedWeek.middleSong}</span>
                      </div>
                    )}

                    <div className="bg-slate-50 dark:bg-[#0F172A]/40 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                      {selectedWeek.christianLivingParts.map((cp, i) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {cp.title} ({cp.minutes} min)
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {cp.speaker || "—"}
                          </span>
                        </div>
                      ))}

                      {/* Estudo Bíblico de Congregação */}
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            Estudo Bíblico de Congregação (30 min)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {selectedWeek.congregationStudyConductor || "—"}
                          </span>
                          {selectedWeek.congregationStudyReader && (
                            <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-1.5">
                              (Leitor: {selectedWeek.congregationStudyReader})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cântico Final e Oração */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {selectedWeek.closingSong && (
                        <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#0F172A]/40 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Music className="w-3.5 h-3.5 text-[#295E9F]" />
                          <span className="truncate">{selectedWeek.closingSong}</span>
                        </div>
                      )}
                      {selectedWeek.closingPrayer && (
                        <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#0F172A]/40 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Oração: <strong>{selectedWeek.closingPrayer}</strong></span>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0F172A]/40 flex gap-3 shrink-0">
          {step === 'input' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] px-5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              {activeInputMode === 'paste' && (
                <button
                  type="button"
                  disabled={!inputText.trim()}
                  onClick={handleProcessText}
                  className={cn(
                    "flex-1 min-h-[48px] rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg transition-all",
                    inputText.trim() 
                      ? "bg-[#295E9F] hover:bg-[#3474C2] shadow-[#295E9F]/30 cursor-pointer" 
                      : "bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60"
                  )}
                >
                  <ArrowRight className="w-4 h-4" />
                  Processar Texto & Revisar Semanas
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                className="min-h-[48px] px-5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Voltar
              </button>
              <button
                type="button"
                onClick={handleApplyCurrentWeek}
                className="flex-1 min-h-[48px] bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                Salvar Escala ({parseResult?.weeks.length || 0} semanas)
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
