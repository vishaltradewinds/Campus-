#!/bin/bash
FILES=$(find src/components -name "*.tsx" -type f)
for file in $FILES; do
  sed -i -e 's/placeholder-\[#666666\]/placeholder-slate-400/g' "$file"
  sed -i -e 's/border-l-\[#CCFF00\]/border-l-indigo-600/g' "$file"
  sed -i -e 's/bg-\[#182410\]/bg-indigo-50/g' "$file"
  sed -i -e 's/bg-\[#0D0D0D\]/bg-slate-50/g' "$file"
  sed -i -e 's/hover:bg-\[#2c2c2c\]/hover:bg-slate-200/g' "$file"
  sed -i -e 's/border-\[#2e2e2e\]/border-slate-200/g' "$file"
  sed -i -e 's/bg-\[#1a1a1a\]/bg-white/g' "$file"
  sed -i -e 's/divide-\[#222\]/divide-slate-200/g' "$file"
done
