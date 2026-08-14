import { MeetingPart } from '../types';

export interface ParsedApostilaWeek {
  weekLabel?: string;
  bibleReading?: string;
  openingSong?: string;
  treasuresTheme?: string;
  spiritualGemsTheme?: string;
  bibleReadingSection?: string;
  ministryPart1?: { title: string; type?: string; lesson?: string };
  ministryPart2?: { title: string; type?: string; lesson?: string };
  ministryPart3?: { title: string; type?: string; lesson?: string };
  middleSong?: string;
  christianLivingPart1?: { title: string; minutes?: number };
  christianLivingPart2?: { title: string; minutes?: number };
  congregationBibleStudy?: { title: string; material?: string };
  closingSong?: string;
  rawText: string;
}

/**
 * Parser 100% local e offline para texto colado manualmente da Apostila
 * Não faz nenhuma requisição de rede (em estrita conformidade com os Termos de Uso do jw.org).
 */
export function parseApostilaText(text: string): ParsedApostilaWeek {
  const result: ParsedApostilaWeek = {
    rawText: text
  };

  if (!text || text.trim().length === 0) {
    return result;
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 1. Identificar data / semana e leitura da semana
  for (const line of lines.slice(0, 8)) {
    // Exemplo: "10-16 DE MARÇO", "1-7 DE ABRIL", "Semana de 12 de maio"
    if (/\d+[-–]\d+\s+de\s+[a-zçãéíóú]+/i.test(line) || /semana\s+de/i.test(line)) {
      result.weekLabel = line;
    }
    // Exemplo de leitura bíblica da semana: "SALMOS 1-10", "1 REIS 1-2", "MATEUS 1-3"
    if (/^[1-3]?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,15}\s+\d+([-–]\d+)?$/i.test(line) && !line.toLowerCase().includes('cântico')) {
      result.bibleReading = line;
    }
  }

  // 2. Extrair Cânticos
  const canticoMatches = text.match(/cântico\s+(\d+)/gi);
  if (canticoMatches && canticoMatches.length > 0) {
    result.openingSong = canticoMatches[0];
    if (canticoMatches.length > 1) {
      result.middleSong = canticoMatches[1];
    }
    if (canticoMatches.length > 2) {
      result.closingSong = canticoMatches[canticoMatches.length - 1];
    }
  }

  // 3. Extrair Tesouros da Palavra de Deus (Discurso 10 min)
  // Padrão comum: "1. TEMA DO DISCURSO (10 min)" ou linha após "TESOUROS DA PALAVRA DE DEUS"
  const treasuresMatch = text.match(/(?:TESOUROS DA PALAVRA DE DEUS|1\.\s+)([^\n(]+)(?:\((\d+)\s*min\))?/i);
  if (treasuresMatch) {
    const candidate = treasuresMatch[1].replace(/TESOUROS DA PALAVRA DE DEUS/i, '').trim();
    if (candidate.length > 3) {
      result.treasuresTheme = candidate;
    }
  }

  // Fallback ou busca por linha com "(10 min)"
  const tenMinLines = lines.filter(l => /\(10\s*min\)/i.test(l));
  if (tenMinLines.length > 0 && !result.treasuresTheme) {
    result.treasuresTheme = tenMinLines[0].replace(/\(10\s*min\)/i, '').replace(/^[\d.)\s-]+/, '').trim();
  }
  if (tenMinLines.length > 1) {
    result.spiritualGemsTheme = tenMinLines[1].replace(/\(10\s*min\)/i, '').replace(/^[\d.)\s-]+/, '').trim();
  }

  // 4. Leitura da Bíblia (4 min)
  const bibleReadMatch = text.match(/leitura da b[íi]blia[:\s]*([^\n(]+)(?:\((\d+)\s*min\))?/i);
  if (bibleReadMatch) {
    result.bibleReadingSection = bibleReadMatch[1].trim();
  } else {
    const fourMinLines = lines.filter(l => /leitura da b[íi]blia/i.test(l) || (/\(4\s*min\)/i.test(l) && /leitura/i.test(l)));
    if (fourMinLines.length > 0) {
      result.bibleReadingSection = fourMinLines[0].replace(/\(4\s*min\)/i, '').replace(/^[\d.)\s-]+/, '').trim();
    }
  }

  // 5. Faça Seu Melhor no Ministério (Partes de Estudante)
  const ministryKeywords = [
    'iniciar conversas', 'cultivar o interesse', 'fazer discípulos', 
    'explicar suas crenças', 'discurso', 'primeira conversa', 
    'revisita', 'estudo bíblico', 'vídeo', 'demonstração'
  ];

  const studentPartLines: string[] = [];
  lines.forEach(l => {
    if (/\((?:3|4|5)\s*min\)/i.test(l) && !/leitura da b[íi]blia/i.test(l) && !/comentários/i.test(l) && !/cântico/i.test(l)) {
      studentPartLines.push(l);
    }
  });

  if (studentPartLines.length >= 1) {
    result.ministryPart1 = { title: studentPartLines[0].replace(/\(\d+\s*min\)/i, '').replace(/^[\d.)\s-]+/, '').trim() };
  }
  if (studentPartLines.length >= 2) {
    result.ministryPart2 = { title: studentPartLines[1].replace(/\(\d+\s*min\)/i, '').replace(/^[\d.)\s-]+/, '').trim() };
  }
  if (studentPartLines.length >= 3) {
    result.ministryPart3 = { title: studentPartLines[2].replace(/\(\d+\s*min\)/i, '').replace(/^[\d.)\s-]+/, '').trim() };
  }

  // 6. Nossa Vida Cristã & Estudo Bíblico de Congregação (30 min)
  const cbsMatch = text.match(/estudo b[íi]blico de congrega[çc][ãa]o[:\s]*([^\n(]+)(?:\((\d+)\s*min\))?/i);
  if (cbsMatch) {
    result.congregationBibleStudy = {
      title: "Estudo Bíblico de Congregação",
      material: cbsMatch[1].trim()
    };
  } else {
    const thirtyMinLine = lines.find(l => /estudo b[íi]blico/i.test(l) || /\(30\s*min\)/i.test(l));
    if (thirtyMinLine) {
      result.congregationBibleStudy = {
        title: "Estudo Bíblico de Congregação",
        material: thirtyMinLine.replace(/\(30\s*min\)/i, '').replace(/^[\d.)\s-]+/, '').trim()
      };
    }
  }

  // Nossa Vida Cristã partes (15 min ou 10 min)
  const christianLivingLines = lines.filter(l => {
    const isCL = /\((?:15|10|7|8|5)\s*min\)/i.test(l);
    const notTreasures = !/tesouros/i.test(l) && !/joias/i.test(l);
    const notEBC = !/estudo b[íi]blico de congrega[çc][ãa]o/i.test(l);
    const notMinistry = !studentPartLines.includes(l);
    const notIntro = !/comentários/i.test(l) && !/cântico/i.test(l);
    return isCL && notTreasures && notEBC && notMinistry && notIntro;
  });

  if (christianLivingLines.length > 0) {
    const matchMin = christianLivingLines[0].match(/\((\d+)\s*min\)/i);
    result.christianLivingPart1 = {
      title: christianLivingLines[0].replace(/\(\d+\s*min\)/i, '').replace(/^[\d.)\s-]+/, '').trim(),
      minutes: matchMin ? parseInt(matchMin[1], 10) : 15
    };
  }

  return result;
}

/**
 * Exemplo de texto padrão da apostila para testes rápidos offline
 */
export const SAMPLE_APOSTILA_TEXT = `10-16 DE MARÇO
SALMOS 19-21

Cântico 12 e oração
Comentários iniciais (1 min)

TESOUROS DA PALAVRA DE DEUS
"A lei de Jeová é perfeita" (10 min)
Encontre joias espirituais (10 min)
Leitura da Bíblia: Salmo 19:1-14 (4 min)

FAÇA SEU MELHOR NO MINISTÉRIO
Iniciar conversas: Use o assunto do modelo para começar uma conversa (3 min)
Cultivar o interesse: Mostre um vídeo de jw.org e deixe uma pergunta pendente (4 min)
Fazer discípulos: Estudo bíblico usando a lição 12 do livro Seja Feliz (5 min)

NOSSA VIDA CRISTÃ
Cântico 85
Como a Bíblia nos ajuda a tomar boas decisões (15 min)
Estudo Bíblico de Congregação: Livro Seja Feliz para Sempre!, lição 38 pontos 1-3 (30 min)
Comentários finais (3 min)
Cântico 132 e oração`;

/**
 * Converte o parsed result para o array de MeetingPart padrão do S-38-T
 */
export function applyParsedToMeetingParts(currentParts: MeetingPart[], parsed: ParsedApostilaWeek): MeetingPart[] {
  const updated = currentParts.map(p => ({ ...p }));

  // Discurso 10 min
  const discurso = updated.find(p => p.id === 'discurso');
  if (discurso && parsed.treasuresTheme) {
    discurso.title = `Tesouros: ${parsed.treasuresTheme}`;
  }

  // Joias 10 min
  const joias = updated.find(p => p.id === 'joias');
  if (joias && parsed.spiritualGemsTheme) {
    joias.title = `Tesouros: ${parsed.spiritualGemsTheme}`;
  }

  // Leitura da Bíblia 4 min
  const leitura = updated.find(p => p.id === 'leitura');
  if (leitura && parsed.bibleReadingSection) {
    leitura.title = `Leitura da Bíblia: ${parsed.bibleReadingSection}`;
  }

  // Partes de Ministério
  const m1 = updated.find(p => p.id === 'ministerio1');
  if (m1 && parsed.ministryPart1?.title) {
    m1.title = `Ministério: ${parsed.ministryPart1.title}`;
  }

  const m2 = updated.find(p => p.id === 'ministerio2');
  if (m2 && parsed.ministryPart2?.title) {
    m2.title = `Ministério: ${parsed.ministryPart2.title}`;
  }

  const m3 = updated.find(p => p.id === 'ministerio3');
  if (m3 && parsed.ministryPart3?.title) {
    m3.title = `Ministério: ${parsed.ministryPart3.title}`;
  }

  // Cânticos
  const cAbertura = updated.find(p => p.id === 'abertura');
  if (cAbertura && parsed.openingSong) {
    cAbertura.title = `${parsed.openingSong} e Oração Iniciais`;
  }

  const cMeio = updated.find(p => p.id === 'vida_cantico');
  if (cMeio && parsed.middleSong) {
    cMeio.title = `${parsed.middleSong} (Intermediário)`;
  }

  const cFim = updated.find(p => p.id === 'conclusao_cantico');
  if (cFim && parsed.closingSong) {
    cFim.title = `${parsed.closingSong} e Oração Finais`;
  }

  // Nossa Vida Cristã
  const v1 = updated.find(p => p.id === 'vida1');
  if (v1 && parsed.christianLivingPart1?.title) {
    v1.title = `Vida Cristã: ${parsed.christianLivingPart1.title}`;
    if (parsed.christianLivingPart1.minutes) {
      v1.plannedTime = parsed.christianLivingPart1.minutes;
    }
  }

  // Estudo Bíblico de Congregação
  const ebc = updated.find(p => p.id === 'estudo');
  if (ebc && parsed.congregationBibleStudy?.material) {
    ebc.title = `Estudo Bíblico: ${parsed.congregationBibleStudy.material}`;
  }

  return updated;
}
