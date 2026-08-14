import React, { useState } from 'react';
import { 
  parseApostilaText, 
  ParsedApostilaWeek, 
  SAMPLE_APOSTILA_TEXT,
  applyParsedToMeetingParts
} from '../lib/apostilaParser';
import { MeetingPart } from '../types';
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
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ImportApostilaModalProps {
  isOpen: boolean;
  currentParts: MeetingPart[];
  onClose: () => void;
  onApply: (newParts: MeetingPart[], weekLabel?: string) => void;
}

export function ImportApostilaModal({
  isOpen,
  currentParts,
  onClose,
  onApply
}: ImportApostilaModalProps) {
  const [inputText, setInputText] = useState("");
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [parsed, setParsed] = useState<ParsedApostilaWeek | null>(null);

  // Editable fields for mandatory review
  const [weekLabel, setWeekLabel] = useState("");
  const [bibleReading, setBibleReading] = useState("");
  const [openingSong, setOpeningSong] = useState("");
  const [treasuresTheme, setTreasuresTheme] = useState("");
  const [spiritualGems, setSpiritualGems] = useState("");
  const [bibleReadingSection, setBibleReadingSection] = useState("");
  const [ministry1, setMinistry1] = useState("");
  const [ministry2, setMinistry2] = useState("");
  const [ministry3, setMinistry3] = useState("");
  const [middleSong, setMiddleSong] = useState("");
  const [christianLiving1, setChristianLiving1] = useState("");
  const [congregationStudy, setCongregationStudy] = useState("");
  const [closingSong, setClosingSong] = useState("");

  if (!isOpen) return null;

  const handleProcessText = () => {
    if (!inputText.trim()) return;
    const result = parseApostilaText(inputText);
    setParsed(result);

    // Initialize review state
    setWeekLabel(result.weekLabel || "");
    setBibleReading(result.bibleReading || "");
    setOpeningSong(result.openingSong || "Cântico 00");
    setTreasuresTheme(result.treasuresTheme || "Discurso de Tesouros");
    setSpiritualGems(result.spiritualGemsTheme || "Encontre joias espirituais");
    setBibleReadingSection(result.bibleReadingSection || result.bibleReading || "Leitura da Bíblia");
    setMinistry1(result.ministryPart1?.title || "Primeira Parte de Estudante");
    setMinistry2(result.ministryPart2?.title || "Segunda Parte de Estudante");
    setMinistry3(result.ministryPart3?.title || "Terceira Parte de Estudante");
    setMiddleSong(result.middleSong || "Cântico 00");
    setChristianLiving1(result.christianLivingPart1?.title || "Nossa Vida Cristã");
    setCongregationStudy(result.congregationBibleStudy?.material || "Estudo Bíblico de Congregação");
    setClosingSong(result.closingSong || "Cântico 00");

    setStep('review');
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_APOSTILA_TEXT);
  };

  const handleSaveAndApply = () => {
    const finalParsed: ParsedApostilaWeek = {
      weekLabel,
      bibleReading,
      openingSong,
      treasuresTheme,
      spiritualGemsTheme: spiritualGems,
      bibleReadingSection,
      ministryPart1: { title: ministry1 },
      ministryPart2: { title: ministry2 },
      ministryPart3: { title: ministry3 },
      middleSong,
      christianLivingPart1: { title: christianLiving1, minutes: 15 },
      congregationBibleStudy: { title: "Estudo Bíblico de Congregação", material: congregationStudy },
      closingSong,
      rawText: inputText
    };

    const updatedParts = applyParsedToMeetingParts(currentParts, finalParsed);
    onApply(updatedParts, weekLabel);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0F172A]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Importar Semana da Apostila (RF10)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                  100% Offline
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reconhecimento local no dispositivo • Sem automação ou requisição de rede
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal & Terms Compliance Notice (Seção 16 do PRD v1.4) */}
        <div className="px-5 sm:px-6 py-2.5 bg-sky-500/5 dark:bg-sky-500/10 border-b border-sky-500/20 text-xs text-sky-800 dark:text-sky-300 flex items-center gap-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>
            <strong>Conformidade Legal:</strong> Cole o texto copiado do seu app JW Library ou PDF. O processamento é realizado estritamente no seu navegador.
          </span>
        </div>

        {/* Body content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {step === 'paste' ? (
            /* PASSO 1: COLAGEM MANUAL DO TEXTO */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Cole o texto da semana da Apostila aqui:
                </label>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="text-xs text-[#295E9F] dark:text-[#4A6CA7] hover:underline font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Preencher Exemplo Prático
                </button>
              </div>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={10}
                placeholder="Exemplo:
10-16 DE MARÇO
SALMOS 19-21
Cântico 12 e oração
TESOUROS DA PALAVRA DE DEUS
'A lei de Jeová é perfeita' (10 min)
Encontre joias espirituais (10 min)
Leitura da Bíblia: Salmo 19:1-14 (4 min)
FAÇA SEU MELHOR NO MINISTÉRIO
..."
                className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl p-4 text-xs font-mono focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] resize-none"
              />

              <div className="bg-slate-100 dark:bg-[#0F172A]/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">Como funciona o reconhecimento local:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>Identifica os títulos de Discurso, Joias Espirituais e Leitura da Bíblia</li>
                  <li>Mapeia as partes de estudante e temas de Nossa Vida Cristã</li>
                  <li>Mantém a estrutura padronizada de 105 minutos e regras do S-38-T</li>
                </ul>
              </div>
            </div>
          ) : (
            /* PASSO 2: REVISÃO OBRIGATÓRIA ANTES DE SALVAR (RF10) */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Revisão Obrigatória:</strong> Verifique e edite os campos detectados antes de aplicar à programação.
                  </span>
                </div>
                <button
                  onClick={() => setStep('paste')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white underline shrink-0 ml-2"
                >
                  Recolar texto
                </button>
              </div>

              {/* Informações Gerais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Data / Semana</label>
                  <input
                    type="text"
                    value={weekLabel}
                    onChange={(e) => setWeekLabel(e.target.value)}
                    placeholder="Ex: 10-16 de Março"
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Leitura Semanal</label>
                  <input
                    type="text"
                    value={bibleReading}
                    onChange={(e) => setBibleReading(e.target.value)}
                    placeholder="Ex: SALMOS 19-21"
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Tesouros */}
              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  Tesouros da Palavra de Deus
                </span>
                
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 dark:text-slate-400">Discurso (10 min)</label>
                    <input
                      type="text"
                      value={treasuresTheme}
                      onChange={(e) => setTreasuresTheme(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 dark:text-slate-400">Leitura da Bíblia (4 min)</label>
                    <input
                      type="text"
                      value={bibleReadingSection}
                      onChange={(e) => setBibleReadingSection(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Faça Seu Melhor no Ministério */}
              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  Faça Seu Melhor no Ministério
                </span>
                
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={ministry1}
                    onChange={(e) => setMinistry1(e.target.value)}
                    placeholder="Parte 1..."
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={ministry2}
                    onChange={(e) => setMinistry2(e.target.value)}
                    placeholder="Parte 2..."
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={ministry3}
                    onChange={(e) => setMinistry3(e.target.value)}
                    placeholder="Parte 3..."
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Nossa Vida Cristã */}
              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  Nossa Vida Cristã & Estudo Bíblico
                </span>
                
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 dark:text-slate-400">Parte de Vida Cristã (15 min)</label>
                    <input
                      type="text"
                      value={christianLiving1}
                      onChange={(e) => setChristianLiving1(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 dark:text-slate-400">Estudo Bíblico de Congregação (30 min)</label>
                    <input
                      type="text"
                      value={congregationStudy}
                      onChange={(e) => setCongregationStudy(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0F172A]/40 flex gap-3 shrink-0">
          {step === 'paste' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] px-5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
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
                Processar Texto Localmente & Revisar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('paste')}
                className="min-h-[48px] px-5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSaveAndApply}
                className="flex-1 min-h-[48px] bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                Confirmar Revisão e Aplicar à Programação
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
