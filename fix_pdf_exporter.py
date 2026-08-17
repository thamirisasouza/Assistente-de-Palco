import re

with open('src/lib/pdfExporter.ts', 'r') as f:
    content = f.read()

# Remove the isWeekendMeeting block. We know it starts at line 238
# const isWeekendMeeting = ...
# if (isWeekendMeeting) { ... } else {

lines = content.split('\n')
start_idx = -1
for i, line in enumerate(lines):
    if "const isWeekendMeeting" in line:
        start_idx = i
        break

if start_idx != -1:
    # Find the else block
    else_idx = -1
    for i in range(start_idx, len(lines)):
        if "} else {" in lines[i] and "ESTRUTURA DE MEIO DE SEMANA" in lines[i+1]:
            else_idx = i
            break
            
    if else_idx != -1:
        # Find the end of the else block
        end_idx = -1
        # It ends at line 391:     } right before y += 2.5;
        for i in range(else_idx, len(lines)):
            if lines[i].strip() == "}" and "y += 2.5;" in lines[i+2]:
                end_idx = i
                break
        
        if end_idx != -1:
            # Reconstruct the file
            new_lines = lines[:start_idx] + [
                "    // Mapeamento das partes registradas",
                "    // ESTRUTURA DE MEIO DE SEMANA (Normal ou Visita do SC)"
            ]
            
            # Unindent the else block by 2 spaces
            for line in lines[else_idx+2:end_idx]:
                if line.startswith("  "):
                    new_lines.append(line[2:])
                else:
                    new_lines.append(line)
                    
            new_lines.extend(lines[end_idx+1:])
            
            with open('src/lib/pdfExporter.ts', 'w') as f:
                f.write('\n'.join(new_lines))
            print("Successfully updated src/lib/pdfExporter.ts")
        else:
            print("Could not find end of else block")
    else:
        print("Could not find else block")
else:
    print("Could not find start idx")

