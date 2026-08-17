const fs = require('fs');
let content = fs.readFileSync('/app/applet/src/hooks/useMeetingTimer.ts', 'utf8');

// 1. Remove saveFirebaseSettings from useEffect
content = content.replace(
  'saveFirebaseSettings(settings).catch(() => {});',
  '// saveFirebaseSettings is now handled per-action to avoid infinite loops with realtime sync'
);

// 2. Add real-time sync for settings in the setup
const oldRealtime = `    // Inscrição em tempo real para sincronização com o banco de dados oficial
    const unsubscribe = subscribeToFirebaseMeetings((liveMeetings) => {`;
    
const newRealtime = `    // Inscrição em tempo real para sincronização com o banco de dados oficial
    const unsubscribeSettings = subscribeToFirebaseSettings((liveSettings) => {
      if (!isMounted || !liveSettings) return;
      if (liveSettings.name || liveSettings.brothers?.length) {
        setSettings(liveSettings);
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(liveSettings));
      }
    });

    const unsubscribe = subscribeToFirebaseMeetings((liveMeetings) => {`;
    
content = content.replace(oldRealtime, newRealtime);

// 3. Cleanup both unsubscribes
content = content.replace(
  'if (typeof unsubscribe === \'function\') unsubscribe();',
  'if (typeof unsubscribe === \'function\') unsubscribe();\n      if (typeof unsubscribeSettings === \'function\') unsubscribeSettings();'
);

// 4. Update the actions to save to firebase
const updateSettingsFn = `  const updateSettings = (updates: Partial<CongregationSettings>) => {
    if (state.status !== 'setup') {
      console.warn("Settings can only be changed during setup.");
      return;
    }
    setSettings(prev => {
      const next = { ...prev, ...updates };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };`;

content = content.replace(/const updateSettings = \([\s\S]*?setSettings\(prev => \(\{ \.\.\.prev, \.\.\.updates \}\)\);\n  \};/, updateSettingsFn);

const updateBrotherFn = `  const updateBrother = (id: string, updates: Partial<Brother>) => {
    setSettings(prev => {
      const next = {
        ...prev,
        brothers: prev.brothers.map(b => b.id === id ? { ...b, ...updates } : b).sort((a, b) => a.name.localeCompare(b.name))
      };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };`;
content = content.replace(/const updateBrother = \([\s\S]*?\}\)\);\n  \};/, updateBrotherFn);

const removeBrotherFn = `  const removeBrother = (id: string) => {
    setSettings(prev => {
      const next = {
        ...prev,
        brothers: prev.brothers.filter(b => b.id !== id)
      };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };`;
content = content.replace(/const removeBrother = \([\s\S]*?\}\)\);\n  \};/, removeBrotherFn);

const addBrotherFn = `  const addBrother = (name: string, role: Role) => {
    if (!name.trim()) return;
    setSettings(prev => {
      if (prev.brothers.some(b => b.name.toLowerCase() === name.toLowerCase())) return prev;
      const uniqueId = \`br-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`;
      const newBrothers = [...prev.brothers, { id: uniqueId, name, role }];
      const next = { ...prev, brothers: newBrothers.sort((a, b) => a.name.localeCompare(b.name)) };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };`;
content = content.replace(/const addBrother = \([\s\S]*?\}\);\n  \};/, addBrotherFn);

const addBrothersBatchFn = `  const addBrothersBatch = (
    items: Array<string | { name: string; role?: Role }>,
    defaultRole: Role = "Publicador"
  ) => {
    if (!items.length) return;
    setSettings(prev => {
      const existingMap = new Set(prev.brothers.map(b => b.name.toLowerCase().trim()));
      const toAdd: Brother[] = [];
      
      items.forEach((item, index) => {
        const rawName = typeof item === 'string' ? item : item.name;
        const itemRole = typeof item === 'object' && item.role ? item.role : defaultRole;
        const cleanName = rawName.trim();
        if (cleanName && !existingMap.has(cleanName.toLowerCase())) {
          existingMap.add(cleanName.toLowerCase());
          toAdd.push({
            id: \`br-\${Date.now()}-\${index}-\${Math.random().toString(36).substring(2, 7)}\`,
            name: cleanName,
            role: itemRole
          });
        }
      });
      
      if (!toAdd.length) return prev;
      
      const newBrothers = [...prev.brothers, ...toAdd];
      const next = { ...prev, brothers: newBrothers.sort((a, b) => a.name.localeCompare(b.name)) };
      saveFirebaseSettings(next).catch(() => {});
      return next;
    });
  };`;
content = content.replace(/const addBrothersBatch = \([\s\S]*?\}\);\n  \};/, addBrothersBatchFn);

fs.writeFileSync('/app/applet/src/hooks/useMeetingTimer.ts', content);
console.log("Hook patched.");
