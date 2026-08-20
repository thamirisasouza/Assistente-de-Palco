import { MeetingPart, Brother } from '../types';

export interface ParsedMinistryPart {
  title: string;
  minutes: number;
  speaker?: string;
  assistant?: string;
}

export interface ParsedChristianLivingPart {
  title: string;
  minutes: number;
  speaker?: string;
}

export interface ParsedWeekSchedule {
  id: string;
  weekLabel: string;
  date: string;
  bibleReading: string;
  congregationName?: string;
  president?: string;
  openingPrayer?: string;
  openingSong?: string;
  treasuresTheme?: string;
  treasuresSpeaker?: string;
  spiritualGemsSpeaker?: string;
  bibleReadingSpeaker?: string;
  bibleReadingSection?: string;
  ministryParts: ParsedMinistryPart[];
  middleSong?: string;
  christianLivingParts: ParsedChristianLivingPart[];
  congregationStudyConductor?: string;
  congregationStudyReader?: string;
  congregationStudyMaterial?: string;
  closingSong?: string;
  closingPrayer?: string;
  rawText: string;
}

export interface MonthPdfParseResult {
  congregationName?: string;
  generationDate?: string;
  weeks: ParsedWeekSchedule[];
  allBrothersFound: string[];
}

/**
 * Limpa e normaliza espaços e quebras de linha
 */
function cleanStr(str?: string): string {
  if (!str) return "";
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Extrai nomes separados por barra: "Mércia / Jessica" => { speaker: "Mércia", assistant: "Jessica" }
 */
function parseSlashNames(text: string): { speaker: string; assistant?: string } {
  const parts = text.split('/').map(s => cleanStr(s)).filter(Boolean);
  if (parts.length >= 2) {
    return {
      speaker: parts[0],
      assistant: parts[1]
    };
  }
  return {
    speaker: cleanStr(text)
  };
}

/**
 * Remove números ordinais no início de linha: "1. A importância..." => "A importância..."
 */
function stripLeadingNumber(text: string): string {
  return text.replace(/^[\d.)\s-]+/, '').trim();
}

/**
 * Parser especializado na formatação do PDF Mensal da Reunião do Meio de Semana
 * Modelo: Jardim Rosana - Ferraz de Vasconcelos SP
 */
export function parseMonthlyPdfText(fullText: string): MonthPdfParseResult {
  const result: MonthPdfParseResult = {
    weeks: [],
    allBrothersFound: []
  };

  if (!fullText || !fullText.trim()) {
    return result;
  }

  const brothersSet = new Set<string>();

  // 1. Detectar Nome da Congregação no cabeçalho
  const headerMatch = fullText.match(/([^\n]+?)\s+(?:Reunião do meio de semana|Reuniao)/i);
  if (headerMatch) {
    result.congregationName = cleanStr(headerMatch[1].replace(/---\s*NOVA PÁGINA\s*---/g, ''));
  }

  // 2. Dividir o texto em blocos de semana
  // Padrão de início de semana: "3 de agosto de 2026 | JEREMIAS 22-23" ou "10 de agosto de 2026"
  const weekHeaderRegex = /(?:^|\n)(?:\d{2}\/\d{2}\/\d{4}[^\n]*\n)?(\d{1,2}\s+de\s+[a-zçãéíóúA-ZÇÃÉÍÓÚ]+\s+de\s+\d{4})\s*(?:\|\s*([^\n]+?))?(?=\s+Presidente|\s*\n)/gi;

  const matches: { index: number; date: string; reading: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = weekHeaderRegex.exec(fullText)) !== null) {
    matches.push({
      index: m.index,
      date: cleanStr(m[1]),
      reading: cleanStr(m[2] || "")
    });
  }

  // Se o regex estrito falhar, tenta dividir por linhas com data
  if (matches.length === 0) {
    const fallbackRegex = /(\d{1,2}\s+de\s+[a-zçãéíóúA-ZÇÃÉÍÓÚ]+(?:\s+de\s+\d{4})?)/gi;
    while ((m = fallbackRegex.exec(fullText)) !== null) {
      matches.push({
        index: m.index,
        date: cleanStr(m[1]),
        reading: ""
      });
    }
  }

  const weekBlocks: { date: string; reading: string; text: string }[] = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startIndex = current.index;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
    const blockText = fullText.substring(startIndex, endIndex).trim();

    weekBlocks.push({
      date: current.date,
      reading: current.reading,
      text: blockText
    });
  }

  // Se ainda não encontrou divisões, processa o texto todo como 1 semana
  if (weekBlocks.length === 0) {
    weekBlocks.push({
      date: "Semana Atual",
      reading: "",
      text: fullText
    });
  }

  // 3. Processar cada bloco de semana
  weekBlocks.forEach((block, idx) => {
    const weekText = block.text;
    const lines = weekText.split('\n').map(l => cleanStr(l)).filter(Boolean);

    const week: ParsedWeekSchedule = {
      id: `week-${idx + 1}`,
      weekLabel: block.reading ? `${block.date} | ${block.reading}` : block.date,
      date: block.date,
      bibleReading: block.reading,
      congregationName: result.congregationName,
      ministryParts: [],
      christianLivingParts: [],
      rawText: weekText
    };

    // Presidente
    const presMatch = weekText.match(/Presidente\s+([^\n\r]+?)(?=\s+Cântico|\s+Oração|\s*\n)/i);
    if (presMatch) {
      week.president = cleanStr(presMatch[1]);
      brothersSet.add(week.president);
    }

    // Cântico Inicial e Oração
    // Ex: "Cântico 40: Você já decidiu? Oração Dionisio"
    const openingSongMatch = weekText.match(/(Cântico\s+\d+[^:\n]*:[^\n\r]+?)(?=\s+Oração|\s+Comentários|\s*\n)/i);
    if (openingSongMatch) {
      week.openingSong = cleanStr(openingSongMatch[1]);
    } else {
      const genericSong1 = weekText.match(/Cântico\s+\d+/i);
      if (genericSong1) week.openingSong = cleanStr(genericSong1[0]);
    }

    // Oração inicial (geralmente na linha do cântico inicial ou logo após Presidente)
    const openPrayMatch = weekText.match(/Cântico[^\n]+?Oração\s+([^\n\r]+?)(?=\s+Comentários|\s+TESOUROS|\s*\n)/i) ||
                          weekText.match(/Oração\s+([A-ZÁÉÍÓÚÇ][a-záéíóúç]+(?:\s+[A-ZÁÉÍÓÚÇ][a-záéíóúç]+)*)/i);
    if (openPrayMatch) {
      week.openingPrayer = cleanStr(openPrayMatch[1]);
      brothersSet.add(week.openingPrayer);
    }

    // Seção TESOUROS DA PALAVRA DE DEUS
    const treasuresIndex = weekText.search(/TESOUROS DA PALAVRA DE DEUS/i);
    const ministryIndex = weekText.search(/FAÇA SEU MELHOR NO MINISTÉRIO/i);
    const christianLivingIndex = weekText.search(/NOSSA VIDA CRISTÃ/i);

    if (treasuresIndex !== -1) {
      const treasuresSection = weekText.substring(
        treasuresIndex, 
        ministryIndex !== -1 ? ministryIndex : weekText.length
      );
      const tLines = treasuresSection.split('\n').map(l => cleanStr(l)).filter(Boolean);

      for (const line of tLines) {
        // Discurso 10 min: "1. A importância de ter bons pastores (10 min) Fabricio Gonçalves"
        const discMatch = line.match(/(?:1\.\s*)?([^(]+)\(10\s*min\)\s*(.*)/i);
        if (discMatch && !line.toLowerCase().includes('joias')) {
          week.treasuresTheme = stripLeadingNumber(cleanStr(discMatch[1]));
          if (discMatch[2]) {
            week.treasuresSpeaker = cleanStr(discMatch[2]);
            brothersSet.add(week.treasuresSpeaker);
          }
        }

        // Joias 10 min: "2. Joias espirituais (10 min) Israel Rezende"
        if (line.toLowerCase().includes('joias')) {
          const gemsSpeakerMatch = line.match(/\(10\s*min\)\s*(.*)/i);
          if (gemsSpeakerMatch && gemsSpeakerMatch[1]) {
            week.spiritualGemsSpeaker = cleanStr(gemsSpeakerMatch[1]);
            brothersSet.add(week.spiritualGemsSpeaker);
          }
        }

        // Leitura da Bíblia 4 min: "3. Leitura da Bíblia (4 min) Raphael Alves"
        if (line.toLowerCase().includes('leitura da bíblia') || line.toLowerCase().includes('leitura da biblia')) {
          const bibleReadMatch = line.match(/\(4\s*min\)\s*(.*)/i);
          if (bibleReadMatch && bibleReadMatch[1]) {
            week.bibleReadingSpeaker = cleanStr(bibleReadMatch[1]);
            brothersSet.add(week.bibleReadingSpeaker);
          }
          week.bibleReadingSection = stripLeadingNumber(line.replace(/\(4\s*min\).*/i, ''));
        }
      }
    }

    // Seção FAÇA SEU MELHOR NO MINISTÉRIO
    if (ministryIndex !== -1) {
      const ministrySection = weekText.substring(
        ministryIndex, 
        christianLivingIndex !== -1 ? christianLivingIndex : weekText.length
      );
      const mLines = ministrySection.split('\n').map(l => cleanStr(l)).filter(Boolean);

      for (const line of mLines) {
        // Padrão: "4. Iniciando conversas (4 min) Mércia / Jessica"
        const partMatch = line.match(/(?:[4-6]\.\s*)?([^(]+)\((\d+)\s*min\)\s*(.*)/i);
        if (partMatch) {
          const title = stripLeadingNumber(cleanStr(partMatch[1]));
          const minutes = parseInt(partMatch[2], 10) || 4;
          const assignedText = cleanStr(partMatch[3] || "");

          const names = parseSlashNames(assignedText);
          if (names.speaker) brothersSet.add(names.speaker);
          if (names.assistant) brothersSet.add(names.assistant);

          week.ministryParts.push({
            title,
            minutes,
            speaker: names.speaker,
            assistant: names.assistant
          });
        }
      }
    }

    // Seção NOSSA VIDA CRISTÃ
    if (christianLivingIndex !== -1) {
      const clSection = weekText.substring(christianLivingIndex);
      const clLines = clSection.split('\n').map(l => cleanStr(l)).filter(Boolean);

      // Cântico Intermediário: "Cântico 103: Os anciãos são um presente de Jeová"
      const midSongMatch = clSection.match(/Cântico\s+(\d+[^:\n]*:[^\n\r]+)/i);
      if (midSongMatch) {
        week.middleSong = cleanStr(midSongMatch[0].split('\n')[0]);
      }

      // Procura partes de Vida Cristã (ex: 15 min, 10 min, 5 min) e Estudo Bíblico (30 min)
      for (let i = 0; i < clLines.length; i++) {
        const line = clLines[i];

        // Estudo Bíblico de Congregação (30 min) Fabiano dos Santos / José Lopes
        if (line.toLowerCase().includes('estudo bíblico de congregação') || line.toLowerCase().includes('estudo biblico')) {
          const ebcMatch = line.match(/\(30\s*min\)\s*(.*)/i);
          let assigned = "";
          if (ebcMatch && ebcMatch[1]) {
            assigned = ebcMatch[1];
          } else if (i + 1 < clLines.length && !clLines[i + 1].toLowerCase().includes('comentários') && !clLines[i + 1].toLowerCase().includes('cântico')) {
            assigned = clLines[i + 1];
          }

          const ebcNames = parseSlashNames(assigned);
          week.congregationStudyConductor = ebcNames.speaker;
          week.congregationStudyReader = ebcNames.assistant;
          if (ebcNames.speaker) brothersSet.add(ebcNames.speaker);
          if (ebcNames.assistant) brothersSet.add(ebcNames.assistant);
        } 
        // Outras partes de Vida Cristã com tempo (15 min, 10 min, 5 min)
        else if (/\((\d+)\s*min\)/i.test(line) && !line.toLowerCase().includes('estudo') && !line.toLowerCase().includes('comentários')) {
          const minMatch = line.match(/\((\d+)\s*min\)/i);
          const minutes = minMatch ? parseInt(minMatch[1], 10) : 15;
          const title = stripLeadingNumber(line.replace(/\(\d+\s*min\).*/i, ''));
          
          let speakerCandidate = line.replace(/.*?\(\d+\s*min\)\s*/i, '').trim();
          
          // Se o orador estiver na próxima linha
          if (!speakerCandidate && i + 1 < clLines.length && !clLines[i + 1].toLowerCase().includes('cântico') && !clLines[i + 1].toLowerCase().includes('estudo')) {
            speakerCandidate = clLines[i + 1];
          }

          if (speakerCandidate) {
            brothersSet.add(speakerCandidate);
          }

          week.christianLivingParts.push({
            title,
            minutes,
            speaker: cleanStr(speakerCandidate)
          });
        }
      }

      // Cântico Final e Oração: "Cântico 60: A mensagem de vida Oração João Junior"
      const closeMatches = clSection.match(/Cântico\s+(\d+[^:\n]*:[^\n\r]+?)(?:\s+Oração\s+([^\n\r]+)|$)/i) ||
                           clSection.match(/Cântico\s+(\d+)\s*:\s*([^\n]+)/i);
      
      const canticoRegex = /Cântico\s+(\d+[^:\n]*:[^\n\r]+)/gi;
      const allCanticos: string[][] = [];
      let m;
      while ((m = canticoRegex.exec(clSection)) !== null) {
        allCanticos.push(m);
      }
      if (allCanticos.length > 1) {
        const lastCanticoLine = allCanticos[allCanticos.length - 1][0];
        const prayInLast = lastCanticoLine.match(/Oração\s+(.*)/i);
        if (prayInLast) {
          week.closingSong = cleanStr(lastCanticoLine.replace(/Oração\s+.*/i, ''));
          week.closingPrayer = cleanStr(prayInLast[1]);
        } else {
          week.closingSong = cleanStr(lastCanticoLine);
        }
      }

      // Oração final caso esteja em outra linha
      const closePrayMatch = clSection.match(/Oração\s+([A-ZÁÉÍÓÚÇ][a-záéíóúç]+(?:\s+[A-ZÁÉÍÓÚÇ][a-záéíóúç]+)*)\s*$/m) ||
                             clSection.match(/Oração\s+([^\n\r]+)/gi);
      if (closePrayMatch && !week.closingPrayer) {
        const lastPray = closePrayMatch[closePrayMatch.length - 1].replace(/Oração\s+/i, '');
        week.closingPrayer = cleanStr(lastPray);
      }
      if (week.closingPrayer) {
        brothersSet.add(week.closingPrayer);
      }
    }

    result.weeks.push(week);
  });

  result.allBrothersFound = Array.from(brothersSet).filter(b => b && b.length > 2 && !b.toLowerCase().includes('cântico'));
  return result;
}

/**
 * Converte a semana analisada do PDF para a lista de MeetingPart do app
 */
export function applyPdfWeekToMeetingParts(
  currentParts: MeetingPart[], 
  week: ParsedWeekSchedule
): MeetingPart[] {
  let parts = currentParts.map(p => ({ ...p }));

  // 1. Cântico e Oração Iniciais
  const cAbertura = parts.find(p => p.id === 'abertura');
  if (cAbertura) {
    cAbertura.partNumber = undefined;
    if (week.openingSong) {
      cAbertura.title = `${week.openingSong} & Oração Inicial`;
    }
    if (week.openingPrayer) {
      cAbertura.speaker = week.openingPrayer;
    }
  }

  // 2. Comentários Iniciais (Presidente)
  const comentIniciais = parts.find(p => p.id === 'comentarios');
  if (comentIniciais) {
    comentIniciais.partNumber = undefined;
    if (week.president) {
      comentIniciais.speaker = week.president;
    }
  }

  // 3. Tesouros - Discurso 10 min
  const discurso = parts.find(p => p.id === 'discurso');
  if (discurso) {
    discurso.partNumber = 1;
    if (week.treasuresTheme) {
      discurso.title = `Tesouros: ${week.treasuresTheme}`;
    }
    if (week.treasuresSpeaker) {
      discurso.speaker = week.treasuresSpeaker;
    }
  }

  // 4. Tesouros - Joias Espirituais 10 min
  const joias = parts.find(p => p.id === 'joias');
  if (joias) {
    joias.partNumber = 2;
    if (week.spiritualGemsSpeaker) {
      joias.speaker = week.spiritualGemsSpeaker;
    }
  }

  // 5. Tesouros - Leitura da Bíblia 4 min
  const leitura = parts.find(p => p.id === 'leitura');
  if (leitura) {
    leitura.partNumber = 3;
    if (week.bibleReadingSection) {
      leitura.title = `Leitura da Bíblia: ${week.bibleReadingSection}`;
    }
    if (week.bibleReadingSpeaker) {
      leitura.speaker = week.bibleReadingSpeaker;
    }
  }

  // 6. Faça Seu Melhor no Ministério
  const m1 = parts.find(p => p.id === 'ministerio1');
  if (m1) {
    m1.partNumber = 4;
    if (week.ministryParts[0]) {
      m1.title = `Ministério: ${week.ministryParts[0].title}`;
      m1.plannedTime = week.ministryParts[0].minutes || 4;
      m1.speaker = week.ministryParts[0].speaker;
      m1.assistant = week.ministryParts[0].assistant;
    }
  }

  const m2 = parts.find(p => p.id === 'ministerio2');
  if (m2) {
    m2.partNumber = 5;
    if (week.ministryParts[1]) {
      m2.title = `Ministério: ${week.ministryParts[1].title}`;
      m2.plannedTime = week.ministryParts[1].minutes || 4;
      m2.speaker = week.ministryParts[1].speaker;
      m2.assistant = week.ministryParts[1].assistant;
    }
  }

  const m3 = parts.find(p => p.id === 'ministerio3');
  if (m3) {
    m3.partNumber = 6;
    if (week.ministryParts[2]) {
      m3.title = `Ministério: ${week.ministryParts[2].title}`;
      m3.plannedTime = week.ministryParts[2].minutes || 4;
      m3.speaker = week.ministryParts[2].speaker;
      m3.assistant = week.ministryParts[2].assistant;
    }
  }

  // 7. Cântico Intermediário
  const cMeio = parts.find(p => p.id === 'vida_cantico');
  if (cMeio) {
    cMeio.partNumber = undefined;
    if (week.middleSong) {
      cMeio.title = `${week.middleSong}`;
    }
  }

  // 8. Nossa Vida Cristã
  const v1 = parts.find(p => p.id === 'vida1');
  if (v1) {
    v1.partNumber = 7;
    if (week.christianLivingParts[0]) {
      v1.title = `Vida Cristã: ${week.christianLivingParts[0].title}`;
      v1.plannedTime = week.christianLivingParts[0].minutes || 15;
      v1.speaker = week.christianLivingParts[0].speaker;
    }
  }

  // Se houver uma 2ª parte de Vida Cristã no PDF (ex: semana de campanha)
  if (week.christianLivingParts.length > 1) {
    const v2Index = parts.findIndex(p => p.id === 'vida2');
    const partV2Data: MeetingPart = {
      id: 'vida2',
      partNumber: 8,
      title: `Vida Cristã: ${week.christianLivingParts[1].title}`,
      plannedTime: week.christianLivingParts[1].minutes || 5,
      flexible: false,
      hasCounsel: false,
      speaker: week.christianLivingParts[1].speaker
    };

    if (v2Index >= 0) {
      parts[v2Index] = partV2Data;
    } else {
      const v1Index = parts.findIndex(p => p.id === 'vida1');
      if (v1Index >= 0) {
        parts.splice(v1Index + 1, 0, partV2Data);
      }
    }
  } else {
    // Se não houver 2ª parte, remove qualquer 'vida2' sobressalente
    parts = parts.filter(p => p.id !== 'vida2');
  }

  // 9. Estudo Bíblico de Congregação
  const ebc = parts.find(p => p.id === 'estudo');
  if (ebc) {
    ebc.partNumber = week.christianLivingParts.length > 1 ? 9 : 8;
    ebc.plannedTime = 30;
    ebc.flexible = false;
    if (week.congregationStudyConductor) {
      ebc.speaker = week.congregationStudyConductor;
    }
    if (week.congregationStudyReader) {
      ebc.assistant = week.congregationStudyReader;
    }
    if (week.congregationStudyMaterial) {
      ebc.title = `Estudo Bíblico: ${week.congregationStudyMaterial}`;
    }
  }

  // 10. Comentários Finais (Presidente)
  const comentFinais = parts.find(p => p.id === 'comentarios_finais');
  if (comentFinais) {
    comentFinais.partNumber = undefined;
    comentFinais.plannedTime = 3;
    comentFinais.flexible = false;
    if (week.president) {
      comentFinais.speaker = week.president;
    }
  }

  // 11. Cântico e Oração Finais
  const cFim = parts.find(p => p.id === 'conclusao_cantico');
  if (cFim) {
    cFim.partNumber = undefined;
    if (week.closingSong) {
      cFim.title = `${week.closingSong} & Oração Final`;
    }
    if (week.closingPrayer) {
      cFim.speaker = week.closingPrayer;
    }
  }

  return parts;
}

/**
 * Converte strings de data da apostila em objeto Date para comparação
 * Ex: "17 de agosto de 2026", "17 de agosto", "17/08/2026", etc.
 */
export function parseWeekStartDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const str = dateStr.toLowerCase().trim();

  const ptMonths: Record<string, number> = {
    'janeiro': 0, 'jan': 0,
    'fevereiro': 1, 'fev': 1,
    'março': 2, 'marco': 2, 'mar': 2,
    'abril': 3, 'abr': 3,
    'maio': 4, 'mai': 4,
    'junho': 5, 'jun': 5,
    'julho': 6, 'jul': 6,
    'agosto': 7, 'ago': 7,
    'setembro': 8, 'set': 8,
    'outubro': 9, 'out': 9,
    'novembro': 10, 'nov': 10,
    'dezembro': 11, 'dez': 11
  };

  // Formato com barras ou hífens: 17/08/2026 ou 17/08
  const slashMatch = str.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}|\d{2}))?/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    let year = slashMatch[3] ? parseInt(slashMatch[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    return new Date(year, month, day, 0, 0, 0);
  }

  // Formato por extenso: "17 de agosto de 2026" ou "17 de agosto"
  const textMatch = str.match(/(\d{1,2})\s+de\s+([a-zçãéíóúA-ZÇÃÉÍÓÚ]+)(?:\s+de\s+(\d{4}))?/i);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthName = textMatch[2].toLowerCase().trim();
    const month = ptMonths[monthName] ?? -1;
    const year = textMatch[3] ? parseInt(textMatch[3], 10) : new Date().getFullYear();
    if (month !== -1) {
      return new Date(year, month, day, 0, 0, 0);
    }
  }

  return null;
}

/**
 * Encontra a semana correspondente à data informada (ou à data atual).
 * Se hoje é dia 18 e a semana começou dia 17 (segunda-feira), a semana do dia 17 é selecionada.
 */
export function findMatchingWeekForDate(weeks: ParsedWeekSchedule[], targetDate: Date = new Date()): ParsedWeekSchedule | null {
  if (!weeks || weeks.length === 0) return null;

  const targetTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();

  // 1. Tenta encontrar a semana onde targetDate está entre o início da semana e o final (7 dias corridos)
  for (const week of weeks) {
    const startDate = parseWeekStartDate(week.date);
    if (startDate) {
      const startTime = startDate.getTime();
      const endTime = startTime + (7 * 24 * 60 * 60 * 1000) - 1; // 7 dias
      if (targetTime >= startTime && targetTime <= endTime) {
        return week;
      }
    }
  }

  // 2. Se a data estiver fora do intervalo estrito, seleciona a semana mais próxima
  let closestWeek = weeks[0];
  let minDiff = Infinity;

  for (const week of weeks) {
    const startDate = parseWeekStartDate(week.date);
    if (startDate) {
      const diff = Math.abs(startDate.getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestWeek = week;
      }
    }
  }

  return closestWeek;
}

/**
 * Exemplo real padrão retirado exatamente do PDF mensal
 */
export const SAMPLE_MONTHLY_PDF_TEXT = `Jardim Rosana - Ferraz de Vasconcelos SP Reunião do meio de semana
13/08/2026, 21:59:21
3 de agosto de 2026 | JEREMIAS 22-23 Presidente José Carlos
Cântico 40: Você já decidiu? Oração Dionisio
Comentários iniciais
TESOUROS DA PALAVRA DE DEUS
1. A importância de ter bons pastores (10 min) Fabricio Gonçalves
2. Joias espirituais (10 min) Israel Rezende
3. Leitura da Bíblia (4 min) Raphael Alves
FAÇA SEU MELHOR NO MINISTÉRIO
4. Iniciando conversas (4 min) Mércia / Jessica
5. Cultivando o interesse (4 min) Mércia Moraes / Marcia Melo
6. Discurso (4 min) Leonardo Silva
NOSSA VIDA CRISTÃ
Cântico 103: Os anciãos são um presente de Jeová
7. Uma História Escrita por Jeová— O Corpo Governante Unido com os Irmãos — Parte 1 (15 min) Alison Valença
8. Estudo bíblico de congregação (30 min) Fabiano dos Santos / José Lopes
Comentários finais
Cântico 60: A mensagem de vida Oração João Junior

10 de agosto de 2026 | JEREMIAS 24-25 Presidente Vandeir Moraes
Cântico 124: Sempre leais Oração Rafael Oliveira
Comentários iniciais
TESOUROS DA PALAVRA DE DEUS
1. Por que alguns “figos” eram bons e outros eram ruins? (10 min) Arnon Vinicius
2. Joias espirituais (10 min) Emerson S. Machado
3. Leitura da Bíblia (4 min) Fabio Jose
FAÇA SEU MELHOR NO MINISTÉRIO
4. Iniciando conversas (4 min) Gilvaneide dos Santos / Patricia Alves
5. Cultivando o interesse (4 min) Luciana Santos / Terezinha P. Soares
6. Fazendo discípulos (4 min) Alvina / Julia Oliveira
NOSSA VIDA CRISTÃ
Cântico 65: Confiantes, nós vamos continuar!
7. Necessidades locais (15 min) Vandeir Moraes
8. Estudo bíblico de congregação (30 min) Magno Lobo / Gustavo Valença
Comentários finais
Cântico 137: Mulheres fiéis Oração Marcelo Alves

17 de agosto de 2026 | JEREMIAS 26-28 Presidente Alison Valença
Cântico 77: Luz num mundo sombrio Oração Eliezer
Comentários iniciais
TESOUROS DA PALAVRA DE DEUS
1. Não seja enganado por falsos profetas (10 min) Lucas Taveira
2. Joias espirituais (10 min) Valdir Ferreira
3. Leitura da Bíblia (4 min) Gerson José da Costa
FAÇA SEU MELHOR NO MINISTÉRIO
4. Iniciando conversas (3 min) Elaine Ferreira / Israelita
5. Cultivando o interesse (4 min) Djanira / Maria do Carmo
6. Fazendo discípulos (5 min) Alberto Correia / Itallo Silva
NOSSA VIDA CRISTÃ
Cântico 16: Jeová escolheu nosso Rei
7. Necessidades locais (15 min) José Carlos
8. Estudo bíblico de congregação (30 min) Vandeir Moraes / Leonardo Silva
Comentários finais
Cântico 71: Marchamos com Jeová Oração Valdir Ferreira

24 de agosto de 2026 | JEREMIAS 29-30 Presidente Lucas Taveira
Cântico 12: Nosso grandioso Deus, Jeová Oração Vandeir Moraes
Comentários iniciais
TESOUROS DA PALAVRA DE DEUS
1. Jeová disciplina seus servos na medida certa (10 min) Valdemir Silva
2. Joias espirituais (10 min) Arnon Vinicius
3. Leitura da Bíblia (4 min) Dionisio
FAÇA SEU MELHOR NO MINISTÉRIO
4. Iniciando conversas (4 min) Eliane Silva / Maria da Graça
5. Iniciando conversas (3 min) Lucidalva Santos / Eunice Silveira
6. Discurso (5 min) Gustavo Valença
NOSSA VIDA CRISTÃ
Cântico 3: Jeová, minha força e esperança
7. Jeová dá esperança a seus servos (10 min) Fabiano dos Santos
8. Campanha especial em setembro (5 min) Edson De Souza
9. Estudo bíblico de congregação (30 min) Jilmar Silva / Raphael Alves
Comentários finais
Cântico 156: Olhar com fé Oração Denis Nonis

31 de agosto de 2026 | JEREMIAS 31 Presidente Fabiano dos Santos
Cântico 27: A vitória dos filhos de Deus Oração Gustavo Valença
Comentários iniciais
TESOUROS DA PALAVRA DE DEUS
1. “Farei . . . um novo pacto” (10 min) José Carlos
2. Joias espirituais (10 min) Luciano Taveira
3. Leitura da Bíblia (4 min) Victor Ramos
FAÇA SEU MELHOR NO MINISTÉRIO
4. Iniciando conversas (3 min) Cicera / Edna
5. Iniciando conversas (4 min) Cleuza / Lorhany Alves
6. Explicando suas crenças (5 min) Rafael Oliveira
NOSSA VIDA CRISTÃ
Cântico 67: “Pregue a palavra”
7. Seja adaptável — Use o JW.ORG (15 min) Denis Nonis
8. Estudo bíblico de congregação (30 min) Edson De Souza / Itallo Silva
Comentários finais
Cântico 132: Nós somos um Oração Magno Lobo`;
