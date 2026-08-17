const fs = require('fs');
let content = fs.readFileSync('/app/applet/src/lib/firebase.ts', 'utf8');

const newFunction = `// Inscrição em tempo real para configurações da congregação
export function subscribeToFirebaseSettings(callback: (settings: CongregationSettings | null) => void) {
  try {
    const docRef = doc(db, CONGREGATION_DOC_PATH);
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as CongregationSettings);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, CONGREGATION_DOC_PATH);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, CONGREGATION_DOC_PATH);
    return () => {};
  }
}

// Carregar histórico de reuniões do Firebase`;

content = content.replace('// Carregar histórico de reuniões do Firebase', newFunction);
fs.writeFileSync('/app/applet/src/lib/firebase.ts', content);
console.log("firebase.ts patched");
