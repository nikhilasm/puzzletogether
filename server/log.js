/**
 * The server's log and the only place server code writes to the console: one record per event, JSON
 * in production and a readable line in development, gated by PT_LOG_LEVEL (ADR-0026). Two rules
 * nothing here can enforce: nothing on the op or focus path logs, and a reconnect token or solution
 * is never a field.
 */

import { config } from './config.js';

/** Severity order. A record is written when its level is at or above the configured threshold. */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/** Read once: the level cannot change while the process runs, so nor can this. */
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

/** The parts of a thrown value worth keeping. An Error serialises to {} through JSON.stringify. */
function describeError(error) {
    if (!(error instanceof Error)) return { message: String(error) };
    return { name: error.name, message: error.message, stack: error.stack };
}

/** Renders one field value, leaving a plain word bare so a development line stays scannable. */
function renderValue(value) {
    if (typeof value === 'string' && !/[\s"]/.test(value)) return value;
    return JSON.stringify(value);
}

/** The development rendering: time, level, event, then the fields as key=value pairs. */
function devLine(level, event, fields) {
    const pairs = Object.entries(fields)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${renderValue(value)}`)
        .join(' ');
    const time = new Date().toISOString().slice(11, 23);
    return `${time} ${level.padEnd(5)} ${event}${pairs ? ` ${pairs}` : ''}`;
}

/**
 * Writes one record, if its level clears the threshold.
 *
 * err is the one field name with a meaning: a thrown value there is described rather than
 * serialised, and in development its stack follows the line instead of being crushed into it.
 */
function write(level, event, fields) {
    if (LEVELS[level] < threshold) return;

    const { err, ...rest } = fields ?? {};
    const detail = err === undefined ? null : describeError(err);
    const line = config.isDev
        ? devLine(level, event, detail ? { ...rest, err: detail.message } : rest) +
          (detail?.stack ? `\n${detail.stack}` : '')
        : JSON.stringify({
              t: new Date().toISOString(),
              level,
              event,
              ...rest,
              ...(detail ? { err: detail } : {}),
          });

    // warn and error go to stderr, which is where an operator's alerting is pointed.
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.info(line);
}

/**
 * The log; every server module writes through this, none to the console directly. Each method takes
 * an event name in domain.action form and a flat object of fields, where a field named err holds a
 * thrown value that is described rather than serialised.
 *
 * @type {Record<'debug'|'info'|'warn'|'error', (event: string, fields?: object) => void>}
 */
export const log = {
    debug: (event, fields) => write('debug', event, fields),
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
};
