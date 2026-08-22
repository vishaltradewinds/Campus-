#!/bin/bash
FILES=$(find src/components -name "*.tsx" -type f)
for file in $FILES; do
  sed -i -e 's/border-\[#282828\]/border-slate-200/g' "$file"
  sed -i -e 's/bg-\[#1c1c1c\]/bg-slate-50/g' "$file"
  sed -i -e 's/bg-\[#222\]/bg-slate-100/g' "$file"
  sed -i -e 's/text-\[#ccc\]/text-slate-600/g' "$file"
  sed -i -e 's/text-\[#CCCCCC\]/text-slate-600/g' "$file"
  sed -i -e 's/bg-\[#1e1e1e\]/bg-white/g' "$file"
  sed -i -e 's/border-\[#CCFF00\]/border-indigo-600/g' "$file"
  sed -i -e 's/accent-\[#CCFF00\]/accent-indigo-600/g' "$file"
  sed -i -e 's/text-\[#aaa\]/text-slate-500/g' "$file"
  sed -i -e 's/divide-\[#222222\]/divide-slate-200/g' "$file"
  sed -i -e 's/hover:bg-\[#333\]/hover:bg-slate-200/g' "$file"
  sed -i -e 's/bg-\[#0E0E0E\]/bg-slate-50/g' "$file"
  sed -i -e 's/border-\[#555555\]/border-slate-400/g' "$file"
done
