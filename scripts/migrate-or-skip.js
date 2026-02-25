#!/usr/bin/env node

const { spawnSync } = require("child_process")

const DEFAULT_LOCK_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 3000

function parseEnvInt(value, fallback) {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const MAX_LOCK_RETRIES = parseEnvInt(process.env.MIGRATION_LOCK_RETRIES, DEFAULT_LOCK_RETRIES)
const RETRY_DELAY_MS = parseEnvInt(process.env.MIGRATION_LOCK_RETRY_MS, DEFAULT_RETRY_DELAY_MS)

function sleep(ms) {
  if (ms <= 0) return
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
    return
  } catch {
    const end = Date.now() + ms
    while (Date.now() < end) {
      // Fallback for environments where Atomics.wait is unavailable.
    }
  }
}

function shouldFailOnMigrationLock() {
  return process.env.NODE_ENV === "production" || process.env.CI === "true" || process.env.VERCEL === "1"
}

function runMigrateDeploy() {
  return spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "pipe",
    encoding: "utf8",
  })
}

function isLockTimeoutOutput(output) {
  return (
    output.includes("P1002") ||
    output.toLowerCase().includes("advisory lock") ||
    output.toLowerCase().includes("timed out")
  )
}

function run() {
  if (process.env.SKIP_MIGRATIONS === "1") {
    console.log("[migrate] SKIP_MIGRATIONS=1, skipping prisma migrate deploy")
    return 0
  }

  const totalAttempts = MAX_LOCK_RETRIES + 1

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const result = runMigrateDeploy()

    if (result.status === 0) {
      process.stdout.write(result.stdout || "")
      process.stderr.write(result.stderr || "")
      return 0
    }

    const output = `${result.stdout || ""}\n${result.stderr || ""}`
    const isLockTimeout = isLockTimeoutOutput(output)
    const isLastAttempt = attempt === totalAttempts

    if (!isLockTimeout) {
      process.stdout.write(result.stdout || "")
      process.stderr.write(result.stderr || "")
      return result.status || 1
    }

    if (!isLastAttempt) {
      console.warn(
        `[migrate] Lock timeout during migration (attempt ${attempt}/${totalAttempts}). Retrying in ${RETRY_DELAY_MS}ms...`
      )
      sleep(RETRY_DELAY_MS)
      continue
    }

    if (shouldFailOnMigrationLock()) {
      process.stdout.write(result.stdout || "")
      process.stderr.write(result.stderr || "")
      console.error("[migrate] Migration lock persisted after retries in production/CI. Failing build to prevent schema drift.")
      return result.status || 1
    }

    console.warn("[migrate] Migration skipped after lock timeout retries in non-production mode. Proceeding with build.")
    return 0
  }

  return 1
}

process.exit(run())
