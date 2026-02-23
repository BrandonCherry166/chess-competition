import React, { useEffect, useRef } from 'react';
import type { MoveRecord } from '../lib/types';

interface MoveHistoryProps {
  moves: MoveRecord[];
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({ moves }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [moves.length]);

  // Group moves into pairs (white + black)
  const pairs: { num: number; white?: MoveRecord; black?: MoveRecord }[] = [];
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move.color === 'w') {
      pairs.push({ num: move.moveNumber, white: move });
    } else {
      if (pairs.length > 0 && !pairs[pairs.length - 1].black) {
        pairs[pairs.length - 1].black = move;
      } else {
        pairs.push({ num: move.moveNumber, black: move });
      }
    }
  }

  return (
    <div className="move-history">
      <h3>Move History</h3>
      <div className="move-list">
        {pairs.length === 0 && <p className="no-moves">No moves yet</p>}
        {pairs.map((pair, i) => (
          <div key={i} className="move-pair">
            <span className="move-num">{pair.num}.</span>
            {pair.white && (
              <span className="move-san white-move" title={`${pair.white.timeMs}ms`}>
                {pair.white.san}
              </span>
            )}
            {pair.black && (
              <span className="move-san black-move" title={`${pair.black.timeMs}ms`}>
                {pair.black.san}
              </span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
