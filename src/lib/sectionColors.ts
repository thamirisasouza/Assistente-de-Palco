import { MeetingPart } from '../types';

export interface SectionDefinition {
  id: 'abertura' | 'tesouros' | 'ministerio' | 'vida';
  name: string;
  shortName: string;
  color: string; // Ex: '#3F647E'
  textColor: string;
  bgRgb: [number, number, number];
  lightBg: string;
  darkBg: string;
  borderClass: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

export const SECTIONS: Record<string, SectionDefinition> = {
  abertura: {
    id: 'abertura',
    name: 'ABERTURA DA REUNIÃO',
    shortName: 'Abertura',
    color: '#334155',
    textColor: '#FFFFFF',
    bgRgb: [51, 65, 85],
    lightBg: 'bg-slate-100',
    darkBg: 'dark:bg-slate-850',
    borderClass: 'border-slate-400',
    badgeBg: 'bg-slate-700 text-white',
    badgeText: 'text-slate-700 dark:text-slate-300',
    description: 'Cântico inicial e Comentários do Presidente'
  },
  tesouros: {
    id: 'tesouros',
    name: 'TESOUROS DA PALAVRA DE DEUS',
    shortName: 'Tesouros',
    color: '#3F647E',
    textColor: '#FFFFFF',
    bgRgb: [63, 100, 126],
    lightBg: 'bg-[#3F647E]/10',
    darkBg: 'dark:bg-[#3F647E]/20',
    borderClass: 'border-[#3F647E]',
    badgeBg: 'bg-[#3F647E] text-white',
    badgeText: 'text-[#3F647E] dark:text-[#88B4D4]',
    description: 'Discurso de 10 min, Joias Espirituais e Leitura da Bíblia'
  },
  ministerio: {
    id: 'ministerio',
    name: 'FAÇA SEU MELHOR NO MINISTÉRIO',
    shortName: 'Ministério',
    color: '#A4762A',
    textColor: '#FFFFFF',
    bgRgb: [164, 118, 42],
    lightBg: 'bg-[#A4762A]/10',
    darkBg: 'dark:bg-[#A4762A]/20',
    borderClass: 'border-[#A4762A]',
    badgeBg: 'bg-[#A4762A] text-white',
    badgeText: 'text-[#A4762A] dark:text-[#E2B765]',
    description: 'Tarefas de estudantes, conversas e demonstrações'
  },
  vida: {
    id: 'vida',
    name: 'NOSSA VIDA CRISTÃ',
    shortName: 'Vida Cristã',
    color: '#8C272C',
    textColor: '#FFFFFF',
    bgRgb: [140, 39, 44],
    lightBg: 'bg-[#8C272C]/10',
    darkBg: 'dark:bg-[#8C272C]/20',
    borderClass: 'border-[#8C272C]',
    badgeBg: 'bg-[#8C272C] text-white',
    badgeText: 'text-[#8C272C] dark:text-[#E27D83]',
    description: 'Cânticos, Partes práticas, Estudo Bíblico e Conclusão'
  }
};

/**
 * Identifica a qual seção pertence uma determinada parte da reunião
 */
export function getPartSection(part?: MeetingPart, index?: number): SectionDefinition {
  if (!part) return SECTIONS.abertura;

  const id = (part.id || '').toLowerCase();
  const title = (part.title || '').toLowerCase();

  // Abertura
  if (id === 'abertura' || id === 'comentarios') {
    return SECTIONS.abertura;
  }
  if (index !== undefined && index <= 1 && (title.includes('comentários iniciais') || title.includes('cântico e oração')) && !title.includes('vida') && !title.includes('intermediário')) {
    return SECTIONS.abertura;
  }

  // Tesouros da Palavra de Deus (#3F647E)
  if (
    id === 'discurso' || 
    id === 'joias' || 
    id === 'leitura' || 
    title.includes('tesouro') || 
    title.includes('joias') || 
    title.includes('leitura da bíblia')
  ) {
    return SECTIONS.tesouros;
  }

  // Faça Seu Melhor no Ministério (#A4762A)
  if (
    id.startsWith('ministerio') || 
    title.includes('ministério') || 
    title.includes('iniciando conversas') || 
    title.includes('iniciar conversas') ||
    title.includes('cultivando o interesse') || 
    title.includes('cultivar o interesse') ||
    title.includes('explicando suas crenças') || 
    title.includes('explicar suas crenças') ||
    title.includes('fazendo discípulos') ||
    title.includes('fazer discípulos') ||
    title.includes('discurso de estudante')
  ) {
    return SECTIONS.ministerio;
  }

  // Nossa Vida Cristã (#8C272C)
  return SECTIONS.vida;
}

/**
 * Retorna as partes agrupadas por seção para exibição na lista/agenda
 */
export function groupPartsBySection(parts: MeetingPart[]) {
  const groups: {
    section: SectionDefinition;
    parts: { part: MeetingPart; originalIndex: number }[];
  }[] = [
    { section: SECTIONS.abertura, parts: [] },
    { section: SECTIONS.tesouros, parts: [] },
    { section: SECTIONS.ministerio, parts: [] },
    { section: SECTIONS.vida, parts: [] }
  ];

  parts.forEach((part, index) => {
    const section = getPartSection(part, index);
    const group = groups.find(g => g.section.id === section.id);
    if (group) {
      group.parts.push({ part, originalIndex: index });
    }
  });

  // Filtra grupos que tenham partes
  return groups.filter(g => g.parts.length > 0);
}
