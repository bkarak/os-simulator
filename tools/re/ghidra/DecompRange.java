import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.address.*;
import java.io.*;
public class DecompRange extends GhidraScript {
  public void run() throws Exception {
    String[] a = getScriptArgs();
    long lo = Long.parseLong(a[0], 16), hi = Long.parseLong(a[1], 16);
    PrintWriter out = new PrintWriter(new FileWriter(a[2]));
    PrintWriter all = new PrintWriter(new FileWriter(a[2] + ".funcs"));
    DecompInterface d = new DecompInterface();
    d.openProgram(currentProgram);
    for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
      long e = f.getEntryPoint().getOffset();
      all.println(Long.toHexString(e) + " " + f.getName() + " " + f.getBody().getNumAddresses());
      if (e < lo || e >= hi) continue;
      DecompileResults r = d.decompileFunction(f, 60, monitor);
      out.println("// ===== " + f.getName() + " @ " + Long.toHexString(e));
      if (r.decompileCompleted()) out.println(r.getDecompiledFunction().getC());
      else out.println("// failed: " + r.getErrorMessage());
    }
    out.close(); all.close();
  }
}
