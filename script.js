// DRIP - merge water tiles up the chain to serve communities

const SIZE = 4;
const CONTAMINANT = -1; // contaminant tile value

// difficulty settings (numbers come from the balance tests)
const difficulty = {
  easy: { waterTower: false, spreadEvery: 20, contamMin: 3 },
  normal: { waterTower: true, spreadEvery: 10, contamMin: 4 },
  hard: { waterTower: true, spreadEvery: 6, contamMin: 4 },
};

// flat, single-color icons (brand book: no gradients or shadows).
// they use currentColor, so each tile's CSS color sets the icon color
const icons = {
  drop: '<path fill="currentColor" d="M12 2.6c-.3 0-.5.1-.7.4C9.2 5.8 5.5 10.5 5.5 14.5a6.5 6.5 0 0 0 13 0c0-4-3.7-8.7-5.8-11.5-.2-.3-.4-.4-.7-.4z"/>',
  cup: '<path fill="currentColor" d="M4.5 3h15l-1.8 16.3A2 2 0 0 1 15.7 21H8.3a2 2 0 0 1-2-1.7L4.5 3zm2.3 2 .4 4h9.6l.4-4H6.8z" fill-rule="evenodd"/>',
  bucket: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6.5 10a5.5 5.5 0 0 1 11 0"/><path fill="currentColor" d="M3.5 9.5h17l-2 10.2a1.6 1.6 0 0 1-1.6 1.3H7.1a1.6 1.6 0 0 1-1.6-1.3l-2-10.2z"/>',
  tank: '<path fill="currentColor" fill-rule="evenodd" d="M4 6c0-1.9 3.6-3.2 8-3.2s8 1.3 8 3.2v12c0 1.9-3.6 3.2-8 3.2s-8-1.3-8-3.2V6zm8 1.4c3.2 0 5.4-.7 5.4-1.4S15.2 4.6 12 4.6 6.6 5.3 6.6 6s2.2 1.4 5.4 1.4zM4 11.4h16v1.2H4z"/>',
  well: '<path fill="currentColor" d="M2.5 9 12 3.5 21.5 9h-19zM5.5 9h1.8v6H5.5zm11.2 0h1.8v6h-1.8zM7.3 10.4h9.4v1.2H7.3zm4.1 1.2h1.2v2.2h-1.2zM3.5 15h17v6h-17z"/>',
  tower: '<path fill="currentColor" d="M5.5 7.5a6.5 3 0 0 1 13 0v4h-13z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M8 11.5 6 21M16 11.5l2 9.5M12 11.5V21M7.2 16.5h9.6"/>',
  contaminant: '<path fill="currentColor" fill-rule="evenodd" d="M12 2.5 1.5 21h21L12 2.5zM11 9h2v6.5h-2zm0 8h2v2h-2z"/>',
};

// every possible tier, lowest to highest.
// buildTiers() copies the ones the current mode uses into `tiers`
const allTiers = [
  { name: "Drop", svg: icons.drop, css: "tier-drop" },
  { name: "Cup", svg: icons.cup, css: "tier-cup" },
  { name: "Bucket", svg: icons.bucket, css: "tier-bucket" },
  { name: "Jerry Can", img: "img/jerry-can-icon.png", css: "tier-jerry" },
  { name: "Tank", svg: icons.tank, css: "tier-tank" },
  { name: "Well", svg: icons.well, css: "tier-well" },
  { name: "Water Tower", svg: icons.tower, css: "tier-tower" },
];

// milestone messages (LevelUp): shown once each game when communities served reaches `at`
const milestones = [
  { at: 1, text: "First community served! Every drop adds up." },
  { at: 3, text: "3 communities served. You're making waves!" },
  { at: 5, text: "5 communities! Water changes everything." },
  { at: 10, text: "10 communities served. Your impact is growing!" },
  { at: 20, text: "20 communities! You're a clean water champion." },
];

// sound effects (LevelUp): put these files in a sounds/ folder
const sounds = {
  merge: "sounds/merge.mp3",
  served: "sounds/served.mp3",
  contaminant: "sounds/contaminant.mp3",
  gameOver: "sounds/game-over.mp3",
};

let mode = "easy"; // matches the button marked "selected" in index.html
let settings = difficulty[mode];
let tiers = []; // tier number = index in this array (0 means empty)
let topTier = 0; // highest tier; building one serves a community
let grid = [];
let score = 0;
let best = getBest();
let communities = 0;
let moves = 0;
let contamCountdown = 5;
let seconds = 0;
let timer;
let playing = false;
let endTimeout;
let nextMilestone = 0; // index of the next milestone to reach
let soundOn = getSoundSetting();

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

const soundButton = document.getElementById("sound-btn");
soundButton.addEventListener("click", function () {
  soundOn = !soundOn;
  saveSoundSetting(soundOn);
  updateSoundButton();
});
updateSoundButton();

// difficulty buttons
const modeButtons = document.querySelectorAll(".mode-btn");
for (let i = 0; i < modeButtons.length; i++) {
  modeButtons[i].addEventListener("click", function () {
    setMode(modeButtons[i].dataset.mode);
  });
}

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

showSpreadNumbers();
setMode(mode);

// switches difficulty and updates everything that depends on it
function setMode(newMode) {
  mode = newMode;
  settings = difficulty[mode];

  for (let i = 0; i < modeButtons.length; i++) {
    let isSelected = modeButtons[i].dataset.mode === mode;
    modeButtons[i].classList.toggle("selected", isSelected);
    modeButtons[i].setAttribute("aria-pressed", isSelected);
  }

  buildTiers();
  showChain();
  updateTierText();
}

function buildTiers() {
  let list = allTiers.filter(function (t) {
    return settings.waterTower || t.name !== "Water Tower";
  });
  tiers = [null];
  for (let i = 0; i < list.length; i++) {
    tiers.push(Object.assign({}, list[i], { points: Math.pow(2, i + 1) }));
  }
  topTier = tiers.length - 1;
}

// fills in text that changes with the mode (tier names, mode name)
function updateTierText() {
  setAllText(".top-tier-name", tiers[topTier].name);
  setAllText(".pre-top-name", tiers[topTier - 1].name);
  setAllText(".mode-name", mode.toUpperCase());
}

// fills in the spread numbers on the How to Play screen from the settings
function showSpreadNumbers() {
  let spans = document.querySelectorAll("[data-spread]");
  for (let i = 0; i < spans.length; i++) {
    spans[i].textContent = difficulty[spans[i].dataset.spread].spreadEvery;
  }
}

function setAllText(selector, text) {
  let elements = document.querySelectorAll(selector);
  for (let i = 0; i < elements.length; i++) {
    elements[i].textContent = text;
  }
}

// image icon if the tier has one, otherwise its flat SVG icon
function tileIcon(tier) {
  if (tier.img) {
    return '<img class="tile-img" src="' + tier.img + '" alt="">';
  }
  return svgIcon(tier.svg);
}

function svgIcon(paths) {
  return (
    '<svg class="tile-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    paths +
    "</svg>"
  );
}

function showScreen(screen) {
  startScreen.hidden = true;
  howScreen.hidden = true;
  gameScreen.hidden = true;
  endScreen.hidden = true;
  screen.hidden = false;
}

function goToMenu() {
  clearTimeout(endTimeout);
  playing = false;
  clearInterval(timer);
  showScreen(startScreen);
}

function startGame() {
  clearTimeout(endTimeout);
  buildTiers();
  showChain();
  best = getBest();

  // empty 4x4 board
  grid = [];
  for (let r = 0; r < SIZE; r++) {
    grid.push([0, 0, 0, 0]);
  }

  score = 0;
  communities = 0;
  moves = 0;
  nextMilestone = 0;
  contamCountdown = 5;
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
  let served = 0; // top tiers built (each serves a community)

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] > 0 && tiles[i] === tiles[i + 1]) {
      let newTier = tiles[i] + 1;
      mergedAt.push(result.length);
      points += tiers[newTier].points;

      if (newTier === topTier) {
        served++; // the top tier leaves the board
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

  return { result: result, mergedAt: mergedAt, points: points, served: served };
}

function move(dir) {
  if (!playing) return;

  let moved = false;
  let newServed = 0;
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
    newServed += slid.served;
  }

  // nothing moved so don't count it
  if (!moved) return;

  moves++;
  let message = "";

  if (newServed > 0) {
    communities += newServed;
    message =
      tiers[topTier].name + " built! Community " + communities + " served";
    confetti();
    playSound("served");

    let milestone = checkMilestone();
    if (milestone !== "") message = milestone;
  } else if (mergeSpots.length > 0) {
    playSound("merge");
  }

  if (cleanContaminants(mergeSpots) > 0 && message === "") {
    message = "Contaminant washed away!";
  }

  if (
    moves % settings.spreadEvery === 0 &&
    spreadContaminants() > 0 &&
    message === ""
  ) {
    message = "Contamination is spreading!";
  }

  contamCountdown--;
  if (contamCountdown <= 0) {
    addTile(CONTAMINANT);
    playSound("contaminant");
    score -= 20;
    if (score < 0) score = 0;
    if (message === "") message = "Contaminant appeared! -20";

    // they show up faster the longer you play (never faster than contamMin)
    contamCountdown = 7 - Math.floor(moves / 25);
    if (contamCountdown < settings.contamMin) {
      contamCountdown = settings.contamMin;
    }
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
function cleanContaminants(spots) {
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
      if (grid[nr] && grid[nr][nc] === CONTAMINANT) {
        grid[nr][nc] = 0;
        cleaned++;
      }
    }
  }
  return cleaned;
}

// each contaminant spreads to one random empty neighbor (not diagonal)
function spreadContaminants() {
  let targets = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== CONTAMINANT) continue;
      let open = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ].filter(function (n) {
        return grid[n[0]] && grid[n[0]][n[1]] === 0;
      });
      if (open.length > 0) {
        targets.push(open[Math.floor(Math.random() * open.length)]);
      }
    }
  }
  // fill after looping so new contaminants don't spread again this turn
  for (let i = 0; i < targets.length; i++) {
    grid[targets[i][0]][targets[i][1]] = CONTAMINANT;
  }
  return targets.length;
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

// returns the milestone message if one was just reached, otherwise ""
function checkMilestone() {
  let text = "";
  while (
    nextMilestone < milestones.length &&
    communities >= milestones[nextMilestone].at
  ) {
    text = milestones[nextMilestone].text;
    nextMilestone++;
  }
  return text;
}

function playSound(name) {
  if (!soundOn) return;
  let audio = new Audio(sounds[name]);
  audio.volume = 0.4;
  let promise = audio.play();
  // play() fails quietly if the file is missing or the browser blocks it
  if (promise) promise.catch(function () {});
}

function updateSoundButton() {
  soundButton.textContent = soundOn ? "Sound: On" : "Sound: Off";
  soundButton.setAttribute("aria-pressed", soundOn);
}

function getSoundSetting() {
  try {
    return localStorage.getItem("dripSound") !== "off";
  } catch (err) {
    return true;
  }
}

function saveSoundSetting(on) {
  try {
    localStorage.setItem("dripSound", on ? "on" : "off");
  } catch (err) {
    console.log("couldn't save sound setting");
  }
}

function gameOver() {
  playing = false;
  clearInterval(timer);
  playSound("gameOver");
  document.getElementById("end-communities").textContent = communities;
  document.getElementById("end-communities-word").textContent =
    communities === 1 ? "community" : "communities";
  document.getElementById("end-score").textContent = score.toLocaleString();
  document.getElementById("end-best").textContent = best.toLocaleString();

  // wait a sec so you can see the full board
  endTimeout = setTimeout(function () {
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
  document.getElementById("contam-count").textContent = contamCountdown;
  document.getElementById("contam-unit").textContent =
    contamCountdown === 1 ? "move" : "moves";
}

// board tiles show only the icon; the name is kept for screen readers and hover
function drawBoard() {
  board.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      let tile = grid[r][c];
      let div = document.createElement("div");
      let name = "";

      if (tile === CONTAMINANT) {
        div.className = "tile contaminant";
        div.innerHTML = svgIcon(icons.contaminant);
        name = "Contaminant";
      } else if (tile > 0) {
        div.className = "tile " + tiers[tile].css;
        div.innerHTML = tileIcon(tiers[tile]);
        name = tiers[tile].name;
      } else {
        div.className = "tile empty";
      }

      if (name !== "") {
        div.setAttribute("role", "img");
        div.setAttribute("aria-label", name);
        div.title = name;
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

// fills in the water chain on the How to Play page and next to the board
function showChain() {
  let row = document.getElementById("chain-row");
  let list = document.getElementById("chain-list");
  row.innerHTML = "";
  list.innerHTML = "";
  row.style.setProperty("--chain-count", tiers.length - 1);

  for (let t = 1; t < tiers.length; t++) {
    let tier = tiers[t];

    let box = document.createElement("div");
    box.className = "tile " + tier.css;
    box.innerHTML = tileIcon(tier) + "<span>" + tier.name + "</span>";
    row.appendChild(box);

    let item = document.createElement("li");
    item.className = tier.css;
    let detail = tier.points + " pts";
    if (t === topTier) detail = "Serves a community";
    item.innerHTML =
      tileIcon(tier) +
      " <strong>" +
      tier.name +
      "</strong> <small>" +
      detail +
      "</small>";
    list.appendChild(item);
  }
}

// best score saved in localStorage, one per difficulty
function getBest() {
  try {
    return Number(localStorage.getItem("dripBest_" + mode)) || 0;
  } catch (err) {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem("dripBest_" + mode, value);
  } catch (err) {
    console.log("couldn't save best score");
  }
}

function confetti() {
  // charity: water primary and secondary brand colors
  let colors = ["#ffc907", "#2e9df7", "#8bd1cb", "#4fcb53", "#ff902a", "#f16061"];

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