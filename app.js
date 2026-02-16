const FILES = "abcdefgh";

const PIECE_GLYPHS = {
  w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

const boardEl = document.getElementById("board");
const statusTextEl = document.getElementById("statusText");
const resetBtn = document.getElementById("resetBtn");
const fxLayer = document.getElementById("fxLayer");
const intensityRangeEl = document.getElementById("intensityRange");
const intensityValueEl = document.getElementById("intensityValue");

let game = createInitialGame();
let selected = null;
let legalTargets = [];
let isAnimating = false;
let cinematicIntensity = 1;

function setCinematicIntensity(rawValue) {
  const value = Math.max(50, Math.min(180, Number(rawValue) || 100));
  cinematicIntensity = value / 100;
  if (intensityRangeEl) intensityRangeEl.value = String(value);
  if (intensityValueEl) intensityValueEl.textContent = `${value}%`;
}

function createInitialGame() {
  return {
    board: initialBoard(),
    turn: "w",
    castling: {
      wK: true,
      wQ: true,
      bK: true,
      bQ: true,
    },
    enPassant: null,
    halfMove: 0,
    moveCount: 1,
    status: "playing",
  };
}

function initialBoard() {
  const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c += 1) {
    board[0][c] = { color: "b", type: back[c], moved: false };
    board[1][c] = { color: "b", type: "P", moved: false };
    board[6][c] = { color: "w", type: "P", moved: false };
    board[7][c] = { color: "w", type: back[c], moved: false };
  }
  return board;
}

function cloneGameState(state) {
  return {
    ...state,
    board: state.board.map((row) => row.map((p) => (p ? { ...p } : null))),
    castling: { ...state.castling },
    enPassant: state.enPassant ? { ...state.enPassant } : null,
  };
}

function inside(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function enemy(color) {
  return color === "w" ? "b" : "w";
}

function drawBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const sq = document.createElement("button");
      sq.type = "button";
      sq.className = `square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
      sq.dataset.r = String(r);
      sq.dataset.c = String(c);
      const piece = game.board[r][c];
      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = "piece";
        pieceEl.textContent = PIECE_GLYPHS[piece.color][piece.type];
        sq.appendChild(pieceEl);
      }

      if (selected && selected.r === r && selected.c === c) {
        sq.classList.add("selected");
      }
      const target = legalTargets.find((m) => m.to.r === r && m.to.c === c);
      if (target) {
        sq.classList.add(target.capture ? "capture" : "target");
      }

      sq.addEventListener("click", onSquareClick);
      boardEl.appendChild(sq);
    }
  }

  updateStatus();
}

function onSquareClick(event) {
  if (game.status !== "playing" || isAnimating) return;

  const targetEl = event.currentTarget;
  const r = Number(targetEl.dataset.r);
  const c = Number(targetEl.dataset.c);
  const clickedPiece = game.board[r][c];

  if (selected) {
    const chosenMove = legalTargets.find((m) => m.to.r === r && m.to.c === c);
    if (chosenMove) {
      playMove(chosenMove);
      return;
    }
  }

  if (clickedPiece && clickedPiece.color === game.turn) {
    selected = { r, c };
    legalTargets = legalMovesForSquare(game, r, c);
  } else {
    selected = null;
    legalTargets = [];
  }

  drawBoard();
}

async function playMove(move) {
  if (isAnimating) return;
  isAnimating = true;

  const fromRect = squareRect(move.from.r, move.from.c);
  const toRect = squareRect(move.to.r, move.to.c);
  await animateShot(fromRect, toRect, move);

  game = applyMove(game, move);
  selected = null;
  legalTargets = [];
  recalcStatus();
  drawBoard();
  isAnimating = false;
}

function squareRect(r, c) {
  const boardRect = boardEl.getBoundingClientRect();
  const size = boardRect.width / 8;
  return {
    x: boardRect.left + c * size,
    y: boardRect.top + r * size,
    cx: boardRect.left + c * size + size / 2,
    cy: boardRect.top + r * size + size / 2,
    size,
  };
}

function animateShot(fromRect, toRect, move) {
  const shot = move.shot;
  const arenaRect = boardEl.getBoundingClientRect();
  const x1 = fromRect.cx - arenaRect.left;
  const y1 = fromRect.cy - arenaRect.top;
  const x2 = toRect.cx - arenaRect.left;
  const y2 = toRect.cy - arenaRect.top;

  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const dist = Math.hypot(x2 - x1, y2 - y1);

  const stick = document.createElement("div");
  stick.className = `stick ${shot}`;
  stick.innerHTML = `
    <svg class="stick-svg" viewBox="0 0 260 72" role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id="shaftWood" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f0dcba"></stop>
          <stop offset="38%" stop-color="#d9ba8c"></stop>
          <stop offset="100%" stop-color="#b38757"></stop>
        </linearGradient>
      </defs>
      <rect x="20" y="22" width="36" height="20" rx="10" fill="#111518"></rect>
      <g fill="#d9dde0">
        <rect x="22" y="24" width="2" height="16" rx="1"></rect>
        <rect x="27" y="24" width="2" height="16" rx="1"></rect>
        <rect x="32" y="24" width="2" height="16" rx="1"></rect>
        <rect x="37" y="24" width="2" height="16" rx="1"></rect>
        <rect x="42" y="24" width="2" height="16" rx="1"></rect>
        <rect x="47" y="24" width="2" height="16" rx="1"></rect>
      </g>
      <rect x="50" y="26" width="156" height="12" rx="6" fill="url(#shaftWood)" stroke="#765230" stroke-width="1.2"></rect>
      <rect x="120" y="27" width="68" height="2.4" rx="1" fill="rgb(255 255 255 / 60%)"></rect>
      <path d="M205 27 L241 27 C249 27 252 32 252 40 L252 56 C252 62 248 66 242 66 L206 66 C198 66 194 61 194 53 L194 40 C194 33 198 29 205 27 Z" fill="#0c1013" stroke="#44515a" stroke-width="1.1"></path>
      <g fill="rgb(232 241 247 / 86%)">
        <rect x="205" y="30" width="28" height="2"></rect>
        <rect x="205" y="35" width="34" height="2"></rect>
        <rect x="205" y="40" width="38" height="2"></rect>
        <rect x="205" y="45" width="41" height="2"></rect>
        <rect x="205" y="50" width="43" height="2"></rect>
      </g>
      <path d="M241 44 L255 44 L255 64 C255 69 251 71 247 71 L236 71 Z" fill="#07090b"></path>
      <circle cx="18" cy="32" r="7" fill="#0b0f12"></circle>
      <circle cx="16" cy="30" r="2" fill="#45545f"></circle>
    </svg>
  `;
  const variants = {
    wrist: {
      duration: 1220,
      arc: 13,
      delay: 380,
      linger: 980,
      pieceFlight: 780,
      backSwing: 58,
      snapSwing: 48,
      followSwing: 24,
      backDistance: 20,
      contactDistance: 0,
      holdDistance: 12,
      followDistance: 22,
    },
    slap: {
      duration: 1420,
      arc: 24,
      delay: 460,
      linger: 1120,
      pieceFlight: 860,
      backSwing: 92,
      snapSwing: 82,
      followSwing: 38,
      backDistance: 30,
      contactDistance: 0,
      holdDistance: 20,
      followDistance: 30,
    },
    backhand: {
      duration: 1300,
      arc: -20,
      delay: 420,
      linger: 1020,
      pieceFlight: 820,
      backSwing: 74,
      snapSwing: 66,
      followSwing: 30,
      backDistance: 24,
      contactDistance: 0,
      holdDistance: 16,
      followDistance: 26,
    },
  };
  const style = variants[shot] || variants.wrist;
  const swingMult = 0.55 + 0.45 * cinematicIntensity;
  const travelMult = 0.65 + 0.35 * cinematicIntensity;
  const timeMult = 0.7 + 0.3 * cinematicIntensity;
  const lingerMult = 0.75 + 0.4 * cinematicIntensity;
  const tuned = {
    ...style,
    duration: Math.round(style.duration * timeMult),
    delay: Math.round(style.delay * timeMult),
    linger: Math.round(style.linger * lingerMult),
    pieceFlight: Math.round(style.pieceFlight * timeMult),
    backSwing: style.backSwing * swingMult,
    snapSwing: style.snapSwing * swingMult,
    followSwing: style.followSwing * swingMult,
    backDistance: style.backDistance * travelMult,
    contactDistance: style.contactDistance * travelMult,
    holdDistance: style.holdDistance * travelMult,
    followDistance: style.followDistance * travelMult,
  };
  const stickWidth = shot === "slap" ? 250 : 228;
  const stickHeight = 74;
  const handleOriginX = stickWidth * (20 / 260);
  const handleOriginY = stickHeight * (32 / 72);
  const bladeTipX = stickWidth * (252 / 260);
  const bladeTipY = stickHeight * (56 / 72);

  const ux = dist > 0 ? (x2 - x1) / dist : 1;
  const uy = dist > 0 ? (y2 - y1) / dist : 0;
  const slideIn = Math.min(90, 30 + dist * 0.34);
  const holdShift = Math.min(tuned.holdDistance, 8 + dist * 0.06);
  const followThrough = Math.min(tuned.followDistance, 12 + dist * 0.08);
  const sign = tuned.arc >= 0 ? 1 : -1;

  const r1 = angle - tuned.arc - 12;
  const rBack = angle - sign * tuned.backSwing;
  const rSnap = angle + sign * tuned.snapSwing;
  const rFollow = angle + sign * tuned.followSwing;
  const r3 = angle - (tuned.arc > 0 ? 6 : -6);

  const bladeVectorX = bladeTipX - handleOriginX;
  const bladeVectorY = bladeTipY - handleOriginY;
  const placeStickForBlade = (bladeX, bladeY, rotDeg) => {
    const theta = (rotDeg * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const rotatedBladeX = bladeVectorX * cosT - bladeVectorY * sinT;
    const rotatedBladeY = bladeVectorX * sinT + bladeVectorY * cosT;
    return {
      x: bladeX - handleOriginX - rotatedBladeX,
      y: bladeY - handleOriginY - rotatedBladeY,
    };
  };

  const startPos = placeStickForBlade(x1 - ux * slideIn, y1 - uy * slideIn, r1);
  const backPos = placeStickForBlade(x1 - ux * tuned.backDistance, y1 - uy * tuned.backDistance, rBack);
  const contactPos = placeStickForBlade(
    x1 + ux * tuned.contactDistance,
    y1 + uy * tuned.contactDistance,
    rSnap,
  );
  const holdPos = placeStickForBlade(x1 + ux * holdShift, y1 + uy * holdShift, rFollow);
  const endPos = placeStickForBlade(x1 + ux * followThrough, y1 + uy * followThrough, r3);

  stick.style.left = "0px";
  stick.style.top = "0px";
  stick.style.width = `${stickWidth}px`;
  stick.style.height = `${stickHeight}px`;
  stick.style.setProperty("--ox", `${handleOriginX}px`);
  stick.style.setProperty("--oy", `${handleOriginY}px`);
  stick.style.setProperty("--duration", `${tuned.duration}ms`);
  stick.style.setProperty("--sx", `${startPos.x}px`);
  stick.style.setProperty("--sy", `${startPos.y}px`);
  stick.style.setProperty("--bx", `${backPos.x}px`);
  stick.style.setProperty("--by", `${backPos.y}px`);
  stick.style.setProperty("--cx", `${contactPos.x}px`);
  stick.style.setProperty("--cy", `${contactPos.y}px`);
  stick.style.setProperty("--hx", `${holdPos.x}px`);
  stick.style.setProperty("--hy", `${holdPos.y}px`);
  stick.style.setProperty("--ex", `${endPos.x}px`);
  stick.style.setProperty("--ey", `${endPos.y}px`);
  stick.style.setProperty("--r1", `${r1}deg`);
  stick.style.setProperty("--rBack", `${rBack}deg`);
  stick.style.setProperty("--rSnap", `${rSnap}deg`);
  stick.style.setProperty("--rFollow", `${rFollow}deg`);
  stick.style.setProperty("--r3", `${r3}deg`);

  const trail = document.createElement("div");
  trail.className = "puck-trail";
  trail.style.left = `${x1 + ux * 2}px`;
  trail.style.top = `${y1 + uy * 2 - 4}px`;
  trail.style.width = `${Math.max(18, dist - 2)}px`;
  trail.style.transform = `rotate(${angle}deg)`;
  trail.style.animation = `sweep ${tuned.duration + 320}ms ease-out ${tuned.delay}ms forwards`;

  const impact = document.createElement("div");
  impact.className = "impact-ring";
  impact.style.left = `${x1 - 12}px`;
  impact.style.top = `${y1 - 12}px`;
  impact.style.animationDelay = `${tuned.delay + 120}ms`;

  const bars = document.createElement("div");
  bars.className = "cutscene-bars";
  bars.style.setProperty("--bars-duration", `${tuned.duration + tuned.linger}ms`);

  const glare = document.createElement("div");
  glare.className = "cutscene-glare";
  glare.style.setProperty("--glare-duration", `${tuned.duration + tuned.linger}ms`);

  const flyingPiece = document.createElement("div");
  flyingPiece.className = "flying-piece";
  flyingPiece.textContent = PIECE_GLYPHS[move.piece.color][move.piece.type];
  flyingPiece.style.left = `${x1}px`;
  flyingPiece.style.top = `${y1}px`;
  flyingPiece.style.setProperty("--dx", `${x2 - x1}px`);
  flyingPiece.style.setProperty("--dy", `${y2 - y1}px`);
  flyingPiece.style.setProperty("--lift", `${Math.min(20, 8 + dist * 0.08)}px`);
  flyingPiece.style.setProperty("--spin", `${Math.max(16, Math.min(40, dist * 0.2))}deg`);
  flyingPiece.style.animation = `pieceFlight ${tuned.pieceFlight}ms cubic-bezier(0.18, 0.85, 0.24, 1) ${tuned.delay + 140}ms forwards`;

  boardEl.classList.add("cutscene-pulse");
  fxLayer.appendChild(bars);
  fxLayer.appendChild(glare);
  fxLayer.appendChild(stick);
  fxLayer.appendChild(trail);
  fxLayer.appendChild(impact);
  fxLayer.appendChild(flyingPiece);

  return new Promise((resolve) => {
    window.setTimeout(() => {
      boardEl.classList.remove("cutscene-pulse");
      bars.remove();
      glare.remove();
      stick.remove();
      trail.remove();
      impact.remove();
      flyingPiece.remove();
      resolve();
    }, tuned.duration + tuned.delay + tuned.linger);
  });
}

function legalMovesForSquare(state, r, c) {
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = pseudoMoves(state, r, c, piece);
  return pseudo.filter((move) => !wouldLeaveKingInCheck(state, move));
}

function pseudoMoves(state, r, c, piece) {
  const moves = [];

  function add(toR, toC, options = {}) {
    if (!inside(toR, toC)) return;
    const target = state.board[toR][toC];
    if (target && target.color === piece.color) return;

    moves.push({
      from: { r, c },
      to: { r: toR, c: toC },
      piece: { ...piece },
      capture: Boolean(target) || Boolean(options.enPassantCapture),
      enPassantCapture: options.enPassantCapture || null,
      castle: options.castle || null,
      promote: options.promote || null,
      shot: shotType(piece, r, c, toR, toC),
    });
  }

  if (piece.type === "P") {
    const dir = piece.color === "w" ? -1 : 1;
    const startRow = piece.color === "w" ? 6 : 1;
    const oneR = r + dir;
    if (inside(oneR, c) && !state.board[oneR][c]) {
      if (oneR === 0 || oneR === 7) {
        add(oneR, c, { promote: "Q" });
      } else {
        add(oneR, c);
      }

      const twoR = r + dir * 2;
      if (r === startRow && !state.board[twoR][c]) {
        add(twoR, c);
      }
    }

    for (const dc of [-1, 1]) {
      const cr = r + dir;
      const cc = c + dc;
      if (!inside(cr, cc)) continue;
      const target = state.board[cr][cc];
      if (target && target.color !== piece.color) {
        if (cr === 0 || cr === 7) {
          add(cr, cc, { promote: "Q" });
        } else {
          add(cr, cc);
        }
      }

      if (
        state.enPassant &&
        state.enPassant.r === cr &&
        state.enPassant.c === cc &&
        state.enPassant.color !== piece.color
      ) {
        add(cr, cc, {
          enPassantCapture: { r, c: cc },
        });
      }
    }
  }

  if (piece.type === "N") {
    const jumps = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    for (const [dr, dc] of jumps) add(r + dr, c + dc);
  }

  if (piece.type === "B" || piece.type === "R" || piece.type === "Q") {
    const dirs = [];
    if (piece.type !== "B") dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    if (piece.type !== "R") dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);

    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inside(nr, nc)) {
        const target = state.board[nr][nc];
        if (!target) {
          add(nr, nc);
        } else {
          if (target.color !== piece.color) add(nr, nc);
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  if (piece.type === "K") {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        add(r + dr, c + dc);
      }
    }

    if (!piece.moved && !inCheck(state, piece.color)) {
      const row = piece.color === "w" ? 7 : 0;
      if (canCastle(state, piece.color, "K")) {
        add(row, 6, { castle: "K" });
      }
      if (canCastle(state, piece.color, "Q")) {
        add(row, 2, { castle: "Q" });
      }
    }
  }

  return moves;
}

function canCastle(state, color, side) {
  const row = color === "w" ? 7 : 0;
  if (side === "K") {
    if (!state.castling[`${color}K`]) return false;
    if (state.board[row][5] || state.board[row][6]) return false;
    if (isSquareAttacked(state, row, 5, enemy(color))) return false;
    if (isSquareAttacked(state, row, 6, enemy(color))) return false;
    const rook = state.board[row][7];
    if (!rook || rook.type !== "R" || rook.color !== color || rook.moved) return false;
    return true;
  }

  if (!state.castling[`${color}Q`]) return false;
  if (state.board[row][1] || state.board[row][2] || state.board[row][3]) return false;
  if (isSquareAttacked(state, row, 3, enemy(color))) return false;
  if (isSquareAttacked(state, row, 2, enemy(color))) return false;
  const rook = state.board[row][0];
  if (!rook || rook.type !== "R" || rook.color !== color || rook.moved) return false;
  return true;
}

function findKing(state, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = state.board[r][c];
      if (piece && piece.type === "K" && piece.color === color) {
        return { r, c };
      }
    }
  }
  return null;
}

function isSquareAttacked(state, targetR, targetC, byColor) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== byColor) continue;

      if (piece.type === "P") {
        const dir = byColor === "w" ? -1 : 1;
        if (r + dir === targetR && (c - 1 === targetC || c + 1 === targetC)) return true;
        continue;
      }

      if (piece.type === "N") {
        const jumps = [
          [-2, -1],
          [-2, 1],
          [-1, -2],
          [-1, 2],
          [1, -2],
          [1, 2],
          [2, -1],
          [2, 1],
        ];
        if (jumps.some(([dr, dc]) => r + dr === targetR && c + dc === targetC)) return true;
        continue;
      }

      if (piece.type === "K") {
        if (Math.max(Math.abs(targetR - r), Math.abs(targetC - c)) === 1) return true;
        continue;
      }

      const dirs = [];
      if (piece.type === "B" || piece.type === "Q") dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      if (piece.type === "R" || piece.type === "Q") dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (inside(nr, nc)) {
          if (nr === targetR && nc === targetC) return true;
          if (state.board[nr][nc]) break;
          nr += dr;
          nc += dc;
        }
      }
    }
  }
  return false;
}

function inCheck(state, color) {
  const king = findKing(state, color);
  if (!king) return false;
  return isSquareAttacked(state, king.r, king.c, enemy(color));
}

function wouldLeaveKingInCheck(state, move) {
  const next = applyMove(state, move, true);
  return inCheck(next, state.turn);
}

function applyMove(state, move, simulate = false) {
  const next = cloneGameState(state);
  const fromPiece = next.board[move.from.r][move.from.c];
  next.board[move.from.r][move.from.c] = null;

  if (move.enPassantCapture) {
    next.board[move.enPassantCapture.r][move.enPassantCapture.c] = null;
  }

  const movedPiece = { ...fromPiece, moved: true };
  if (move.promote) movedPiece.type = move.promote;

  next.board[move.to.r][move.to.c] = movedPiece;

  if (move.castle) {
    const row = movedPiece.color === "w" ? 7 : 0;
    if (move.castle === "K") {
      const rook = next.board[row][7];
      next.board[row][7] = null;
      next.board[row][5] = { ...rook, moved: true };
    } else {
      const rook = next.board[row][0];
      next.board[row][0] = null;
      next.board[row][3] = { ...rook, moved: true };
    }
  }

  if (fromPiece.type === "K") {
    next.castling[`${fromPiece.color}K`] = false;
    next.castling[`${fromPiece.color}Q`] = false;
  }

  if (fromPiece.type === "R") {
    const row = fromPiece.color === "w" ? 7 : 0;
    if (move.from.r === row && move.from.c === 0) next.castling[`${fromPiece.color}Q`] = false;
    if (move.from.r === row && move.from.c === 7) next.castling[`${fromPiece.color}K`] = false;
  }

  const capturedPiece = state.board[move.to.r][move.to.c];
  if (capturedPiece && capturedPiece.type === "R") {
    const row = capturedPiece.color === "w" ? 7 : 0;
    if (move.to.r === row && move.to.c === 0) next.castling[`${capturedPiece.color}Q`] = false;
    if (move.to.r === row && move.to.c === 7) next.castling[`${capturedPiece.color}K`] = false;
  }

  next.enPassant = null;
  if (fromPiece.type === "P" && Math.abs(move.to.r - move.from.r) === 2) {
    next.enPassant = {
      r: (move.to.r + move.from.r) / 2,
      c: move.from.c,
      color: fromPiece.color,
    };
  }

  if (!simulate) {
    next.turn = enemy(state.turn);
    next.halfMove = move.capture || fromPiece.type === "P" ? 0 : state.halfMove + 1;
    next.moveCount = state.turn === "b" ? state.moveCount + 1 : state.moveCount;
  }

  return next;
}

function allLegalMoves(state, color = state.turn) {
  const moves = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = state.board[r][c];
      if (!piece || piece.color !== color) continue;
      const pseudo = pseudoMoves(state, r, c, piece);
      for (const move of pseudo) {
        if (!wouldLeaveKingInCheck(state, move)) {
          moves.push(move);
        }
      }
    }
  }
  return moves;
}

function recalcStatus() {
  const side = game.turn;
  const legal = allLegalMoves(game, side);
  const checked = inCheck(game, side);

  if (legal.length === 0) {
    if (checked) {
      game.status = `mate-${enemy(side)}`;
    } else {
      game.status = "stalemate";
    }
  } else {
    game.status = checked ? `check-${side}` : "playing";
  }
}

function updateStatus() {
  if (game.status === "playing") {
    statusTextEl.textContent = `${game.turn === "w" ? "White" : "Black"} to move`;
    return;
  }

  if (game.status.startsWith("check-")) {
    const side = game.status.slice(6);
    statusTextEl.textContent = `Check on ${side === "w" ? "White" : "Black"} - ${game.turn === "w" ? "White" : "Black"} to move`;
    return;
  }

  if (game.status.startsWith("mate-")) {
    const winner = game.status.slice(5);
    statusTextEl.textContent = `Checkmate - ${winner === "w" ? "White" : "Black"} wins`;
    return;
  }

  statusTextEl.textContent = "Stalemate";
}

function shotType(piece, fromR, fromC, toR, toC) {
  const dist = Math.max(Math.abs(fromR - toR), Math.abs(fromC - toC));
  if (piece.type === "N" || piece.type === "K") return "backhand";
  if (piece.type === "Q" || piece.type === "R" || dist >= 3) return "slap";
  return "wrist";
}

resetBtn.addEventListener("click", () => {
  game = createInitialGame();
  selected = null;
  legalTargets = [];
  drawBoard();
});

if (intensityRangeEl) {
  intensityRangeEl.addEventListener("input", (event) => {
    setCinematicIntensity(event.target.value);
  });
}

setCinematicIntensity(intensityRangeEl ? intensityRangeEl.value : 100);

drawBoard();
