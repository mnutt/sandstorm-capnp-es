#!/usr/bin/env node

import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await rm(path.join(rootDir, "dist"), { recursive: true, force: true });
