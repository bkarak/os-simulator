#!/usr/bin/env python3
"""Step 1: the PE sections and every resource, dumped to <outdir>/<TYPE>_<NAME>.bin.

    python3 tools/re/res.py original/Os_simulator.exe out

The four RT_RCDATA resources named TMAIN, TLOGIN, TEDITOR and TABOUT_FORM are the program's
forms (Delphi .dfm files, binary); dfm.py turns them into text. RT_STRING holds the VCL's
messages, which is where the dialog captions ("Warning", "Error") come from.
"""
import os, sys
import pefile

exe, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
pe = pefile.PE(exe)
print("ImageBase %x EntryPoint %x" % (pe.OPTIONAL_HEADER.ImageBase, pe.OPTIONAL_HEADER.AddressOfEntryPoint))
for s in pe.sections:
    print("%-8s VA %06x size %06x raw %06x" % (s.Name.rstrip(b"\0").decode(), s.VirtualAddress, s.Misc_VirtualSize, s.PointerToRawData))
image = pe.get_memory_mapped_image()
for t in pe.DIRECTORY_ENTRY_RESOURCE.entries:
    tname = pefile.RESOURCE_TYPE.get(t.id, str(t.name))
    for n in t.directory.entries:
        nm = str(n.name) if n.name else str(n.id)
        for leaf in n.directory.entries:
            d = leaf.data.struct
            print(tname, nm, d.Size)
            with open(os.path.join(outdir, f"{tname}_{nm}.bin"), "wb") as f:
                f.write(image[d.OffsetToData:d.OffsetToData + d.Size])
