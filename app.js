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
const debugOverlayEl = document.getElementById("debugOverlay");

let game = createInitialGame();
let selected = null;
let legalTargets = [];
let isAnimating = false;
let cinematicIntensity = 1;
let debugOverlay = false;

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
        pieceEl.className = `piece ${piece.color === "w" ? "piece-white" : "piece-black"}`;
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

  try {
    const fromRect = squareRect(move.from.r, move.from.c);
    const toRect = squareRect(move.to.r, move.to.c);
    await animateShot(fromRect, toRect, move);

    game = applyMove(game, move);
    selected = null;
    legalTargets = [];
    recalcStatus();
    drawBoard();
  } finally {
    isAnimating = false;
  }
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInCubic(t) {
  return t ** 3;
}

function drawHockeyStick(ctx, shot) {
  const length = shot === "slap" ? 256 : 238;
  const shaftStart = 34;
  const shaftEnd = length - 60;
  const heelX = length - 58;
  const bladeY = 12;
  const bladeH = 18;
  const toeX = length + 6;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#151f27";
  ctx.lineWidth = 4.6;

  ctx.fillStyle = "#0e141a";
  ctx.beginPath();
  ctx.roundRect(-6, -9, 16, 18, 9);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#1a232c";
  ctx.beginPath();
  ctx.roundRect(8, -10, 40, 20, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e9f0f4";
  for (let x = 11; x < 46; x += 5) {
    ctx.fillRect(x, -8, 2, 16);
  }

  const shaftGrad = ctx.createLinearGradient(shaftStart, -4, shaftEnd, 4);
  shaftGrad.addColorStop(0, "#8cc7ff");
  shaftGrad.addColorStop(0.45, "#4b8fc8");
  shaftGrad.addColorStop(1, "#2b5f93");
  ctx.fillStyle = shaftGrad;
  ctx.beginPath();
  ctx.roundRect(shaftStart, -5, shaftEnd - shaftStart, 10, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgb(255 255 255 / 55%)";
  ctx.fillRect(shaftStart + 20, -3, shaftEnd - shaftStart - 34, 1.9);

  ctx.fillStyle = "#37638b";
  ctx.beginPath();
  ctx.moveTo(shaftEnd - 2, -5);
  ctx.lineTo(heelX - 5, 2);
  ctx.lineTo(heelX + 4, bladeY + 1);
  ctx.lineTo(heelX + 8, bladeY - 2);
  ctx.lineTo(shaftEnd + 3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#202e3a";
  ctx.beginPath();
  ctx.moveTo(heelX, bladeY);
  ctx.lineTo(toeX - 14, bladeY);
  ctx.quadraticCurveTo(toeX + 2, bladeY + 1, toeX + 3, bladeY + 12);
  ctx.lineTo(toeX + 3, bladeY + bladeH - 1);
  ctx.quadraticCurveTo(toeX + 1, bladeY + bladeH + 6, toeX - 8, bladeY + bladeH + 7);
  ctx.lineTo(heelX + 2, bladeY + bladeH + 7);
  ctx.quadraticCurveTo(heelX - 2, bladeY + bladeH + 6, heelX - 2, bladeY + bladeH + 2);
  ctx.lineTo(heelX - 2, bladeY + 3);
  ctx.quadraticCurveTo(heelX - 1, bladeY, heelX, bladeY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgb(248 252 255 / 88%)";
  for (let y = bladeY + 3; y <= bladeY + bladeH + 4; y += 4) {
    ctx.fillRect(heelX + 2, y, toeX - heelX - 9, 1.7);
  }

  ctx.fillStyle = "rgb(255 255 255 / 30%)";
  ctx.fillRect(heelX + 6, bladeY + 2, 22, 1.5);
  ctx.fillRect(toeX - 30, bladeY + 2.2, 10, 1.2);

  ctx.fillStyle = "rgb(0 0 0 / 24%)";
  ctx.beginPath();
  ctx.ellipse(toeX - 4, bladeY + bladeH + 9, 10, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
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
  const variants = {
    wrist: {
      duration: 1500,
      linger: 950,
      backSwing: 72,
      snapSwing: 58,
      followSwing: 30,
      backDistance: 56,
      holdDistance: 16,
      followDistance: 26,
      arcLift: 26,
      pieceFlight: 820,
    },
    slap: {
      duration: 1720,
      linger: 1180,
      backSwing: 116,
      snapSwing: 94,
      followSwing: 42,
      backDistance: 82,
      holdDistance: 24,
      followDistance: 34,
      arcLift: 38,
      pieceFlight: 920,
    },
    backhand: {
      duration: 1600,
      linger: 1040,
      backSwing: -94,
      snapSwing: -76,
      followSwing: -34,
      backDistance: 70,
      holdDistance: 20,
      followDistance: 30,
      arcLift: 30,
      pieceFlight: 860,
    },
  };
  const style = variants[shot] || variants.wrist;
  const swingMult = 0.6 + 0.65 * cinematicIntensity;
  const travelMult = 0.7 + 0.55 * cinematicIntensity;
  const timeMult = 0.72 + 0.4 * cinematicIntensity;
  const lingerMult = 0.75 + 0.45 * cinematicIntensity;
  const tuned = {
    ...style,
    duration: Math.round(style.duration * timeMult),
    linger: Math.round(style.linger * lingerMult),
    pieceFlight: Math.round(style.pieceFlight * timeMult),
    backSwing: style.backSwing * swingMult,
    snapSwing: style.snapSwing * swingMult,
    followSwing: style.followSwing * swingMult,
    backDistance: style.backDistance * travelMult,
    holdDistance: style.holdDistance * travelMult,
    followDistance: style.followDistance * travelMult,
    arcLift: style.arcLift * travelMult,
  };
  const totalMs = tuned.duration + tuned.linger;
  const strikeT = 0.62;
  const pieceLift = Math.min(24, 10 + dist * 0.09);

  const ux = dist > 0 ? (x2 - x1) / dist : 1;
  const uy = dist > 0 ? (y2 - y1) / dist : 0;
  const px = -uy;
  const py = ux;
  const colorSign = move.piece.color === "w" ? -1 : 1;
  const baseSign = (shot === "backhand" ? -1 : 1) * colorSign;
  const contactOffset = fromRect.size * 0.28 + (shot === "slap" ? 2 : 0);
  const bladeTouch = {
    x: x1 - ux * contactOffset,
    y: y1 - uy * contactOffset,
  };

  const localBlade = { x: shot === "slap" ? 224 : 208, y: 22 };
  const localHandle = { x: 0, y: 0 };

  function bladeForHandle(handlePos, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const rx = (localBlade.x - localHandle.x) * cosA - (localBlade.y - localHandle.y) * sinA;
    const ry = (localBlade.x - localHandle.x) * sinA + (localBlade.y - localHandle.y) * cosA;
    return { x: handlePos.x + rx, y: handlePos.y + ry };
  }

  const bladeLocalAngle = (Math.atan2(localBlade.y - localHandle.y, localBlade.x - localHandle.x) * 180) / Math.PI;
  const stickLength = Math.hypot(localBlade.x - localHandle.x, localBlade.y - localHandle.y);
  const handlePivot = {
    x: bladeTouch.x + px * stickLength * baseSign,
    y: bladeTouch.y + py * stickLength * baseSign,
  };
  const angleToTouch = (Math.atan2(bladeTouch.y - handlePivot.y, bladeTouch.x - handlePivot.x) * 180) / Math.PI;
  const angleTouch = angleToTouch - bladeLocalAngle;
  const strikeTarget = { x: x1 + ux * 2, y: y1 + uy * 2 };
  const angleToStrike = (Math.atan2(strikeTarget.y - handlePivot.y, strikeTarget.x - handlePivot.x) * 180) / Math.PI;
  const angleStrike = angleToStrike - bladeLocalAngle;

  const projectionFromTouch = (angleDeg) => {
    const p = bladeForHandle(handlePivot, angleDeg);
    return (p.x - bladeTouch.x) * ux + (p.y - bladeTouch.y) * uy;
  };
  const backOptionA = angleTouch + Math.abs(tuned.backSwing);
  const backOptionB = angleTouch - Math.abs(tuned.backSwing);
  const projA = projectionFromTouch(backOptionA);
  const projB = projectionFromTouch(backOptionB);
  const angleBack = projA < projB ? backOptionA : backOptionB;

  const angleDelta = (from, to) => ((to - from + 540) % 360) - 180;
  const swingDir = Math.sign(angleDelta(angleBack, angleStrike)) || baseSign;
  const angleFollow = angleStrike + swingDir * Math.abs(tuned.followSwing);
  const angleEnd = angleStrike + swingDir * Math.abs(tuned.followSwing) * 0.45;
  const bladeBackPos = bladeForHandle(handlePivot, angleBack);
  const bladeStrikePos = bladeForHandle(handlePivot, angleStrike);
  const bladeFollowPos = bladeForHandle(handlePivot, angleFollow);

  const bars = document.createElement("div");
  bars.className = "cutscene-bars";
  bars.style.setProperty("--bars-duration", `${totalMs}ms`);

  const glare = document.createElement("div");
  glare.className = "cutscene-glare";
  glare.style.setProperty("--glare-duration", `${totalMs}ms`);

  const canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(arenaRect.width * dpr);
  canvas.height = Math.floor(arenaRect.height * dpr);
  canvas.style.width = `${arenaRect.width}px`;
  canvas.style.height = `${arenaRect.height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  boardEl.classList.add("cutscene-pulse");
  fxLayer.appendChild(bars);
  fxLayer.appendChild(glare);
  fxLayer.appendChild(canvas);

  return new Promise((resolve) => {
    const start = performance.now();
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      boardEl.classList.remove("cutscene-pulse");
      canvas.remove();
      bars.remove();
      glare.remove();
      resolve();
    };

    const render = (now) => {
      try {
        const elapsed = now - start;
        const t = clamp(elapsed / totalMs, 0, 1);
        ctx.clearRect(0, 0, arenaRect.width, arenaRect.height);

        let bladePos;
        let stickAngle;
        if (t < 0.2) {
          stickAngle = angleTouch;
        } else if (t < 0.48) {
          const q = easeInOutCubic((t - 0.2) / 0.28);
          stickAngle = lerp(angleTouch, angleBack, q);
        } else if (t < strikeT) {
          const q = easeInCubic((t - 0.48) / (strikeT - 0.48));
          stickAngle = lerp(angleBack, angleStrike, q);
        } else if (t < 0.84) {
          const q = easeOutCubic((t - strikeT) / (0.84 - strikeT));
          stickAngle = lerp(angleStrike, angleFollow, q);
        } else {
          const q = easeOutCubic((t - 0.84) / 0.16);
          stickAngle = lerp(angleFollow, angleEnd, q);
        }

        const handlePos = handlePivot;
        bladePos = bladeForHandle(handlePos, stickAngle);
        const angleRad = (stickAngle * Math.PI) / 180;

        if (debugOverlay) {
          ctx.save();
          ctx.lineWidth = 1.8;

        ctx.strokeStyle = "rgba(250, 224, 68, 0.9)";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 140, 90, 0.85)";
        ctx.beginPath();
        ctx.moveTo(bladeTouch.x - px * 120, bladeTouch.y - py * 120);
        ctx.lineTo(bladeTouch.x + px * 120, bladeTouch.y + py * 120);
        ctx.stroke();

        ctx.strokeStyle = "rgba(120, 220, 255, 0.85)";
        ctx.beginPath();
        for (let i = 0; i <= 32; i += 1) {
          const ta = i / 32;
          const a = lerp(angleBack, angleStrike, ta);
          const p = bladeForHandle(handlePivot, a);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        const markers = [
          { p: bladeTouch, color: "#ffffff", label: "touch" },
          { p: bladeBackPos, color: "#ff7f7f", label: "back" },
          { p: bladeStrikePos, color: "#8eff8e", label: "strike" },
          { p: bladeFollowPos, color: "#8ecbff", label: "follow" },
          { p: handlePivot, color: "#ffbe55", label: "pivot" },
        ];

        for (const m of markers) {
          ctx.fillStyle = m.color;
          ctx.beginPath();
          ctx.arc(m.p.x, m.p.y, m.label === "pivot" ? 5 : 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "rgba(8, 16, 24, 0.88)";
        ctx.fillRect(12, 12, 252, 82);
        ctx.fillStyle = "#d8f3ff";
        ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(`proj touch->back: ${(((bladeBackPos.x - bladeTouch.x) * ux + (bladeBackPos.y - bladeTouch.y) * uy)).toFixed(1)}`, 18, 32);
        ctx.fillText(`proj back->strike: ${(((bladeStrikePos.x - bladeBackPos.x) * ux + (bladeStrikePos.y - bladeBackPos.y) * uy)).toFixed(1)}`, 18, 50);
        ctx.fillText(`angles t/b/s: ${angleTouch.toFixed(1)} / ${angleBack.toFixed(1)} / ${angleStrike.toFixed(1)}`, 18, 68);
        ctx.fillText(`swingDir: ${swingDir > 0 ? "+1" : "-1"}`, 18, 86);
          ctx.restore();
        }

        if (t >= strikeT) {
          const q = easeOutCubic((t - strikeT) / (1 - strikeT));
          const pieceX = lerp(x1, x2, q);
          const pieceY = lerp(y1, y2, q) - Math.sin(Math.PI * q) * pieceLift;
          const spin = lerp(0, swingDir * 34, q);
          ctx.save();
          ctx.translate(pieceX, pieceY);
          ctx.rotate((spin * Math.PI) / 180);
          ctx.font = "700 46px 'Segoe UI Symbol', 'Apple Color Emoji', serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(PIECE_GLYPHS[move.piece.color][move.piece.type], 0, 0);
          ctx.restore();

          ctx.save();
          const trailAlpha = clamp(1 - q * 1.1, 0, 0.9);
          ctx.strokeStyle = `rgba(141, 226, 255, ${trailAlpha})`;
          ctx.lineWidth = 8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(pieceX, pieceY);
          ctx.stroke();
          ctx.restore();
        }

        const impactWindow = Math.abs(t - strikeT);
        if (impactWindow < 0.06) {
          const q = impactWindow / 0.06;
          const ringR = 8 + q * 20;
          const alpha = 0.9 - q * 0.9;
          ctx.save();
          ctx.strokeStyle = `rgba(231, 250, 255, ${alpha})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(x1, y1, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(handlePos.x, handlePos.y);
        ctx.rotate(angleRad);
        drawHockeyStick(ctx, shot);
        ctx.restore();

        if (t < 1) {
          requestAnimationFrame(render);
        } else {
          cleanup();
        }
      } catch (err) {
        console.error(err);
        cleanup();
      }
    };

    requestAnimationFrame(render);
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

if (debugOverlayEl) {
  debugOverlayEl.addEventListener("change", (event) => {
    debugOverlay = Boolean(event.target.checked);
  });
}

setCinematicIntensity(intensityRangeEl ? intensityRangeEl.value : 100);

drawBoard();
