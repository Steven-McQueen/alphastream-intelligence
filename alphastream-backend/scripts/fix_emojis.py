#!/usr/bin/env python3
"""Fix emojis in Python files that cause Windows encoding issues."""

import os
import glob

# Files to fix
files_to_fix = [
    "services/price_history_importer.py",
    "main.py",
    "services/news_importer.py",
    "services/hybrid_importer.py",
    "services/refresh_scheduler.py",
    "services/earnings_importer.py",
    "scripts/test_fmp.py",
    "services/macro_importer.py",
]

# Emoji replacements
replacements = {
    "\u2705": "[OK]",      # ✅
    "\u274c": "[ERROR]",   # ❌
    "\u26a0": "[WARN]",    # ⚠
    "\U0001f504": "[REFRESH]",  # 🔄
    "\U0001f4ca": "[DATA]",     # 📊
}

# Get the script directory
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)

for file_path in files_to_fix:
    full_path = os.path.join(backend_dir, file_path)
    if not os.path.exists(full_path):
        print(f"Skipping (not found): {file_path}")
        continue
    
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        new_content = content
        for emoji, replacement in replacements.items():
            new_content = new_content.replace(emoji, replacement)
        
        if new_content != content:
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Fixed: {file_path}")
        else:
            print(f"No changes needed: {file_path}")
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")

print("\nDone!")

