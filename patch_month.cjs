const fs = require('fs');
const file = 'src/hooks/useMeetingTimer.ts';
let code = fs.readFileSync(file, 'utf8');

// Combine old weeks with new weeks when applying monthly schedule
code = code.replace(
  /const updates: Partial<CongregationSettings> = \{\s+monthlySchedule: parseResult,/,
  `// Mescla as semanas antigas com as novas (garantindo que as novas sobrescrevam se tiver o mesmo ID/data, 
    // e mantendo as antigas que não foram enviadas)
    let mergedWeeks = parseResult.weeks || [];
    if (settings.monthlySchedule && settings.monthlySchedule.weeks) {
      const existingWeeks = settings.monthlySchedule.weeks;
      
      // Cria um mapa com as semanas novas
      const newWeeksMap = new Map();
      mergedWeeks.forEach(w => newWeeksMap.set(w.id, w));
      
      // Adiciona as antigas que não estão nas novas
      existingWeeks.forEach(w => {
        if (!newWeeksMap.has(w.id)) {
          mergedWeeks.push(w);
        }
      });
    }
    
    // Ordena as semanas cronologicamente (básico: assume formato que pode ser extraído)
    mergedWeeks.sort((a, b) => {
      // Extrai os dias das strings de data como "16-22 de outubro"
      const getFirstNumber = (str) => {
        const match = str.match(/\\d+/);
        return match ? parseInt(match[0]) : 0;
      };
      
      const getMonthIndex = (str) => {
        const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const s = str.toLowerCase();
        for (let i=0; i<months.length; i++) {
          if (s.includes(months[i])) return i;
        }
        return 0;
      };
      
      const m1 = getMonthIndex(a.date);
      const m2 = getMonthIndex(b.date);
      if (m1 !== m2) return m1 - m2;
      return getFirstNumber(a.date) - getFirstNumber(b.date);
    });
    
    // Se passar de 12 semanas (aprox 3 meses), corta as mais antigas
    if (mergedWeeks.length > 12) {
      mergedWeeks = mergedWeeks.slice(mergedWeeks.length - 12);
    }
    
    const finalParseResult = {
      ...parseResult,
      weeks: mergedWeeks
    };

    const updates: Partial<CongregationSettings> = {
      monthlySchedule: finalParseResult,`
);

fs.writeFileSync(file, code);
