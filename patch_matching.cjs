const fs = require('fs');
const file = 'src/hooks/useMeetingTimer.ts';
let code = fs.readFileSync(file, 'utf8');

const replacementStr = `    const finalParseResult = {
      ...parseResult,
      weeks: mergedWeeks
    };

    // Re-calcula matchingWeek baseada na lista final mesclada 
    const finalMatchingWeek = findMatchingWeekForDate(finalParseResult.weeks, new Date()) || matchingWeek;

    const updates: Partial<CongregationSettings> = {
      monthlySchedule: finalParseResult,
      selectedWeekId: finalMatchingWeek.id,
      importedWeekLabel: finalMatchingWeek.weekLabel,
      brothers: nextBrothers
    };

    if (finalMatchingWeek.president) {
      const idx = updatedParts.findIndex(p => p.id === 'presidente');
      if (idx !== -1) updatedParts[idx].assignee = finalMatchingWeek.president;
    }`;

code = code.replace(
  /const finalParseResult = \{[\s\S]*?if \(matchingWeek\.president\) \{[\s\S]*?if \(idx !== -1\) updatedParts\[idx\]\.assignee = matchingWeek\.president;\n    \}/,
  replacementStr
);

// We need to also recalculate parts based on the new final matching week
const replacementStr2 = `    const finalParseResult = {
      ...parseResult,
      weeks: mergedWeeks
    };

    // Re-calcula matchingWeek baseada na lista final mesclada 
    const finalMatchingWeek = findMatchingWeekForDate(finalParseResult.weeks, new Date()) || matchingWeek;
    
    // Atualiza as parts baseando-se na semana escolhida pela merge
    const finalUpdatedParts = applyPdfWeekToMeetingParts(baseParts, finalMatchingWeek);
    
    setState(prev => ({
      ...prev,
      parts: finalUpdatedParts,
      importedWeekLabel: finalMatchingWeek.weekLabel
    }));

    const updates: Partial<CongregationSettings> = {
      monthlySchedule: finalParseResult,
      selectedWeekId: finalMatchingWeek.id,
      importedWeekLabel: finalMatchingWeek.weekLabel,
      brothers: nextBrothers
    };

    if (finalMatchingWeek.president) {
      const idx = finalUpdatedParts.findIndex(p => p.id === 'presidente');
      if (idx !== -1) finalUpdatedParts[idx].assignee = finalMatchingWeek.president;
    }`;

code = code.replace(
  /const finalParseResult = \{[\s\S]*?if \(finalMatchingWeek\.president\) \{[\s\S]*?if \(idx !== -1\) updatedParts\[idx\]\.assignee = finalMatchingWeek\.president;\n    \}/,
  replacementStr2
);

// And we need to remove the first setState that was doing it on the old matching week
code = code.replace(
  /const updatedParts = applyPdfWeekToMeetingParts\(baseParts, matchingWeek\);\n\n    setState\(prev => \(\{\n      \.\.\.prev,\n      parts: updatedParts,\n      importedWeekLabel: matchingWeek\.weekLabel\n    \}\)\);\n\n    \/\/ Adiciona irmãos encontrados/,
  `// Adiciona irmãos encontrados`
);


fs.writeFileSync(file, code);
