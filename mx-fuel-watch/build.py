from pathlib import Path
import base64, gzip, math, shutil, struct, subprocess

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "MX_Fuel_Watch_PH.exe"
TMP = ROOT / ".build"
SRC = ROOT / "mx_fuel_watch_ph_v33.c"

def run(*args):
    print("+", " ".join(map(str,args)))
    subprocess.check_call([str(x) for x in args])

def make_import_libs():
    MACHINE_AMD64=0x8664
    libs={
      "kernel32.dll":["CloseHandle","CreateThread","ExitProcess","GetLocalTime","GetModuleHandleW","MultiByteToWideChar","Sleep",
                      "GetModuleFileNameW","GetCommandLineW","CreateMutexW","GetLastError","GetTempPathW","CreateFileW",
                      "WriteFile","CopyFileW","DeleteFileW","MoveFileExW","CreateProcessW"],
      "user32.dll":["BeginPaint","CreateIcon","CreateWindowExW","DefWindowProcW","DispatchMessageW","DrawIconEx","DrawTextW",
                    "EndPaint","FillRect","GetClientRect","GetMessageW","InvalidateRect","KillTimer","LoadCursorW","LoadImageW",
                    "MessageBoxW","PostMessageW","PostQuitMessage","RegisterClassExW","SetTimer","ShowWindow","TranslateMessage","UpdateWindow"],
      "gdi32.dll":["BitBlt","CreateCompatibleBitmap","CreateCompatibleDC","CreateFontW","CreatePen","CreateSolidBrush","DeleteDC",
                   "DeleteObject","Ellipse","LineTo","MoveToEx","Polygon","Rectangle","RoundRect","SelectObject","SetBkMode","SetTextColor"],
      "winhttp.dll":["WinHttpCloseHandle","WinHttpConnect","WinHttpOpen","WinHttpOpenRequest","WinHttpReadData","WinHttpReceiveResponse",
                     "WinHttpSendRequest","WinHttpSetTimeouts"],
      "dwmapi.dll":["DwmSetWindowAttribute"],
    }
    imp = TMP / "imports"; imp.mkdir(parents=True, exist_ok=True)
    for dll, funcs in libs.items():
        d = imp / dll.split(".")[0]; d.mkdir(exist_ok=True)
        objs=[]
        for i,f in enumerate(funcs):
            data=f.encode()+b"\0"+dll.encode()+b"\0"
            hdr=struct.pack("<HHHHIIHH",0,0xffff,0,MACHINE_AMD64,0,len(data),0,4)
            p=d/f"{i:03}_{f}.obj"; p.write_bytes(hdr+data); objs.append(p)
        lib=imp/(dll.split(".")[0]+".lib")
        run("llvm-ar","rcs",lib,*objs)
    return imp

def make_icon_dib(size):
    w=h=size
    px=bytearray()
    mask_stride=((w+31)//32)*4
    mask_rows=[]
    cx=(w-1)/2; cy=(h-1)/2; r=w*0.46
    for y in range(h-1,-1,-1):
        mask=bytearray(mask_stride)
        for x in range(w):
            dx=x-cx; dy=y-cy; d=(dx*dx+dy*dy)**0.5
            inside=d<=r
            if not inside:
                b=g=rr=a=0
                mask[x//8] |= 1 << (7-(x%8))
            else:
                t=max(0.0,min(1.0,d/r))
                rr=int(9+16*(1-t)); g=int(25+31*(1-t)); b=int(38+45*(1-t)); a=255
                if r-1.8 <= d <= r:
                    rr,g,b = 226,176,70
                sx=x/size; sy=y/size
                gold=(233,183,73)
                blue=(69,177,235)
                pump = (0.30<=sx<=0.64 and 0.28<=sy<=0.72)
                inner = (0.36<=sx<=0.58 and 0.34<=sy<=0.48)
                base = (0.26<=sx<=0.68 and 0.70<=sy<=0.77)
                hose = ((0.64<=sx<=0.73 and 0.38<=sy<=0.67) or (0.70<=sx<=0.78 and 0.50<=sy<=0.58))
                if pump or base or hose:
                    rr,g,b = gold
                if inner:
                    rr,g,b = 15,45,59
                if (0.38<=sx<=0.44 and 0.54<=sy<=0.65) or (0.50<=sx<=0.56 and 0.54<=sy<=0.65):
                    rr,g,b = blue
            px += bytes((b,g,rr,a))
        mask_rows.append(bytes(mask))
    mask=b"".join(mask_rows)
    hdr=struct.pack("<IIIHHIIIIII",40,w,h*2,1,32,0,w*h*4,0,0,0,0)
    return hdr+bytes(px)+mask

def make_ico():
    sizes=[16,24,32,48,64,96,128]
    imgs=[make_icon_dib(s) for s in sizes]
    hdr=struct.pack("<HHH",0,1,len(imgs))
    offset=6+16*len(imgs)
    ents=[]
    for s,img in zip(sizes,imgs):
        ents.append(struct.pack("<BBBBHHII",s,s,0,0,1,32,len(img),offset))
        offset += len(img)
    return hdr+b"".join(ents)+b"".join(imgs)

def make_res():
    ico=make_ico()
    reserved,typ,count=struct.unpack_from("<HHH",ico,0)
    entries=[]
    for i in range(count):
        off=6+i*16
        w,h,cc,rsv,planes,bpp,sz,ofs=struct.unpack_from("<BBBBHHII",ico,off)
        entries.append((w,h,cc,rsv,planes,bpp,sz,ofs,ico[ofs:ofs+sz]))
    def idfield(n): return struct.pack("<HH",0xffff,n)
    def pad4(b): return b+b"\0"*((-len(b))%4)
    def rec(rtype,rname,data,lang=0x0409,flags=0x1030):
        pre=struct.pack("<II",len(data),0)+idfield(rtype)+idfield(rname)
        pre=pad4(pre)
        header=pre+struct.pack("<IHHII",0,flags,lang,0,0)
        header=struct.pack("<II",len(data),len(header))+header[8:]
        return pad4(header)+pad4(data)
    res=rec(0,0,b"",0,0)
    for idx,e in enumerate(entries,1):
        res+=rec(3,idx,e[8])
    grp=struct.pack("<HHH",0,1,count)
    for idx,e in enumerate(entries,1):
        w,h,cc,rsv,planes,bpp,sz,ofs,_=e
        grp+=struct.pack("<BBBBHHIH",w,h,cc,rsv,planes,bpp,sz,idx)
    res+=rec(14,101,grp)
    p=TMP/"app_icon.res"; p.write_bytes(res); return p

def main():
    shutil.rmtree(TMP, ignore_errors=True); TMP.mkdir()
    packed = ROOT / "source.b64"
    global SRC
    if packed.exists():
        SRC = TMP / "mx_fuel_watch_ph_v33.c"
        SRC.write_bytes(gzip.decompress(base64.b64decode(packed.read_text().strip())))
    imp=make_import_libs()
    res=make_res()
    obj=TMP/"app.obj"
    run("clang","--target=x86_64-pc-windows-msvc","-O2","-ffreestanding","-fno-stack-protector","-fno-builtin","-c",SRC,"-o",obj)
    run("lld-link","/entry:WinMainCRTStartup","/subsystem:windows","/nodefaultlib","/machine:x64",
        f"/out:{OUT}",obj,res,imp/"kernel32.lib",imp/"user32.lib",imp/"gdi32.lib",imp/"winhttp.lib",imp/"dwmapi.lib")
    print("Built:", OUT, OUT.stat().st_size, "bytes")

if __name__=="__main__":
    main()
