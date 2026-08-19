declare const __DEV__: boolean;

export const AI_DEBUG = typeof __DEV__ !== "undefined" ? __DEV__ : true;

export const Logger = {
  log(...args: unknown[]) {
    if (AI_DEBUG) console.log(...args);
  },

  warn(...args: unknown[]) {
    if (AI_DEBUG) console.warn(...args);
  },

  error(...args: unknown[]) {
    if (AI_DEBUG) console.error(...args);
  },

  info(...args: unknown[]) {
    if (AI_DEBUG) console.log(...args);
  },
};