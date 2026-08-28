import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";

const cwd = process.cwd();

function runGit(args) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const rootResult = runGit(["rev-parse", "--show-toplevel"]);

if (rootResult.status !== 0) {
  process.exit(0);
}

let repositoryRoot;

try {
  repositoryRoot = realpathSync(rootResult.stdout.trim());
} catch {
  process.exit(0);
}

if (repositoryRoot !== realpathSync(cwd)) {
  process.exit(0);
}

const currentResult = runGit(["config", "--local", "--get", "core.hooksPath"]);
const currentHooksPath = currentResult.status === 0 ? currentResult.stdout.trim() : "";

if (currentHooksPath && currentHooksPath !== ".githooks") {
  console.warn(
    `Keeping existing core.hooksPath (${currentHooksPath}); configure .githooks manually if desired.`,
  );
  process.exit(0);
}

const configureResult = runGit([
  "config",
  "--local",
  "core.hooksPath",
  ".githooks",
]);

if (configureResult.status !== 0) {
  console.warn("Could not configure the tracked Git hooks automatically.");
}
