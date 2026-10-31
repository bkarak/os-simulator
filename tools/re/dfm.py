#!/usr/bin/env python3
"""Step 2: a binary Delphi form (the "TPF0" stream in an RT_RCDATA resource) as .dfm text.

    python3 tools/re/dfm.py out/RT_RCDATA_TMAIN.bin > docs/forms/TMAIN.txt

Every control with its class, position, caption, font and the names of its event handlers.
Strings are decoded as Windows-1253, the Greek code page the team's machines used.
"""
import struct
import sys
class R:
    def __init__(s, b): s.b, s.p = b, 0
    def u8(s): v = s.b[s.p]; s.p += 1; return v
    def peek(s): return s.b[s.p]
    def n(s, k): v = s.b[s.p:s.p+k]; s.p += k; return v
    def ss(s): return s.n(s.u8()).decode('cp1253', 'replace')
def val(r, ind):
    t = r.u8()
    if t == 0: return None
    if t == 1:
        items = []
        while r.peek() != 0: items.append(val(r, ind))
        r.u8(); return '(' + ' '.join(map(str, items)) + ')'
    if t == 2: return struct.unpack('<b', r.n(1))[0]
    if t == 3: return struct.unpack('<h', r.n(2))[0]
    if t == 4: return struct.unpack('<i', r.n(4))[0]
    if t == 5: r.n(10); return '<ext>'
    if t in (6,): return repr(r.ss())
    if t == 7: return r.ss()
    if t == 8: return 'False'
    if t == 9: return 'True'
    if t == 10: l = struct.unpack('<i', r.n(4))[0]; d = r.n(l); return f'<binary {l}>'
    if t == 11:
        xs = []
        while True:
            x = r.ss()
            if not x: break
            xs.append(x)
        return '[' + ', '.join(xs) + ']'
    if t == 12: l = struct.unpack('<i', r.n(4))[0]; return repr(r.n(l).decode('cp1253','replace'))
    if t == 13: return 'nil'
    if t == 14:
        out = ['<']
        while r.peek() != 0:
            if r.peek() in (2,3,4): val(r, ind)
            out.append(' ' * (ind+2) + 'item')
            while r.peek() != 0:
                nm = r.ss(); out.append(' ' * (ind+4) + f'{nm} = {val(r, ind+4)}')
            r.u8()
            out.append(' ' * (ind+2) + 'end')
        r.u8(); return '\n'.join(out) + '>'
    raise Exception(f'type {t} at {r.p}')
def obj(r, ind=0):
    if r.peek() & 0xF0 == 0xF0:
        f = r.u8()
        if f & 2: val(r, ind)
    cls = r.ss(); name = r.ss()
    print(' ' * ind + f'object {name}: {cls}')
    while r.peek() != 0:
        nm = r.ss(); print(' ' * (ind+2) + f'{nm} = {val(r, ind+2)}')
    r.u8()
    while r.peek() != 0: obj(r, ind+2)
    r.u8()
    print(' ' * ind + 'end')
b = open(sys.argv[1], 'rb').read()
assert b[:4] == b'TPF0'
r = R(b); r.p = 4; obj(r)
