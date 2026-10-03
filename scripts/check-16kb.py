#!/usr/bin/env python3
"""Verify every 64-bit .so in an APK/AAB has 16 KB-aligned PT_LOAD segments.

Play requires this for apps targeting Android 15+. It applies only to 64-bit
ABIs; 32-bit devices cannot use 16 KB pages, so armeabi-v7a and x86 are skipped.
"""
import struct, sys, zipfile, re

SIXTEEN_KB = 16384
SIXTY_FOUR_BIT = ("arm64-v8a", "x86_64")

def min_load_align(data):
    if data[:4] != b"\x7fELF":
        return None
    is64, e = data[4] == 2, "<" if data[5] == 1 else ">"
    if is64:
        phoff = struct.unpack_from(e + "Q", data, 32)[0]
        phes, phn, aoff, fmt = struct.unpack_from(e + "H", data, 54)[0], struct.unpack_from(e + "H", data, 56)[0], 48, e + "Q"
    else:
        phoff = struct.unpack_from(e + "I", data, 28)[0]
        phes, phn, aoff, fmt = struct.unpack_from(e + "H", data, 42)[0], struct.unpack_from(e + "H", data, 44)[0], 28, e + "I"
    aligns = [struct.unpack_from(fmt, data, phoff + i * phes + aoff)[0]
              for i in range(phn)
              if struct.unpack_from(e + "I", data, phoff + i * phes)[0] == 1]
    return min(aligns) if aligns else None

def main(path):
    bad, checked = [], 0
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if not name.endswith(".so"):
                continue
            m = re.search(r"lib/([^/]+)/", name)
            if not m or m.group(1) not in SIXTY_FOUR_BIT:
                continue
            align = min_load_align(z.read(name))
            if align is None:
                continue
            checked += 1
            if align < SIXTEEN_KB:
                bad.append((name, align))
    if not checked:
        print("no 64-bit native libraries found")
        return 0
    if bad:
        print(f"{len(bad)} of {checked} 64-bit libraries are not 16 KB aligned:")
        for n, a in bad:
            print(f"    {a:>6}  {n}")
        return 1
    print(f"all {checked} 64-bit libraries are 16 KB aligned")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
