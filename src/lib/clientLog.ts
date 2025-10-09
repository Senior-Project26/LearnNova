export async function clientLog(level: 'info' | 'warn' | 'error', message: string, context?: any) {
  try {
    await fetch('http://127.0.0.1:5050/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ level, message, context }),
    });
  } catch (e) {
    // As a fallback, still log to browser console
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log']('[CLIENT-LOG FAIL]', message, context);
  }
}
