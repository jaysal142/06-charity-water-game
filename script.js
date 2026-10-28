// DRIP - merge water tiles into wells

const SIZE = 4;
const DIRTY = -1; // contaminant tile
const WELL = 6;

// tier number = index in this array (0 means empty)
const tiers = [
  null,
  { name: "Drop", icon: "💧", points: 2 },
  { name: "Cup", icon: "🥤", points: 4 },
  { name: "Bucket", icon: "🪣", points: 8 },
  { name: "Jerry Can", icon: "🟨", points: 16 },
  { name: "Tank", icon: "🛢️", points: 32 },
  { name: "Well", icon: "⛲", points: 64 },
];

let grid = [];
let score = 0;
let best = getBest();
let communities = 0;
let moves = 0;
let dirtyCountdown = 5;
let seconds = 0;
let timer;
let playing = false;

const startScreen = document.getElementById("start-screen");
const howScreen = document.getElementById("how-screen");
const gameScreen = document.getElementById("game-screen");
const endScreen = document.getElementById("end-screen");
const board = document.getElementById("board");
const feedback = document.getElementById("feedback");

// buttons
document.getElementById("play-btn").addEventListener("click", startGame);
document.getElementById("how-start-btn").addEventListener("click", startGame);
document.getElementById("reset-btn").addEventListener("click", startGame);
document.getElementById("play-again-btn").addEventListener("click", startGame);
document.getElementById("menu-btn").addEventListener("click", goToMenu);
document.getElementById("end-menu-btn").addEventListener("click", goToMenu);
document.getElementById("how-btn").addEventListener("click", function () {
  showScreen(howScreen);
});

const arrowButtons = document.querySelectorAll(".arrow-btn");
for (let i = 0; i < arrowButtons.length; i++) {
  arrowButtons[i].addEventListener("click", function () {
    move(arrowButtons[i].dataset.dir);
  });
}

// arrow keys
document.addEventListener("keydown", function (e) {
  if (!playing) return;

  if (e.key === "ArrowUp") move("up");
  else if (e.key === "ArrowDown") move("down");
  else if (e.key === "ArrowLeft") move("left");
  else if (e.key === "ArrowRight") move("right");
  else return;

  e.preventDefault(); // so the page doesn't scroll
});

// swiping on phones
let touchX = 0;
let touchY = 0;

board.addEventListener("pointerdown", function (e) {
  touchX = e.clientX;
  touchY = e.clientY;
});

board.addEventListener("pointerup", function (e) {
  let dx = e.clientX - touchX;
  let dy = e.clientY - touchY;

  // ignore tiny swipes
  if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) move("right");
    else move("left");
  } else {
    if (dy > 0) move("down");
    else move("up");
  }
});

showChain();

function showScreen(screen) {
  startScreen.hidden = true;
  howScreen.hidden = true;
  gameScreen.hidden = true;
  endScreen.hidden = true;
  screen.hidden = false;
}

function goToMenu() {
  playing = false;
  clearInterval(timer);
  showScreen(startScreen);
}

function startGame() {
  // empty 4x4 board
  grid = [];
  for (let r = 0; r < SIZE; r++) {
    grid.push([0, 0, 0, 0]);
  }

  score = 0;
  communities = 0;
  moves = 0;
  dirtyCountdown = 5;
  seconds = 0;
  playing = true;
  document.getElementById("time").textContent = "0:00";

  addTile(1);
  addTile(1);

  clearInterval(timer);
  timer = setInterval(updateTimer, 1000);

  showMessage("Swipe to start merging!");
  updateStats();
  drawBoard();
  showScreen(gameScreen);
}

function updateTimer() {
  seconds++;
  let mins = Math.floor(seconds / 60);
  let secs = seconds % 60;
  if (secs < 10) secs = "0" + secs;
  document.getElementById("time").textContent = mins + ":" + secs;
}

// puts a tile in a random empty spot
function addTile(value) {
  let emptySpots = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) {
        emptySpots.push([r, c]);
      }
    }
  }

  if (emptySpots.length === 0) return;

  let spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
  grid[spot[0]][spot[1]] = value;
}

// gets the rows/columns for a direction, ordered so tiles
// slide toward the start of each line
function getLines(dir) {
  let lines = [];
  for (let i = 0; i < SIZE; i++) {
    let line = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === "left") line.push([i, j]);
      if (dir === "right") line.push([i, SIZE - 1 - j]);
      if (dir === "up") line.push([j, i]);
      if (dir === "down") line.push([SIZE - 1 - j, i]);
    }
    lines.push(line);
  }
  return lines;
}

// slides one line and merges matching tiles
// contaminants move but can't merge
function slideLine(values) {
  let tiles = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== 0) tiles.push(values[i]);
  }

  let result = [];
  let mergedAt = []; // spots where a merge happened
  let points = 0;
  let wells = 0;

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] > 0 && tiles[i] === tiles[i + 1]) {
      let newTier = tiles[i] + 1;
      mergedAt.push(result.length);
      points += tiers[newTier].points;

      if (newTier === WELL) {
        wells++; // wells leave the board
      } else {
        result.push(newTier);
      }
      i++; // skip the tile we merged with
    } else {
      result.push(tiles[i]);
    }
  }

  while (result.length < SIZE) {
    result.push(0);
  }

  return { result: result, mergedAt: mergedAt, points: points, wells: wells };
}

function move(dir) {
  if (!playing) return;

  let moved = false;
  let newWells = 0;
  let mergeSpots = [];
  let lines = getLines(dir);

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let values = [];
    for (let j = 0; j < line.length; j++) {
      values.push(grid[line[j][0]][line[j][1]]);
    }

    let slid = slideLine(values);

    for (let j = 0; j < line.length; j++) {
      let r = line[j][0];
      let c = line[j][1];
      if (grid[r][c] !== slid.result[j]) moved = true;
      grid[r][c] = slid.result[j];
    }

    for (let j = 0; j < slid.mergedAt.length; j++) {
      mergeSpots.push(line[slid.mergedAt[j]]);
    }

    score += slid.points;
    newWells += slid.wells;
  }

  // nothing moved so don't count it
  if (!moved) return;

  moves++;
  let message = "";

  if (newWells > 0) {
    communities += newWells;
    message = "Well built! Community " + communities + " served";
    confetti();
  }

  if (cleanDirtyTiles(mergeSpots) > 0 && message === "") {
    message = "Contaminant washed away! 🧼";
  }

  dirtyCountdown--;
  if (dirtyCountdown <= 0) {
    addTile(DIRTY);
    score -= 20;
    if (score < 0) score = 0;
    message = "Contaminant appeared! -20";

    // they show up faster the longer you play (min every 3 moves)
    dirtyCountdown = 7 - Math.floor(moves / 25);
    if (dirtyCountdown < 3) dirtyCountdown = 3;
  } else {
    // mostly drops, sometimes a cup
    if (Math.random() < 0.85) addTile(1);
    else addTile(2);
  }

  if (message !== "") showMessage(message);
  updateStats();
  drawBoard();

  if (!canMove()) {
    gameOver();
  }
}

// removes contaminants touching a merge (not diagonal)
function cleanDirtyTiles(spots) {
  let cleaned = 0;
  for (let i = 0; i < spots.length; i++) {
    let r = spots[i][0];
    let c = spots[i][1];
    let neighbors = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];

    for (let j = 0; j < neighbors.length; j++) {
      let nr = neighbors[j][0];
      let nc = neighbors[j][1];
      if (grid[nr] && grid[nr][nc] === DIRTY) {
        grid[nr][nc] = 0;
        cleaned++;
      }
    }
  }
  return cleaned;
}

// can still move if there's an empty spot or two matching tiles side by side
function canMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      let tile = grid[r][c];
      if (tile === 0) return true;
      if (tile > 0 && tile === grid[r][c + 1]) return true;
      if (tile > 0 && r < SIZE - 1 && tile === grid[r + 1][c]) return true;
    }
  }
  return false;
}

function gameOver() {
  playing = false;
  clearInterval(timer);
  document.getElementById("end-communities").textContent = communities;
  document.getElementById("end-score").textContent = score.toLocaleString();
  document.getElementById("end-best").textContent = best.toLocaleString();

  // wait a sec so you can see the full board
  setTimeout(function () {
    showScreen(endScreen);
  }, 800);
}

function updateStats() {
  if (score > best) {
    best = score;
    saveBest(best);
  }
  document.getElementById("score").textContent = score.toLocaleString();
  document.getElementById("best").textContent = best.toLocaleString();
  document.getElementById("communities").textContent = communities;
  document.getElementById("contam-count").textContent = dirtyCountdown;
}

function drawBoard() {
  board.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      let tile = grid[r][c];
      let div = document.createElement("div");

      if (tile === DIRTY) {
        div.className = "tile contaminant";
        div.innerHTML = '<span class="tile-icon">⚠️</span><span>Dirty</span>';
      } else if (tile > 0) {
        div.className = "tile tier-" + tile;
        div.innerHTML =
          '<span class="tile-icon">' +
          tiers[tile].icon +
          "</span><span>" +
          tiers[tile].name +
          "</span>";
      } else {
        div.className = "tile empty";
      }

      board.appendChild(div);
    }
  }
}

function showMessage(text) {
  feedback.textContent = text;
  // restart the pop animation
  feedback.classList.remove("pop");
  void feedback.offsetWidth;
  feedback.classList.add("pop");
}

// fills in the water chain on the how to play page and next to the board
function showChain() {
  let row = document.getElementById("chain-row");
  let list = document.getElementById("chain-list");

  for (let t = 1; t < tiers.length; t++) {
    let tier = tiers[t];

    let box = document.createElement("div");
    box.className = "tile tier-" + t;
    box.innerHTML =
      '<span class="tile-icon">' +
      tier.icon +
      "</span><span>" +
      tier.name +
      "</span>";
    row.appendChild(box);

    let item = document.createElement("li");
    item.className = "tier-" + t;
    let detail = tier.points + " pts";
    if (t === WELL) detail = "Serves a community";
    item.innerHTML =
      tier.icon +
      " <strong>" +
      tier.name +
      "</strong> <small>" +
      detail +
      "</small>";
    list.appendChild(item);
  }
}

// best score saved in localStorage
function getBest() {
  try {
    return Number(localStorage.getItem("dripBest")) || 0;
  } catch (err) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem("dripBest", value);
  } catch (err) {
    console.log("couldn't save best score");
  }
}

function confetti() {
  let colors = ["#ffc907", "#003366", "#77a8bb", "#bf6c46", "#fed8c1"];

  for (let i = 0; i < 80; i++) {
    let piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.backgroundColor =
      colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = 2 + Math.random() * 2 + "s";
    piece.style.animationDelay = Math.random() * 0.5 + "s";
    piece.addEventListener("animationend", function () {
      piece.remove();
    });
    document.body.appendChild(piece);
  }
}
