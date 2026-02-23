export interface BotInfo {
  username: string;
  avatar: string;
  forkUrl: string;
}

export type PlayerType = 'bot' | 'human';

export interface PlayerInfo {
  type: PlayerType;
  bot: BotInfo | null; // null when type === 'human'
}

export const HUMAN_PLAYER: PlayerInfo = {
  type: 'human',
  bot: null,
};

export type GameStatus =
  | 'idle'
  | 'waiting-human' // waiting for a human move
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
  whitePlayer: PlayerInfo | null;
  blackPlayer: PlayerInfo | null;
  lastMoveTimeMs: number;
  timeLimitMs: number;
}

export type TournamentStatus = 'idle' | 'running' | 'finished';

export type TournamentMatchStatus = 'pending' | 'running' | 'finished' | 'bye';

export interface TournamentMatch {
  id: string;
  roundIndex: number;
  matchIndex: number;
  whiteBot: BotInfo | null;
  blackBot: BotInfo | null;
  winner: BotInfo | null;
  loser: BotInfo | null;
  status: TournamentMatchStatus;
}

export interface TournamentRound {
  title: string;
  matches: TournamentMatch[];
}

export interface TournamentState {
  status: TournamentStatus;
  rounds: TournamentRound[];
  currentMatchId: string | null;
  champion: BotInfo | null;
  runnerUp: BotInfo | null;
  thirdPlace: BotInfo | null;
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
