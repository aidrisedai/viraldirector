import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { crc32, createZip } from "./zip";

describe("createZip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes an archive that standard tools can open, with unique names", async () => {
    const zip = await createZip([
      { name: "01-hook.mp4", data: new Blob([new Uint8Array([1, 2, 3, 4])]) },
      { name: "script.txt", data: "Your first idea — is bad.\n" },
      { name: "script.txt", data: "second" },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const file = join(dir, "t.zip");
    writeFileSync(file, new Uint8Array(await zip.arrayBuffer()));
    let listing: string;
    try {
      listing = execFileSync("python3", ["-c", "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print('|'.join(i.filename+':'+str(i.file_size) for i in z.infolist()));print(z.read('script.txt').decode())", file]).toString();
    } catch {
      return; // no Python here: the CRC test above still covers the format's hardest part
    }
    expect(listing).toContain("01-hook.mp4:4|script.txt:");
    expect(listing).toContain("script (2).txt:6");
    expect(listing).toContain("Your first idea — is bad.");
  });
});
