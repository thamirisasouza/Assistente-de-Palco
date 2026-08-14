import React, { useState, useRef } from 'react';
import { 
  parseMonthlyPdfText, 
  ParsedWeekSchedule, 
  MonthPdfParseResult, 
  SAMPLE_MONTHLY_PDF_TEXT,
  applyPdfWeekToMeetingParts
} from '../lib/apostilaParser';
import { readPdfFile } from '../lib/pdfReader';
import { MeetingPart, Brother } from '../types';
import { 
  FileText, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles, 
  X, 
  Edit3, 
  ArrowRight,
  BookOpen,
  Music,
  CheckCircle2,
  RefreshCw,
  UploadCloud,
  Calendar,
  User,
  Users,
  Building2,
  FileCheck2,
  FileCode,
  Layers,
  HelpCircle
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
}

export function ImportApostilaModal({
  isOpen,
  currentParts,
  existingBrothers,
  onClose,
  onApplyWeek
}: ImportApostilaModalProps) {
  const [activeInputMode, setActiveInputMode] = useState<'upload' | 'paste'>('upload');
  const [inputText, setInputText] = useState("");
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<MonthPdfParseResult | null>(null);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setPdfFileName(file.name);
    setIsProcessingPdf(true);

    try {
      const extracted = await readPdfFile(file);
      setInputText(extracted.fullText);
      const parsed = parseMonthlyPdfText(extracted.fullText);
      setParseResult(parsed);
      setSelectedWeekIndex(0);
      setStep('review');
    } catch (err) {
      console.error("Erro ao ler PDF:", err);
      // Fallback para modo texto
      setActiveInputMode('paste');
      alert("Não foi possível extrair o texto diretamente deste arquivo PDF. Por favor, cole o texto na aba 'Colar Texto'.");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const handleProcessText = () => {
    if (!inputText.trim()) return;
    const parsed = parseMonthlyPdfText(inputText);
    setParseResult(parsed);
    setSelectedWeekIndex(0);
    setStep('review');
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_MONTHLY_PDF_TEXT);
    setPdfFileName("programacao_mensal_jardim_rosana.pdf");
    const parsed = parseMonthlyPdfText(SAMPLE_MONTHLY_PDF_TEXT);
    setParseResult(parsed);
    setSelectedWeekIndex(0);
    setStep('review');
  };

  const selectedWeek: ParsedWeekSchedule | null = 
    parseResult && parseResult.weeks.length > selectedWeekIndex 
      ? parseResult.weeks[selectedWeekIndex] 
      : null;

  const handleApplyCurrentWeek = () => {
    if (!selectedWeek || !parseResult) return;
    const updatedParts = applyPdfWeekToMeetingParts(currentParts, selectedWeek);
    onApplyWeek(
      updatedParts, 
      selectedWeek, 
      parseResult.allBrothersFound, 
      parseResult.congregationName
    );
    onClose();
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
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                  Padrão Mensal
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lê todas as semanas do mês, oradores, leitores, ajudantes e cânticos automaticamente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal & Privacy Compliance */}
        <div className="px-5 sm:px-6 py-2 bg-sky-500/5 dark:bg-sky-500/10 border-b border-sky-500/20 text-xs text-sky-800 dark:text-sky-300 flex items-center gap-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="text-[11px] leading-tight">
            <strong>Processamento 100% no seu navegador:</strong> O arquivo PDF é lido localmente no seu dispositivo. Nenhum dado é enviado para servidores externos.
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {step === 'input' ? (
            /* ETAPA 1: ESCOLHA DE ENTRADA (PDF OU TEXTO) */
            <div className="space-y-5">
              
              {/* Abas de Modo */}
              <div className="flex bg-slate-100 dark:bg-[#0F172A] p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveInputMode('upload')}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
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
                    "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
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
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="application/pdf"
                    className="hidden"
                  />

                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#295E9F] dark:hover:border-[#4A6CA7] rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-[#0F172A]/30 hover:bg-[#295E9F]/5 flex flex-col items-center justify-center gap-3 group"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-[#295E9F]/10 dark:bg-[#295E9F]/20 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        {isProcessingPdf ? "Lendo e interpretando PDF..." : "Clique para selecionar ou arraste o PDF da Reunião"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Formato padrão de escala mensal (ex: Jardim Rosana - Ferraz de Vasconcelos SP)
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessingPdf}
                      className="mt-2 px-5 py-2.5 bg-[#295E9F] hover:bg-[#3474C2] text-white text-xs font-bold rounded-xl shadow-md transition-all"
                    >
                      {isProcessingPdf ? "Processando..." : "Selecionar Arquivo PDF"}
                    </button>
                  </div>

                  {/* Botão de Exemplo */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Quer testar com a escala de Agosto de 2026?
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="text-xs text-[#295E9F] dark:text-[#4A6CA7] hover:underline font-bold flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Carregar Escala Mensal Modelo
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
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="text-xs text-[#295E9F] dark:text-[#4A6CA7] hover:underline font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Preencher Exemplo Modelo
                    </button>
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
                  O que o sistema detecta automaticamente:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Todas as 4 ou 5 semanas do mês</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Presidente e Oração Inicial</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Discurso, Joias e Leitura da Bíblia</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Ministério (Estudante e Ajudante)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Partes de Vida Cristã (sem ajudante)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#295E9F]" />
                    <span>Estudo Bíblico (Dirigente e Leitor)</span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* ETAPA 2: REVISÃO E SELEÇÃO DE SEMANA DO MÊS */
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Cabeçalho da Congregação e Seleção de Semana */}
              <div className="bg-slate-100 dark:bg-[#0F172A] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#295E9F] dark:text-[#4A6CA7]" />
                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                      {parseResult?.congregationName || "Congregação Detectada"}
                    </span>
                  </div>
                  <button
                    onClick={() => setStep('input')}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Carregar outro PDF
                  </button>
                </div>

                {/* Seletor de Semanas do Mês */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Semanas Detectadas no Mês ({parseResult?.weeks.length || 0}):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {parseResult?.weeks.map((w, idx) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWeekIndex(idx)}
                        className={cn(
                          "p-2.5 rounded-xl text-left border transition-all flex flex-col gap-0.5 cursor-pointer",
                          selectedWeekIndex === idx
                            ? "bg-[#295E9F] text-white border-[#295E9F] shadow-md scale-[1.02]"
                            : "bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#295E9F]"
                        )}
                      >
                        <span className="text-[10px] uppercase font-bold opacity-80">
                          Semana {idx + 1}
                        </span>
                        <span className="text-xs font-bold truncate">
                          {w.date}
                        </span>
                        {w.bibleReading && (
                          <span className="text-[10px] truncate opacity-75">
                            {w.bibleReading}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
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
                className="min-h-[48px] px-5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                className="min-h-[48px] px-5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
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
                Aplicar Semana ({selectedWeek?.date}) à Reunião
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
