"""
Generate .ico from idle_0.png for desktop pet taskbar icon.

Usage: python tools/generate_ico.py
Output: src/assets/icon.ico (16/32/48/256 multi-size)
"""
from PIL import Image
import os

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = os.path.join(base_dir, 'output', 'frames', 'idle_0.png')
    dst = os.path.join(base_dir, 'src', 'assets', 'icon.ico')

    img = Image.open(src).convert('RGBA')
    # Original: 32x40 with padding. Find bounding box of non-transparent pixels.
    bbox = img.getbbox()
    if bbox:
        cropped = img.crop(bbox)
    else:
        cropped = img

    print(f'Cropped size: {cropped.size}')

    # Make square by padding the shorter dimension
    w, h = cropped.size
    side = max(w, h)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - w) // 2, (side - h) // 2))

    # Generate 256x256 base with nearest-neighbor (preserve pixel art)
    base = square.resize((256, 256), Image.NEAREST)

    # Save as .ico with multiple sizes — Pillow handles downscaling
    base.save(dst, format='ICO', sizes=[(256, 256), (48, 48), (32, 32), (16, 16)])
    print(f'Generated {dst}')

    # Verify
    verify = Image.open(dst)
    print(f'ICO sizes: {verify.info.get("sizes", "N/A")}')

if __name__ == '__main__':
    main()
