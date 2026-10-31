import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.address.*;
import ghidra.program.model.mem.*;
import ghidra.program.model.symbol.*;
import java.io.*;
import java.util.*;
public class Seed extends GhidraScript {
  public void run() throws Exception {
    String[] a = getScriptArgs();
    long lo = Long.parseLong(a[0], 16), hi = Long.parseLong(a[1], 16);
    // names file: "addr name" lines
    List<String[]> names = new ArrayList<>();
    for (String l : java.nio.file.Files.readAllLines(new File(a[2]).toPath())) {
      l = l.trim(); if (l.isEmpty()) continue; names.add(l.split("\\s+"));
    }
    Memory mem = currentProgram.getMemory();
    // prologue scan
    TreeSet<Long> starts = new TreeSet<>();
    for (long x = lo; x < hi - 3; x++) {
      Address ad = toAddr(x);
      byte b0 = mem.getByte(ad), b1 = mem.getByte(ad.add(1)), b2 = mem.getByte(ad.add(2));
      if ((b0 & 0xff) == 0x55 && (b1 & 0xff) == 0x8b && (b2 & 0xff) == 0xec) starts.add(x);
      // align-4 starts after RET padding: 53 56 57 / 53 8b d8 common delphi prologues
      if (x % 4 == 0 && ((b0 & 0xff) == 0x53 || (b0 & 0xff) == 0x56) ) {
        byte pb = mem.getByte(ad.subtract(1));
        if ((pb & 0xff) == 0xc3 || (pb & 0xff) == 0x90 || (pb & 0xff) == 0x8b) starts.add(x);
      }
    }
    for (String[] n : names) starts.add(Long.parseLong(n[0], 16));
    for (long s : starts) {
      Address ad = toAddr(s);
      disassemble(ad);
      if (getFunctionAt(ad) == null) createFunction(ad, null);
    }
    for (String[] n : names) {
      Address ad = toAddr(Long.parseLong(n[0], 16));
      disassemble(ad);
      Function f = getFunctionAt(ad);
      if (f == null) f = createFunction(ad, n[1]);
      if (f != null) f.setName(n[1], SourceType.USER_DEFINED);
    }
    analyzeChanges(currentProgram);
    PrintWriter out = new PrintWriter(new FileWriter(a[3]));
    DecompInterface d = new DecompInterface();
    d.openProgram(currentProgram);
    for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
      long e = f.getEntryPoint().getOffset();
      if (e < lo || e >= hi) continue;
      DecompileResults r = d.decompileFunction(f, 60, monitor);
      out.println("// ===== " + f.getName() + " @ " + Long.toHexString(e));
      if (r.decompileCompleted()) out.println(r.getDecompiledFunction().getC());
      else out.println("// failed: " + r.getErrorMessage());
    }
    out.close();
    // disassembly listing
    PrintWriter lst = new PrintWriter(new FileWriter(a[3] + ".asm"));
    InstructionIterator it = currentProgram.getListing().getInstructions(toAddr(lo), true);
    while (it.hasNext()) {
      Instruction ins = it.next();
      if (ins.getAddress().getOffset() >= hi) break;
      Function f = getFunctionAt(ins.getAddress());
      if (f != null) lst.println("\n;---- " + f.getName());
      lst.println(ins.getAddress() + "  " + ins.toString());
    }
    lst.close();
  }
}
