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
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
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
  const [selectedSpeaker, setSelectedSpeaker] = useState<SpeakerStat | null>(null);
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

  // Dados para o Gráfico de Desvio Médio por Parte
  const partChartData = useMemo(() => {
    return analytics.partTypeStats
      .filter(p => p.count >= 1)
      .map(p => ({
        name: p.partCategory.replace(/\(.*?\)/g, '').trim(),
        fullName: p.partCategory,
        avgDiffSec: p.avgDiffSeconds,
        avgDiffMin: +(p.avgDiffSeconds / 60).toFixed(1),
        exceededRate: p.exceededRate,
        count: p.count,
        avgPlannedMin: p.avgPlannedMin,
        avgActualMin: p.avgActualMin,
        section: p.sectionName
      }))
      .sort((a, b) => b.avgDiffSec - a.avgDiffSec);
  }, [analytics.partTypeStats]);

  // Dados para o Gráfico de Pontualidade por Cargo
  const roleChartData = useMemo(() => {
    return analytics.roleStats.map(r => ({
      name: r.role === 'Servo Ministerial' ? 'Servos' : r.role === 'Ancião' ? 'Anciãos' : 'Publicadores',
      fullName: r.role,
      onTimeRate: r.onTimeRate,
      avgDiffSec: r.avgDiffSeconds,
      avgDiffMin: +(r.avgDiffSeconds / 60).toFixed(1),
      totalParts: r.totalParts,
      speakers: r.speakerCount
    }));
  }, [analytics.roleStats]);

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

          {/* GRÁFICO 1: TENDÊNCIA DE ATRASO / ECONOMIA POR PARTE DA REUNIÃO */}
          <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#295E9F] dark:text-[#4A6CA7]" />
                  Em quais partes há tendência de demorar mais?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Desvio médio em minutos (barras para a direita/vermelhas indicam partes que costumam estourar).
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-red-500">
                  <span className="w-3 h-3 rounded-md bg-red-500 inline-block" /> Demora / Estoura
                </span>
                <span className="flex items-center gap-1.5 text-emerald-500">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" /> No tempo / Adianta
                </span>
              </div>
            </div>

            <div className="h-[280px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={partChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis 
                    type="number" 
                    unit="m" 
                    tick={{ fontSize: 11, fill: '#888888' }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={140} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-700 text-xs space-y-1.5 min-w-[200px]">
                            <p className="font-bold text-sm text-sky-400">{data.fullName}</p>
                            <div className="flex justify-between text-slate-300">
                              <span>Média Planejada:</span>
                              <span className="font-mono font-bold">{data.avgPlannedMin} min</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                              <span>Média Real Registrada:</span>
                              <span className="font-mono font-bold">{data.avgActualMin} min</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-700 pt-1 font-bold">
                              <span>Desvio Médio:</span>
                              <span className={data.avgDiffSec > 0 ? "text-red-400" : "text-emerald-400"}>
                                {data.avgDiffSec > 0 ? `+${data.avgDiffMin} min` : `${data.avgDiffMin} min`}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Taxa de Estouro: {data.exceededRate}% ({data.count} partes analisadas)
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Bar dataKey="avgDiffMin" radius={[0, 6, 6, 0]}>
                    {partChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.avgDiffSec > 15 ? '#EF4444' : entry.avgDiffSec > 0 ? '#F59E0B' : '#10B981'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>



        </>
      )}
    </div>
  );
}
