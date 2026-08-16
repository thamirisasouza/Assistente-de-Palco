import React, { useState, useMemo } from 'react';
import { CompletedMeeting, Brother, Role } from '../types';
import { 
  calculateMeetingAnalytics, 
  generateSampleMeetings, 
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
  onLoadSampleData?: (sampleMeetings: CompletedMeeting[]) => void;
  onClearSampleData?: () => void;
  onViewMeeting?: (meeting: CompletedMeeting) => void;
}

export function AnalyticsCharts({
  archivedMeetings,
  knownBrothers,
  onLoadSampleData,
  onClearSampleData,
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

  // Manipulador para carregar dados de demonstração
  const handleLoadDemo = () => {
    if (onLoadSampleData) {
      const demo = generateSampleMeetings(knownBrothers);
      onLoadSampleData(demo);
    }
  };

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
              Nenhuma Reunião Concluída no Histórico
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Conforme você usa o cronômetro do Assistente de Palco e conclui reuniões, os padrões de tempo de cada irmão e de cada parte serão calculados automaticamente.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleLoadDemo}
              className="min-h-[48px] px-6 bg-[#295E9F] hover:bg-[#3474C2] text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4" />
              Carregar Dados de Demonstração (5 Reuniões)
            </button>
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

              {onClearSampleData && archivedMeetings.some(m => m.id.startsWith('demo-')) && (
                <button
                  type="button"
                  onClick={onClearSampleData}
                  className="min-h-[40px] px-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs rounded-xl border border-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar Dados Demo
                </button>
              )}
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

          {/* GRÁFICO 2: PONTUALIDADE POR CARGO (ANCIÃO / SERVO / PUBLICADOR) */}
          <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#295E9F] dark:text-[#4A6CA7]" />
                  Comparativo por Categoria (Anciãos, Servos, Publicadores)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Taxa de pontualidade (% dentro do tempo previsto) e total de partes atribuídas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {roleChartData.map((role) => (
                <div 
                  key={role.fullName}
                  className="bg-slate-50 dark:bg-[#0F172A] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border",
                      role.fullName === 'Ancião' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                      role.fullName === 'Servo Ministerial' ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" :
                      "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                    )}>
                      {role.fullName}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {role.totalParts} {role.totalParts === 1 ? 'parte' : 'partes'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Pontualidade</span>
                      <span className={cn(
                        "text-2xl font-black font-mono",
                        role.onTimeRate >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                        role.onTimeRate >= 60 ? "text-amber-500" : "text-red-500"
                      )}>
                        {role.onTimeRate}%
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Desvio Médio</span>
                      <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                        {role.avgDiffSec > 0 ? `+${role.avgDiffMin}m` : `${role.avgDiffMin}m`}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progresso Visual */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        role.onTimeRate >= 80 ? "bg-emerald-500" :
                        role.onTimeRate >= 60 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${role.onTimeRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SEÇÃO 3: PADRÃO INDIVIDUAL DE CADA IRMÃO / ORADOR */}
          <section className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#295E9F] dark:text-[#4A6CA7]" />
                  Padrão Individual de Cada Irmão
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Veja quem tende a demorar, quem é pontual e em quais partes cada um tem maior tendência de atrasar.
                </p>
              </div>

              {/* Barra de Busca de Irmão */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome ou parte..."
                  className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl pl-9 pr-4 py-2 text-xs focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F]"
                />
              </div>
            </div>

            {/* Filtros por Cargo e Padrão de Tempo */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Filtro por Cargo */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">Cargo:</span>
                {(['Todos', 'Ancião', 'Servo Ministerial', 'Publicador'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      roleFilter === r 
                        ? "bg-[#295E9F] text-white shadow-sm" 
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Filtro por Tendência */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">Padrão:</span>
                {[
                  { id: 'Todos', label: 'Todos' },
                  { id: 'estoura', label: '🔴 Demora' },
                  { id: 'pontual', label: '🟢 Pontual' },
                  { id: 'adianta', label: '🔵 Adianta' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTrendFilter(t.id as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      trendFilter === t.id 
                        ? "bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm" 
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Oradores em Cards Interativos */}
            {filteredSpeakers.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                Nenhum irmão encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSpeakers.map((speaker) => {
                  const isExpanded = selectedSpeaker?.name === speaker.name;
                  const diffSign = speaker.averageDiffSeconds >= 0 ? '+' : '';

                  return (
                    <div 
                      key={speaker.name}
                      className={cn(
                        "p-4 rounded-2xl border transition-all bg-slate-50/70 dark:bg-[#0F172A]/70 flex flex-col justify-between space-y-3",
                        isExpanded 
                          ? "border-[#295E9F] dark:border-[#4A6CA7] ring-2 ring-[#295E9F]/20 bg-white dark:bg-[#1E293B]" 
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                                {speaker.name}
                              </h4>
                              <span className={cn(
                                "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border",
                                speaker.role === 'Ancião' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                                speaker.role === 'Servo Ministerial' ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" :
                                "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                              )}>
                                {speaker.role}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {speaker.totalParts} {speaker.totalParts === 1 ? 'parte realizada' : 'partes realizadas'}
                            </p>
                          </div>

                          {/* Badge de Padrão de Tempo */}
                          <div className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 border",
                            speaker.trend === 'estoura' 
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" :
                            speaker.trend === 'pontual' 
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                            speaker.trend === 'adianta'
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" :
                              "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                          )}>
                            {speaker.trend === 'estoura' && <AlertTriangle className="w-3.5 h-3.5" />}
                            {speaker.trend === 'pontual' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {speaker.trend === 'adianta' && <TrendingDown className="w-3.5 h-3.5" />}
                            <span>{speaker.trendLabel}</span>
                          </div>
                        </div>

                        {/* Indicadores Numéricos */}
                        <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                          <div className="p-2 bg-white dark:bg-[#1E293B] rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Pontualidade</span>
                            <span className={cn(
                              "font-mono font-bold text-sm",
                              speaker.onTimeRate >= 80 ? "text-emerald-500" :
                              speaker.onTimeRate >= 60 ? "text-amber-500" : "text-red-500"
                            )}>
                              {speaker.onTimeRate}% <span className="text-[10px] text-slate-400 font-normal">({speaker.partsOnTime}/{speaker.totalParts})</span>
                            </span>
                          </div>

                          <div className="p-2 bg-white dark:bg-[#1E293B] rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Desvio Médio</span>
                            <span className={cn(
                              "font-mono font-bold text-sm",
                              speaker.averageDiffSeconds > 20 ? "text-red-500" :
                              speaker.averageDiffSeconds < -30 ? "text-sky-500" : "text-emerald-500"
                            )}>
                              {diffSign}{speaker.averageDiffSeconds}s <span className="text-[10px] text-slate-400 font-normal">/ parte</span>
                            </span>
                          </div>
                        </div>

                        {/* Onde tem mais tendência a demorar */}
                        {speaker.mostExceededPart && (
                          <div className="mt-2 p-2 bg-amber-500/10 dark:bg-amber-500/5 rounded-xl border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="truncate">
                              <strong>Tende a estourar em:</strong> {speaker.mostExceededPart}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Botão de Ver Detalhes / Fechar */}
                      <button
                        type="button"
                        onClick={() => setSelectedSpeaker(isExpanded ? null : speaker)}
                        className="w-full min-h-[38px] px-3 bg-white dark:bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-between cursor-pointer"
                      >
                        <span>{isExpanded ? "Ocultar Detalhamento" : "Ver Detalhes & Partes"}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {/* Conteúdo Expandido do Orador */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Desempenho por Tipo de Parte:
                          </h5>
                          
                          <div className="space-y-1.5">
                            {speaker.partBreakdown.map((part) => {
                              const pSign = part.avgDiffSeconds >= 0 ? '+' : '';
                              return (
                                <div 
                                  key={part.partTitle}
                                  className="p-2.5 bg-white dark:bg-[#1E293B] rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs"
                                >
                                  <div className="min-w-0 pr-2">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                      {part.partTitle}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      {part.count}x • Planejado: {part.avgPlannedMin}m • Real: {part.avgActualMin}m
                                    </p>
                                  </div>

                                  <div className="text-right shrink-0 font-mono">
                                    <span className={cn(
                                      "font-bold text-xs px-2 py-0.5 rounded-lg inline-block",
                                      part.avgDiffSeconds > 20 ? "bg-red-500/10 text-red-500" :
                                      part.avgDiffSeconds < -30 ? "bg-sky-500/10 text-sky-500" : "bg-emerald-500/10 text-emerald-500"
                                    )}>
                                      {pSign}{part.avgDiffSeconds}s
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Histórico Recente de Participações */}
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-1">
                            Histórico de Reuniões:
                          </h5>
                          <div className="max-h-[160px] overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                            {speaker.historyEntries.map((hist, hIdx) => {
                              const hSign = hist.diffSeconds >= 0 ? '+' : '';
                              return (
                                <div key={hIdx} className="py-1.5 flex items-center justify-between">
                                  <div className="min-w-0">
                                    <p className="text-slate-700 dark:text-slate-300 font-medium truncate">
                                      {hist.partTitle}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                      {hist.meetingDate}
                                    </p>
                                  </div>
                                  <div className="text-right font-mono shrink-0 pl-2">
                                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                                      {formatTime(hist.actualSec)}
                                    </span>
                                    <span className={cn(
                                      "text-[10px] ml-1.5 font-bold",
                                      hist.diffSeconds > 15 ? "text-red-500" : "text-emerald-500"
                                    )}>
                                      ({hSign}{formatTime(hist.diffSeconds)})
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
