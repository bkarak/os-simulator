#!/usr/bin/env python3
"""Step 4: the event handlers' addresses, from the forms' published-method tables.

    python3 tools/re/methods.py original/Os_simulator.exe > out/names.txt

Delphi reaches an OnClick handler through the class's RTTI method table, never through a direct
call, so a disassembler's call-graph analysis misses all of them; Ghidra found 11 functions in
the program's own code on its own. Each table entry is u16 size, u32 code address, then the
name as a length-prefixed string. The output ("<addr> <Unit>_<name>") is what Seed.java reads.
"""
import re, struct, sys

b = open(sys.argv[1], "rb").read()
found = []
for m in re.finditer(rb"[A-Za-z_][A-Za-z0-9_]{3,40}", b[0x4A000:0x50300]):
    s = m.start() + 0x4A000
    n = b[s - 1]
    if n != len(m.group()):
        continue
    size = struct.unpack_from("<H", b, s - 7)[0]
    addr = struct.unpack_from("<I", b, s - 5)[0]
    if size == 7 + n and 0x401000 <= addr < 0x451000:
        found.append((addr, m.group().decode()))

def unit(a):
    # The units sit in the code in this order: About_Unit, editor_pas, main_pas, login_menu.
    return "About" if a < 0x44B800 else "Editor" if a < 0x44BF00 else "Main" if a < 0x4504A0 else "Login"

for a, n in sorted(found):
    print("%x %s_%s" % (a, unit(a), n))
