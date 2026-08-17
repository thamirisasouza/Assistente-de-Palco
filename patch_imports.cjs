const fs = require('fs');
let content = fs.readFileSync('/app/applet/src/hooks/useMeetingTimer.ts', 'utf8');

content = content.replace(
  'subscribeToFirebaseMeetings',
  'subscribeToFirebaseMeetings,\n  subscribeToFirebaseSettings'
);

fs.writeFileSync('/app/applet/src/hooks/useMeetingTimer.ts', content);
console.log("imports patched");
