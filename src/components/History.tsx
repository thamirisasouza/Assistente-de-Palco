import React, { useState } from 'react';
import { CompletedMeeting, PartRecord, TOTAL_PLANNED_MEETING_MINUTES, Brother } from '../types';
import { formatTime, formatTimeHours, getBalanceColorClass, formatBalanceDisplay, cn } from '../lib/utils';
import { exportMeetingToPdf } from '../lib/pdfExporter';
import { AnalyticsCharts } from './AnalyticsCharts';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  User, 
  Building2, 
  Share2, 
  Copy, 
  Check, 
  RefreshCw, 
  BarChart3, 
  Clock, 
  ArrowLeft, 
  Trash2, 
  FileText,
  TrendingDown,
  TrendingUp,
  Award,
  FileDown,
  Download
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
  knownBrothers = [],
  onNewMeeting, 
  onSelectMeeting, 
  onDeleteMeeting,
}: HistoryProps) {
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'resumo' | 'arquivo' | 'graficos'>('resumo');

  // Selected meeting to display, fallback to first in archive
  const activeMeeting = meeting || archivedMeetings[0];

  if (!activeMeeting) {
    return (
      <div className="max-w-3xl mx-auto p-6 py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
          <FileText className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nenhuma Reunião Arquivada</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Após concluir e encerrar a primeira reunião, o relatório imutável aparecerá aqui.
          </p>
        </div>
        <button
          onClick={onNewMeeting}
          className="min-h-[56px] px-8 bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold rounded-2xl shadow-lg transition-all animate-pulse-attention"
        >
          Iniciar Nova Reunião
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
    const lines = [
      `📊 *RELATÓRIO DE REUNIÃO*`,
      `📅 *Data:* ${activeMeeting.data_formatada}`,
      `🏛️ *Congregação:* ${activeMeeting.congregacao}`,
      `👤 *Presidente:* ${activeMeeting.presidente}`,
      ...(activeMeeting.tipo_semana !== 'Normal' ? [`🏷️ *Modalidade:* ${activeMeeting.tipo_semana}`] : []),
      ``,
      `⏱️ *Duração Real:* ${activeMeeting.duracao_real_minutos} min (Planejado: ${activeMeeting.duracao_planejada_minutos} min)`,
      `⚖️ *Saldo Final:* ${formatBalanceDisplay(activeMeeting.saldo_final_segundos)}`,
      `📈 *Partes no Tempo Correto:* ${partsOnTime}/${activeMeeting.partes.length} (${Math.round((partsOnTime / Math.max(1, activeMeeting.partes.length)) * 100)}%)`,
      ``,
      `*DETALHAMENTO DAS PARTES:*`,
      `---------------------------------`,
      ...activeMeeting.partes.map((p) => {
        let speakerStr = '';
        if (!p.hideSpeaker && p.speaker && !p.title.toLowerCase().includes(p.speaker.toLowerCase())) {
          speakerStr = `\n${p.speaker}`;
          if (p.assistant && !p.title.toLowerCase().includes(p.assistant.toLowerCase())) {
            speakerStr += ` c/ ${p.assistant}`;
          }
        }

        const diffSeconds = p.actualTime - (p.plannedTime * 60);
        const isOver = p.status === 'Excedido' || diffSeconds > 0;
        const timeFormatted = formatTime(p.actualTime);
        const diffFormatted = formatTime(Math.abs(diffSeconds));
        
        const statusDetail = isOver 
          ? `(Ultrapassou) ${diffFormatted}\n(Excedido)`
          : `(Sobra de tempo) ${diffFormatted}\nNo tempo correto`;

        const numberPrefix = p.partNumber != null ? `${p.partNumber}\n` : '';

        return `${numberPrefix}${p.title}${speakerStr}\n\n${timeFormatted} / ${p.plannedTime}m\n${statusDetail}\n-------`;
      }),
      ``,
      `_Relatório Oficial gerado pelo Assistente de Palco_`
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
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-1 bg-emerald-900/30 text-emerald-100 font-bold text-xs rounded-full border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Reunião Encerrada
              </span>
              <span className="px-2.5 py-1 bg-emerald-900/30 text-emerald-100 text-xs rounded-full font-mono">
                {activeMeeting.tipo_semana}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Resumo & Relatório da Reunião
            </h1>
            <p className="text-sm text-emerald-100">
              {activeMeeting.data_formatada} • {activeMeeting.congregacao}
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex bg-white dark:bg-[#1E293B] p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('resumo')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'resumo' 
                  ? "bg-emerald-600 text-white shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <FileText className="w-4 h-4" /> Resumo
            </button>
            <button
              onClick={() => setActiveTab('arquivo')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'arquivo' 
                  ? "bg-emerald-600 text-white shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Calendar className="w-4 h-4" /> Arquivo ({archivedMeetings.length})
            </button>
            <button
              onClick={() => setActiveTab('graficos')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'graficos' 
                  ? "bg-emerald-600 text-white shadow-sm" 
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <BarChart3 className="w-4 h-4" /> Gráficos
            </button>
          </div>
        </header>

        {/* Metadados da Reunião (visíveis nas abas resumo e arquivo) */}
        {activeTab !== 'graficos' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Presidente</span>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                {activeMeeting.presidente}
              </p>
            </div>
            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Duração Real</span>
              <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                {activeMeeting.duracao_real_minutos} min <span className="text-xs text-slate-400 font-normal">/ {activeMeeting.duracao_planejada_minutos}m</span>
              </p>
            </div>
            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Saldo Final</span>
              <p className={cn("text-xl font-bold font-mono mt-0.5", balanceColors.text)}>
                {formatBalanceDisplay(activeMeeting.saldo_final_segundos)}
              </p>
            </div>
            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Partes no Tempo Correto</span>
              <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                {partsOnTime} <span className="text-xs text-slate-400 font-normal">de {activeMeeting.partes.length}</span>
              </p>
            </div>
          </div>
        )}

        {/* TAB 1: RESUMO DETALHADO */}
        {activeTab === 'resumo' && (
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
                  className="min-h-[44px] px-4 bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  {downloadingPdf ? "Gerando PDF..." : "Exportar PDF (Modelo Escala)"}
                </button>
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="min-h-[44px] px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
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
        )}

        {/* TAB 2: ARQUIVO HISTÓRICO DE REUNIÕES */}
        {activeTab === 'arquivo' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap gap-2 justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Histórico de Reuniões Gravadas</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Reuniões arquivadas salvas no dispositivo. Baixe o PDF oficial com minutos reais a qualquer momento.</p>
              </div>
              <button
                type="button"
                onClick={() => handleExportPdf(activeMeeting)}
                disabled={downloadingPdf}
                className="min-h-[40px] px-4 bg-[#295E9F] hover:bg-[#3474C2] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                {downloadingPdf ? "Gerando PDF..." : `Baixar PDF (${activeMeeting.data_formatada})`}
              </button>
            </div>

            <div className="space-y-3">
              {archivedMeetings.map((m) => {
                const isSelected = m.id === activeMeeting.id;
                const mBalanceColors = getBalanceColorClass(m.saldo_final_segundos);

                return (
                  <div 
                    key={m.id}
                    className={cn(
                      "bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm",
                      isSelected ? "border-[#295E9F] dark:border-[#4A6CA7] ring-2 ring-[#295E9F]/20" : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-mono font-bold">
                          {m.tipo_semana}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                          {m.data_formatada}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {m.congregacao}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportPdf(m)}
                          className="min-h-[40px] px-3 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                          title="Exportar PDF no formato da escala mensal com minutos reais"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          PDF
                        </button>
                        <button
                          onClick={() => {
                            onSelectMeeting(m);
                            setActiveTab('resumo');
                          }}
                          className="min-h-[40px] px-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-[#295E9F] hover:text-white text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors"
                        >
                          Ver Resumo
                        </button>
                        <button
                          onClick={() => onDeleteMeeting(m.id)}
                          className="h-10 w-10 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl flex items-center justify-center transition-colors"
                          title="Excluir do Arquivo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: GRÁFICOS & PADRÕES DE PONTUALIDADE */}
        {activeTab === 'graficos' && (
          <AnalyticsCharts
            archivedMeetings={archivedMeetings}
            knownBrothers={knownBrothers}
            onViewMeeting={(m) => {
              onSelectMeeting(m);
              setActiveTab('resumo');
            }}
          />
        )}
      </div>

      {/* Fixed Action Footer (Princípio 2: Alvo ≥ 56px) */}
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
            className="w-full min-h-[56px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold text-xs sm:text-base rounded-2xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 animate-pulse-attention"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-center">Nova Reunião</span>
          </button>
        </div>
      </div>
    </div>
  );
}
