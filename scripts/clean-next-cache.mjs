import { rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const target = path.resolve(root, ".next");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Removes the local Next.js .next cache. Stop the dev server first, or run npm run dev:clean.");
  process.exit(0);
}

if (!target.startsWith(root + path.sep)) {
  throw new Error(`Refusing to remove path outside project: ${target}`);
}

function getRunningNextDevPids() {
  try {
    if (process.platform === "win32") {
      const command = [
        "$root = $env:NEXT_CACHE_PROJECT_ROOT;",
        "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" |",
        "Where-Object { $_.CommandLine -and $_.CommandLine.Contains($root) -and ($_.CommandLine.Contains('next\\dist\\bin\\next') -or $_.CommandLine.Contains('next\\dist\\server\\lib\\start-server')) } |",
        "Select-Object -ExpandProperty ProcessId",
      ].join(" ");

      return execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
        encoding: "utf8",
        env: { ...process.env, NEXT_CACHE_PROJECT_ROOT: root },
      })
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    }

    return execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" })
      .split("\n")
      .filter((line) => line.includes(root) && line.includes("next/dist/"))
      .map((line) => line.trim().split(/\s+/, 1)[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}

const runningPids = getRunningNextDevPids();
if (runningPids.length > 0 && !process.argv.includes("--force")) {
  throw new Error(
    `Next dev server is still running for this project (PID ${runningPids.join(", ")}). Stop it first, then rerun this command.`
  );
}

await rm(target, { recursive: true, force: true });
console.log(`Removed ${path.relative(root, target)}`);
