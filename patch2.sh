#!/bin/bash
sed -i 's/JSON.stringify(liveSettings)/JSON.stringify(sanitized)/' src/hooks/useMeetingTimer.ts
