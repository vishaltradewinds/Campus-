#!/bin/bash

# Find all tsx files in src/components (excluding auth since we mostly did that)
FILES=$(find src/components -name "*.tsx" -type f)

for file in $FILES; do
  sed -i -e 's/bg-\[#0A0A0A\]/bg-slate-50/g' "$file"
  sed -i -e 's/text-\[#F5F5F5\]/text-slate-900/g' "$file"
  sed -i -e 's/bg-\[#111111\]/bg-white/g' "$file"
  sed -i -e 's/bg-\[#141414\]/bg-slate-50/g' "$file"
  sed -i -e 's/bg-\[#161616\]/bg-slate-50/g' "$file"
  sed -i -e 's/bg-\[#181818\]/bg-white/g' "$file"
  sed -i -e 's/bg-\[#1C1C1C\]/bg-indigo-50/g' "$file"
  sed -i -e 's/bg-\[#222222\]/bg-slate-100/g' "$file"
  sed -i -e 's/bg-\[#333333\]/bg-slate-200/g' "$file"
  
  sed -i -e 's/border-\[#222222\]/border-slate-200/g' "$file"
  sed -i -e 's/border-\[#222\]/border-slate-200/g' "$file"
  sed -i -e 's/border-\[#2A2A2A\]/border-slate-200/g' "$file"
  sed -i -e 's/border-\[#2E2E2E\]/border-slate-200/g' "$file"
  sed -i -e 's/border-\[#333333\]/border-slate-300/g' "$file"
  sed -i -e 's/border-\[#333\]/border-slate-300/g' "$file"
  sed -i -e 's/border-\[#444444\]/border-slate-300/g' "$file"
  sed -i -e 's/border-\[#444\]/border-slate-300/g' "$file"
  
  sed -i -e 's/text-\[#AAAAAA\]/text-slate-500/g' "$file"
  sed -i -e 's/text-\[#AAA\]/text-slate-500/g' "$file"
  sed -i -e 's/text-\[#888888\]/text-slate-500/g' "$file"
  sed -i -e 's/text-\[#888\]/text-slate-500/g' "$file"
  sed -i -e 's/text-\[#777777\]/text-slate-400/g' "$file"
  sed -i -e 's/text-\[#777\]/text-slate-400/g' "$file"
  sed -i -e 's/text-\[#666666\]/text-slate-500/g' "$file"
  sed -i -e 's/text-\[#666\]/text-slate-500/g' "$file"
  sed -i -e 's/text-\[#555555\]/text-slate-500/g' "$file"
  sed -i -e 's/text-\[#555\]/text-slate-500/g' "$file"
  sed -i -e 's/text-\[#444444\]/text-slate-400/g' "$file"
  sed -i -e 's/text-\[#444\]/text-slate-400/g' "$file"
  
  sed -i -e 's/text-white/text-slate-900/g' "$file"
  sed -i -e 's/hover:text-white/hover:text-slate-900/g' "$file"
  
  sed -i -e 's/text-\[#CCFF00\]/text-indigo-600/g' "$file"
  sed -i -e 's/bg-\[#CCFF00\]/bg-indigo-600/g' "$file"
  sed -i -e 's/border-\[#CCFF00\]/border-indigo-600/g' "$file"
  
  sed -i -e 's/text-black/text-white/g' "$file"
  
  sed -i -e 's/hover:bg-\[#b8e600\]/hover:bg-indigo-700/g' "$file"
  sed -i -e 's/hover:bg-\[#b3ff00\]/hover:bg-indigo-700/g' "$file"
  sed -i -e 's/hover:bg-\[#222222\]/hover:bg-slate-100/g' "$file"
  sed -i -e 's/hover:bg-\[#2e2e2e\]/hover:bg-slate-200/g' "$file"
  sed -i -e 's/hover:bg-\[#333333\]/hover:bg-slate-200/g' "$file"
  
  sed -i -e 's/bg-\[#0A0A0A\]/bg-slate-50/g' "$file"
done
