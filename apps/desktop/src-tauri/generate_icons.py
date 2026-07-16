import zlib
import struct
import os

def write_png(width, height, pixels, filename):
    png = bytearray([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png.extend(struct.pack(">I", 13))
    png.extend(b"IHDR")
    png.extend(ihdr_data)
    png.extend(struct.pack(">I", zlib.crc32(b"IHDR" + ihdr_data)))
    
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter type 0
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw_data.extend([r, g, b, a])
            
    idat_data = zlib.compress(raw_data)
    png.extend(struct.pack(">I", len(idat_data)))
    png.extend(b"IDAT")
    png.extend(idat_data)
    png.extend(struct.pack(">I", zlib.crc32(b"IDAT" + idat_data)))
    
    png.extend(struct.pack(">I", 0))
    png.extend(b"IEND")
    png.extend(struct.pack(">I", zlib.crc32(b"IEND")))
    
    with open(filename, "wb") as f:
        f.write(png)

# Let's generate 18x18 icons
width = 18
height = 18

# tray-idle (monochrome clock outline)
pixels_idle = []
for y in range(height):
    for x in range(width):
        dx = x - 8.5
        dy = y - 8.5
        dist = (dx*dx + dy*dy)**0.5
        
        is_outline = 5.0 <= dist <= 6.5
        is_hand_v = (x == 8 and 4 <= y <= 8)
        is_hand_h = (y == 8 and 8 <= x <= 12)
        
        if is_outline or is_hand_v or is_hand_h:
            # Black outline
            pixels_idle.append((0, 0, 0, 255))
        else:
            pixels_idle.append((0, 0, 0, 0))

# tray-active (monochrome clock outline with green active dot)
pixels_active = []
for y in range(height):
    for x in range(width):
        dx = x - 8.5
        dy = y - 8.5
        dist = (dx*dx + dy*dy)**0.5
        
        is_outline = 5.0 <= dist <= 6.5
        is_hand_v = (x == 8 and 4 <= y <= 8)
        is_hand_h = (y == 8 and 8 <= x <= 12)
        
        # small dot at coordinates x=13.5, y=13.5 (radius 2)
        dx_dot = x - 13.5
        dy_dot = y - 13.5
        dist_dot = (dx_dot*dx_dot + dy_dot*dy_dot)**0.5
        is_dot = dist_dot <= 2.2
        
        if is_dot:
            pixels_active.append((0, 200, 83, 255)) # Green dot!
        elif is_outline or is_hand_v or is_hand_h:
            pixels_active.append((0, 0, 0, 255))
        else:
            pixels_active.append((0, 0, 0, 0))

os.makedirs("icons", exist_ok=True)
write_png(width, height, pixels_idle, "icons/tray-idle.png")
write_png(width, height, pixels_active, "icons/tray-active.png")
print("Successfully generated icons/tray-idle.png and icons/tray-active.png")
