import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

run("git", ["diff", "--check"]);
assertCleanWorktree();

const extensionTests = fs.readdirSync(path.join(repoRoot, "tests", "extension"))
  .filter(file => file.endsWith(".mjs"))
  .sort()
  .map(file => path.join("tests", "extension", file));

for (const test of extensionTests) {
  run("node", [test]);
}

const syntaxFiles = gitFiles(["extension/src", "extension/web-ffmpeg", "tests/extension", "tests/smoke"])
  .filter(file => /\.(?:js|mjs)$/.test(file))
  .sort();

for (const file of syntaxFiles) {
  run("node", ["--check", file]);
}

run("node", ["tests/smoke/local-e2e-smoke.mjs"], {
  env: { ...process.env, OPENAPI_CALLS: "0" }
});

if (process.env.FUGUANG_RELEASE_ZIP) {
  run("node", ["tests/extension/release-package.test.mjs"], {
    env: process.env
  });
}

console.log("VERIFY_RELEASE_STATUS=passed");

function assertCleanWorktree() {
  const result = run("git", ["status", "--porcelain=v1", "--untracked-files=all"], { capture: true });
  const dirtyLines = result.stdout
    .split("\n")
    .map(line => line.trimEnd())
    .filter(Boolean);
  if (!dirtyLines.length) {
    return;
  }
  throw new Error(
    [
      "release verification requires a clean tracked worktree.",
      "Commit or discard tracked changes and remove non-ignored untracked files before release verification.",
      ...dirtyLines.map(line => `  ${line}`)
    ].join("\n")
  );
}

function gitFiles(paths) {
  const result = run("git", ["ls-files", "-z", ...paths], { capture: true });
  return result.stdout.split("\0").filter(Boolean);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: options.env || process.env,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    const rendered = [command, ...args].join(" ");
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(`${rendered} failed with exit code ${result.status}`);
  }
  if (!options.capture) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
  }
  return result;
}
