#!/usr/bin/env python3
"""
Create empty placeholder .jpg files for all trails.
This creates the file structure so you can later replace each file
with the real photo when you find/download it.
"""

import csv
import os
import re
from pathlib import Path

CSV_FILE = "hiking_routes_antioquia_complete.csv"
OUTPUT_DIR = "trail_photos"

def sanitize_filename(route_name):
    """
    Convert route name to filename format: lowercase, hyphens instead of spaces
    Example: "Cerro Tusa" -> "cerro-tusa.jpg"
    """
    name = re.sub(r'[\(\)\'"]', '', route_name)
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[-\s]+', '-', name)
    name = name.strip('-').lower()
    return f"{name}.jpg"

def main():
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    
    trails = []
    try:
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                trails.append(row)
    except FileNotFoundError:
        print(f"Error: {CSV_FILE} not found")
        print("Make sure the CSV file is in the same directory as this script.")
        return
    
    print(f"Found {len(trails)} trails in CSV file")
    print(f"Output directory: {OUTPUT_DIR}/")
    print("-" * 50)
    
    created = 0
    already_exist = 0
    
    for i, trail in enumerate(trails, 1):
        route_name = trail.get('Route Name', '')
        if not route_name:
            continue
        
        filename = sanitize_filename(route_name)
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        if os.path.exists(filepath):
            print(f"{i}/{len(trails)} {filename} - already exists, keeping existing file")
            already_exist += 1
        else:
            with open(filepath, 'w') as f:
                pass
            print(f"{i}/{len(trails)} Created: {filename}")
            created += 1
    
    print("=" * 50)
    print("SUMMARY")
    print(f"New placeholder files created: {created}")
    print(f"Already existed (kept): {already_exist}")
    print(f"Total files in {OUTPUT_DIR}/: {len(os.listdir(OUTPUT_DIR))}")
    print("=" * 50)
    print("\nNext steps:")
    print("1. Find real photos for each trail")
    print("2. Replace the placeholder files with real .jpg images")
    print("3. Keep the exact same filename")
    print("4. Upload to your Supabase storage")
    print("5. Update the Photo URL column in your CSV with Supabase URLs")

if __name__ == "__main__":
    main()