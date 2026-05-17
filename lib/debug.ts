/**
 * Lightweight client-side debug logger. Gated on either
 *   NEXT_PUBLIC_DEBUG=1
 * or a runtime override via `localStorage.setItem('agro:debug', '1')`. In
 * production builds with neither set, every helper compiles down to a
 * no-op so there's no console noise or perf cost.
 *
 * Helpers:
 *   - debug(label, ...args)       — namespaced console.log
 *   - warn(label, ...args)        — always logs (warnings should never be silent)
 *   - error(label, ...args)       — always logs (errors should never be silent)
 *   - time(label) / timeEnd       — performance timing
 *   - mount(component)            — logs "[mount]" with elapsed ms since module load
 *
 * Used by the providers (AuthProvider, AgriDataProvider) to make the
 * client-side mount lifecycle visible during pilot deployment. Pair with
 * a browser console open during a hard reload to see exactly where the
 * loading phase is spending time.
 */

const NS = "[agro]";

const MODULE_START = typeof performance !== "undefined" ? performance.now() : 0;

function readEnvFlag(): boolean {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEBUG === "1") {
    return true;
  }
  return false;
}

function readRuntimeFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("agro:debug") === "1";
  } catch {
    return false;
  }
}

/** True when verbose debug logging should fire. */
export function isDebugEnabled(): boolean {
  return readEnvFlag() || readRuntimeFlag();
}

/** Namespaced console.log; no-op when debug is disabled. */
export function debug(label: string, ...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.log(`${NS} ${label}`, ...args);
  } catch {
    /* console can fail in sandboxed envs — give up silently */
  }
}

/** Namespaced console.warn; always fires. */
export function warn(label: string, ...args: unknown[]): void {
  try {
    // eslint-disable-next-line no-console
    console.warn(`${NS} ${label}`, ...args);
  } catch {
    /* ignore */
  }
}

/** Namespaced console.error; always fires. */
export function error(label: string, ...args: unknown[]): void {
  try {
    // eslint-disable-next-line no-console
    console.error(`${NS} ${label}`, ...args);
  } catch {
    /* ignore */
  }
}

const timers = new Map<string, number>();

/** Start a performance timer. No-op when debug is disabled. */
export function time(label: string): void {
  if (!isDebugEnabled()) return;
  if (typeof performance === "undefined") return;
  timers.set(label, performance.now());
}

/** End a timer started with time(). Logs the elapsed ms. */
export function timeEnd(label: string): void {
  if (!isDebugEnabled()) return;
  if (typeof performance === "undefined") return;
  const start = timers.get(label);
  if (start == null) return;
  timers.delete(label);
  const dur = performance.now() - start;
  debug(`⏱ ${label}`, `${dur.toFixed(1)}ms`);
}

/**
 * Log a provider/component mount with elapsed ms since module load. Useful
 * for spotting which mount is delaying first paint on a reload.
 */
export function mount(component: string, detail?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  const elapsed =
    typeof performance !== "undefined"
      ? (performance.now() - MODULE_START).toFixed(0)
      : "?";
  debug(`▶ mount ${component} @+${elapsed}ms`, detail ?? "");
}

/** Log a provider/component unmount. */
export function unmount(component: string): void {
  if (!isDebugEnabled()) return;
  const elapsed =
    typeof performance !== "undefined"
      ? (performance.now() - MODULE_START).toFixed(0)
      : "?";
  debug(`◀ unmount ${component} @+${elapsed}ms`);
}

/**
 * Log a state transition inside a provider, e.g.
 *   transition('Auth', 'loading', 'ready', { hasSession: true })
 */
export function transition(
  scope: string,
  from: string,
  to: string,
  detail?: Record<string, unknown>,
): void {
  if (!isDebugEnabled()) return;
  debug(`↪ ${scope}: ${from} → ${to}`, detail ?? "");
}
