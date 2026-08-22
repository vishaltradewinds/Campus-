#!/bin/bash
# Remove `if (!snapshot.empty)` wrappers
sed -i -e "s/if (!snapshot.empty) {//g" src/context/TalentNetworkContext.tsx
# Need to remove the closing bracket for each. Let's do this more cleanly with perl or node.
