const fs = require('fs');
const file = 'src/hooks/useMeetingTimer.ts';
let code = fs.readFileSync(file, 'utf8');

const applyMonthCodeStr = `
  const applyMonthSchedule = (parseResult: MonthPdfParseResult) => {
    if (!parseResult || !parseResult.weeks || parseResult.weeks.length === 0) return;

    // Mesclar semanas existentes com as novas importadas
    const existingWeeks = settings.monthlySchedule?.weeks || [];
    const newWeeks = parseResult.weeks;
    
    const weeksMap = new Map();
    existingWeeks.forEach(w => weeksMap.set(w.id, w));
    newWeeks.forEach(w => weeksMap.set(w.id, w));
    
    // Manter até as últimas 12 semanas (aprox 3 meses) para não sobrecarregar
    const combinedWeeks = Array.from(weeksMap.values()).slice(-12);

    const mergedParseResult = {
      ...parseResult,
      weeks: combinedWeeks
    };

    // Encontra a semana de hoje automaticamente nas semanas COMBINADAS
    const matchingWeek = findMatchingWeekForDate(mergedParseResult.weeks, new Date()) || newWeeks[0] || mergedParseResult.weeks[0];

    const baseParts = getPartsForWeekType(settings.weekType);
    const updatedParts = applyPdfWeekToMeetingParts(baseParts, matchingWeek);

    setState(prev => ({
      ...prev,
      parts: updatedParts,
      importedWeekLabel: matchingWeek.weekLabel
    }));

    // Adiciona irmãos encontrados automaticamente
    const existingMap = new Set(settings.brothers.map(b => b.name.toLowerCase().trim()));
    const toAdd: Brother[] = [];
    (mergedParseResult.allBrothersFound || parseResult.allBrothersFound || []).forEach((name, idx) => {
      const cleanName = name.trim();
      if (cleanName && !existingMap.has(cleanName.toLowerCase())) {
        existingMap.add(cleanName.toLowerCase());
        toAdd.push({
          id: \`br-\${Date.now()}-\${idx}-\${Math.random().toString(36).substring(2, 7)}\`,
          name: cleanName,
          role: 'Publicador'
        });
      }
    });

    const nextBrothers = toAdd.length ? [...settings.brothers, ...toAdd].sort((a, b) => a.name.localeCompare(b.name)) : settings.brothers;

    const updates: Partial<CongregationSettings> = {
      monthlySchedule: mergedParseResult,
      selectedWeekId: matchingWeek.id,
      importedWeekLabel: matchingWeek.weekLabel,
      brothers: nextBrothers
    };
    
    updateSettings(updates);
  };
`;

code = code.replace(
  /const applyMonthSchedule = \(parseResult: MonthPdfParseResult\) => \{[\s\S]*?updateSettings\(updates\);\n  \};/,
  applyMonthCodeStr.trim()
);

fs.writeFileSync(file, code);
