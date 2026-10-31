# Reverse-engineering OSS

This is the record of how a 396 KB Delphi executable from January 1998 became the JavaScript
simulator in `src/`, in one day (2026-10-31). The "I" here is Claude Code (Anthropic's coding
agent), which did the reverse-engineering and wrote these notes as it went; Vassilios
Karakoidas, one of the program's six authors, asked for it and directed the work. There was no
source code: the Pascal was lost long ago. Every command below was run and every output excerpt
is real. The scripts are in `tools/re/` (their README gives the order), the Wine setup in
`tools/wine/`.

## What was in the zip

`oss.zip`, as the author's site has served it since the late 1990s, holds five files:

```
   395,776  21-01-1998 13:27  Os_simulator.exe   PE32 executable (GUI) Intel 80386
    14,323  21-01-1998 18:55  OSS_HELP.HLP       MS Windows 3.1 help
       697  07-01-1998 14:36  address.txt
        87  21-01-1998 19:09  example.bch
         0  12-01-1998 23:57  untitled.bch
```

`address.txt` is one hundred lines, `[ 1]` to `[ 100]`, except that `[ 35]` appears twice, so
the file has 101 lines. `example.bch` is a batch file of five commands:

```
std 5 this is an example
ldd 5
stm 12 of a batch file
ldm 12
scr batch file example
```

and `untitled.bch` is empty. Both files mattered later: the empty one is what the program opens
when asked to edit a file that does not exist, and the duplicated `[ 35]` is a bug.

## Step 1: resources before code

A Delphi program carries its user interface as data. Every form is a resource, the class's
published fields and methods are described in RTTI tables next to the code, and the unit names
are in a `PACKAGEINFO` resource. So the first thing to read was the resource directory
(`res.py`), not the disassembly:

```
RT_RCDATA PACKAGEINFO 436
RT_RCDATA TABOUT_FORM 1277
RT_RCDATA TEDITOR 2073
RT_RCDATA TLOGIN 1402
RT_RCDATA TMAIN 5315
```

Four forms. `PACKAGEINFO` lists the VCL units and then the program's own four: `editor_pas`,
`main_pas`, `About_Unit` and `login_menu`. The runtime's copyright string says
"Portions Copyright (c) 1983,97 Borland".

## Step 2: the forms

The form resources are binary `.dfm` streams (`TPF0`): an object is a class name, an instance
name, a list of typed properties and its children. `dfm.py` is 60 lines and gives back the
form file the team saved in 1998 (all four are in `docs/forms/`). Excerpt from the main form:

```
object main: Tmain
  BorderIcons = []
  BorderStyle = bsToolWindow
  Caption = 'Simulation Screen'
  ClientHeight = 403
  ClientWidth = 618
  Menu = MainMenu1
  OnShow = FormActivate
  ...
  object Edit1: TEdit
    Left = 24
    Top = 328
    Width = 257
    Height = 21
    OnChange = Edit1Change
  end
  object BitBtn1: TBitBtn
    Caption = 'Execute'
    OnClick = BitBtn1Click
  end
  ...
  object Timer1: TTimer
    Enabled = False
    Interval = 100
    OnTimer = Timer1Timer
  end
```

That is the whole interface, to the pixel, with the name of every event handler: the login
window (a name, a "Choose Scheduler" radio group of Fifo, Round-Robin and Shortest Job First,
a status memo and a 0–9000 progress bar), the simulation screen (a Screen memo, a command line,
Active Tasks, Rem.Time, Current Task, a time quantum defaulting to 100 ms, and a panel that
switches between Memory, Hard Disk and Printer Status), the batch editor, and an About box in
blue Arial on maroon that says "OS Simulator ver.1.2", "Program created by: Renegade and EmP",
"January 1998".

Two details from here paid off later. The login window's design-time position is 55,55, which
is exactly where a 530×370 window sits centred on a 640×480 screen: the forms were laid out for
VGA, so the browser version is a 640×480 desktop. And the main form's `Reset` button and
`Reset` menu item both have `OnClick = FormActivate`, the same handler as the form's `OnShow`:
resetting is the same as opening the window.

## Step 3: the help file

`OSS_HELP.HLP` turned out to be the program's specification. WinHelp files are a small file
system of their own (a B-tree directory of internal files), the topic text is LZ77-compressed in
4 KB blocks, and this one also uses Hall phrase compression: a 234-entry phrase table in
`|PhrIndex`/`|PhrImage`, with the text made of phrase references and literal runs. `hlp.py` does
all three in about 120 lines. The decoded text (`docs/help.txt`) has seven topics, and the
Commands topic lists every command with its syntax and its cost:

```
cmp / <string1> / <string2>   1 time quantum
prn <string>                500
scr <string>                  5
ldm <N>, stm <N> <string>, dlm <N>       1 each
ldd <N>, std <N> <string>, dld <N>     100 each
end                           1
dir                           ?
dirreal, dirtasks, edit <name>.bch, terminate <N>
<name>.bch                    5 plus each command in it
<name>.bch /s                 5 plus each command in it
```

Memory and the hard disk have 100 positions each. The Miscellaneous topic names the team:
Anagnostou Achilles, Agapiou Stauros, Karakoidas Basilis, Kotoula Vivi, Maurogiorgos George and
Polychronopoulos Elias, for the third-semester class "Operating Systems I". The help file was
"Created with EasyHelp/Web by EmP".

The help text is transcribed into `src/help.js` as it was written.

## Step 4: finding the code

Ghidra's headless analyser (12.1.3) imported the executable and found 11 functions in the
23 KB at the end of the CODE section where the four units live. A Delphi event handler is never
called directly; the form loader finds it by name through the class's published-method table
(`u16 size, u32 address, shortstring name`), so call-graph analysis cannot see any of them.
`methods.py` reads those tables:

```
44e1f8 Main_BitBtn1Click        (Execute)
44e424 Main_FormActivate        (OnShow, Reset)
44e59c Main_execute_task
44fdb0 Main_Timer1Timer
45055c Login_BitBtn1Click       (Start The Simulation)
...                             28 in all
```

With those 28 addresses and every `push ebp; mov ebp, esp` in the range seeded as function
starts (`Seed.java`), Ghidra decompiled 61 functions.

## Step 5: why the decompiler was wrong about every string comparison

Delphi's `LStrCmp` does not return a value. It compares two strings and leaves the result in
the CPU flags, and the caller branches on them directly:

```
0044e251  MOV EAX,dword ptr [ESI]
0044e253  MOV EDX,0x44e3a0           ; 'none'
0044e258  CALL LStrCmp
0044e25d  JZ 0x0044e272
```

Ghidra's decompiler does not know that, so in its C every comparison tests a stale flag from
some earlier instruction, and every `if` after one is wrong. Since this program is mostly string
comparisons, the decompiled C was useful for structure and useless for conditions. The work was
done in the listing instead, made readable by `annasm.py`: the runtime routines named (each
identified by reading it once: `Pos` calls `StrPos` on two `PChar`s, `LowerCase` adds 0x20 to
`A`..`Z`, `ValLong` skips spaces and accepts `$` for hex), every pointer to a string constant
followed by the string, and every offset into the main form replaced by the field's name. The
field table gives the order, `screen_output` at `0x2C4` and then four bytes per published field.
The result is 4,758 lines, and reading it took most of the day.

## Step 6: the parser

The Execute button reads the command line and calls one procedure with seven parameters. That
procedure has a nested procedure per command, each reaching into its parent's stack frame
through the frame pointer it is passed (`[EBP+8]`), which is how Delphi, like Turbo Pascal
before it, compiles nested procedures and why the listing is full of `MOV EAX,[EBP+0x8]; MOV EAX,[EAX-0x4]`. In order:

1. Lowercase the whole line (so `scr Hello` prints ` hello`).
2. Try each command in turn: `Pos('cmp ', s) = 1`, then `scr `, `prn `, `ldm `, `ldd `, `stm `,
   `std `, `end`, `dlm `, `dld `, then exact `dirreal`, `dir`, `dirtasks`, then `edit`, then
   "ends in `.bch /s`", "ends in `.bch`", then `terminate`.
3. Each command fills in a result code and up to two parameters. Code 1 queues a task, 5 means
   done on the spot, and the rest select the message: 0 "Invalid or Misspelled Command!",
   2 "Incorrect Memory Position Selected!", 3 "Misspelled or Missing Parameters!",
   4 "Invalid Filename!", 6 "Command aborted due to occupied address!", 7 "Specified Batch
   File Missing from Virtual Hard Drive".

A routine shared by several commands squeezes runs of spaces: it drops leading spaces and
collapses the first *n* runs to one space each, leaving the rest alone, so `stm 12 two   spaces`
keeps the spacing of its text.

The parameters keep their surprises. `scr` and `prn` take everything after the command word,
leading space included, which is why every `scr` and `prn` line starts with a space. `stm` and `std`
split at the second space. `cmp` looks for `/` right after `cmp ` and then scans *from the right*
for the last ` /`. Execute then echoes the command word and the parameters before queuing, so a
typed `stm 5 Abc` shows as

```
stm
 5 abc

```

and the blank line is a `Lines.Add(' ')` at the end of every Execute.

## Step 7: tasks and the three schedulers

A task is a 28-byte record in a table of 100: command, total time, remaining time, two
parameters, task number, and (for batches) a line counter. A new task takes the first free
slot. Its number comes from the Execute button's `Tag` property, incremented on every task and
never reset, not even by Reset or by logging out and in again. The scheduler is the timer
handler, one quantum per tick:

- **FIFO** gives the quantum to the lowest task number, so tasks run to completion in the order
  they were typed.
- **Round robin** gives it to the next occupied slot after the one that ran last, wrapping.
- **Shortest Job First** gives it to the task with the least *remaining* time, rescanning every
  tick, so it is really shortest-remaining-time-first: a 5-quantum `scr` typed while a
  100-quantum `ldd` is running overtakes it. The scan ignores tasks with 600 or more quanta
  left, which none has.

The chosen algorithm lives in the main form's `Tag`. When a task's remaining time reaches zero,
`execute_task` does what the command does: `scr` adds its text to the Screen, `prn` adds
"printing completed" and the text to the Printer panel, `stm`/`std` write the memory or disk
array and rewrite line *N* of the listing as `[ N] "text"`, asking first ("The specified address
is ocupied.Would you like to overwrite?") if the address holds something; `ldm`/`ldd` print an
address, `cmp` prints `H:<higher> L:<lower>` or "Equal operands!", `end` goes back to the login
window, and `dir` lists the disk addresses whose contents end in `.bch`.

## Step 8: batch files live on two disks

This took the longest to see. A batch file's *contents* live in the real directory the program
runs in. Its *name* must also be stored on the simulated hard disk, as the contents of some
address, or the parser refuses it with code 7. So the session goes:

```
std 1 example.bch        (100 quanta: the name goes onto the simulated disk)
example.bch              (now it runs)
```

The batch editor does the first step for you: its Execute buttons save the file, queue that
`std` (to the address equal to the first free *task slot's* index), put the name on the command
line and hide the editor. If you press Execute straight away, the `std` has not finished and the
batch is "missing from Virtual Hard Drive". That is how the program shipped.

Run as one, a batch is a single task: five quanta, then the file is read and every line parsed
as a check, then the first line's time is loaded, and each time it runs out that line's effect
happens and the next line's time is loaded. Run with `/s`, the batch task's own five quanta end
by queuing every line as a task of its own.

## Step 9: running the original

The account above came from the listing. To check it, the original ran under Wine in Docker
(`tools/wine/`, Debian's `wine32` under x86 emulation, slow but faithful), driven with
`xdotool` and photographed with ImageMagick. The same command sequences went into the original
and into the engine's tests (`test/engine.test.js`), which assert the lines the original
printed.

It confirmed the formats line for line (the echo, the leading spaces, `H:abd L:abc`,
`[ 5] "abc"`, and the `dirtasks` row `  prn  483            none        hi there   9`), the
detection screen's blank memo, the overwrite dialog with its "Warning" caption, the `over`
login, and the bugs from the listing that a session can show: `ldm 0`, the word "none", the
round-robin hang and Ctrl+X. It also corrected me twice:

- I typed `foo` expecting "Invalid or Misspelled Command!" and got "Specified Batch File Missing
  from Virtual Hard Drive". The batch test is `Pos('.bch', s) = Length(s) - 3`, and `Pos`
  returns 0 when the substring is not there. For any three-letter string, `0 = 3 - 3`. Every
  unknown three-letter command was a batch file, and every unknown six-letter one a batch run
  with `/s`. I had read past that comparison while writing the parser.
- I expected `example.bch /s` to raise the overwrite dialog, because the listing clearly queues
  its first line twice (`std 5` twice, the second finding address 5 occupied). It ran cleanly.
  The reason is a second bug: when the batch task finishes, `execute_task` writes the batch's
  own, now empty, record back to its slot, and the first task it had just queued sat in that
  slot (it was the first free one). One copy of line 1 is overwritten. The duplicate read looks
  like someone's fix for a first line that went missing, and it works whenever the batch sits in
  the first free slot. The active-task counter is decremented twice, which also matches the one
  task lost. Three wrongs that make a right, most of the time.

## The bugs

All of these are in the 1998 binary. The ones marked *seen* were reproduced under Wine; the
rest are read from the listing.

1. **Three- and six-letter commands are batch files** (*seen*), as above.
2. **No range check on `ldm`, `ldd`, `dlm`, `dld`** (*seen*). `ldm 0` prints the login name,
   because the global holding it sits just before the memory array. `ldm 101` prints the first
   disk address; larger numbers read whatever follows.
3. **Round robin hangs on an empty table** (*seen*). Its scan wraps around with no exit. The
   timer is switched off when the last task *finishes*, but `terminate` empties the table without
   doing so; terminate the only task under round robin and the next tick spins at 100% CPU for
   ever.
4. **The address listings are off by one from 36** (from the file). They are loaded from
   `address.txt`, which has `[ 35]` twice, and written by line index, so `stm 40 x` updates the
   line labelled `[ 39]`.
5. **Batch with `/s`**: the first line queued twice, one queued task overwritten, the counter
   decremented twice (*seen*, as above). With the batch in a later slot, a different line is
   lost and line 1 runs twice.
6. **"occured in line N" is not a line number.** It is `FilePos` on a text file, which counts
   128-byte buffers, so in any batch file under 128 bytes every error is "in line 1".
7. **Checking a batch runs it a little.** The check parses every line with the same parser, and
   the parser does `edit`, `dirreal`, `dirtasks` and `terminate` on the spot, so a batch with
   `terminate 3` in it kills task 3 while being checked, and `edit x.bch` opens the editor.
8. **A batch line that is done on the spot never finishes.** Those four commands have no time
   quantum, the line's countdown starts at zero, the first tick takes it to −1, and it never
   reaches zero again: the batch stays in the table for good, and under FIFO, which always
   picks the lowest task number, nothing queued after it ever runs.
9. **A batch whose name is on the simulated disk but whose file is gone** raises an I/O
   exception inside the timer handler before the task's record is written back, so the next
   tick raises it again, and the one after.
10. **Inconsistent errors for a bad address**: `ldm x` says "Invalid Filename!", `ldd x`, `dlm x`
    and `dld x` say "Invalid or Misspelled Command!".
11. **Commands without parameters echo the word "none"** (*seen*), the parser's placeholder.
12. **A malformed `cmp`** queues with both strings "none" and answers "Equal operands!".
13. **Ctrl+X quits** (*seen*). It is File > Exit's shortcut, and a menu shortcut is handled
    before the focused control sees the key, so selecting text in the command line and pressing
    Ctrl+X closes the program instead of cutting.
14. **A time quantum of 0 stops the clock** (`TTimer` does not run at interval 0), and a negative
    one becomes a 49-day quantum (the interval is unsigned).
15. **The detection screen is never seen** (*seen* under Wine). The login handler fills the memo
    and moves the progress bar in a loop that never lets Windows paint, then hides the window.
    Under Wine the memo stayed blank while the bar moved, and the window closed as it filled.

Also found: logging in as `over` skips the detection screen entirely. It is the team's own
shortcut, and it still works.

## The re-implementation

`src/engine.js` is the simulator without a screen: the parser, the task table, the schedulers,
the effects and the batch runner, one function per routine of the original where that made
sense, with the original's routine named in a comment. It talks to a `view` object for
everything it shows and a `files` object for the real directory, so it runs in the page and
under `node --test`. The parser is pure; the four commands that act on the spot are done
separately, which is what lets a batch be checked without running it.

`src/oss.js` builds the four forms from their `.dfm` coordinates on a 640×480 desktop and wires
them to the engine; `src/help.js` is the help file. The real directory is the browser's local
storage, seeded with the two batch files from the zip.

Fixed in the re-implementation: bugs 1 to 12 and 14. Bug 13 is kept as a menu label but Ctrl+X
only quits when the focus is not in a text field. The editor stores a file's name at the first
empty disk address rather than at the first free task slot's index, its Save and About menu
items (which had no handler) do what they say, and Enter on the command line runs the command,
which in 1998 only the Execute button did. Bug 15 is "fixed" the other way round: the
detection screen shows what the help file says it shows, its lines appearing as the bar passes
the points where the code added them. The figures it shows are what the original reports on a
current PC: `Pentium Processor Found` (Windows has reported every x86 CPU that way to 32-bit
programs since), the browser's processor count, and memory capped at 2147483647 bytes, which is
what `GlobalMemoryStatus` tells a 32-bit program on any machine with more than 2 GB.

## What went wrong

- **The decompiler's flags.** An hour went into reading conditions in Ghidra's C before it was
  clear that none of them could be trusted (Step 5).
- **Padding that was not there.** `od -c example.bch` printed the last line followed by blank
  columns, which I read as trailing spaces and copied into the engine. They were `od`'s column
  alignment; the file is 87 bytes and ends at `example`. A byte comparison against the original
  file caught it.
- **`Pos` returning 0** (Step 9). The code said it plainly and I did not see it; the running
  program did.
- **Docker and `/private/tmp`.** The first Wine run mounted the files from the macOS temporary
  directory, which Docker Desktop does not share with its VM, so the mount was empty and Wine
  said "File not found" for a file that was plainly there. `docker cp` fixed it.

## Conclusions

The order that worked was the one that worked for
[The Anger of Pharaoh XXXV](https://github.com/bkarak/pharaoh-xxxv): data before code. The four form resources
gave the whole interface and every handler's name before a single instruction was read, and the
help file gave the specification, including the time quanta. The disassembly then only had to
answer the questions those two left open. Running the original afterwards was worth more than
any amount of rereading: it found the one bug the listing hid in plain sight, and it showed that
two bugs I was sure of cancelled each other out.
