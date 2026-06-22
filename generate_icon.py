"""
Generate application icon from source PNG.
Reads the source icon PNG and creates:
  - assets/icon.png  (256x256)
  - assets/icon.ico  (multi-size: 16, 24, 32, 48, 64, 128, 256)
"""
from PIL import Image
import os
import struct

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, 'assets')
SOURCE_PNG = os.path.join(BASE_DIR, '背单词软件图标.png')
SIZES = [16, 24, 32, 48, 64, 128, 256]


def make_ico(frames, sizes, path):
    """Manually construct a multi-resolution ICO file.
    Uses BMP+DIB format which works on all Windows versions."""
    ico_header = struct.pack('<HHH', 0, 1, len(sizes))

    # Generate all BMP pixel data first
    bmp_entries = []
    for frame, (w, h) in zip(frames, [(s, s) for s in sizes]):
        # Pixel data: BGRA, bottom-up
        pixels = b''
        for y in range(h - 1, -1, -1):
            for x in range(w):
                r, g, b, a = frame.getpixel((x, y))
                pixels += struct.pack('BBBB', b, g, r, a)

        # AND mask (1bpp, each row padded to 4-byte boundary)
        and_row_bytes = (w + 31) // 32 * 4
        and_mask = b'\x00' * (and_row_bytes * h)

        bmp_data = pixels + and_mask
        data_size = 40 + len(bmp_data)  # 40 = DIB header size

        bmp_entries.append({
            'w': w if w < 256 else 0,
            'h': h if h < 256 else 0,
            'data_size': data_size,
            'bmp_data': bmp_data,
        })

    # Calculate offsets
    data_start = 6 + 16 * len(sizes)
    offset = data_start
    for entry in bmp_entries:
        entry['offset'] = offset
        offset += entry['data_size']

    # Build directory entries
    dirs = b''
    for e in bmp_entries:
        dirs += struct.pack('<BBBBHHII',
            e['w'], e['h'], 0, 0,   # w, h, color_count, reserved
            1,                        # planes
            32,                       # bpp
            e['data_size'],
            e['offset']
        )

    # Write file
    with open(path, 'wb') as f:
        f.write(ico_header)
        f.write(dirs)
        for e in bmp_entries:
            actual_w = e['w'] if e['w'] > 0 else 256
            actual_h = e['h'] if e['h'] > 0 else 256
            dib = struct.pack('<IiiHHIIiiII',
                40, actual_w, actual_h * 2, 1, 32, 0,
                len(e['bmp_data']), 0, 0, 0, 0)
            f.write(dib)
            f.write(e['bmp_data'])

    return os.path.getsize(path)


def main():
    if not os.path.exists(SOURCE_PNG):
        print(f'[ERROR] Source icon not found: {SOURCE_PNG}')
        print('Please place the icon PNG file in the VocabMaster directory.')
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    img = Image.open(SOURCE_PNG)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    print(f'Source: {SOURCE_PNG} ({img.size[0]}x{img.size[1]})')

    # Generate PNG at 256x256
    png_256 = img.copy()
    png_256.thumbnail((256, 256), Image.LANCZOS)
    png_path = os.path.join(OUTPUT_DIR, 'icon.png')
    png_256.save(png_path, 'PNG')
    print(f'Created {png_path} ({png_256.size[0]}x{png_256.size[1]})')

    # Generate multi-size frames
    frames = [img.resize((s, s), Image.LANCZOS) for s in SIZES]

    # Generate ICO with all sizes
    ico_path = os.path.join(OUTPUT_DIR, 'icon.ico')
    ico_size = make_ico(frames, SIZES, ico_path)
    print(f'Created {ico_path} ({ico_size:,} bytes, {len(SIZES)} frames: {SIZES})')

    print('Icon generation complete!')


if __name__ == '__main__':
    main()
