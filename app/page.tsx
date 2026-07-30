"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Gem = "coral" | "cyan" | "lime" | "violet" | "amber" | "blue";
type Cell = { id: number; gem: Gem; clearing?: boolean };

const SIZE = 6;
const GEMS: Gem[] = ["coral", "cyan", "lime", "violet", "amber", "blue"];
const GEM_SYMBOLS: Record<Gem, string> = {
  coral: "✦",
  cyan: "◈",
  lime: "✚",
  violet: "✧",
  amber: "●",
  blue: "◆",
};

const randomGem = () => GEMS[Math.floor(Math.random() * GEMS.length)];

function makeBoard(): Cell[] {
  return Array.from({ length: SIZE * SIZE }, (_, index) => ({
    id: index,
    gem: randomGem(),
  }));
}

function findMatches(board: Cell[]) {
  const matches = new Set<number>();
  for (let row = 0; row < SIZE; row += 1) {
    let start = 0;
    while (start < SIZE) {
      const gem = board[row * SIZE + start]?.gem;
      let end = start + 1;
      while (end < SIZE && board[row * SIZE + end]?.gem === gem) end += 1;
      if (gem && end - start >= 3) {
        for (let column = start; column < end; column += 1) matches.add(row * SIZE + column);
      }
      start = end;
    }
  }
  for (let column = 0; column < SIZE; column += 1) {
    let start = 0;
    while (start < SIZE) {
      const gem = board[start * SIZE + column]?.gem;
      let end = start + 1;
      while (end < SIZE && board[end * SIZE + column]?.gem === gem) end += 1;
      if (gem && end - start >= 3) {
        for (let row = start; row < end; row += 1) matches.add(row * SIZE + column);
      }
      start = end;
    }
  }
  return matches;
}

function createPlayableBoard() {
  let next = makeBoard();
  while (findMatches(next).size > 0) next = makeBoard();
  return next;
}

function areNeighbors(a: number, b: number) {
  const rowA = Math.floor(a / SIZE);
  const columnA = a % SIZE;
  const rowB = Math.floor(b / SIZE);
  const columnB = b % SIZE;
  return Math.abs(rowA - rowB) + Math.abs(columnA - columnB) === 1;
}

function refill(board: Cell[], matches: Set<number>) {
  const next = [...board];
  for (let column = 0; column < SIZE; column += 1) {
    const survivors: Cell[] = [];
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      const index = row * SIZE + column;
      if (!matches.has(index)) survivors.push(next[index]);
    }
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      const index = row * SIZE + column;
      const survivor = survivors[SIZE - 1 - row];
      next[index] = survivor ?? { id: Date.now() + index + Math.random(), gem: randomGem() };
    }
  }
  return next;
}

export default function Home() {
  const [board, setBoard] = useState<Cell[]>(() => createPlayableBoard());
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(24);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [notice, setNotice] = useState("보석을 이어 붙여 빛을 깨워보세요");

  const isGameOver = moves === 0;

  useEffect(() => {
    const stored = window.localStorage.getItem("glow-grid-best");
    if (stored) setBest(Number(stored));
  }, []);

  const updateBest = useCallback((nextScore: number) => {
    setBest((current) => {
      const nextBest = Math.max(current, nextScore);
      window.localStorage.setItem("glow-grid-best", String(nextBest));
      return nextBest;
    });
  }, []);

  const clearMatches = useCallback(
    (startingBoard: Cell[], moveCombo = 0) => {
      const matches = findMatches(startingBoard);
      if (matches.size === 0) {
        setCombo(moveCombo);
        return;
      }
      const points = matches.size * 20 * Math.max(1, moveCombo + 1);
      setBoard(startingBoard.map((cell, index) => (matches.has(index) ? { ...cell, clearing: true } : cell)));
      window.setTimeout(() => {
        setScore((current) => {
          const nextScore = current + points;
          updateBest(nextScore);
          return nextScore;
        });
        setBoard((current) => refill(current, matches));
        clearMatches(refill(startingBoard, matches), moveCombo + 1);
      }, 230);
    },
    [updateBest],
  );

  const resetGame = useCallback(() => {
    setBoard(createPlayableBoard());
    setSelected(null);
    setScore(0);
    setMoves(24);
    setCombo(0);
    setNotice("새로운 빛의 조합을 찾아보세요");
  }, []);

  const playCell = useCallback(
    (index: number) => {
      if (isGameOver) return;
      if (selected === null) {
        setSelected(index);
        setNotice("이웃한 보석을 선택하면 교환됩니다");
        return;
      }
      if (selected === index) {
        setSelected(null);
        setNotice("선택을 취소했어요");
        return;
      }
      if (!areNeighbors(selected, index)) {
        setSelected(index);
        setNotice("바로 옆 보석만 교환할 수 있어요");
        return;
      }
      const swapped = [...board];
      [swapped[selected], swapped[index]] = [swapped[index], swapped[selected]];
      setSelected(null);
      setMoves((current) => Math.max(0, current - 1));
      const matches = findMatches(swapped);
      if (matches.size === 0) {
        setBoard(board);
        setCombo(0);
        setNotice("조합이 만들어지지 않았어요");
        return;
      }
      setBoard(swapped);
      setNotice(`${matches.size}개의 보석이 빛났어요!`);
      clearMatches(swapped);
    },
    [board, clearMatches, isGameOver, selected],
  );

  const statusText = useMemo(() => {
    if (isGameOver) return "오늘의 빛이 멈췄어요";
    if (combo > 1) return `${combo} COMBO · 계속 이어가세요`;
    return notice;
  }, [combo, isGameOver, notice]);

  return (
    <main className="game-page">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <section className="game-shell" aria-label="Glow Grid 퍼즐게임">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">✦</div>
            <div>
              <p className="eyebrow">DAILY PUZZLE · 07.28</p>
              <h1>Glow Grid</h1>
            </div>
          </div>
          <button className="new-game-button" onClick={resetGame}>새 게임 <span>↗</span></button>
        </header>

        <div className="game-layout">
          <section className="intro-panel">
            <p className="eyebrow accent">빛을 연결하세요</p>
            <h2>한 번의 교환,<br /><em>새로운 파동.</em></h2>
            <p className="intro-copy">같은 색 보석을 3개 이상 연결하면 보드에 빛이 번집니다. 가장 높은 콤보를 만들어 보세요.</p>
            <div className="rule-row"><span>01</span><p>보석을 탭해 선택</p></div>
            <div className="rule-row"><span>02</span><p>이웃한 보석과 교환</p></div>
            <div className="rule-row"><span>03</span><p>3개 이상 연결해 득점</p></div>
            <div className="quote">“작은 움직임이<br />큰 빛을 만듭니다.”</div>
          </section>

          <section className="play-panel">
            <div className="stats-row">
              <div className="stat"><span>현재 점수</span><strong>{score.toLocaleString()}</strong></div>
              <div className="stat"><span>남은 교환</span><strong className={moves <= 5 ? "warning" : ""}>{String(moves).padStart(2, "0")}</strong></div>
              <div className="stat"><span>최고 점수</span><strong>{best.toLocaleString()}</strong></div>
            </div>
            <div className="board-frame">
              <div className="board" role="grid" aria-label="6 곱하기 6 퍼즐 보드">
                {board.map((cell, index) => (
                  <button
                    key={cell.id}
                    className={`gem gem-${cell.gem} ${selected === index ? "selected" : ""} ${cell.clearing ? "clearing" : ""}`}
                    onClick={() => playCell(index)}
                    aria-label={`${cell.gem} 보석 ${index + 1}번${selected === index ? " 선택됨" : ""}`}
                    role="gridcell"
                  >
                    <span>{GEM_SYMBOLS[cell.gem]}</span>
                  </button>
                ))}
              </div>
              {isGameOver && (
                <div className="game-over" role="status">
                  <p className="eyebrow accent">ROUND COMPLETE</p>
                  <h3>{score.toLocaleString()}점</h3>
                  <p>다시 한 번 빛을 이어볼까요?</p>
                  <button className="restart-button" onClick={resetGame}>다시 시작하기</button>
                </div>
              )}
            </div>
            <div className="board-footer">
              <span className="live-dot" /> <span>{statusText}</span>
              <span className="footer-tip">TIP · 연속으로 터뜨리면 점수가 커져요</span>
            </div>
          </section>
        </div>
        <footer className="bottom-note"><span>GLOW GRID / A SMALL DAILY RITUAL</span><span>MADE FOR A BRIGHTER MINUTE ✦</span></footer>
      </section>
    </main>
  );
}
