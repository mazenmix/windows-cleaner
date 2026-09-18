import struct, sys
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "mxfuel.ico")
sizes = [16, 32, 48, 64, 128]
images = []

def inside_round(x, y, n):
    pad = max(1, n // 20)
    r = max(2, n // 5)
    if pad + r <= x < n-pad-r or pad + r <= y < n-pad-r:
        return pad <= x < n-pad and pad <= y < n-pad
    cx = pad+r if x < n/2 else n-pad-r-1
    cy = pad+r if y < n/2 else n-pad-r-1
    return (x-cx)*(x-cx)+(y-cy)*(y-cy) <= r*r

for n in sizes:
    px = bytearray(n*n*4)
    for y in range(n):
        for x in range(n):
            i=(y*n+x)*4
            b,g,r,a = 0,0,0,0
            if inside_round(x,y,n):
                b,g,r,a = 27,16,9,255
                sx,sy=x/n,y/n
                pump = 0.23 <= sx <= 0.60 and 0.20 <= sy <= 0.79
                if pump:
                    b,g,r,a = 54,35,22,255
                screen = 0.30 <= sx <= 0.54 and 0.28 <= sy <= 0.43
                if screen:
                    b,g,r,a = 45,29,17,255
                stand = 0.27 <= sx <= 0.58 and 0.72 <= sy <= 0.80
                if stand:
                    b,g,r,a = 240,238,232,255
                blue = 0.30 <= sx <= 0.54 and 0.52 <= sy <= 0.56
                red = 0.30 <= sx <= 0.54 and 0.60 <= sy <= 0.64
                if blue: b,g,r,a = 255,133,35,255
                if red: b,g,r,a = 82,69,239,255
                hose = (
                    (0.60 <= sx <= 0.70 and 0.29 <= sy <= 0.37) or
                    (0.68 <= sx <= 0.75 and 0.35 <= sy <= 0.65) or
                    (0.64 <= sx <= 0.73 and 0.63 <= sy <= 0.71)
                )
                if hose: b,g,r,a = 78,193,242,255
                border = (
                    (0.22 <= sx <= 0.25 or 0.58 <= sx <= 0.61) and 0.20 <= sy <= 0.79
                ) or (
                    (0.20 <= sy <= 0.23 or 0.76 <= sy <= 0.79) and 0.23 <= sx <= 0.60
                )
                if border: b,g,r,a = 245,242,236,255
            px[i:i+4]=bytes((b,g,r,a))
    xor=bytearray()
    for y in range(n-1,-1,-1):
        xor += px[y*n*4:(y+1)*n*4]
    mask_stride=((n+31)//32)*4
    mask=bytes(mask_stride*n)
    hdr=struct.pack("<IIIHHIIIIII",40,n,n*2,1,32,0,len(xor),0,0,0,0)
    images.append(hdr+xor+mask)

header=struct.pack("<HHH",0,1,len(images))
off=6+16*len(images)
entries=bytearray()
for n,img in zip(sizes,images):
    wb=0 if n==256 else n
    entries += struct.pack("<BBBBHHII",wb,wb,0,0,1,32,len(img),off)
    off += len(img)
OUT.write_bytes(header+entries+b"".join(images))
print(OUT, OUT.stat().st_size)
