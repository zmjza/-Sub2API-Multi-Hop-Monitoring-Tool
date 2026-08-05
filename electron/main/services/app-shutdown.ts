export interface QuitEventLike {
  preventDefault(): void;
}

export function createAsyncQuitHandler(
  cleanup: () => Promise<void>,
  quit: () => void,
): (event: QuitEventLike) => void {
  let started = false;
  return (event) => {
    if (started) return;
    started = true;
    event.preventDefault();
    void cleanup().finally(quit);
  };
}
