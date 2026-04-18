type VerboseLevel = "debug" | "info" | "warn";

function shouldEmitVerboseLogs() {
  if (process.env.ACECRM_ENABLE_SERVER_LOGS === "1") return true;
  return process.env.NODE_ENV !== "production";
}

function emitVerbose(level: VerboseLevel, args: unknown[]) {
  if (!shouldEmitVerboseLogs()) return;
  (globalThis.console[level] as (...params: unknown[]) => void)(...args);
}

export const serverLog = {
  debug(...args: unknown[]) {
    emitVerbose("debug", args);
  },
  info(...args: unknown[]) {
    emitVerbose("info", args);
  },
  warn(...args: unknown[]) {
    emitVerbose("warn", args);
  },
  error(...args: unknown[]) {
    globalThis.console.error(...args);
  },
};
