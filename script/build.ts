#!/usr/bin/env bun

import solidPlugin from "@opentui/solid/bun-plugin"
import { $ } from "bun"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pkg from "../package.json"

type BuildTarget = {
  os: "linux" | "darwin" | "win32"
  arch: "arm64" | "x64"
  abi?: "musl"
  avx2?: false
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

process.chdir(rootDir)

const args = process.argv.slice(2)
const singleFlag = args.includes("--single")
const baselineFlag = args.includes("--baseline")
const skipInstall = args.includes("--skip-install")
const noArchive = args.includes("--no-archive")
const uploadZipFlag = args.includes("--upload-zip")
const dryRunFlag = args.includes("--dry-run")

function getArgValue(flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index === -1) {
    return undefined
  }

  const value = args[index + 1]
  if (!value || value.startsWith("--")) {
    return undefined
  }

  return value
}

if (args.includes("--tag") && !getArgValue("--tag")) {
  throw new Error("Missing value for --tag")
}

const releaseTag = getArgValue("--tag") ?? `v${pkg.version}`

if (uploadZipFlag) {
  const distDir = path.resolve(rootDir, "dist")
  const zipFiles = await Array.fromAsync(
    new Bun.Glob(`${pkg.name}-*.zip`).scan({
      cwd: distDir,
      absolute: true,
    }),
  )

  const releaseFiles = zipFiles
    .filter((filePath) => {
      const archive = path.basename(filePath)
      return archive.includes("-darwin-") || archive.includes("-windows-")
    })
    .sort((a, b) => a.localeCompare(b))

  if (releaseFiles.length === 0) {
    throw new Error("No macOS/windows zip archives found in dist. Run bun run build:all first.")
  }

  console.log(`upload target: ${releaseTag}`)
  console.log("archives:")
  for (const filePath of releaseFiles) {
    console.log(`- ${path.relative(rootDir, filePath)}`)
  }

  if (dryRunFlag) {
    console.log("dry-run enabled, skipping gh release upload")
    process.exit(0)
  }

  await $`gh release upload ${releaseTag} ${releaseFiles} --clobber`
  console.log(`uploaded ${releaseFiles.length} zip archive(s) to ${releaseTag}`)
  process.exit(0)
}

const allTargets: BuildTarget[] = [
  { os: "linux", arch: "arm64" },
  { os: "linux", arch: "x64" },
  { os: "linux", arch: "x64", avx2: false },
  { os: "linux", arch: "arm64", abi: "musl" },
  { os: "linux", arch: "x64", abi: "musl" },
  { os: "linux", arch: "x64", abi: "musl", avx2: false },
  { os: "darwin", arch: "arm64" },
  { os: "darwin", arch: "x64" },
  { os: "darwin", arch: "x64", avx2: false },
  { os: "win32", arch: "x64" },
  { os: "win32", arch: "x64", avx2: false },
]

const targets = singleFlag
  ? allTargets.filter((target) => {
      if (target.os !== process.platform || target.arch !== process.arch) {
        return false
      }

      if (target.avx2 === false) {
        return baselineFlag
      }

      if (target.abi !== undefined) {
        return false
      }

      return true
    })
  : allTargets

if (targets.length === 0) {
  throw new Error(`No build targets selected for ${process.platform}-${process.arch}`)
}

await $`rm -rf dist`

if (!skipInstall) {
  await $`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
}

if (skipInstall) {
  const missingNativePackages = Array.from(
    new Set(
      targets
        .map((target) => `@opentui/core-${target.os}-${target.arch}`)
        .filter((name) => !fs.existsSync(path.resolve(rootDir, `node_modules/${name}/index.ts`))),
    ),
  )

  if (missingNativePackages.length > 0) {
    throw new Error(
      `Missing native packages: ${missingNativePackages.join(", ")}. Run the build once without --skip-install.`,
    )
  }
}

const parserWorker = fs.realpathSync(path.resolve(rootDir, "node_modules/@opentui/core/parser.worker.js"))
const parserWorkerPath = path.relative(rootDir, parserWorker).replace(/\\/g, "/")
const binaryName = "polymarket-bloomberg-tui"

const binaries: Record<string, string> = {}

for (const target of targets) {
  const packageName = [
    pkg.name,
    target.os === "win32" ? "windows" : target.os,
    target.arch,
    target.avx2 === false ? "baseline" : undefined,
    target.abi,
  ]
    .filter(Boolean)
    .join("-")

  const bunTarget = ["bun", target.os, target.arch, target.avx2 === false ? "baseline" : undefined, target.abi]
    .filter(Boolean)
    .join("-")

  const bunfsRoot = target.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"

  console.log(`building ${packageName}`)
  await $`mkdir -p dist/${packageName}/bin`

  const result = await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    plugins: [solidPlugin],
    sourcemap: "external",
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: bunTarget as never,
      outfile: `dist/${packageName}/bin/${binaryName}`,
      windows: {},
    },
    entrypoints: ["./src/index.tsx", parserWorker],
    define: {
      POLYMARKET_BLOOMBERG_TUI_VERSION: JSON.stringify(pkg.version),
      OTUI_TREE_SITTER_WORKER_PATH: JSON.stringify(`${bunfsRoot}${parserWorkerPath}`),
    },
  })

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error(`Build failed for ${packageName}`)
  }

  await Bun.file(`dist/${packageName}/package.json`).write(
    JSON.stringify(
      {
        name: packageName,
        version: pkg.version,
        os: [target.os],
        cpu: [target.arch],
      },
      null,
      2,
    ),
  )

  if (!noArchive) {
    const archiveName = target.os === "linux" ? `${packageName}.tar.gz` : `${packageName}.zip`
    if (target.os === "linux") {
      await $`tar -czf ../../${archiveName} *`.cwd(`dist/${packageName}/bin`)
    } else {
      await $`zip -rq ../../${archiveName} *`.cwd(`dist/${packageName}/bin`)
    }
  }

  binaries[packageName] = pkg.version
}

console.log("built binaries:", Object.keys(binaries).join(", "))

export { binaries }
