import struct, math, sys
from pathlib import Path

if len(sys.argv) != 4:
    raise SystemExit("usage: embed_icon.py <exe> <ico> <out>")
EXE=Path(sys.argv[1])
ICO=Path(sys.argv[2])
OUT=Path(sys.argv[3])

def align(v,a): return (v+a-1)//a*a

ico=ICO.read_bytes()
resv,itype,count=struct.unpack_from('<HHH',ico,0)
assert resv==0 and itype==1 and count>0
icons=[]
for i in range(count):
    off=6+i*16
    w,h,cc,rsv,planes,bpp,size,dataoff=struct.unpack_from('<BBBBHHII',ico,off)
    payload=ico[dataoff:dataoff+size]
    icons.append(dict(w=w,h=h,cc=cc,rsv=rsv,planes=planes or 1,bpp=bpp or 32,size=size,payload=payload,id=i+1))

b=bytearray(EXE.read_bytes())
peoff=struct.unpack_from('<I',b,0x3c)[0]
assert b[peoff:peoff+4]==b'PE\0\0'
coff=peoff+4
machine,nsec,timestamp,ptrsym,nsym,opt_size,chars=struct.unpack_from('<HHIIIHH',b,coff)
assert machine==0x8664
opt=coff+20
assert struct.unpack_from('<H',b,opt)[0]==0x20b
sec_align=struct.unpack_from('<I',b,opt+32)[0]
file_align=struct.unpack_from('<I',b,opt+36)[0]
dd=opt+112
sectab=opt+opt_size

sections=[]
for i in range(nsec):
    off=sectab+i*40
    name=bytes(b[off:off+8]).rstrip(b'\0')
    vs,va,rs,rp=struct.unpack_from('<IIII',b,off+8)
    sections.append((name,vs,va,rs,rp))
new_hdr_off=sectab+nsec*40
first_raw=min(rp for _,_,_,_,rp in sections if rp)
assert new_hdr_off+40 <= first_raw, 'no section-header room'
last_va=max(va+align(max(vs,1),sec_align) for _,vs,va,rs,rp in sections)
new_va=align(last_va,sec_align)
new_raw=align(len(b),file_align)

root_off=0
root_size=16+2*8
icon_type_off=root_size
icon_type_size=16+count*8
icon_lang_offs=[]
cur=icon_type_off+icon_type_size
for _ in icons:
    icon_lang_offs.append(cur); cur += 16+8
group_type_off=cur; cur += 16+8
group_lang_off=cur; cur += 16+8
icon_data_entry_offs=[]
for _ in icons:
    icon_data_entry_offs.append(cur); cur += 16
group_data_entry_off=cur; cur += 16
cur=align(cur,4)

group=bytearray(struct.pack('<HHH',0,1,count))
for ic in icons:
    group += struct.pack('<BBBBHHIH',ic['w'],ic['h'],ic['cc'],0,ic['planes'],ic['bpp'],ic['size'],ic['id'])
group_payload_off=cur; cur += len(group); cur=align(cur,4)
icon_payload_offs=[]
for ic in icons:
    icon_payload_offs.append(cur); cur += len(ic['payload']); cur=align(cur,4)
rsrc=bytearray(cur)

def put_dir(off, id_entries):
    struct.pack_into('<IIHHHH',rsrc,off,0,0,0,0,0,len(id_entries))
    eo=off+16
    for rid,target,is_dir in id_entries:
        val=target | (0x80000000 if is_dir else 0)
        struct.pack_into('<II',rsrc,eo,rid,val)
        eo+=8

put_dir(root_off,[(3,icon_type_off,True),(14,group_type_off,True)])
put_dir(icon_type_off,[(ic['id'],lo,True) for ic,lo in zip(icons,icon_lang_offs)])
for lo,de in zip(icon_lang_offs,icon_data_entry_offs):
    put_dir(lo,[(0x409,de,False)])
put_dir(group_type_off,[(1,group_lang_off,True)])
put_dir(group_lang_off,[(0x409,group_data_entry_off,False)])

for de,po,ic in zip(icon_data_entry_offs,icon_payload_offs,icons):
    struct.pack_into('<IIII',rsrc,de,new_va+po,len(ic['payload']),0,0)
struct.pack_into('<IIII',rsrc,group_data_entry_off,new_va+group_payload_off,len(group),0,0)
rsrc[group_payload_off:group_payload_off+len(group)] = group
for po,ic in zip(icon_payload_offs,icons):
    rsrc[po:po+len(ic['payload'])]=ic['payload']

raw_size=align(len(rsrc),file_align)
virt_size=len(rsrc)
if len(b)<new_raw:
    b += b'\0'*(new_raw-len(b))
b += rsrc
if len(rsrc)<raw_size:
    b += b'\0'*(raw_size-len(rsrc))

name=b'.rsrc\0\0\0'
sec_chars=0x40000040
hdr=struct.pack('<8sIIIIIIHHI',name,virt_size,new_va,raw_size,new_raw,0,0,0,0,sec_chars)
b[new_hdr_off:new_hdr_off+40]=hdr
struct.pack_into('<H',b,coff+2,nsec+1)
old_init=struct.unpack_from('<I',b,opt+8)[0]
struct.pack_into('<I',b,opt+8,old_init+raw_size)
struct.pack_into('<I',b,opt+56,align(new_va+virt_size,sec_align))
struct.pack_into('<II',b,dd+2*8,new_va,virt_size)
struct.pack_into('<I',b,opt+64,0)
OUT.write_bytes(b)
print(f'Wrote {OUT} ({OUT.stat().st_size} bytes)')
