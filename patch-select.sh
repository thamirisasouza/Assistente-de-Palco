#!/bin/bash
sed -i 's/<option key={b.id} value={b.name}>{b.name}<\/option>/<option key={b.id} value={b.name}>{b.name} ({b.role})<\/option>/g' src/components/Setup.tsx
