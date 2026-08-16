import { CompletedMeeting, Brother, Role } from '../types';

export interface SpeakerPartDetail {
  partTitle: string;
  count: number;
  avgPlannedMin: number;
  avgActualMin: number;
  avgDiffSeconds: number;
  exceededCount: number;
  onTimeCount: number;
}

export interface SpeakerHistoryEntry {
  meetingId: string;
  meetingDate: string;
  partTitle: string;
  plannedMin: number;
  actualSec: number;
  diffSeconds: number;
  status: string;
}

export type SpeakerPunctualityTrend = 'pontual' | 'estoura' | 'adianta' | 'misto';

export interface SpeakerStat {
  name: string;
  role: Role;
  totalParts: number;
  partsOnTime: number;
  partsExceeded: number;
  partsUnderTime: number;
  onTimeRate: number; // 0 a 100
  averageDiffSeconds: number; // positivo = demora, negativo = adianta
  trend: SpeakerPunctualityTrend;
  trendLabel: string;
  partBreakdown: SpeakerPartDetail[];
  mostExceededPart: string | null;
  historyEntries: SpeakerHistoryEntry[];
}

export interface PartTypeStat {
  partCategory: string; // Ex: 'Joias Espirituais', 'Discurso 10m', 'Estudo Bíblico'
  sectionName: string;
  count: number;
  totalPlannedSec: number;
  totalActualSec: number;
  avgPlannedMin: number;
  avgActualMin: number;
  avgDiffSeconds: number;
  exceededCount: number;
  exceededRate: number;
  speakersWithDelay: Array<{ name: string; avgDiffSeconds: number; count: number }>;
}

export interface RoleStat {
  role: Role;
  speakerCount: number;
  totalParts: number;
  onTimeRate: number;
  avgDiffSeconds: number;
}

export interface OverallAnalytics {
  totalMeetings: number;
  totalPartsAnalyzed: number;
  globalOnTimeRate: number;
  avgMeetingBalanceSeconds: number;
  topDelayParts: PartTypeStat[];
  speakers: SpeakerStat[];
  roleStats: RoleStat[];
  partTypeStats: PartTypeStat[];
}

// Normaliza o nome da parte para agrupar categorias estatísticas
export function categorizePartTitle(title: string): { category: string; section: string } {
  const t = title.toLowerCase();
  
  if (t.includes('cântico e oração') || t.includes('cantico inicial') || t.includes('comentários iniciais')) {
    return { category: 'Abertura & Cântico Inicial', section: 'Abertura' };
  }
  if (t.includes('discurso') && t.includes('tesouros')) {
    return { category: 'Tesouros: Discurso (10 min)', section: 'Tesouros' };
  }
  if (t.includes('joias') || t.includes('jóias')) {
    return { category: 'Tesouros: Joias Espirituais (10 min)', section: 'Tesouros' };
  }
  if (t.includes('leitura') || t.includes('bíblia')) {
    return { category: 'Tesouros: Leitura da Bíblia (4 min)', section: 'Tesouros' };
  }
  if (t.includes('ministério') || t.includes('ministerio') || t.includes('iniciando') || t.includes('cultivando') || t.includes('explicando')) {
    return { category: 'Ministério: Tarefas de Estudantes (4 min)', section: 'Ministério' };
  }
  if (t.includes('cântico intermediário') || t.includes('cantico do meio')) {
    return { category: 'Cântico Intermediário', section: 'Vida Cristã' };
  }
  if (t.includes('nossa vida cristã') || t.includes('vida cristã: parte') || t.includes('necessidades')) {
    return { category: 'Vida Cristã: Partes Práticas (15 min)', section: 'Vida Cristã' };
  }
  if (t.includes('estudo bíblico') || t.includes('estudo biblico') || t.includes('estudo de livro')) {
    return { category: 'Vida Cristã: Estudo Bíblico (30 min)', section: 'Vida Cristã' };
  }
  if (t.includes('discurso público') || t.includes('discurso de serviço') || t.includes('discurso do super') || t.includes('superintendente')) {
    return { category: 'Discurso Público / Superintendente (30 min)', section: 'Discursos Especiais' };
  }
  if (t.includes('estudo de a sentinela') || t.includes('sentinela')) {
    return { category: 'Estudo de A Sentinela (60 min)', section: 'Final de Semana' };
  }
  if (t.includes('comentários finais') || t.includes('conclusão') || t.includes('cantico final') || t.includes('cântico e oração finais')) {
    return { category: 'Conclusão & Cântico Final', section: 'Conclusão' };
  }

  return { category: title, section: 'Outras' };
}

// Analisa todas as reuniões concluídas e gera estatísticas completas
export function calculateMeetingAnalytics(
  meetings: CompletedMeeting[],
  knownBrothers: Brother[] = []
): OverallAnalytics {
  if (!meetings || meetings.length === 0) {
    return {
      totalMeetings: 0,
      totalPartsAnalyzed: 0,
      globalOnTimeRate: 100,
      avgMeetingBalanceSeconds: 0,
      topDelayParts: [],
      speakers: [],
      roleStats: [],
      partTypeStats: []
    };
  }

  // Mapa de papéis por nome
  const roleMap = new Map<string, Role>();
  knownBrothers.forEach(b => roleMap.set(b.name.trim().toLowerCase(), b.role));

  // Estruturas de agregação por orador
  const speakerDataMap = new Map<string, {
    name: string;
    role: Role;
    parts: Array<{
      meetingId: string;
      meetingDate: string;
      partTitle: string;
      plannedMin: number;
      actualSec: number;
      diffSec: number;
      isExceeded: boolean;
      isUnder: boolean;
    }>;
  }>();

  // Estruturas de agregação por tipo de parte
  const partTypeMap = new Map<string, {
    category: string;
    section: string;
    instances: Array<{
      speakerName?: string;
      plannedMin: number;
      actualSec: number;
      diffSec: number;
      isExceeded: boolean;
    }>;
  }>();

  let totalPartsAnalyzed = 0;
  let totalPartsOnTime = 0;
  let totalBalanceAccumulated = 0;

  meetings.forEach(meeting => {
    totalBalanceAccumulated += meeting.saldo_final_segundos || 0;

    (meeting.partes || []).forEach(part => {
      // Ignora cânticos congregacionais puros da análise de oradores
      const isSongOnly = part.hideSpeaker || part.title.toLowerCase().includes('cântico');
      
      const plannedSec = (part.plannedTime || 0) * 60;
      const actualSec = part.actualTime || 0;
      const diffSec = actualSec - plannedSec;
      const isExceeded = part.status === 'Excedido' || diffSec > 15; // margem de 15s de tolerância
      const isUnder = diffSec < -45;

      totalPartsAnalyzed++;
      if (!isExceeded) {
        totalPartsOnTime++;
      }

      // Agrupa na categoria da parte
      const { category, section } = categorizePartTitle(part.title);
      if (!partTypeMap.has(category)) {
        partTypeMap.set(category, { category, section, instances: [] });
      }
      partTypeMap.get(category)!.instances.push({
        speakerName: part.speaker,
        plannedMin: part.plannedTime,
        actualSec,
        diffSec,
        isExceeded
      });

      // Agrupa no orador (se houver orador designado)
      if (part.speaker && part.speaker.trim() && !isSongOnly) {
        const cleanName = part.speaker.trim();
        const lowerName = cleanName.toLowerCase();
        
        if (!speakerDataMap.has(cleanName)) {
          const guessedRole: Role = roleMap.get(lowerName) || 
            (cleanName.includes('Superintendente') ? 'Ancião' : 'Publicador');
          speakerDataMap.set(cleanName, {
            name: cleanName,
            role: guessedRole,
            parts: []
          });
        }

        speakerDataMap.get(cleanName)!.parts.push({
          meetingId: meeting.id,
          meetingDate: meeting.data_formatada || 'Reunião',
          partTitle: part.title,
          plannedMin: part.plannedTime,
          actualSec,
          diffSec,
          isExceeded,
          isUnder
        });
      }
    });
  });

  // 1. Processa estatísticas de cada orador
  const speakerStats: SpeakerStat[] = Array.from(speakerDataMap.values()).map(sp => {
    const totalParts = sp.parts.length;
    const partsExceeded = sp.parts.filter(p => p.isExceeded).length;
    const partsUnder = sp.parts.filter(p => p.isUnder).length;
    const partsOnTime = totalParts - partsExceeded;
    const onTimeRate = totalParts > 0 ? Math.round((partsOnTime / totalParts) * 100) : 100;
    
    const totalDiff = sp.parts.reduce((acc, p) => acc + p.diffSec, 0);
    const averageDiffSeconds = totalParts > 0 ? Math.round(totalDiff / totalParts) : 0;

    // Determina tendência de pontualidade
    let trend: SpeakerPunctualityTrend = 'pontual';
    let trendLabel = 'Pontual';
    if (averageDiffSeconds > 45 || (partsExceeded / totalParts) >= 0.5) {
      trend = 'estoura';
      trendLabel = 'Tende a Demorar';
    } else if (averageDiffSeconds < -60 || (partsUnder / totalParts) >= 0.5) {
      trend = 'adianta';
      trendLabel = 'Tende a Adiantar';
    } else if (partsExceeded > 0 && partsUnder > 0) {
      trend = 'misto';
      trendLabel = 'Variável';
    }

    // Detalhamento de partes deste orador
    const partSummaryMap = new Map<string, {
      count: number;
      totalPlannedMin: number;
      totalActualSec: number;
      totalDiffSec: number;
      exceededCount: number;
      onTimeCount: number;
    }>();

    sp.parts.forEach(p => {
      const { category } = categorizePartTitle(p.partTitle);
      if (!partSummaryMap.has(category)) {
        partSummaryMap.set(category, {
          count: 0,
          totalPlannedMin: 0,
          totalActualSec: 0,
          totalDiffSec: 0,
          exceededCount: 0,
          onTimeCount: 0
        });
      }
      const item = partSummaryMap.get(category)!;
      item.count++;
      item.totalPlannedMin += p.plannedMin;
      item.totalActualSec += p.actualSec;
      item.totalDiffSec += p.diffSec;
      if (p.isExceeded) item.exceededCount++;
      else item.onTimeCount++;
    });

    const partBreakdown: SpeakerPartDetail[] = Array.from(partSummaryMap.entries()).map(([partTitle, d]) => ({
      partTitle,
      count: d.count,
      avgPlannedMin: Math.round(d.totalPlannedMin / d.count),
      avgActualMin: +(d.totalActualSec / d.count / 60).toFixed(1),
      avgDiffSeconds: Math.round(d.totalDiffSec / d.count),
      exceededCount: d.exceededCount,
      onTimeCount: d.onTimeCount
    })).sort((a, b) => b.avgDiffSeconds - a.avgDiffSeconds);

    // Parte em que ele tem mais tendência a estourar
    const mostExceededPart = partBreakdown.find(p => p.avgDiffSeconds > 20)?.partTitle || 
      (partBreakdown[0]?.avgDiffSeconds > 0 ? partBreakdown[0].partTitle : null);

    const historyEntries: SpeakerHistoryEntry[] = sp.parts.map(p => ({
      meetingId: p.meetingId,
      meetingDate: p.meetingDate,
      partTitle: p.partTitle,
      plannedMin: p.plannedMin,
      actualSec: p.actualSec,
      diffSeconds: p.diffSec,
      status: p.isExceeded ? 'Excedido' : 'No tempo correto'
    }));

    return {
      name: sp.name,
      role: sp.role,
      totalParts,
      partsOnTime,
      partsExceeded,
      partsUnderTime: partsUnder,
      onTimeRate,
      averageDiffSeconds,
      trend,
      trendLabel,
      partBreakdown,
      mostExceededPart,
      historyEntries
    };
  }).sort((a, b) => {
    // Ordena priorizando quem mais participa ou quem mais estoura
    if (b.totalParts !== a.totalParts) return b.totalParts - a.totalParts;
    return b.averageDiffSeconds - a.averageDiffSeconds;
  });

  // 2. Processa estatísticas por tipo de parte da reunião
  const partTypeStats: PartTypeStat[] = Array.from(partTypeMap.entries()).map(([category, data]) => {
    const count = data.instances.length;
    const totalPlannedSec = data.instances.reduce((acc, i) => acc + (i.plannedMin * 60), 0);
    const totalActualSec = data.instances.reduce((acc, i) => acc + i.actualSec, 0);
    const avgPlannedMin = count > 0 ? Math.round(totalPlannedSec / count / 60) : 0;
    const avgActualMin = count > 0 ? +(totalActualSec / count / 60).toFixed(1) : 0;
    const avgDiffSeconds = count > 0 ? Math.round((totalActualSec - totalPlannedSec) / count) : 0;
    const exceededCount = data.instances.filter(i => i.isExceeded).length;
    const exceededRate = count > 0 ? Math.round((exceededCount / count) * 100) : 0;

    // Oradores que mais demoram nesta parte específica
    const speakerDelaysMap = new Map<string, { totalDiff: number; count: number }>();
    data.instances.forEach(i => {
      if (i.speakerName) {
        const current = speakerDelaysMap.get(i.speakerName) || { totalDiff: 0, count: 0 };
        current.totalDiff += i.diffSec;
        current.count++;
        speakerDelaysMap.set(i.speakerName, current);
      }
    });

    const speakersWithDelay = Array.from(speakerDelaysMap.entries())
      .map(([name, val]) => ({
        name,
        avgDiffSeconds: Math.round(val.totalDiff / val.count),
        count: val.count
      }))
      .sort((a, b) => b.avgDiffSeconds - a.avgDiffSeconds);

    return {
      partCategory: category,
      sectionName: data.section,
      count,
      totalPlannedSec,
      totalActualSec,
      avgPlannedMin,
      avgActualMin,
      avgDiffSeconds,
      exceededCount,
      exceededRate,
      speakersWithDelay
    };
  }).sort((a, b) => b.avgDiffSeconds - a.avgDiffSeconds);

  // Top partes com maior atraso
  const topDelayParts = [...partTypeStats].filter(p => p.count >= 1);

  // 3. Processa estatísticas por Cargo (Ancião / Servo / Publicador)
  const roles: Role[] = ['Ancião', 'Servo Ministerial', 'Publicador'];
  const roleStats: RoleStat[] = roles.map(role => {
    const roleSpeakers = speakerStats.filter(s => s.role === role);
    const totalParts = roleSpeakers.reduce((acc, s) => acc + s.totalParts, 0);
    const onTimeParts = roleSpeakers.reduce((acc, s) => acc + s.partsOnTime, 0);
    const onTimeRate = totalParts > 0 ? Math.round((onTimeParts / totalParts) * 100) : 100;
    
    const weightedDiff = roleSpeakers.reduce((acc, s) => acc + (s.averageDiffSeconds * s.totalParts), 0);
    const avgDiffSeconds = totalParts > 0 ? Math.round(weightedDiff / totalParts) : 0;

    return {
      role,
      speakerCount: roleSpeakers.length,
      totalParts,
      onTimeRate,
      avgDiffSeconds
    };
  });

  const globalOnTimeRate = totalPartsAnalyzed > 0 
    ? Math.round((totalPartsOnTime / totalPartsAnalyzed) * 100) 
    : 100;

  const avgMeetingBalanceSeconds = meetings.length > 0 
    ? Math.round(totalBalanceAccumulated / meetings.length) 
    : 0;

  return {
    totalMeetings: meetings.length,
    totalPartsAnalyzed,
    globalOnTimeRate,
    avgMeetingBalanceSeconds,
    topDelayParts,
    speakers: speakerStats,
    roleStats,
    partTypeStats
  };
}

