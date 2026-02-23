export interface BotInfo {
  username: string;
  avatar: string;
  forkUrl: string;
}

export type GameStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'finished';

export type GameResult =
  | 'white-checkmate'
  | 'black-checkmate'
  | 'stalemate'
  | 'draw-repetition'
  | 'draw-insufficient'
  | 'draw-50-move'
  | 'white-forfeit-invalid'
  | 'black-forfeit-invalid'
  | 'white-forfeit-timeout'
  | 'black-forfeit-timeout'
  | null;

export interface MoveRecord {
  moveNumber: number;
  san: string;
  uci: string;
  fen: string;
  color: 'w' | 'b';
  timeMs: number;
}

export interface GameState {
  status: GameStatus;
  result: GameResult;
  fen: string;
  moves: MoveRecord[];
  currentTurn: 'w' | 'b';
  whiteBot: BotInfo | null;
  blackBot: BotInfo | null;
  lastMoveTimeMs: number;
}

// Messages from main thread -> worker
export type WorkerInMessage =
  | { type: 'load'; botUrl: string }
  | { type: 'move'; fen: string; timeLimitMs: number };

// Messages from worker -> main thread
export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'result'; uci: string }
  | { type: 'error'; message: string };
