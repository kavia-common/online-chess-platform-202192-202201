import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

import {
  createInitialPosition,
  generateLegalMoves,
  getPieceColor,
  inCheck,
  isSquareAttacked,
  makeMove,
  parseSquare,
  squareToAlgebraic,
} from "./chess/engine";

/**
 * App-level chess UI.
 * - Interactive board with click-to-select and click-to-move
 * - Legal move validation (including check rules)
 * - Turn indicator and check/checkmate status
 * - Move history in SAN-like coordinate format
 * - Restart button
 */
// PUBLIC_INTERFACE
function App() {
  const [position, setPosition] = useState(() => createInitialPosition());
  const [turn, setTurn] = useState("w"); // 'w' | 'b'
  const [selected, setSelected] = useState(null); // {r,c} | null
  const [legalMovesFromSelected, setLegalMovesFromSelected] = useState([]); // [{to:{r,c}, ...}]
  const [moveHistory, setMoveHistory] = useState([]); // array of strings
  const [status, setStatus] = useState({
    inCheck: false,
    checkmated: false,
    stalemated: false,
  });

  // Compute legal moves for entire position+turn (for checkmate/stalemate detection).
  const allLegalMoves = useMemo(
    () => generateLegalMoves(position, turn),
    [position, turn]
  );

  useEffect(() => {
    // Evaluate status after every position/turn change.
    const isInCheck = inCheck(position, turn);
    const noMoves = allLegalMoves.length === 0;
    const checkmated = noMoves && isInCheck;
    const stalemated = noMoves && !isInCheck;

    setStatus({
      inCheck: isInCheck,
      checkmated,
      stalemated,
    });

    // Clear selection if game ended
    if (checkmated || stalemated) {
      setSelected(null);
      setLegalMovesFromSelected([]);
    }
  }, [position, turn, allLegalMoves]);

  const unicodePiece = (piece) => {
    if (!piece) return "";
    const map = {
      w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
      b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
    };
    return map[piece.color]?.[piece.type] ?? "";
  };

  const isSelectablePiece = (r, c) => {
    const piece = position.board[r][c];
    return piece && piece.color === turn;
  };

  const isLegalDestination = (r, c) => {
    return legalMovesFromSelected.some((m) => m.to.r === r && m.to.c === c);
  };

  const getMoveForDestination = (r, c) => {
    return legalMovesFromSelected.find((m) => m.to.r === r && m.to.c === c);
  };

  const squareClasses = (r, c) => {
    const isDark = (r + c) % 2 === 1;
    const classes = ["square", isDark ? "square--dark" : "square--light"];

    if (selected && selected.r === r && selected.c === c) {
      classes.push("square--selected");
    }

    if (selected && isLegalDestination(r, c)) {
      const target = position.board[r][c];
      classes.push(target ? "square--captureHint" : "square--moveHint");
    }

    // Highlight king in check
    const piece = position.board[r][c];
    if (
      piece &&
      piece.type === "K" &&
      piece.color === turn &&
      status.inCheck
    ) {
      classes.push("square--kingInCheck");
    }

    return classes.join(" ");
  };

  const handleSquareClick = (r, c) => {
    if (status.checkmated || status.stalemated) return;

    // If we have a selection, attempt move if click is legal destination.
    if (selected) {
      if (isLegalDestination(r, c)) {
        const move = getMoveForDestination(r, c);
        const { position: nextPosition, san } = makeMove(position, move);

        setPosition(nextPosition);
        setTurn((t) => (t === "w" ? "b" : "w"));
        setSelected(null);
        setLegalMovesFromSelected([]);
        setMoveHistory((h) => [...h, san]);
        return;
      }

      // Clicking another own piece switches selection.
      if (isSelectablePiece(r, c)) {
        const from = { r, c };
        setSelected(from);
        const movesFrom = allLegalMoves.filter(
          (m) => m.from.r === r && m.from.c === c
        );
        setLegalMovesFromSelected(movesFrom);
        return;
      }

      // Clicking elsewhere clears selection.
      setSelected(null);
      setLegalMovesFromSelected([]);
      return;
    }

    // No selection yet: select own piece.
    if (isSelectablePiece(r, c)) {
      const from = { r, c };
      setSelected(from);
      const movesFrom = allLegalMoves.filter(
        (m) => m.from.r === r && m.from.c === c
      );
      setLegalMovesFromSelected(movesFrom);
    }
  };

  // PUBLIC_INTERFACE
  const restartGame = () => {
    setPosition(createInitialPosition());
    setTurn("w");
    setSelected(null);
    setLegalMovesFromSelected([]);
    setMoveHistory([]);
  };

  const turnLabel = turn === "w" ? "White" : "Black";

  const statusText = (() => {
    if (status.checkmated) {
      const winner = turn === "w" ? "Black" : "White";
      return `Checkmate — ${winner} wins`;
    }
    if (status.stalemated) return "Stalemate — Draw";
    if (status.inCheck) return `${turnLabel} to move — Check`;
    return `${turnLabel} to move`;
  })();

  return (
    <div className="App neon">
      <header className="nv-header">
        <div className="nv-header__left">
          <div className="nv-brand">Neon Violet Chess</div>
          <div className="nv-subtitle">Interactive chessboard with legal moves</div>
        </div>

        <div className="nv-header__right">
          <div
            className={`nv-pill ${
              status.checkmated || status.stalemated
                ? "nv-pill--ended"
                : status.inCheck
                ? "nv-pill--danger"
                : "nv-pill--ok"
            }`}
            aria-live="polite"
          >
            {statusText}
          </div>

          <button className="nv-btn" onClick={restartGame}>
            Restart
          </button>
        </div>
      </header>

      <main className="nv-main">
        <section className="nv-boardCard" aria-label="Chessboard">
          <div className="nv-board">
            {position.board.map((row, r) => (
              <div className="rank" key={`r-${r}`}>
                {row.map((piece, c) => {
                  const algebraic = squareToAlgebraic({ r, c });
                  const showCoord =
                    (r === 7 && c === 0) || // show bottom-left
                    (r === 7 && c === 7) ||
                    (r === 0 && c === 0) ||
                    (r === 0 && c === 7);

                  return (
                    <button
                      key={`sq-${r}-${c}`}
                      className={squareClasses(r, c)}
                      onClick={() => handleSquareClick(r, c)}
                      aria-label={`Square ${algebraic}${
                        piece
                          ? `, ${piece.color === "w" ? "white" : "black"} ${
                              piece.type
                            }`
                          : ""
                      }`}
                      type="button"
                    >
                      <span className="piece" aria-hidden="true">
                        {unicodePiece(piece)}
                      </span>

                      {showCoord ? (
                        <span className="coord" aria-hidden="true">
                          {algebraic}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="nv-hintBar" aria-label="Hints">
            <div className="nv-hint">
              Tip: Click a piece to see legal moves. Click a highlighted square
              to move.
            </div>
            <div className="nv-hint nv-hint--muted">
              Legal move validation includes checks (you cannot leave your king
              in check).
            </div>
          </div>
        </section>

        <aside className="nv-side">
          <section className="nv-panel" aria-label="Move history">
            <div className="nv-panel__title">Move History</div>
            {moveHistory.length === 0 ? (
              <div className="nv-empty">No moves yet.</div>
            ) : (
              <ol className="nv-moves">
                {moveHistory.map((m, idx) => (
                  <li key={`${m}-${idx}`} className="nv-move">
                    <span className="nv-move__idx">{idx + 1}.</span>
                    <span className="nv-move__text">{m}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="nv-panel" aria-label="Game info">
            <div className="nv-panel__title">Game Info</div>
            <div className="nv-infoRow">
              <span className="nv-infoKey">Turn</span>
              <span className="nv-infoVal">{turnLabel}</span>
            </div>
            <div className="nv-infoRow">
              <span className="nv-infoKey">In check</span>
              <span className="nv-infoVal">
                {status.inCheck ? "Yes" : "No"}
              </span>
            </div>
            <div className="nv-infoRow">
              <span className="nv-infoKey">Legal moves</span>
              <span className="nv-infoVal">{allLegalMoves.length}</span>
            </div>
          </section>
        </aside>
      </main>

      <footer className="nv-footer">
        <span className="nv-footer__muted">
          Neon Violet theme • Local rules engine • No backend required for this
          subtask
        </span>
      </footer>
    </div>
  );
}

export default App;
