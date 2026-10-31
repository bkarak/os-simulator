#!/usr/bin/env python3
"""Step 3: the text of a WinHelp file (.HLP): internal directory, LZ77 topic blocks and Hall
phrase compression, enough to read OSS_HELP.HLP. Prints one "==== TOPIC:" block per topic,
text runs joined by " | ".

    python3 tools/re/hlp.py original/OSS_HELP.HLP > docs/help.txt

The format is the one in Manfred Winterhoff's helpfile.txt (the helpdeco documentation).
"""
import struct
import sys
b = open(sys.argv[1], 'rb').read()
magic, dirstart, firstfree, size = struct.unpack_from('<IiiI', b, 0)
assert magic == 0x00035F3F, hex(magic)

def btree_leaves(off):
    # off -> FILEHEADER(9) then BTREEHEADER
    p = off + 9
    (m, flags, pagesize, struc, z, splits, root, neg1, total, nlevels, entries) = struct.unpack_from('<HHH16shhhhhhi', b, p)
    assert m == 0x293B
    pages = p + 38
    # descend to first leaf
    page = root
    for _ in range(nlevels - 1):
        q = pages + page * pagesize
        unused, n, prev = struct.unpack_from('<HHh', b, q)
        page = prev  # first child pointer
    while page != -1:
        q = pages + page * pagesize
        unused, n, prev, nxt = struct.unpack_from('<HHhh', b, q)
        yield q + 8, n
        page = nxt

files = {}
for q, n in btree_leaves(dirstart):
    for _ in range(n):
        e = b.index(b'\0', q); name = b[q:e].decode('latin1'); q = e + 1
        files[name] = struct.unpack_from('<i', b, q)[0]; q += 4
print('files:', files, file=sys.stderr)

def fdata(name):
    off = files[name]
    reserved, used, flag = struct.unpack_from('<iiB', b, off)
    return b[off + 9: off + 9 + used]

def lz77(src, limit=None):
    out = bytearray(); i = 0
    while i < len(src):
        flags = src[i]; i += 1
        for bit in range(8):
            if i >= len(src): break
            if flags & (1 << bit):
                v = src[i] | (src[i+1] << 8); i += 2
                cnt = (v >> 12) + 3; dist = (v & 0xFFF) + 1
                for _ in range(cnt): out.append(out[-dist])
            else:
                out.append(src[i]); i += 1
    return bytes(out)

sysd = fdata('|SYSTEM')
smagic, minor, major, gendate, sflags = struct.unpack_from('<HHHiH', sysd, 0)
print('SYSTEM minor', minor, 'flags', sflags, file=sys.stderr)
p = 12
while p + 4 <= len(sysd):
    rt, ds = struct.unpack_from('<HH', sysd, p)
    print('  sysrec', rt, sysd[p+4:p+4+ds][:80], file=sys.stderr)
    p += 4 + ds

# phrases (Hall)
phrases = None
if '|PhrIndex' in files:
    pi = fdata('|PhrIndex'); pim = fdata('|PhrImage')
    a4a, entries, csize, imsize, imcsize, z = struct.unpack_from('<iiiiii', pi, 0)
    bits = struct.unpack_from('<H', pi, 24)[0] & 0xF
    stream = pi[28:]
    pos = [0]; bitpos = 0
    def getbit():
        global bitpos
        v = (stream[bitpos >> 3] >> (bitpos & 7)) & 1; bitpos += 1; return v
    offs = [0]
    for _ in range(entries):
        n = 1
        while getbit(): n += 1 << bits
        if getbit(): n += 1
        if bits > 1 and getbit(): n += 2
        if bits > 2 and getbit(): n += 4
        if bits > 3 and getbit(): n += 8
        if bits > 4 and getbit(): n += 16
        offs.append(offs[-1] + n)
    img = lz77(pim) if imsize != imcsize else pim
    phrases = [img[offs[i]:offs[i+1]] for i in range(entries)]
    print('phrases', entries, phrases[:20], file=sys.stderr)

def hall(src):
    out = bytearray(); i = 0
    while i < len(src):
        c = src[i]; i += 1
        if c & 1 == 0: out += phrases[c >> 1]
        elif c & 3 == 1: out += phrases[128 + (c >> 2) * 256 + src[i]]; i += 1
        elif c & 7 == 3: n = (c >> 3) + 1; out += src[i:i+n]; i += n
        elif c & 15 == 7: out += b' ' * ((c >> 4) + 1)
        else: out += b'\0' * ((c >> 4) + 1)
    return bytes(out)

top = fdata('|TOPIC')
bs = 4096 if sflags != 8 else 2048
stream = bytearray()
for k in range(0, len(top), bs):
    blk = top[k:k+bs]
    payload = blk[12:]
    stream += lz77(payload)[:16384 - 12] if sflags in (4, 8) else payload
p = 12 if False else 0
out = []
while p + 21 <= len(stream):
    blocksize, dl2, prev, nxt, dl1, rt = struct.unpack_from('<iiiiiB', stream, p)
    if blocksize <= 0: break
    ld1 = stream[p+21:p+dl1]
    ld2raw = stream[p+dl1:p+blocksize]
    ld2 = hall(ld2raw) if (phrases and dl2 > blocksize - dl1) else ld2raw
    text = ld2.decode('cp1253', 'replace')
    if rt == 2:
        out.append('\n==== TOPIC: ' + text.split('\0')[0])
    elif rt in (0x20, 0x23):
        out.append(' | '.join(s for s in text.split('\0') if s))
    p += blocksize
print('\n'.join(out))
