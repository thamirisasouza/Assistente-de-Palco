import jsPDF from 'jspdf';
import { CompletedMeeting, PartRecord } from '../types';
import { formatTime, formatBalanceDisplay } from './utils';
import { MonthPdfParseResult, ParsedWeekSchedule } from './apostilaParser';

/**
 * Formata segundos em minutos e segundos: "09:45" ou "9:45"
 */
export function formatActualTimePdf(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formata data curta no padrão DD/MM/AA (ex: 13/08/26)
 */
function getShortMeetingDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/**
 * Limpa títulos para manter o padrão idêntico do PDF modelo
 */
function cleanPartTitle(rawTitle: string): string {
  return rawTitle
    .replace(/^Tesouros:\s*/i, '')
    .replace(/^Ministério:\s*/i, '')
    .replace(/^Faça Seu Melhor no Ministério:\s*/i, '')
    .replace(/^Nossa Vida Cristã:\s*/i, '')
    .replace(/^Vida Cristã:\s*/i, '')
    .replace(/^Leitura da Bíblia:\s*/i, 'Leitura da Bíblia')
    .replace(/^Estudo Bíblico:\s*/i, 'Estudo bíblico de congregação')
    .trim();
}

/**
 * Exporta o PDF com layout idêntico ao modelo oficial da congregação:
 * - As semanas são as mesmas do PDF importado
 * - Cabeçalho da semana:
 *     3 de agosto de 2026 | JEREMIAS 22-23
 *     # Reunião do dia 13/08/26
 * - Tempos reais alinhados em coluna própria na frente do nome do publicador
 * - Tempos que ultrapassaram o planejado em VERMELHO
 */
export function exportMeetingToPdf(meeting: CompletedMeeting) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight; // 180mm
  
  // Colunas perfeitamente alinhadas
  const maxTitleWidth = 100; // Coluna 1: Título e minutos planejados (15mm a 115mm)
  const nameColumnX = 118;   // Coluna 2: Nome do Publicador / Designação (118mm a 170mm)
  const timeBoxX = 173;      // Coluna 3: Quadrado do Tempo Real (173mm a 193mm, após o nome do publicador)
  const timeBoxWidth = 20;   // Largura do quadradinho do tempo
  const timeBoxHeight = 4.1; // Altura do quadradinho do tempo

  // Tenta carregar o mês completo importado se existir
  let monthSchedule: MonthPdfParseResult | null = null;
  try {
    const saved = localStorage.getItem('s38t_imported_month_schedule');
    if (saved) {
      monthSchedule = JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Não foi possível carregar programação mensal armazenada:", e);
  }

  let y = 16;

  // 1. Cabeçalho Geral (Página 1)
  const drawPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);

    const congTitle = meeting.congregacao || monthSchedule?.congregationName || "Jardim Rosana - Ferraz de Vasconcelos SP";
    doc.text(congTitle, marginLeft, y);

    const headerRight = "Reunião do meio de semana";
    const rightHeaderWidth = doc.getTextWidth(headerRight);
    doc.text(headerRight, marginLeft + contentWidth - rightHeaderWidth, y);
    y += 7.5;
  };

  drawPageHeader();

  // Helper para Faixa Colorida de Seção
  const drawSectionBanner = (title: string, bgColor: [number, number, number]) => {
    if (y > pageHeight - 32) {
      doc.addPage();
      y = 16;
      drawPageHeader();
    }

    doc.setFillColor(...bgColor);
    doc.rect(marginLeft, y - 3.8, contentWidth, 5.0, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title, marginLeft + 2, y - 0.2);

    y += 5.0;
  };

  // Helper para Linha de Parte com Tempo Real Alinhado e Colorido
  const drawScheduleRow = (
    itemText: string,
    actualSecs?: number,
    plannedMins?: number,
    publisherName?: string,
    isPrayer = false
  ) => {
    if (y > pageHeight - 18) {
      doc.addPage();
      y = 16;
      drawPageHeader();
    }

    // 1. Coluna do Tema (Esquerda)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    const lines = doc.splitTextToSize(itemText, maxTitleWidth);
    doc.text(lines[0], marginLeft, y);

    // 2. Coluna do Publicador / Designação (nameColumnX = 118mm, antes do quadradinho do tempo)
    if (publisherName) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);

      if (isPrayer) {
        doc.setTextColor(71, 85, 105);
        doc.text("Oração", nameColumnX, y);
        doc.setTextColor(15, 23, 42);
        doc.text(publisherName, nameColumnX + 14, y);
      } else {
        doc.text(publisherName, nameColumnX, y);
      }
    }

    // 3. Coluna do Tempo Real (Após o nome do publicador: Quadradinho destacado)
    if (actualSecs !== undefined && actualSecs > 0) {
      const isOvertime = plannedMins !== undefined && plannedMins > 0 
        ? actualSecs > (plannedMins * 60)
        : false;

      const timeFormatted = formatActualTimePdf(actualSecs);

      if (isOvertime) {
        // ULTRAPASSOU: QUADRADINHO VERMELHO COM TEXTO BRANCO EM NEGRITO
        doc.setFillColor(220, 38, 38); // #DC2626 Vermelho vibrante
        doc.setDrawColor(185, 28, 28); // #B91C1C Borda vermelha escura
        doc.roundedRect(timeBoxX, y - 3.2, timeBoxWidth, timeBoxHeight, 0.8, 0.8, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(timeFormatted, timeBoxX + (timeBoxWidth / 2), y - 0.2, { align: 'center' });
      } else {
        // NO TEMPO: Quadradinho sutil com texto verde escuro
        doc.setFillColor(241, 245, 249); // Slate-100 neutro
        doc.setDrawColor(203, 213, 225); // Slate-300
        doc.roundedRect(timeBoxX, y - 3.2, timeBoxWidth, timeBoxHeight, 0.8, 0.8, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(22, 101, 52); // #166534 Verde sóbrio
        doc.text(timeFormatted, timeBoxX + (timeBoxWidth / 2), y - 0.2, { align: 'center' });
      }
    }

    // Se o tema quebrou linha
    if (lines.length > 1) {
      for (let i = 1; i < lines.length; i++) {
        y += 4.0;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(lines[i], marginLeft + 3, y);
      }
    }

    y += 4.6;
  };

  // Helper para renderizar a semana completa da reunião realizada
  const renderConductedMeetingWeek = (targetMeeting: CompletedMeeting) => {
    // 1. Cabeçalho da Semana
    // Linha 1: 3 de agosto de 2026 | JEREMIAS 22-23
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);

    const weekTitle = targetMeeting.semana_apostila || `${targetMeeting.data_formatada} | ${targetMeeting.tipo_semana.toUpperCase()}`;
    doc.text(weekTitle, marginLeft, y);

    // Presidente alinhado à direita
    if (targetMeeting.presidente) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Presidente", nameColumnX, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(targetMeeting.presidente, nameColumnX + 16, y);
    }
    y += 4.5;

    // Linha 2: # Reunião do dia 13/08/26
    const shortDate = targetMeeting.data_reuniao_curta || getShortMeetingDate(targetMeeting.encerrada_em || targetMeeting.iniciada_em);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(`# Reunião do dia ${shortDate}`, marginLeft, y);
    y += 4.5;

    // Mapeamento das partes registradas
    const pAbertura = targetMeeting.partes.find(p => p.id === 'abertura');
    const pComentarios = targetMeeting.partes.find(p => p.id === 'comentarios');
    const pDiscurso = targetMeeting.partes.find(p => p.id === 'discurso');
    const pJoias = targetMeeting.partes.find(p => p.id === 'joias');
    const pLeitura = targetMeeting.partes.find(p => p.id === 'leitura');
    const pMin1 = targetMeeting.partes.find(p => p.id === 'ministerio1');
    const pMin2 = targetMeeting.partes.find(p => p.id === 'ministerio2');
    const pMin3 = targetMeeting.partes.find(p => p.id === 'ministerio3');
    const pVidaCantico = targetMeeting.partes.find(p => p.id === 'vida_cantico');
    const pVida1 = targetMeeting.partes.find(p => p.id === 'vida1');
    const pEstudo = targetMeeting.partes.find(p => p.id === 'estudo');
    const pComentFinais = targetMeeting.partes.find(p => p.id === 'comentarios_finais');
    const pConclusao = targetMeeting.partes.find(p => p.id === 'conclusao_cantico');

    // Cântico inicial e Oração inicial
    const canticoInicio = pAbertura?.title || "Cântico inicial";
    const oracaoInicio = pAbertura?.speaker || pAbertura?.assistant;
    drawScheduleRow(canticoInicio, pAbertura?.actualTime, pAbertura?.plannedTime || 5, oracaoInicio, true);

    // Comentários iniciais
    drawScheduleRow("Comentários iniciais", pComentarios?.actualTime, pComentarios?.plannedTime || 1);

    // SEÇÃO 1: TESOUROS DA PALAVRA DE DEUS
    drawSectionBanner("TESOUROS DA PALAVRA DE DEUS", [63, 100, 126]);

    if (pDiscurso) {
      const title = cleanPartTitle(pDiscurso.title);
      drawScheduleRow(`1. ${title} (${pDiscurso.plannedTime} min)`, pDiscurso.actualTime, pDiscurso.plannedTime, pDiscurso.speaker);
    }
    if (pJoias) {
      const title = cleanPartTitle(pJoias.title);
      const displayTitle = title.toLowerCase().includes('joias') ? title : 'Joias espirituais';
      drawScheduleRow(`2. ${displayTitle} (${pJoias.plannedTime} min)`, pJoias.actualTime, pJoias.plannedTime, pJoias.speaker);
    }
    if (pLeitura) {
      const title = cleanPartTitle(pLeitura.title);
      const displayTitle = title.toLowerCase().includes('leitura') ? title : 'Leitura da Bíblia';
      drawScheduleRow(`3. ${displayTitle} (${pLeitura.plannedTime} min)`, pLeitura.actualTime, pLeitura.plannedTime, pLeitura.speaker);
    }

    y += 1.0;

    // SEÇÃO 2: FAÇA SEU MELHOR NO MINISTÉRIO
    drawSectionBanner("FAÇA SEU MELHOR NO MINISTÉRIO", [164, 118, 42]);

    let minNum = 4;
    [pMin1, pMin2, pMin3].forEach((pMin) => {
      if (pMin) {
        const title = cleanPartTitle(pMin.title);
        const assigned = pMin.assistant ? `${pMin.speaker || '—'} / ${pMin.assistant}` : (pMin.speaker || '—');
        drawScheduleRow(`${minNum}. ${title} (${pMin.plannedTime} min)`, pMin.actualTime, pMin.plannedTime, assigned);
        minNum++;
      }
    });

    y += 1.0;

    // SEÇÃO 3: NOSSA VIDA CRISTÃ
    drawSectionBanner("NOSSA VIDA CRISTÃ", [140, 39, 44]);

    if (pVidaCantico) {
      drawScheduleRow(pVidaCantico.title || "Cântico intermediário", pVidaCantico.actualTime, pVidaCantico.plannedTime || 5);
    }

    if (pVida1) {
      const title = cleanPartTitle(pVida1.title);
      drawScheduleRow(`${minNum}. ${title} (${pVida1.plannedTime} min)`, pVida1.actualTime, pVida1.plannedTime, pVida1.speaker);
      minNum++;
    }

    if (pEstudo) {
      const assigned = pEstudo.assistant ? `${pEstudo.speaker || '—'} / ${pEstudo.assistant}` : (pEstudo.speaker || '—');
      drawScheduleRow(`${minNum}. Estudo bíblico de congregação (${pEstudo.plannedTime} min)`, pEstudo.actualTime, pEstudo.plannedTime, assigned);
    }

    drawScheduleRow("Comentários finais", pComentFinais?.actualTime, pComentFinais?.plannedTime || 3);

    const canticoFinal = pConclusao?.title || "Cântico final";
    const oracaoFinal = pConclusao?.speaker || pConclusao?.assistant;
    drawScheduleRow(canticoFinal, pConclusao?.actualTime, pConclusao?.plannedTime || 6, oracaoFinal, true);

    y += 2.5;
  };

  // Helper para renderizar semanas adicionais importadas do PDF (caso existam)
  const renderImportedWeek = (week: ParsedWeekSchedule) => {
    if (y > pageHeight - 70) {
      doc.addPage();
      y = 16;
      drawPageHeader();
    }

    // Linha divisória antes da próxima semana
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(marginLeft, y, marginLeft + contentWidth, y);
    y += 5.5;

    // Cabeçalho da Semana
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(week.weekLabel, marginLeft, y);

    if (week.president) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Presidente", nameColumnX, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(week.president, nameColumnX + 16, y);
    }
    y += 4.5;

    // Cântico inicial + Oração
    const canticoInic = week.openingSong ? `Cântico ${week.openingSong}` : "Cântico inicial";
    drawScheduleRow(canticoInic, undefined, undefined, week.openingPrayer, true);
    drawScheduleRow("Comentários iniciais");

    // SEÇÃO 1
    drawSectionBanner("TESOUROS DA PALAVRA DE DEUS", [63, 100, 126]);
    drawScheduleRow(`1. ${week.treasuresTheme || 'Discurso'} (10 min)`, undefined, 10, week.treasuresSpeaker);
    drawScheduleRow("2. Joias espirituais (10 min)", undefined, 10, week.spiritualGemsSpeaker);
    drawScheduleRow(`3. Leitura da Bíblia (4 min)`, undefined, 4, week.bibleReadingSpeaker);

    y += 1.0;

    // SEÇÃO 2
    drawSectionBanner("FAÇA SEU MELHOR NO MINISTÉRIO", [164, 118, 42]);
    let minIdx = 4;
    (week.ministryParts || []).forEach(mp => {
      const assigned = mp.assistant ? `${mp.speaker || '—'} / ${mp.assistant}` : (mp.speaker || '—');
      drawScheduleRow(`${minIdx}. ${mp.title} (${mp.minutes || 4} min)`, undefined, mp.minutes, assigned);
      minIdx++;
    });

    y += 1.0;

    // SEÇÃO 3
    drawSectionBanner("NOSSA VIDA CRISTÃ", [140, 39, 44]);
    if (week.middleSong) {
      drawScheduleRow(`Cântico ${week.middleSong}`);
    }
    (week.christianLivingParts || []).forEach(cp => {
      drawScheduleRow(`${minIdx}. ${cp.title} (${cp.minutes || 15} min)`, undefined, cp.minutes, cp.speaker);
      minIdx++;
    });

    const conductorStr = week.congregationStudyReader 
      ? `${week.congregationStudyConductor || '—'} / ${week.congregationStudyReader}`
      : (week.congregationStudyConductor || '—');
    drawScheduleRow(`${minIdx}. Estudo bíblico de congregação (30 min)`, undefined, 30, conductorStr);

    drawScheduleRow("Comentários finais");

    const canticoFim = week.closingSong ? `Cântico ${week.closingSong}` : "Cântico final";
    drawScheduleRow(canticoFim, undefined, undefined, week.closingPrayer, true);

    y += 2.5;
  };

  // RENDERIZAÇÃO:
  // 1. Renderiza a reunião realizada
  renderConductedMeetingWeek(meeting);

  // 2. Se houver semanas importadas do mês no storage, renderiza as outras semanas
  if (monthSchedule && monthSchedule.weeks && monthSchedule.weeks.length > 0) {
    monthSchedule.weeks.forEach(w => {
      // Ignora se for a mesma semana da reunião já renderizada
      const isSameWeek = meeting.semana_apostila 
        ? w.weekLabel.toLowerCase().includes(meeting.semana_apostila.toLowerCase()) || meeting.semana_apostila.toLowerCase().includes(w.date.toLowerCase())
        : false;

      if (!isSameWeek) {
        renderImportedWeek(w);
      }
    });
  }

  // Rodapé: Data e Hora no canto inferior direito exatamente como no modelo original
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    const timestampStr = `${day}/${month}/${year}, ${hours}:${mins}:${secs}`;

    const dateStrWidth = doc.getTextWidth(timestampStr);
    doc.text(timestampStr, marginLeft + contentWidth - dateStrWidth, pageHeight - 12);
  }

  // Nome do arquivo limpo para download
  const cleanDate = (meeting.data_reuniao_curta || "reuniao")
    .replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `programacao_reuniao_${cleanDate}.pdf`;

  doc.save(fileName);
}
