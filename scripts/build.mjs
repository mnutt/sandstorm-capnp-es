#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandstormSrc = path.resolve(process.env.SANDSTORM_SRC ?? "/tmp/sandstorm/src");
const schemaRoot = path.join(sandstormSrc, "sandstorm");
const distDir = path.join(rootDir, "dist");
const capnpEsBin = path.join(
  rootDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "capnp-es.cmd" : "capnp-es",
);

if (!existsSync(capnpEsBin)) {
  throw new Error("Missing capnp-es binary. Run `npm install` first.");
}

if (!existsSync(schemaRoot)) {
  throw new Error(
    `Missing Sandstorm schema directory: ${schemaRoot}. Set SANDSTORM_SRC to a Sandstorm src checkout.`,
  );
}

const sourceFiles = await findCapnpFiles(schemaRoot);

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

run(capnpEsBin, [
  "--output=js,dts:dist",
  `--src-prefix=${sandstormSrc}`,
  `--import-path=${sandstormSrc}`,
  ...sourceFiles,
]);

await copyHandwrittenModules(distDir);
await writeIndexFiles(distDir);

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
  if (result.signal) {
    process.kill(process.pid, result.signal);
  }
}

async function findCapnpFiles(dir) {
  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries.sort()) {
    const fullPath = path.join(dir, entry);
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      files.push(...(await findCapnpFiles(fullPath)));
    } else if (entryStat.isFile() && entry.endsWith(".capnp")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function writeIndexFiles(outDir) {
  const generatedFiles = await findFiles(outDir, (fileName) =>
    fileName.endsWith(".js"),
  );
  const relativeGeneratedFiles = generatedFiles
    .map((file) => path.relative(outDir, file).replace(/\\/g, "/"))
    .filter((file) => file !== "index.js" && file !== "app.js" && file !== "web.js");

  const indexJs = relativeGeneratedFiles
    .map((file) => `export * from "./${file}";`)
    .join("\n");
  const indexDts = relativeGeneratedFiles
    .map((file) => `export * from "./${file}";`)
    .join("\n");

  await writeFile(path.join(outDir, "index.js"), `${indexJs}\n`);
  await writeFile(path.join(outDir, "index.d.ts"), `${indexDts}\n`);
}

async function copyHandwrittenModules(outDir) {
  for (const fileName of ["app.js", "app.d.ts", "web.js", "web.d.ts"]) {
    await copyFile(path.join(rootDir, "src", fileName), path.join(outDir, fileName));
  }
}

async function findFiles(dir, predicate) {
  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries.sort()) {
    const fullPath = path.join(dir, entry);
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      files.push(...(await findFiles(fullPath, predicate)));
    } else if (entryStat.isFile() && predicate(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}
