import { describe, expect, it } from "vitest";
import {
  nativeBundleLayout,
  normalizeVersion,
  resolveNativeBundleCommand,
} from "../scripts/desktop-native-bundle.mjs";

describe("ECORIONE native Windows release bundle", () => {
  it("resolves pnpm through explicit cmd.exe on Windows without shell=true", () => {
    expect(
      resolveNativeBundleCommand("pnpm", ["run", "build"], "win32", {
        ComSpec: "C:\\Windows\\System32\\cmd.exe",
      }),
    ).toEqual({
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "pnpm.cmd run build"],
    });
  });

  it("keeps native executables direct and rejects shell metacharacters in Windows pnpm args", () => {
    expect(resolveNativeBundleCommand("git", ["rev-parse", "HEAD"], "win32", {})).toEqual({
      command: "git",
      args: ["rev-parse", "HEAD"],
    });
    expect(() => resolveNativeBundleCommand("pnpm", ["run", "build&whoami"], "win32", {})).toThrow(
      /tidak aman/i,
    );
  });

  it("keeps non-Windows pnpm direct", () => {
    expect(resolveNativeBundleCommand("pnpm", ["run", "build"], "linux", {})).toEqual({
      command: "pnpm",
      args: ["run", "build"],
    });
  });

  it("uses a versioned Windows-native layout", () => {
    const layout = nativeBundleLayout({ version: "0.1.0", outRoot: "/tmp/ecorione-native" });
    expect(layout.bundleName).toBe("ECORIONE-0.1.0-windows-x64");
    expect(layout.nodeExe).toMatch(/runtime[\\/]node[\\/]node\.exe$/);
    expect(layout.temporalExe).toMatch(/runtime[\\/]temporal[\\/]temporal\.exe$/);
    expect(normalizeVersion("0.1.0-rc.1")).toBe("0.1.0-rc.1");
    expect(() => normalizeVersion("../bad")).toThrow(/version/i);
  });
});
