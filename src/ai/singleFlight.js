export function createSingleFlightGuard() {
  let running = false;

  return {
    tryStart() {
      if (running) return false;
      running = true;
      return true;
    },
    finish() {
      running = false;
    },
    isRunning() {
      return running;
    },
  };
}
