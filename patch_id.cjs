const fs = require('fs');
const file = 'src/lib/apostilaParser.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /id: \`week-\$\{idx \+ 1\}\`,/,
  "id: `week-${block.date.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${idx}`, // ID único baseado na data"
);

fs.writeFileSync(file, code);
