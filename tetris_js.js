const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdCtx = holdCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

const COLS = 4;
const ROWS = 12;
const BLOCK_SIZE = 30;

const COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000'
};

const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]]
};

const WALL_KICKS = {
  JLSTZ: {
    '0->1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '1->0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1->2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '2->1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2->3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '3->2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3->0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '0->3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]]
  },
  I: {
    '0->1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1->0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1->2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2->1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2->3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3->2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3->0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0->3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]]
  }
};

let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
let score = 0;
let gameOver = false;
let currentPiece = null;
let nextPiece = null;
let holdPiece = null;
let canHold = true;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

let bag = [];
let clearingLines = [];
let clearAnimation = 0;

const keys = {
  a: false,
  d: false,
  k: false
};
let dasCounter = 0;
let dasDelay = 110;
let arrInterval = 0;

function shuffleBag() {
  const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

function getNextFromBag() {
  if (bag.length === 0) {
    bag = shuffleBag();
  }
  return bag.shift();
}

class Piece {
  constructor(type) {
    this.type = type;
    this.shape = SHAPES[type];
    this.color = COLORS[type];
    this.x = Math.floor(COLS / 2) - Math.floor(this.shape[0].length / 2);
    this.y = 0;
    this.rotation = 0;
  }
  
  rotate(dir) {
    const oldRotation = this.rotation;
    const oldShape = this.shape;
    this.rotation = (this.rotation + dir + 4) % 4;
    this.shape = this.getRotatedShape();
    
    if (this.type === 'O') {
      return true;
    }
    
    const kickData = this.type === 'I' ? WALL_KICKS.I : WALL_KICKS.JLSTZ;
    const kickKey = `${oldRotation}->${this.rotation}`;
    const kicks = kickData[kickKey] || [[0,0]];
    
    for (let [dx, dy] of kicks) {
      this.x += dx;
      this.y += dy;
      if (!this.collides()) {
        return true;
      }
      this.x -= dx;
      this.y -= dy;
    }
    
    this.rotation = oldRotation;
    this.shape = oldShape;
    return false;
  }
  
  rotate180() {
    this.rotate(2);
  }
  
  getRotatedShape() {
    const original = SHAPES[this.type];
    const n = original.length;
    const rotated = Array(n).fill().map(() => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (this.rotation === 1) {
          rotated[x][n-1-y] = original[y][x];
        } else if (this.rotation === 2) {
          rotated[n-1-y][n-1-x] = original[y][x];
        } else if (this.rotation === 3) {
          rotated[n-1-x][y] = original[y][x];
        } else {
          rotated[y][x] = original[y][x];
        }
      }
    }
    return rotated;
  }
  
  move(dx, dy) {
    this.x += dx;
    this.y += dy;
    if (this.collides()) {
      this.x -= dx;
      this.y -= dy;
      return false;
    }
    return true;
  }
  
  collides(shape = this.shape) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newX = this.x + x;
          const newY = this.y + y;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          if (newY >= 0 && board[newY][newX]) return true;
        }
      }
    }
    return false;
  }
  
  hardDrop() {
    while (this.move(0, 1));
    return true;
  }
}

function getRandomPiece() {
  return new Piece(getNextFromBag());
}

// 立体的なブロック描画
function drawBlock(ctx, x, y, color) {
  const size = BLOCK_SIZE;
  const px = x * size;
  const py = y * size;
  
  // メインカラー
  ctx.fillStyle = color;
  ctx.fillRect(px, py, size, size);
  
  // ハイライト（左上）
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + size * 0.2, py + size * 0.2);
  ctx.lineTo(px + size * 0.2, py + size * 0.8);
  ctx.lineTo(px, py + size);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + size * 0.2, py + size * 0.2);
  ctx.lineTo(px + size * 0.8, py + size * 0.2);
  ctx.lineTo(px + size, py);
  ctx.closePath();
  ctx.fill();
  
  // シャドウ（右下）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.moveTo(px + size, py);
  ctx.lineTo(px + size * 0.8, py + size * 0.2);
  ctx.lineTo(px + size * 0.8, py + size * 0.8);
  ctx.lineTo(px + size, py + size);
  ctx.closePath();
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(px, py + size);
  ctx.lineTo(px + size * 0.2, py + size * 0.8);
  ctx.lineTo(px + size * 0.8, py + size * 0.8);
  ctx.lineTo(px + size, py + size);
  ctx.closePath();
  ctx.fill();
  
  // 枠線
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, size, size);
}

function drawBoard() {
  ctx.fillStyle = '#0f3460';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) {
        // ライン消去アニメーション
        if (clearingLines.includes(y)) {
          const alpha = 1 - clearAnimation;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(canvas.width / 2, (y + 0.5) * BLOCK_SIZE);
          ctx.scale(1, 1 - clearAnimation);
          ctx.translate(-canvas.width / 2, -(y + 0.5) * BLOCK_SIZE);
          drawBlock(ctx, x, y, board[y][x]);
          ctx.restore();
          
          // フラッシュエフェクト
          if (clearAnimation < 0.5) {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 - clearAnimation})`;
            ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
          }
        } else {
          drawBlock(ctx, x, y, board[y][x]);
        }
      }
    }
  }
}

function drawPiece(piece, context = ctx, offsetX = 0, offsetY = 0) {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        drawBlock(context, piece.x + x + offsetX, piece.y + y + offsetY, piece.color);
      }
    }
  }
}

function drawHold() {
  holdCtx.fillStyle = '#0f3460';
  holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (holdPiece) {
    const tempPiece = new Piece(holdPiece);
    tempPiece.x = 1;
    tempPiece.y = 1;
    for (let y = 0; y < tempPiece.shape.length; y++) {
      for (let x = 0; x < tempPiece.shape[y].length; x++) {
        if (tempPiece.shape[y][x]) {
          const size = 20;
          const px = (tempPiece.x + x) * size;
          const py = (tempPiece.y + y) * size;
          
          holdCtx.fillStyle = tempPiece.color;
          holdCtx.fillRect(px, py, size, size);
          
          holdCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          holdCtx.fillRect(px, py, size * 0.3, size);
          holdCtx.fillRect(px, py, size, size * 0.3);
          
          holdCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          holdCtx.fillRect(px + size * 0.7, py, size * 0.3, size);
          holdCtx.fillRect(px, py + size * 0.7, size, size * 0.3);
          
          holdCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
          holdCtx.strokeRect(px, py, size, size);
        }
      }
    }
  }
}

function drawNext() {
  nextCtx.fillStyle = '#0f3460';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (nextPiece) {
    const tempPiece = new Piece(nextPiece.type);
    tempPiece.x = 1;
    tempPiece.y = 1;
    for (let y = 0; y < tempPiece.shape.length; y++) {
      for (let x = 0; x < tempPiece.shape[y].length; x++) {
        if (tempPiece.shape[y][x]) {
          const size = 20;
          const px = (tempPiece.x + x) * size;
          const py = (tempPiece.y + y) * size;
          
          nextCtx.fillStyle = tempPiece.color;
          nextCtx.fillRect(px, py, size, size);
          
          nextCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          nextCtx.fillRect(px, py, size * 0.3, size);
          nextCtx.fillRect(px, py, size, size * 0.3);
          
          nextCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          nextCtx.fillRect(px + size * 0.7, py, size * 0.3, size);
          nextCtx.fillRect(px, py + size * 0.7, size, size * 0.3);
          
          nextCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
          nextCtx.strokeRect(px, py, size, size);
        }
      }
    }
  }
}

function merge() {
  for (let y = 0; y < currentPiece.shape.length; y++) {
    for (let x = 0; x < currentPiece.shape[y].length; x++) {
      if (currentPiece.shape[y][x]) {
        if (currentPiece.y + y < 0) {
          gameOver = true;
          document.getElementById('gameOver').style.display = 'block';
          return;
        }
        board[currentPiece.y + y][currentPiece.x + x] = currentPiece.color;
      }
    }
  }
  clearLines();
}

function clearLines() {
  const linesToClear = [];
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== 0)) {
      linesToClear.push(y);
    }
  }
  
  if (linesToClear.length > 0) {
    clearingLines = linesToClear;
    clearAnimation = 0;
    setTimeout(() => {
      for (let y of linesToClear) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
      }
      clearingLines = [];
      score += [0, 100, 300, 500, 800][linesToClear.length];
      document.getElementById('score').textContent = score;
      spawnPiece();
    }, 300);
  } else {
    spawnPiece();
  }
}

function spawnPiece() {
  currentPiece = nextPiece;
  nextPiece = getRandomPiece();
  canHold = true;
  drawNext();
  
  if (currentPiece && currentPiece.collides()) {
    gameOver = true;
    document.getElementById('gameOver').style.display = 'block';
  }
}

function hold() {
  if (!canHold) return;
  
  if (holdPiece === null) {
    holdPiece = currentPiece.type;
    spawnPiece();
  } else {
    const temp = holdPiece;
    holdPiece = currentPiece.type;
    currentPiece = new Piece(temp);
  }
  canHold = false;
  drawHold();
}

function update(time = 0) {
  if (gameOver) return;
  
  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;
  
  // ライン消去アニメーション更新
  if (clearingLines.length > 0) {
    clearAnimation += deltaTime / 300;
    if (clearAnimation > 1) clearAnimation = 1;
  }
  
  if (dropCounter > dropInterval && clearingLines.length === 0) {
    if (currentPiece && !currentPiece.move(0, 1)) {
      merge();
    }
    dropCounter = 0;
  }
  
  // DAS処理
  if (keys.a && dasCounter >= dasDelay) {
    while (currentPiece && currentPiece.move(-1, 0));
  } else if (keys.a) {
    dasCounter += deltaTime;
  }
  
  if (keys.d && dasCounter >= dasDelay) {
    while (currentPiece && currentPiece.move(1, 0));
  } else if (keys.d) {
    dasCounter += deltaTime;
  }
  
  if (keys.k && currentPiece) {
    currentPiece.move(0, 1);
    dropCounter = 0;
  }
  
  draw();
  requestAnimationFrame(update);
}

function draw() {
  drawBoard();
  if (currentPiece && clearingLines.length === 0) {
    drawPiece(currentPiece);
  }
}

function restart() {
  board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  score = 0;
  document.getElementById('score').textContent = score;
  gameOver = false;
  document.getElementById('gameOver').style.display = 'none';
  holdPiece = null;
  canHold = true;
  dropCounter = 0;
  bag = [];
  clearingLines = [];
  clearAnimation = 0;
  nextPiece = getRandomPiece();
  spawnPiece();
  update();
}

document.addEventListener('keydown', e => {
  if (gameOver) return;
  
  const key = e.key.toLowerCase();
  
  if (key === 'a' && !keys.a) {
    keys.a = true;
    dasCounter = 0;
    if (currentPiece) currentPiece.move(-1, 0);
  } else if (key === 'd' && !keys.d) {
    keys.d = true;
    dasCounter = 0;
    if (currentPiece) currentPiece.move(1, 0);
  } else if (key === 'k') {
    keys.k = true;
  } else if (key === 'i' && !e.repeat) {
    if (currentPiece) {
      currentPiece.hardDrop();
      merge();
    }
  } else if (key === 'c' && !e.repeat) {
    hold();
  } else if (key === 'w' && !e.repeat) {
    if (currentPiece) currentPiece.rotate180();
  } else if (key === 'j' && !e.repeat) {
    if (currentPiece) currentPiece.rotate(-1);
  } else if (key === 'l' && !e.repeat) {
    if (currentPiece) currentPiece.rotate(1);
  }
  
  draw();
});

document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key === 'a') keys.a = false;
  if (key === 'd') keys.d = false;
  if (key === 'k') keys.k = false;
});

// グローバルに公開
const game = { restart };

bag = [];
nextPiece = getRandomPiece();
spawnPiece();
update();