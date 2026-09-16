const fs = require('fs');
const file = 'src/components/ImportApostilaModal.tsx';
let code = fs.readFileSync(file, 'utf8');

// The input element string we want to move
const inputElement = `
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="application/pdf"
                    multiple
                    className="hidden"
                  />
`;

// Remove the original one
code = code.replace(inputElement, '');

// Insert it right after {/* Modal Body */} and the div opening
code = code.replace(
  /{step === 'input' \? \(/,
  `<input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="application/pdf"
          multiple
          className="hidden"
        />\n        {step === 'input' ? (`
);

// Modify the "Adicionar PDF" button to trigger the input click
code = code.replace(
  `onClick={() => setStep('input')}`,
  `onClick={() => fileInputRef.current?.click()}`
);

fs.writeFileSync(file, code);
