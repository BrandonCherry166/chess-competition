import React from 'react';
import { Chessboard } from 'react-chessboard';
import type { GameState } from '../lib/types';

interface GameBoardProps {
  gameState: GameState;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState }) => {
  // Highlight the last move
  const lastMove = gameState.moves.length > 0
    ? gameState.moves[gameState.moves.length - 1]
    : null;

  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    const from = lastMove.uci.substring(0, 2);
    const to = lastMove.uci.substring(2, 4);
    customSquareStyles[from] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' };
    customSquareStyles[to] = { backgroundColor: 'rgba(255, 255, 0, 0.5)' };
  }

  return (
    <div className="game-board">
      <div className="board-header">
        <BotLabel
          bot={gameState.blackBot}
          color="black"
          isActive={gameState.currentTurn === 'b' && gameState.status === 'running'}
        />
      </div>
      <Chessboard
        id="competition-board"
        position={gameState.fen}
        boardWidth={480}
        arePiecesDraggable={false}
        customSquareStyles={customSquareStyles}
        customDarkSquareStyle={{ backgroundColor: '#779952' }}
        customLightSquareStyle={{ backgroundColor: '#edeed1' }}
      />
      <div className="board-footer">
        <BotLabel
          bot={gameState.whiteBot}
          color="white"
          isActive={gameState.currentTurn === 'w' && gameState.status === 'running'}
        />
      </div>
    </div>
  );
};

interface BotLabelProps {
  bot: { username: string; avatar: string } | null;
  color: string;
  isActive: boolean;
}

const BotLabel: React.FC<BotLabelProps> = ({ bot, color, isActive }) => {
  if (!bot) return null;
  return (
    <div className={`bot-label ${isActive ? 'active' : ''}`}>
      <img className="bot-avatar-sm" src={bot.avatar} alt={bot.username} />
      <span className="bot-name">{bot.username}</span>
      <span className="bot-color">({color})</span>
      {isActive && <span className="thinking-indicator">thinking...</span>}
    </div>
  );
};
