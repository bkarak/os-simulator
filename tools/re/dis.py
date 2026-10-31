#!/usr/bin/env python3
"""Step 5: a quick Capstone disassembly of routines by address, to identify runtime functions.

    python3 tools/re/dis.py original/Os_simulator.exe 25 403b78 403840 4077b0

The second argument is the most instructions to print per routine (stopping at the first ret).
"""
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
exe = open(sys.argv[1], 'rb').read()
md = Cs(CS_ARCH_X86, CS_MODE_32)
for a in sys.argv[3:]:
    va = int(a, 16); o = va - 0x400C00
    print(f'--- {a}')
    n = 0
    for ins in md.disasm(exe[o:o+400], va):
        print(f'  {ins.address:x}  {ins.mnemonic} {ins.op_str}')
        n += 1
        if ins.mnemonic in ('ret',) or n >= int(sys.argv[2]): break
