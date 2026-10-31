#!/usr/bin/env python3
"""Step 6: Ghidra's listing of the program's code, made readable.

    python3 tools/re/annasm.py original/Os_simulator.exe out/user.c.asm > out/user.asm

Calls into the runtime get names (LStrCmp, LStrAsg, Pos, Copy, ValLong, ...; identified by
reading each routine once), every pointer to a Delphi string constant gets the string as a
comment, and offsets into the main form get the field's name (the published field table gives
the order: screen_output at 0x2C4, then four bytes per field). The flags matter: LStrCmp returns
its result in ZF/CF, which Ghidra's decompiler does not model, so every string comparison in the
decompiled C is wrong and the branches have to be read here.
"""
import re
import struct
import sys
exe = open(sys.argv[1], 'rb').read()
OFF = lambda va: va - 0x400C00
def lit(va):
    o = OFF(va)
    if not (8 <= o < len(exe)): return None
    rc, ln = struct.unpack_from('<iI', exe, o - 8)
    if rc == -1 and 0 <= ln < 300: return exe[o:o+ln].decode('cp1253', 'replace')
    return None
N = {'403b78':'LStrCmp','403840':'LStrAsg','403884':'LStrLAsg','403810':'LStrAsg2','404188':'CopyRecord','404070':'FinalizeRecord','40409c':'AddRefRecord?',
     '403a68':'LStrLen','4037ec':'LStrClr','403b28':'LStrCatN','403c6c':'Copy','409720':'Pos','403da0':'?Str','40298c':'ValLong','40277c':'IOCheck',
     '4085d0':'Format','407a54':'IntToStr','4052b8':'Eof','40527c':'CloseFile','40543c':'ReadLn','40549f':'Reset','4054a6':'Rewrite','4051da':'AssignFile',
     '425f94':'GetText','425fc4':'SetText','445b60':'Timer_SetEnabled','425e84':'SetVisible','4485e8':'MessageDlg','442204':'Application_CreateForm',
     '403a6c':'?','403c2c':'LStrToPChar','403a0c':'LStrFromShortStr','4037fc':'LStrArrayClr','403a3c':'LStrCat','403a74':'LStrCat3','403964':'LStrFromPCharLen'}
F = "screen_output Label1 Edit1 Label5 BitBtn1 BitBtn2 Timer1 Label6 Edit2 Label7 Label8 Edit4 BitBtn3 Label10 Edit6 Reset_Button Panel1 Panel2 Panel3 Label3 HD_output Label2 Memory_output Label4 printer_output Bevel1 Bevel2 Memorybtn HDDBtn PrinterBtn Edit3 MainMenu1 File1 Bevel3 Help1 N1 Exit1 Options1 Execute1 Freeze1 Reset1 N2 Memory1 HDD1 Printer1 Help_Button About1".split()
for line in open(sys.argv[2]):
    line = line.rstrip('\n'); c = []
    m = re.search(r'CALL 0x00([0-9a-f]{6})', line)
    if m and m.group(1) in N: line = line.replace(m.group(0), 'CALL ' + N[m.group(1)])
    for h in re.findall(r'0x(?:00)?(4[45][0-9a-f]{4})\b', line):
        s = lit(int(h, 16))
        if s is not None: c.append(repr(s))
        elif 0x451000 <= int(h,16) < 0x455000: line = line.replace('0x' + h if '0x'+h in line else '0x00'+h, 'g_' + h)
    for h in re.findall(r'\+ 0x(2[c-f][0-9a-f]|3[0-7][0-9a-f])\]', line):
        i = (int(h,16) - 0x2c4)
        if i % 4 == 0 and 0 <= i//4 < len(F): c.append('.' + F[i//4])
    if 'dword ptr [EAX + 0x204]' in line: c.append('.Lines')
    print(line + ('   ; ' + ' '.join(c) if c else ''))
