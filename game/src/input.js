// Keyboard and mouse state, read once per frame by the world. Keys are
// tracked by their code so WASD and the arrow keys both steer the ship.
// The mouse aims: its position is kept in canvas coordinates.
export function createInput(canvas) {
  const keys = new Set();
  // Menu-key edges, recorded at the event: a quick tap counts even if it
  // falls between two frames, and an edge older than half a second is
  // stale (so a press from one screen never fires on a later screen).
  const pressedAt = new Map();
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    dash: false,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    // Single-frame edges: consumed by the loop after it reads them.
    pressedDash: false,
    clicked: false,
  };

  function updateDerived() {
    input.up = keys.has('KeyW') || keys.has('ArrowUp');
    input.down = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.fire = keys.has('Space') || input.mouseDown;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    pressedAt.set(event.code, performance.now());
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.pressedDash = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    updateDerived();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    updateDerived();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    input.mouseDown = false;
    updateDerived();
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouseDown = true;
      input.clicked = true;
    }
    if (event.button === 2) input.pressedDash = true;
    updateDerived();
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
    updateDerived();
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // True while the key is held, for menu shortcuts (P, R, M, Enter).
  input.isDown = (code) => keys.has(code);

  // True once per press, for menu shortcuts: consumes the recorded edge.
  input.consumePress = (code) => {
    const at = pressedAt.get(code);
    if (at == null) return false;
    pressedAt.delete(code);
    return performance.now() - at < 500;
  };

  return input;
}
