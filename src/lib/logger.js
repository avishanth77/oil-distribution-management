// Console output is silenced in production builds. Supabase error messages can
// disclose schema details, so they are not shipped to end users.
const isDev = Boolean(import.meta.env?.DEV);

const safeLog = (level, ...args) => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console[level](...args);
  }
};

export const logError = (...args) => safeLog('error', ...args);
export const logWarn = (...args) => safeLog('warn', ...args);
