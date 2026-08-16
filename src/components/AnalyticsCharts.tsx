import React, { useState, useMemo } from 'react';
import { CompletedMeeting, Brother, Role } from '../types';
import { 
  calculateMeetingAnalytics, 
  SpeakerStat, 
  PartTypeStat, 
  SpeakerPunctualityTrend 
} from '../lib/analytics';
import { formatTime, cn } from '../lib/utils';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users, 
  Search, 
  Filter, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Share2, 
  Copy, 
  Check, 
  RotateCcw,
  BookOpen,
  Calendar
} from 'lucide-react';

interface AnalyticsChartsProps {
  archivedMeetings: CompletedMeeting[];
  knownBrothers: Brother[];
  onViewMeeting?: (meeting: CompletedMeeting) => void;
}

export function AnalyticsCharts({
  archivedMeetings,
  knownBrothers,
  onViewMeeting
}: AnalyticsChartsProps) {
  const [roleFilter, setRoleFilter] = useState<'Todos' | Role>('Todos');
  const [trendFilter, setTrendFilter] = useState<'Todos' | SpeakerPunctualityTrend>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);

  // Calcula todas as estatísticas analíticas
  const analytics = useMemo(() => {
    return calculateMeetingAnalytics(archivedMeetings, knownBrothers);
  }, [archivedMeetings, knownBrothers]);

  // Filtra lista de oradores
  const filteredSpeakers = useMemo(() => {
    return analytics.speakers.filter(s => {
      const matchRole = roleFilter === 'Todos' || s.role === roleFilter;
      const matchTrend = trendFilter === 'Todos' || s.trend === trendFilter;
      const matchSearch = !searchQuery.trim() || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.mostExceededPart && s.mostExceededPart.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchRole && matchTrend && matchSearch;
    });
  }, [analytics.speakers, roleFilter, trendFilter, searchQuery]);

  // Copiar relatório estatístico de pontualidade para WhatsApp
  const handleCopySummary = () => {
    const lines = [
      `📊 *ANÁLISE DE PONTUALIDADE & TENDÊNCIAS*`,
      `🏛️ *Reuniões Analisadas:* ${analytics.totalMeetings}`,
      `⏱️ *Pontualidade Geral:* ${analytics.globalOnTimeRate}% das partes no tempo`,
      `⚖️ *Desvio Médio por Reunião:* ${analytics.avgMeetingBalanceSeconds >= 0 ? '+' : ''}${Math.round(analytics.avgMeetingBalanceSeconds / 60)} min`,
      ``,
      `📌 *PARTES QUE MAIS TENDEM A DEMORAR:*`,
      ...analytics.topDelayParts.slice(0, 4).map((p, i) => {
        const sign = p.avgDiffSeconds >= 0 ? '+' : '';
        const minStr = (p.avgDiffSeconds / 60).toFixed(1);
        return `${i + 1}. ${p.partCategory}: média ${sign}${minStr}m (${p.exceededRate}% estouros)`;
      }),
      ``,
      `👤 *PADRÃO DE ORADORES (TOP PARTICIPAÇÕES):*`,
      ...analytics.speakers.slice(0, 8).map(s => {
        const sign = s.averageDiffSeconds >= 0 ? '+' : '';
        return `• ${s.name} (${s.role}): ${s.onTimeRate}% no tempo | Média: ${sign}${s.averageDiffSeconds}s | ${s.trendLabel}`;
      }),
      ``,
      `_Assistente de Palco — Gestão de Reuniões_`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      
      {/* Caso não haja reuniões gravadas */}
      {analytics.totalMeetings === 0 ? (
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center mx-auto">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Aguardando Reuniões Gravadas
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O histórico está conectado à sua base de dados oficial. Conforme as reuniões forem concluídas no cronômetro, as análises de pontualidade e os gráficos de cada irmão serão gerados automaticamente.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Barra Superior de Métricas Globais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reuniões Analisadas</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
                  {analytics.totalMeetings}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  ({analytics.totalPartsAnalyzed} partes)
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pontualidade Global</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={cn(
                  "text-2xl sm:text-3xl font-black font-mono",
                  analytics.globalOnTimeRate >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                  analytics.globalOnTimeRate >= 60 ? "text-amber-500" : "text-red-500"
                )}>
                  {analytics.globalOnTimeRate}%
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">no tempo</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Médio por Reunião</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={cn(
                  "text-2xl sm:text-3xl font-black font-mono",
                  analytics.avgMeetingBalanceSeconds > 30 ? "text-amber-500" :
                  analytics.avgMeetingBalanceSeconds < -30 ? "text-sky-500" : "text-emerald-500"
                )}>
                  {analytics.avgMeetingBalanceSeconds >= 0 ? '+' : ''}{Math.round(analytics.avgMeetingBalanceSeconds / 60)} min
                </span>
                <span className="text-xs text-slate-400">
                  ({analytics.avgMeetingBalanceSeconds >= 0 ? 'atraso médio' : 'adiantado'})
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1E293B] p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Parte com Mais Atraso</span>
              <div className="mt-1">
                <p className="text-sm font-bold text-red-600 dark:text-red-400 truncate">
                  {analytics.topDelayParts[0]?.partCategory || "Nenhuma"}
                </p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Média: +{( (analytics.topDelayParts[0]?.avgDiffSeconds || 0) / 60 ).toFixed(1)} min
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação do Painel */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1E293B] p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                Padrões & Estatísticas de Tempo Atualizados
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopySummary}
                className="min-h-[40px] px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {copiedReport ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copiedReport ? "Copiado!" : "Copiar Resumo WhatsApp"}
              </button>
            </div>
          </div>

          {/* COMPARAÇÃO POR PUBLICADORES (IRMÃOS DESIGNADOS) */}
          <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#295E9F] dark:text-[#4A6CA7]" />
                  Padrão e Tendência dos Irmãos Designados
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Análise de pontualidade individual com base no histórico de partes realizadas.
                </p>
              </div>

              {/* Filtros para oradores */}
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-48">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar irmão..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Tabela/Lista de Publicadores */}
            <div className="space-y-3 mt-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredSpeakers.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Nenhum irmão encontrado com esses filtros.
                </div>
              ) : (
                filteredSpeakers.map((speaker, index) => (
                  <div 
                    key={index} 
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A]/50 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 w-full md:w-1/3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm",
                        speaker.trend === 'estoura' ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" :
                        speaker.trend === 'adianta' ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400" :
                        speaker.trend === 'misto' ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                      )}>
                        {speaker.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{speaker.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {speaker.role}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {speaker.totalParts} partes
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full md:w-2/3">
                      {/* Pontualidade e Desvio */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Pontualidade</span>
                          <span className="font-bold text-slate-900 dark:text-white">{speaker.onTimeRate}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              speaker.onTimeRate >= 80 ? "bg-emerald-500" :
                              speaker.onTimeRate >= 60 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${speaker.onTimeRate}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Média: <span className={cn(
                            "font-bold font-mono",
                            speaker.averageDiffSeconds > 15 ? "text-red-500" : 
                            speaker.averageDiffSeconds < -15 ? "text-sky-500" : "text-emerald-500"
                          )}>
                            {speaker.averageDiffSeconds > 0 ? '+' : ''}{Math.round(speaker.averageDiffSeconds)}s
                          </span>
                        </div>
                      </div>

                      {/* Tendência e Pior Parte */}
                      <div className="flex flex-col justify-center space-y-1 border-l border-slate-200 dark:border-slate-800 pl-4">
                        <div className="text-[11px] font-bold uppercase text-slate-400">Padrão Geral</div>
                        <div className={cn(
                          "text-xs font-bold flex items-center gap-1",
                          speaker.trend === 'estoura' ? "text-red-600 dark:text-red-400" :
                          speaker.trend === 'adianta' ? "text-sky-600 dark:text-sky-400" :
                          speaker.trend === 'misto' ? "text-amber-600 dark:text-amber-400" :
                          "text-emerald-600 dark:text-emerald-400"
                        )}>
                          {speaker.trend === 'estoura' && <TrendingUp className="w-3.5 h-3.5" />}
                          {speaker.trend === 'adianta' && <TrendingDown className="w-3.5 h-3.5" />}
                          {speaker.trend === 'misto' && <AlertTriangle className="w-3.5 h-3.5" />}
                          {speaker.trend === 'pontual' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {speaker.trendLabel}
                        </div>
                        {speaker.mostExceededPart && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1" title={speaker.mostExceededPart}>
                            <span className="font-medium">Cuidado com:</span> {speaker.mostExceededPart.split('(')[0].trim()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </>
      )}
    </div>
  );
}
