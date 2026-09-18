import struct, sys
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'mxdollar.ico')
sizes = [16, 32, 48, 64]
images=[]
for n in sizes:
    px=bytearray(n*n*4)
    c=(n-1)/2
    rad=n*0.45
    for y in range(n):
        for x in range(n):
            i=(y*n+x)*4
            dx=x-c; dy=y-c
            inside=(dx*dx+dy*dy)<=rad*rad
            if inside:
                b,g,r,a=31,26,18,255
            else:
                b,g,r,a=0,0,0,0
            sx=x/n; sy=y/n
            mark = (
                (0.43 <= sx <= 0.57 and 0.18 <= sy <= 0.82) or
                (0.30 <= sx <= 0.68 and 0.29 <= sy <= 0.38) or
                (0.30 <= sx <= 0.68 and 0.62 <= sy <= 0.71) or
                (0.30 <= sx <= 0.39 and 0.35 <= sy <= 0.52) or
                (0.59 <= sx <= 0.68 and 0.48 <= sy <= 0.65)
            )
            if inside and mark:
                b,g,r,a=118,197,229,255
            px[i:i+4]=bytes((b,g,r,a))
    xor=bytearray()
    for y in range(n-1,-1,-1):
        xor += px[y*n*4:(y+1)*n*4]
    mask_stride=((n+31)//32)*4
    mask=bytes(mask_stride*n)
    hdr=struct.pack('<IIIHHIIIIII',40,n,n*2,1,32,0,len(xor),0,0,0,0)
    images.append(hdr+xor+mask)

header=struct.pack('<HHH',0,1,len(images))
off=6+16*len(images)
entries=bytearray()
for n,img in zip(sizes,images):
    wb=0 if n==256 else n
    entries += struct.pack('<BBBBHHII',wb,wb,0,0,1,32,len(img),off)
    off += len(img)
OUT.write_bytes(header+entries+b''.join(images))
print(OUT, OUT.stat().st_size)
