#!/usr/bin/env python3
"""
Migration script to add image and publisher columns to news_articles table.
Run this once to update existing databases.
"""

import sqlite3
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.db_manager import db

def migrate():
    """Add image and publisher columns to news_articles table if they don't exist."""
    conn = db.connect()
    cursor = conn.cursor()
    
    try:
        # Check existing columns
        cursor.execute("PRAGMA table_info(news_articles)")
        columns = {row[1] for row in cursor.fetchall()}
        
        # Add publisher column if missing
        if "publisher" not in columns:
            print("Adding 'publisher' column to news_articles...")
            cursor.execute("ALTER TABLE news_articles ADD COLUMN publisher TEXT")
            print("[OK] Added 'publisher' column")
        else:
            print("[OK] 'publisher' column already exists")
        
        # Add image column if missing
        if "image" not in columns:
            print("Adding 'image' column to news_articles...")
            cursor.execute("ALTER TABLE news_articles ADD COLUMN image TEXT")
            print("[OK] Added 'image' column")
        else:
            print("[OK] 'image' column already exists")
        
        conn.commit()
        print("\n[OK] Migration completed successfully!")
        
        # Clear existing news to force re-fetch with new fields
        cursor.execute("DELETE FROM news_articles")
        conn.commit()
        print("[OK] Cleared old news articles to force fresh fetch with images")
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 50)
    print("News Articles Migration")
    print("=" * 50)
    migrate()

