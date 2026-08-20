import React, { useState } from 'react';
import { CompletedMeeting, Brother } from '../types';
import { formatTime, getBalanceColorClass, formatBalanceDisplay, cn } from '../lib/utils';
import { exportMeetingToPdf } from '../lib/pdfExporter';
import { 
  CheckCircle2, 
  User, 
  Copy, 
  Check, 
  ArrowLeft, 
  FileDown,
  FileText
} from 'lucide-react';

interface HistoryProps {
  meeting?: CompletedMeeting;
  archivedMeetings: CompletedMeeting[];
  knownBrothers?: Brother[];
  onNewMeeting: () => void;
  onSelectMeeting: (m: CompletedMeeting) => void;
  onDeleteMeeting: (id: string) => void;
}

export function History({ 
  meeting, 
  archivedMeetings, 
  onNewMeeting, 
}: HistoryProps) {
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Selected meeting to display, fallback to first in history
  const activeMeeting = meeting || archivedMeetings[0];

  if (!activeMeeting) {
    return (
      <div className="max-w-3xl mx-auto p-6 py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
          <FileText className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nenhuma Reunião no Histórico</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Após concluir e encerrar a reunião, o relatório detalhado aparecerá aqui.
          </p>
        </div>
        <button
          onClick={onNewMeeting}
          className="min-h-[56px] px-8 bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar ao Início (Dashboard)
        </button>
      </div>
    );
  }

  const isPartOnTime = (p: { status?: string; actualTime: number; plannedTime: number }) => {
    if (p.status === 'No tempo correto' || p.status === 'No tempo') return true;
    if (p.status === 'Excedido') return false;
    return p.actualTime <= (p.plannedTime * 60);
  };

  const partsOnTime = activeMeeting.partes.filter(isPartOnTime).length;
  const partsExceeded = activeMeeting.partes.length - partsOnTime;

  const balanceColors = getBalanceColorClass(activeMeeting.saldo_final_segundos);

  // Exportar PDF formatado oficial da escala mensal com minutos reais
  const handleExportPdf = (targetMeeting: CompletedMeeting = activeMeeting) => {
    setDownloadingPdf(true);
    try {
      exportMeetingToPdf(targetMeeting);
    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      alert("Houve um problema ao gerar o PDF. Tente novamente.");
    } finally {
      setTimeout(() => setDownloadingPdf(false), 1200);
    }
  };

  // Copy formatted report for WhatsApp
  const handleCopyReport = () => {
    // Helper para converter saldo em termos amigáveis da reunião
    const formatBalanceText = (totalSec: number) => {
      if (Math.abs(totalSec) < 5) return 'No tempo exato';
      const absSec = Math.abs(totalSec);
      const mins = Math.floor(absSec / 60);
      const secs = absSec % 60;
      let timeStr = '';
      if (mins > 0) timeStr += `${mins} min `;
      if (secs > 0 || mins === 0) timeStr += `${secs} seg`;
      timeStr = timeStr.trim();

      return totalSec > 0 ? `Atrasada em ${timeStr}` : `Adiantada em ${timeStr}`;
    };

    const formatPartStatus = (actualSec: number, plannedMins: number) => {
      const plannedSec = plannedMins * 60;
      const diffSec = actualSec - plannedSec;

      if (diffSec > 0) {
        const mins = Math.floor(diffSec / 60);
        const secs = diffSec % 60;
        let diffStr = '';
        if (mins > 0) diffStr += `${mins} min `;
        if (secs > 0 || mins === 0) diffStr += `${secs} seg`;
        return `⚠️ Passou ${diffStr.trim()}`;
      } else if (diffSec < -15) {
        const absSec = Math.abs(diffSec);
        const mins = Math.floor(absSec / 60);
        const secs = absSec % 60;
        let diffStr = '';
        if (mins > 0) diffStr += `${mins} min `;
        if (secs > 0 || mins === 0) diffStr += `${secs} seg`;
        return `✅ Sobrou ${diffStr.trim()}`;
      } else {
        return `✅ No tempo`;
      }
    };

    const lines = [
      `📋 *RESUMO DA REUNIÃO*`,
      `📅 *Data:* ${activeMeeting.data_formatada}`,
      `🏛️ *Congregação:* ${activeMeeting.congregacao}`,
      `👤 *Presidente:* ${activeMeeting.presidente}`,
      ...(activeMeeting.salvo_por_email || activeMeeting.user_email ? [`📧 *Registrado por:* ${activeMeeting.salvo_por_email || activeMeeting.user_email}`] : []),
      ...(activeMeeting.tipo_semana !== 'Normal' ? [`🏷️ *Modalidade:* ${activeMeeting.tipo_semana}`] : []),
      ``,
      `⏱️ *Duração da Reunião:* ${activeMeeting.duracao_real_minutos} min (Programado: ${activeMeeting.duracao_planejada_minutos} min)`,
      `⚖️ *Resultado:* ${formatBalanceText(activeMeeting.saldo_final_segundos)}`,
      `📈 *Partes no Tempo:* ${partsOnTime} de ${activeMeeting.partes.length} (${Math.round((partsOnTime / Math.max(1, activeMeeting.partes.length)) * 100)}%)`,
      ``,
      `*DETALHES DAS PARTES:*`,
      `---------------------------------`,
      ...activeMeeting.partes.map((p) => {
        let speakerStr = '';
        if (!p.hideSpeaker && p.speaker && !p.title.toLowerCase().includes(p.speaker.toLowerCase())) {
          speakerStr = ` — ${p.speaker}`;
          if (p.assistant && !p.title.toLowerCase().includes(p.assistant.toLowerCase())) {
            speakerStr += ` c/ ${p.assistant}`;
          }
        }

        const timeFormatted = formatTime(p.actualTime);
        const statusDetail = formatPartStatus(p.actualTime, p.plannedTime);
        const numberPrefix = p.partNumber != null ? `Parte ${p.partNumber}: ` : '';

        return `• *${numberPrefix}${p.title}*${speakerStr}\n  ⏱️ ${timeFormatted} / ${p.plannedTime} min (${statusDetail})`;
      }),
      ``,
      `_Assistente de Palco — JW_`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full min-h-screen bg-transparent flex flex-col items-center pb-36 transition-colors duration-500">
      <div className="w-full max-w-4xl p-4 sm:p-6 md:py-10 space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/30 dark:border-emerald-700/50 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={onNewMeeting}
                className="px-3 py-1 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-full border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Voltar para a tela inicial (Dashboard)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar ao Início
              </button>
              <span className="px-3 py-1 bg-emerald-900/30 text-emerald-100 font-bold text-xs rounded-full border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Reunião Encerrada
              </span>
              <span className="px-2.5 py-1 bg-emerald-900/30 text-emerald-100 text-xs rounded-full font-mono">
                {activeMeeting.tipo_semana}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Resumo da Reunião
            </h1>
            <p className="text-sm text-emerald-100 flex items-center gap-2 flex-wrap">
              <span>{activeMeeting.data_formatada} • {activeMeeting.congregacao}</span>
              {(activeMeeting.salvo_por_email || activeMeeting.user_email) && (
                <span className="inline-flex items-center gap-1 text-emerald-100/90 text-xs bg-emerald-900/40 px-2 py-0.5 rounded-md border border-emerald-400/20">
                  <User className="w-3 h-3" />
                  {activeMeeting.salvo_por_email || activeMeeting.user_email}
                </span>
              )}
            </p>
          </div>
        </header>

        {/* 4 Cards em Grid de 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card 1: Presidente */}
          <div className="bg-white dark:bg-[#1E293B] p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Presidente</span>
            <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate mt-1">
              {activeMeeting.presidente || "Não informado"}
            </p>
          </div>

          {/* Card 2: Duração Real */}
          <div className="bg-white dark:bg-[#1E293B] p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Duração Real</span>
            <p className="text-lg sm:text-xl font-bold font-mono text-slate-800 dark:text-slate-100 mt-1">
              {activeMeeting.duracao_real_minutos} min <span className="text-[11px] text-slate-400 font-normal">/ {activeMeeting.duracao_planejada_minutos}m</span>
            </p>
          </div>

          {/* Card 3: Saldo Final */}
          <div className="bg-white dark:bg-[#1E293B] p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Saldo Final</span>
            <p className={cn("text-lg sm:text-xl font-bold font-mono mt-1", balanceColors.text)}>
              {formatBalanceDisplay(activeMeeting.saldo_final_segundos)}
            </p>
          </div>

          {/* Card 4: Partes no Horário */}
          <div className="bg-white dark:bg-[#1E293B] p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Partes no Horário</span>
            <p className="text-lg sm:text-xl font-bold font-mono text-slate-800 dark:text-slate-100 mt-1">
              {partsOnTime} <span className="text-[11px] text-slate-400 font-normal">de {activeMeeting.partes.length}</span>
            </p>
          </div>
        </div>

        {/* RESUMO DETALHADO POR PARTE */}
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-wrap gap-2 justify-between items-center bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Registro Detalhado por Parte</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tempos reais registrados para consulta do Superintendente.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleExportPdf(activeMeeting)}
                disabled={downloadingPdf}
                className="min-h-[42px] px-4 bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                {downloadingPdf ? "Gerando PDF..." : "Exportar PDF (Modelo Escala)"}
              </button>
              <button
                type="button"
                onClick={handleCopyReport}
                className="min-h-[42px] px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiado!" : "Copiar WhatsApp"}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {activeMeeting.partes.map((p, index) => {
              const diffSeconds = p.actualTime - (p.plannedTime * 60);
              const isExceeded = p.status === 'Excedido' || diffSeconds > 0;

              return (
                <div key={index} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.partNumber != null ? (
                        <span className="px-2 py-0.5 rounded-md bg-[#295E9F]/10 dark:bg-[#295E9F]/25 text-[#295E9F] dark:text-[#688EC9] font-mono text-xs flex items-center justify-center font-black border border-[#295E9F]/30">
                          Nº {p.partNumber}
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono text-xs flex items-center justify-center font-bold">
                          •
                        </span>
                      )}
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                        {p.title}
                      </h4>
                    </div>
                    {!p.hideSpeaker && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 pl-8">
                        {p.speaker || "Sem orador designado"}
                        {p.assistant && <span className="text-slate-400"> (c/ {p.assistant})</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-8 sm:pl-0">
                    <div className="flex flex-col sm:items-end font-mono">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {formatTime(p.actualTime)}
                        <span className="text-xs text-slate-400 font-normal"> / {p.plannedTime}m</span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold",
                        isExceeded ? "text-red-500" : "text-emerald-500"
                      )}>
                        {diffSeconds > 0 ? `+${formatTime(diffSeconds)}` : diffSeconds < 0 ? `-${formatTime(Math.abs(diffSeconds))}` : "00:00"}
                      </span>
                    </div>

                    <span className={cn(
                      "px-3 py-1 text-xs uppercase tracking-wider rounded-xl shrink-0 border flex items-center gap-1.5 font-mono font-bold",
                      isExceeded 
                        ? "bg-red-500 text-white border-red-600 shadow-sm font-black" 
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    )}>
                      {isExceeded ? `${formatTime(p.actualTime)} (Excedido)` : "No tempo correto"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-[#1E293B]/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-40">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleExportPdf(activeMeeting)}
            disabled={downloadingPdf}
            className="w-full min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-base rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer"
          >
            <FileDown className="w-5 h-5" />
            <span className="text-center">{downloadingPdf ? "Gerando..." : "Exportar PDF"}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyReport}
            className="w-full min-h-[56px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-base rounded-2xl border border-slate-200 dark:border-slate-700 transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 shadow-sm"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
            <span className="text-center">{copied ? "Copiado!" : "WhatsApp"}</span>
          </button>
          
          <button
            type="button"
            onClick={onNewMeeting}
            className="w-full min-h-[56px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs sm:text-base rounded-2xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-center">Voltar ao Início</span>
          </button>
        </div>
      </div>
    </div>
  );
}
