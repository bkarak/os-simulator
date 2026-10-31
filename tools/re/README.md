# Analysis scripts

Throwaway scripts used to take `Os_simulator.exe` apart, kept because REVERSE-ENGINEERING.md
quotes their output. Run them from the repository root with the 1998 files unzipped into
`original/` (see the main README) and an `out/` directory for their scratch.

Python wants a venv with three packages:

```bash
python3 -m venv venv && venv/bin/pip install pefile capstone pillow
```

In the order they were used:

1. `res.py original/Os_simulator.exe out` — PE sections and every resource as a file.
2. `dfm.py out/RT_RCDATA_TMAIN.bin` — a form as .dfm text (the four are in `docs/forms/`).
3. `hlp.py original/OSS_HELP.HLP` — the help file's text (in `docs/help.txt`).
4. `methods.py original/Os_simulator.exe > out/names.txt` — event-handler addresses.
5. `dis.py original/Os_simulator.exe 25 <addr>...` — Capstone, to name runtime routines.
6. Ghidra, headless: import and analyse, then seed the handlers and decompile the program's
   own code (VA `0x44B400`–`0x450E20`, the four units at the end of the CODE section):

   ```bash
   analyzeHeadless out/ghidra oss -import original/Os_simulator.exe -scriptPath tools/re/ghidra \
       -postScript DecompRange.java 44b400 450e20 out/user.c
   analyzeHeadless out/ghidra oss -process Os_simulator.exe -noanalysis -scriptPath tools/re/ghidra \
       -postScript Seed.java 44b400 450e20 out/names.txt out/user2.c
   ```

   `Seed.java` writes the decompiled C to `out/user2.c` and the listing to `out/user2.c.asm`.
7. `annasm.py original/Os_simulator.exe out/user2.c.asm > out/user.asm` — the listing with
   runtime names, string constants and form fields filled in. This is what was read.

Addresses in the scripts are this executable's: file offset + `0x400C00` is the virtual address
inside CODE, and the main form's fields start at `0x2C4`.
