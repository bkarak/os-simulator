# OSS, the Operating System Simulator

A scheduler simulator written in Delphi in January 1998 by six students for Operating Systems I
at the University of Piraeus, re-implemented in JavaScript from its executable. You log in, pick
FIFO, round robin or shortest job first, and type commands that write to a simulated screen,
memory, hard disk and printer; each costs a number of time quanta, and the scheduler hands out
one quantum per tick. Batch files run as one task or as one task per line.

Run it at [bkarak.wizhut.tech/software/oss](https://bkarak.wizhut.tech/software/oss).

The source of the 1998 program was lost; what survived is `Os_simulator.exe`, its WinHelp file
and two batch files. The reverse-engineering and the re-implementation were done by Claude Code
(Anthropic's coding agent) on 2026-10-31, from the binary alone and checked against the binary
running under Wine, directed by Vassilios Karakoidas, one of the six. How it went is in
[REVERSE-ENGINEERING.md](REVERSE-ENGINEERING.md).

## Layout

```
src/engine.js     the simulator: parser, task table, schedulers, batch runner (no DOM)
src/oss.js        the four forms on a 640x480 Windows 95 desktop, wired to the engine
src/help.js       the program's help file, transcribed
src/oss.css       the look
src/index.html    the simulator on a page of its own; embed.html is the bare desktop for a frame
test/             node --test, including sessions replayed from the original under Wine
docs/forms/       the four Delphi forms, recovered from the executable's resources
docs/help.txt     the help file's text, decoded
tools/re/         the analysis scripts, in the order they were used
tools/wine/       running the original in Docker
tools/screenshot.mjs  drive the simulator in headless Chrome and save a PNG
tools/publish.sh  copy src/ into a web directory
```

The 1998 files are not in this repository. They are on the site as
[oss.zip](https://bkarak.wizhut.tech/programs/oss/oss.zip) (5 files, 206 KB); unzip it into
`original/` for the scripts in `tools/`.

## Running

No build step and no dependencies: serve `src/` and open it.

```bash
python3 -m http.server --directory src 8765
node --test test/
```

`window.OSS` is a handle for the console: `OSS.sim` is the engine, `OSS.execute('scr hi')` runs
a command, `OSS.sim.setQuantum(5)` speeds the clock up.

## Commands

| Command | Quanta | Does |
| --- | ---: | --- |
| `scr <text>` | 5 | prints the text on the Screen |
| `prn <text>` | 500 | prints it on the Printer |
| `stm <N> <text>`, `ldm <N>`, `dlm <N>` | 1 | store, load, delete memory position N (1–100) |
| `std <N> <text>`, `ldd <N>`, `dld <N>` | 100 | the same on the hard disk |
| `cmp /<a> /<b>` | 1 | which string is higher |
| `dir` | 5 | the batch files stored on the simulated disk |
| `end` | 1 | log out |
| `<name>.bch` | 5 + its lines | run a batch file as one task |
| `<name>.bch /s` | 5 | run it as one task per line |
| `dirtasks`, `dirreal`, `terminate <N>`, `edit <name>.bch` | – | done on the spot |

A batch file runs only if its name is stored on the simulated disk (`std 1 example.bch`); the
editor's Execute buttons queue that for you, and it takes 100 quanta. Everything typed is
lowercased first, as it was.

## Differences from 1998

The program behaves as the original did, apart from its bugs. Fixed:

- Unknown three- and six-letter commands were taken for batch files.
- `ldm`, `ldd`, `dlm` and `dld` had no range check (`ldm 0` printed your login name); a
  non-numeric address gave a different wrong message for each of them.
- Round robin hung the program at full CPU when `terminate` emptied the task table.
- The memory and disk listings were off by one from address 36 (`address.txt` has `[ 35]` twice).
- A batch run with `/s` queued its first line twice and lost a task to its own write-back.
- "occured in line N" counted 128-byte buffers, not lines.
- Checking a batch before running it carried out its `edit`, `terminate`, `dirreal` and
  `dirtasks` lines; such a line, when its turn came, never finished.
- A batch whose file had gone raised an I/O error on every tick.
- A malformed `cmp` answered "Equal operands!"; commands without parameters echoed "none".
- A time quantum of 0 stopped the clock and a negative one was 49 days.
- The editor stored a file at the disk address equal to the first free task slot's index.

Changed: Enter runs a command; Ctrl+X quits only outside a text field (it was File > Exit's
shortcut and beat Cut); the editor's Save and About items, which did nothing, work; Exit to
Windows shows the shutdown screen; the detection screen shows its text as the help file says
(the original never painted it), with the figures the original reports on a PC of today. The
batch files live in this browser's storage.

## Credits

OSS was written by Achilles Anagnostou, Stauros Agapiou, Vassilios (Basilis) Karakoidas, Vivi Kotoula,
George Maurogiorgos and Elias Polychronopoulos, as the help file lists them; its About box
credits Renegade and EmP. The help text in `src/help.js` is theirs. The re-implementation is
under the MIT licence (see LICENSE).
