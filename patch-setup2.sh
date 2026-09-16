#!/bin/bash
sed -i 's/setNewBrotherName('"'"''"'"');/setNewBrotherName('"'"''"'"');\n      setNewBrotherRole('"'"'Publicador'"'"');/' src/components/Setup.tsx
