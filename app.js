const board = document.getElementById("board");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("startButton");
const levelLabel = document.getElementById("levelLabel");
const moveCount = document.getElementById("moveCount");
const bestCount = document.getElementById("bestCount");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const undoButton = document.getElementById("undoButton");
const resetButton = document.getElementById("resetButton");
const nextButton = document.getElementById("nextButton");
const levelButtons = [...document.querySelectorAll(".level-button")];

const pieces = {
  ruby: { color: "#ff7680", icon: "R" },
  gold: { color: "#fff3bd", icon: "N" },
  mint: { color: "#5de0cb", icon: "B" },
  sky: { color: "#7fcdd8", icon: "Q" },
  violet: { color: "#b990ff", icon: "K" },
  ember: { color: "#ff7a45", icon: "P" },
  teal: { color: "#73ead9", icon: "C" },
  lime: { color: "#a9f071", icon: "G" }
};

const colorOrder = ["ruby", "gold", "mint", "sky", "violet", "ember", "teal", "lime"];

function rowEndpoints() {
  return Object.fromEntries(colorOrder.map((color, row) => [color, [[row, 0], [row, 7]]]));
}

function columnEndpoints() {
  return Object.fromEntries(colorOrder.map((color, col) => [color, [[0, col], [7, col]]]));
}

function mirroredRows() {
  return Object.fromEntries(colorOrder.map((color, row) => {
    const start = row % 2 === 0 ? [row, 0] : [row, 7];
    const end = row % 2 === 0 ? [row, 7] : [row, 0];
    return [color, [start, end]];
  }));
}

function mirroredColumns() {
  return Object.fromEntries(colorOrder.map((color, col) => {
    const start = col % 2 === 0 ? [0, col] : [7, col];
    const end = col % 2 === 0 ? [7, col] : [0, col];
    return [color, [start, end]];
  }));
}

const levels = [
  { name: "Filas reales", endpoints: rowEndpoints() },
  { name: "Columnas del castillo", endpoints: columnEndpoints() },
  { name: "Ataque lateral", endpoints: mirroredRows() },
  { name: "Torres alternas", endpoints: mirroredColumns() },
  { name: "Corona final", endpoints: rowEndpoints() }
];

let levelIndex = 0;
let paths = {};
let history = [];
let activeColor = null;
let activePath = [];
let moves = 0;
let isDrawing = false;

function key(row, col) {
  return `${row},${col}`;
}

function sameCell(a, b) {
  return a && b && a[0] === b[0] && a[1] === b[1];
}

function endpointColor(row, col) {
  const endpoints = levels[levelIndex].endpoints;
  return Object.keys(endpoints).find((color) =>
    endpoints[color].some((point) => sameCell(point, [row, col]))
  );
}

function cellOwner(row, col) {
  const cellKey = key(row, col);
  return Object.keys(paths).find((color) => paths[color].some((point) => key(point[0], point[1]) === cellKey));
}

function isAdjacent(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

function bestKey() {
  return `conectagoblin-best-${levelIndex}`;
}

function saveBest() {
  const currentBest = Number(localStorage.getItem(bestKey()) || 0);
  if (!currentBest || moves < currentBest) {
    localStorage.setItem(bestKey(), String(moves));
  }
}

function loadBest() {
  bestCount.textContent = localStorage.getItem(bestKey()) || "0";
}

function setStatus(title, text) {
  statusTitle.textContent = title;
  statusText.textContent = text;
}

function renderBoard() {
  board.innerHTML = "";
  const endpoints = levels[levelIndex].endpoints;
  const segmentMap = new Map();

  Object.entries(paths).forEach(([color, path]) => {
    path.forEach((point, index) => {
      const dirs = [];
      const previous = path[index - 1];
      const next = path[index + 1];
      [previous, next].filter(Boolean).forEach((other) => {
        if (other[0] < point[0]) dirs.push("up");
        if (other[0] > point[0]) dirs.push("down");
        if (other[1] < point[1]) dirs.push("left");
        if (other[1] > point[1]) dirs.push("right");
      });
      segmentMap.set(key(point[0], point[1]), { color, dirs });
    });
  });

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const cell = document.createElement("div");
      const cellKey = key(row, col);
      const segment = segmentMap.get(cellKey);
      cell.className = `cell ${(row + col) % 2 ? "dark" : "light"}`;
      cell.dataset.row = row;
      cell.dataset.col = col;

      if (segment) {
        cell.classList.add("connected", ...segment.dirs);
        cell.style.setProperty("--path-color", pieces[segment.color].color);
      }

      const color = Object.keys(endpoints).find((name) =>
        endpoints[name].some((point) => sameCell(point, [row, col]))
      );

      if (color) {
        const piece = document.createElement("div");
        piece.className = "piece";
        piece.dataset.piece = pieces[color].icon;
        piece.style.setProperty("--piece-color", pieces[color].color);
        cell.appendChild(piece);
      }

      board.appendChild(cell);
    }
  }
}

function refreshHud() {
  levelLabel.textContent = String(levelIndex + 1);
  moveCount.textContent = String(moves);
  loadBest();
  levelButtons.forEach((button, index) => button.classList.toggle("active", index === levelIndex));
}

function startLevel(index) {
  levelIndex = index;
  paths = {};
  history = [];
  activeColor = null;
  activePath = [];
  moves = 0;
  isDrawing = false;
  setStatus(levels[levelIndex].name, "Une cada pareja y ocupa las 64 casillas.");
  refreshHud();
  renderBoard();
}

function clearColor(color) {
  if (paths[color]) {
    delete paths[color];
  }
}

function canUseCell(row, col, color) {
  const owner = cellOwner(row, col);
  const endpoint = endpointColor(row, col);
  if (owner && owner !== color) return false;
  if (endpoint && endpoint !== color) return false;
  return true;
}

function beginPath(row, col) {
  const color = endpointColor(row, col);
  if (!color) return;
  history.push(JSON.stringify({ paths, moves }));
  clearColor(color);
  activeColor = color;
  activePath = [[row, col]];
  paths[activeColor] = [...activePath];
  isDrawing = true;
  setStatus("Camino activo", "Arrastra por casillas vecinas hasta la pieza igual.");
  renderBoard();
}

function trimLoop(row, col) {
  const existing = activePath.findIndex((point) => point[0] === row && point[1] === col);
  if (existing >= 0) {
    activePath = activePath.slice(0, existing + 1);
    return true;
  }
  return false;
}

function extendPath(row, col) {
  if (!isDrawing || !activeColor) return;
  const next = [row, col];
  const last = activePath[activePath.length - 1];
  if (sameCell(last, next)) return;
  if (!isAdjacent(last, next)) return;
  if (trimLoop(row, col)) {
    paths[activeColor] = [...activePath];
    renderBoard();
    return;
  }
  if (!canUseCell(row, col, activeColor)) {
    setStatus("Casilla ocupada", "Ese camino chocaria con otra pieza o linea.");
    return;
  }
  activePath.push(next);
  paths[activeColor] = [...activePath];
  renderBoard();
}

function finishPath() {
  if (!isDrawing || !activeColor) return;
  const endpoints = levels[levelIndex].endpoints[activeColor];
  const last = activePath[activePath.length - 1];
  const completed = endpoints.some((point) => sameCell(point, last)) && activePath.length > 1;

  if (!completed) {
    delete paths[activeColor];
    setStatus("Camino incompleto", "Termina siempre en la pieza del mismo color.");
  } else {
    moves += 1;
    setStatus("Bien conectado", "Sigue hasta llenar el tablero completo.");
  }

  activeColor = null;
  activePath = [];
  isDrawing = false;
  refreshHud();
  renderBoard();
  checkWin();
}

function checkWin() {
  const colors = Object.keys(levels[levelIndex].endpoints);
  const allConnected = colors.every((color) => {
    const path = paths[color] || [];
    const endpoints = levels[levelIndex].endpoints[color];
    return path.length > 1 && endpoints.every((endpoint) => path.some((point) => sameCell(point, endpoint)));
  });
  const filled = new Set();
  Object.values(paths).forEach((path) => path.forEach((point) => filled.add(key(point[0], point[1]))));

  if (allConnected && filled.size === 64) {
    saveBest();
    refreshHud();
    setStatus("Nivel completado", "Goblinajedrez corona el tablero. Pasa al siguiente reto.");
  } else if (allConnected) {
    setStatus("Faltan casillas", "Todas las parejas estan unidas, pero el tablero debe quedar lleno.");
  }
}

function pointerCell(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const cell = target?.closest?.(".cell");
  if (!cell || !board.contains(cell)) return null;
  return [Number(cell.dataset.row), Number(cell.dataset.col)];
}

board.addEventListener("pointerdown", (event) => {
  const cell = pointerCell(event);
  if (!cell) return;
  overlay.classList.add("hidden");
  board.setPointerCapture(event.pointerId);
  beginPath(cell[0], cell[1]);
});

board.addEventListener("pointermove", (event) => {
  const cell = pointerCell(event);
  if (!cell) return;
  extendPath(cell[0], cell[1]);
});

board.addEventListener("pointerup", finishPath);
board.addEventListener("pointercancel", finishPath);

startButton.addEventListener("click", () => {
  overlay.classList.add("hidden");
});

undoButton.addEventListener("click", () => {
  const last = history.pop();
  if (!last) return;
  const state = JSON.parse(last);
  paths = state.paths;
  moves = state.moves;
  activeColor = null;
  activePath = [];
  isDrawing = false;
  setStatus("Deshecho", "Puedes probar otra ruta.");
  refreshHud();
  renderBoard();
});

resetButton.addEventListener("click", () => startLevel(levelIndex));
nextButton.addEventListener("click", () => startLevel((levelIndex + 1) % levels.length));
levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    overlay.classList.add("hidden");
    startLevel(Number(button.dataset.level));
  });
});

startLevel(0);
