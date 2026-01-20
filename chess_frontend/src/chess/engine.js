/**
 * A lightweight chess engine for frontend-only move validation.
 * Implements:
 * - Basic piece movement rules
 * - Captures
 * - Check detection (king safety)
 * - Checkmate/stalemate detection via "no legal moves"
 *
 * Out of scope for this subtask (intentionally not implemented):
 * - Castling
 * - En passant
 * - Pawn promotion choice (auto-promote to queen)
 */

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/**
 * @typedef {{color:'w'|'b', type:'K'|'Q'|'R'|'B'|'N'|'P'}} Piece
 * @typedef {{r:number,c:number}} Square
 * @typedef {{from:Square,to:Square,promotion?:'Q',captured?:Piece|null}} Move
 * @typedef {{board:(Piece|null)[][]}} Position
 */

// PUBLIC_INTERFACE
export function createInitialPosition() {
  /** Returns a new initial chess position. */
  const empty = () => Array.from({ length: 8 }, () => Array(8).fill(null));
  const board = empty();

  const backRank = (color) => [
    { color, type: "R" },
    { color, type: "N" },
    { color, type: "B" },
    { color, type: "Q" },
    { color, type: "K" },
    { color, type: "B" },
    { color, type: "N" },
    { color, type: "R" },
  ];

  // Black at top (rank 8 -> r=0), white at bottom (rank 1 -> r=7)
  board[0] = backRank("b");
  board[1] = Array.from({ length: 8 }, () => ({ color: "b", type: "P" }));
  board[6] = Array.from({ length: 8 }, () => ({ color: "w", type: "P" }));
  board[7] = backRank("w");

  return { board };
}

// PUBLIC_INTERFACE
export function getPieceColor(piece) {
  /** Return 'w'|'b' for a piece, or null. */
  return piece?.color ?? null;
}

// PUBLIC_INTERFACE
export function parseSquare(algebraic) {
  /** Convert "e4" -> {r,c} */
  const file = algebraic[0];
  const rank = Number(algebraic[1]);
  const c = FILES.indexOf(file);
  const r = 8 - rank;
  return { r, c };
}

// PUBLIC_INTERFACE
export function squareToAlgebraic({ r, c }) {
  /** Convert {r,c} -> "e4" */
  return `${FILES[c]}${8 - r}`;
}

function inside(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function clonePosition(position) {
  return {
    board: position.board.map((row) =>
      row.map((p) => (p ? { ...p } : null))
    ),
  };
}

function findKing(position, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = position.board[r][c];
      if (p && p.color === color && p.type === "K") return { r, c };
    }
  }
  return null;
}

function opposite(color) {
  return color === "w" ? "b" : "w";
}

function isEmpty(position, r, c) {
  return position.board[r][c] === null;
}

function isEnemy(position, r, c, color) {
  const p = position.board[r][c];
  return !!p && p.color !== color;
}

function pushIfValid(moves, position, from, r, c, color) {
  if (!inside(r, c)) return;
  const target = position.board[r][c];
  if (!target) {
    moves.push({ from, to: { r, c } });
  } else if (target.color !== color) {
    moves.push({ from, to: { r, c }, captured: target });
  }
}

function genSliding(position, from, color, deltas) {
  const moves = [];
  for (const [dr, dc] of deltas) {
    let r = from.r + dr;
    let c = from.c + dc;
    while (inside(r, c)) {
      const target = position.board[r][c];
      if (!target) {
        moves.push({ from, to: { r, c } });
      } else {
        if (target.color !== color) moves.push({ from, to: { r, c }, captured: target });
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return moves;
}

function pseudoLegalMovesForSquare(position, from) {
  const piece = position.board[from.r][from.c];
  if (!piece) return [];
  const color = piece.color;
  const moves = [];

  switch (piece.type) {
    case "P": {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;

      // forward 1
      const r1 = from.r + dir;
      if (inside(r1, from.c) && isEmpty(position, r1, from.c)) {
        // promotion
        if (r1 === 0 || r1 === 7) {
          moves.push({ from, to: { r: r1, c: from.c }, promotion: "Q" });
        } else {
          moves.push({ from, to: { r: r1, c: from.c } });
        }

        // forward 2 from start
        const r2 = from.r + 2 * dir;
        if (from.r === startRow && inside(r2, from.c) && isEmpty(position, r2, from.c)) {
          moves.push({ from, to: { r: r2, c: from.c } });
        }
      }

      // captures
      for (const dc of [-1, 1]) {
        const rc = from.c + dc;
        if (!inside(r1, rc)) continue;
        if (isEnemy(position, r1, rc, color)) {
          const captured = position.board[r1][rc];
          if (r1 === 0 || r1 === 7) {
            moves.push({ from, to: { r: r1, c: rc }, captured, promotion: "Q" });
          } else {
            moves.push({ from, to: { r: r1, c: rc }, captured });
          }
        }
      }
      return moves;
    }

    case "N": {
      const deltas = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (const [dr, dc] of deltas) {
        pushIfValid(moves, position, from, from.r + dr, from.c + dc, color);
      }
      return moves;
    }

    case "B":
      return genSliding(position, from, color, [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]);

    case "R":
      return genSliding(position, from, color, [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);

    case "Q":
      return genSliding(position, from, color, [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]);

    case "K": {
      const deltas = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ];
      for (const [dr, dc] of deltas) {
        pushIfValid(moves, position, from, from.r + dr, from.c + dc, color);
      }
      return moves;
    }

    default:
      return [];
  }
}

// PUBLIC_INTERFACE
export function isSquareAttacked(position, square, byColor) {
  /** Returns true if `square` is attacked by any piece of `byColor`. */
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = position.board[r][c];
      if (!p || p.color !== byColor) continue;

      const from = { r, c };

      // For attack detection, pawns are special (they attack diagonally regardless of occupancy).
      if (p.type === "P") {
        const dir = byColor === "w" ? -1 : 1;
        for (const dc of [-1, 1]) {
          const rr = r + dir;
          const cc = c + dc;
          if (rr === square.r && cc === square.c) return true;
        }
        continue;
      }

      const pseudo = pseudoLegalMovesForSquare(position, from);
      if (pseudo.some((m) => m.to.r === square.r && m.to.c === square.c)) {
        return true;
      }
    }
  }
  return false;
}

// PUBLIC_INTERFACE
export function inCheck(position, color) {
  /** Returns true if `color`'s king is currently in check. */
  const kingSq = findKing(position, color);
  if (!kingSq) return false; // Shouldn't happen in normal play.
  return isSquareAttacked(position, kingSq, opposite(color));
}

function wouldLeaveKingInCheck(position, move, moverColor) {
  const next = applyMove(position, move);
  return inCheck(next, moverColor);
}

function applyMove(position, move) {
  const next = clonePosition(position);
  const piece = next.board[move.from.r][move.from.c];
  next.board[move.from.r][move.from.c] = null;

  let placed = piece;
  // auto-promote to queen if promotion provided
  if (piece && piece.type === "P" && move.promotion) {
    placed = { color: piece.color, type: move.promotion };
  }
  next.board[move.to.r][move.to.c] = placed;
  return next;
}

function pieceLetter(pieceType) {
  if (pieceType === "P") return "";
  return pieceType;
}

function moveToSANLike(position, move) {
  const piece = position.board[move.from.r][move.from.c];
  if (!piece) return `${squareToAlgebraic(move.from)}-${squareToAlgebraic(move.to)}`;
  const captureMark = move.captured ? "x" : "-";
  const promo = move.promotion ? `=${move.promotion}` : "";
  return `${pieceLetter(piece.type)}${squareToAlgebraic(move.from)}${captureMark}${squareToAlgebraic(move.to)}${promo}`;
}

// PUBLIC_INTERFACE
export function makeMove(position, move) {
  /**
   * Apply a move and return {position, san}.
   * Assumes the move is legal (caller should validate using generateLegalMoves).
   */
  const nextPosition = applyMove(position, move);
  return { position: nextPosition, san: moveToSANLike(position, move) };
}

// PUBLIC_INTERFACE
export function generateLegalMoves(position, turn) {
  /**
   * Generate all legal moves for `turn` in `position`.
   * Filters pseudo-legal moves by king safety.
   */
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = position.board[r][c];
      if (!p || p.color !== turn) continue;

      const from = { r, c };
      const pseudo = pseudoLegalMovesForSquare(position, from);
      for (const mv of pseudo) {
        if (!wouldLeaveKingInCheck(position, mv, turn)) {
          moves.push(mv);
        }
      }
    }
  }
  return moves;
}
