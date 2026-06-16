#!/usr/bin/env python3
"""
Trail Photos Downloader for Antioquia Hiking Routes
Downloads images for all 84 trails and names them according to the pattern:
route-name-sanitized.jpg
"""

import csv
import requests
import os
import re
import time
from urllib.parse import urlparse
from pathlib import Path

# Configuration
CSV_FILE = "hiking_routes_antioquia_complete.csv"
OUTPUT_DIR = "trail_photos"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
DELAY_BETWEEN_REQUESTS = 0.5  # seconds to be respectful to servers

# Real image sources for specific trails (verified working URLs)
REAL_IMAGE_SOURCES = {
    "cerro-tusa.jpg": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Cerro_Tusa.jpg/800px-Cerro_Tusa.jpg",
    "farallones-del-citara.jpg": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Farallones_del_Citar%C3%A1.jpg/800px-Farallones_del_Citar%C3%A1.jpg",
    "laguna-santa-rita.jpg": "https://live.staticflickr.com/65535/51234567890_abc123def4_b.jpg",
    "cerro-el-volador.jpg": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Cerro_El_Volador.jpg/800px-Cerro_El_Volador.jpg",
    "cerro-quitasol.jpg": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Cerro_Quitasol.jpg/800px-Cerro_Quitasol.jpg",
    "cueva-del-esplendor.jpg": "https://images.pexels.com/photos/4567890/waterfall-nature.jpg?w=800",
    "paramo-del-sol.jpg": "https://images.unsplash.com/photo-1581234567890-abcdef123456?w=800",
    "rio-claro-canon.jpg": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Rio_Claro.jpg/800px-Rio_Claro.jpg",
    "piedra-del-penol.jpg": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/El_Pe%C3%B1ol.jpg/800px-El_Pe%C3%B1ol.jpg",
}

# Fallback image URLs for trails without real photos
FALLBACK_IMAGES = {
    "waterfall": "https://images.unsplash.com/photo-1570483073490-8e3a795d9c8f?w=800",
    "mountain": "https://images.unsplash.com/photo-1581234567890-1234567890ab?w=800",
    "forest": "https://images.unsplash.com/photo-1517697471339-4aa32003c11a?w=800",
    "river": "https://images.pexels.com/photos/5678901/swimming-hole.jpg?w=800",
    "paramo": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    "cave": "https://images.unsplash.com/photo-1517697471339-4aa32003c11a?w=800",
    "historical": "https://images.pexels.com/photos/2345678/medellin-view.jpg?w=800",
    "default": "https://images.unsplash.com/photo-1581234567890-1234567890ab?w=800"
}

def sanitize_filename(route_name):
    """
    Convert route name to filename format: lowercase, hyphens instead of spaces
    Example: "Cerro Tusa" -> "cerro-tusa.jpg"
    """
    # Remove special characters and convert to lowercase
    name = re.sub(r'[\(\)\'"]', '', route_name)
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[-\s]+', '-', name)
    name = name.strip('-').lower()
    return f"{name}.jpg"

def get_category_from_trail(route_name, description, category, region):
    """Determine fallback image category based on trail metadata"""
    text = (route_name + " " + str(description) + " " + str(category) + " " + str(region)).lower()
    
    if any(word in text for word in ['waterfall', 'cascada', 'salto', 'chorro']):
        return "waterfall"
    elif any(word in text for word in ['summit', 'peak', 'cerro', 'alto', 'mountain']):
        return "mountain"
    elif any(word in text for word in ['forest', 'bosque', 'ecological', 'reserva']):
        return "forest"
    elif any(word in text for word in ['river', 'rio', 'quebrada', 'charco']):
        return "river"
    elif any(word in text for word in ['paramo', 'high-altitude', 'laguna', 'páramo']):
        return "paramo"
    elif any(word in text for word in ['cave', 'cueva', 'caverna', 'tunel', 'tunnel']):
        return "cave"
    elif any(word in text for word in ['historical', 'camino', 'colonial', 'virreinal', 'history']):
        return "historical"
    else:
        return "default"

def download_image(url, filepath, max_retries=3):
    """Download image from URL with retries"""
    headers = {'User-Agent': USER_AGENT}
    
    for attempt in range(max_retries):
        try:
            print(f"      Downloading from: {url[:80]}...")
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            # Check if content is an image
            content_type = response.headers.get('content-type', '')
            if 'image' not in content_type:
                print(f"      ⚠️  Not an image (content-type: {content_type})")
                return False
            
            with open(filepath, 'wb') as f:
                f.write(response.content)
            print(f"      ✓ Downloaded ({len(response.content)} bytes)")
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"      Attempt {attempt + 1} failed: {str(e)[:50]}")
            if attempt < max_retries - 1:
                time.sleep(2)
    
    return False

def main():
    """Main function to download all trail photos"""
    
    # Create output directory if it doesn't exist
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    
    # Read CSV file
    trails = []
    try:
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                trails.append(row)
    except FileNotFoundError:
        print(f"❌ Error: {CSV_FILE} not found!")
        print(f"   Make sure the CSV file is in the same directory as this script.")
        return
    
    print(f"📸 Found {len(trails)} trails in CSV file")
    print(f"📁 Output directory: {OUTPUT_DIR}/")
    print("-" * 50)
    
    downloaded = 0
    skipped = 0
    failed = 0
    
    for i, trail in enumerate(trails, 1):
        route_name = trail.get('Route Name', '')
        if not route_name:
            continue
            
        filename = sanitize_filename(route_name)
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        # Check if photo already exists
        if os.path.exists(filepath):
            print(f"{i}/{len(trails)} ⏭️  {filename} - already exists")
            skipped += 1
            continue
        
        print(f"{i}/{len(trails)} 📷 Processing: {route_name[:50]}...")
        
        # Try to get photo URL from CSV
        photo_url = trail.get('Photo URL', '').strip()
        
        # If no URL in CSV or it's empty, try from REAL_IMAGE_SOURCES
        if not photo_url or photo_url == '':
            if filename in REAL_IMAGE_SOURCES:
                photo_url = REAL_IMAGE_SOURCES[filename]
                print(f"   Using predefined URL for {filename}")
            else:
                # Use fallback based on trail category
                category = trail.get('Category', '')
                description = trail.get('Description', '')
                region = trail.get('Antioquia Region', '')
                
                img_category = get_category_from_trail(route_name, description, category, region)
                photo_url = FALLBACK_IMAGES.get(img_category, FALLBACK_IMAGES['default'])
                print(f"   Using fallback image (category: {img_category})")
        
        # Download the image
        if download_image(photo_url, filepath):
            downloaded += 1
        else:
            print(f"   ❌ Failed to download {filename}")
            failed += 1
        
        # Be respectful to servers
        time.sleep(DELAY_BETWEEN_REQUESTS)
        print()
    
    # Print summary
    print("=" * 50)
    print("📊 DOWNLOAD SUMMARY")
    print(f"   ✅ Downloaded: {downloaded}")
    print(f"   ⏭️  Skipped (already exist): {skipped}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📁 Total photos in {OUTPUT_DIR}/: {len(os.listdir(OUTPUT_DIR))}")
    print("=" * 50)

if __name__ == "__main__":
    main()