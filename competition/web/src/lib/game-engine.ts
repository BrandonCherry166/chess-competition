import { Chess } from 'chess.js';
import type {
  BotInfo,
  GameState,
  GameResult,
  MoveRecord,
  WorkerInMessage,
  WorkerOutMessage,
} from './types';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const DEFAULT_TIME_LIMIT_MS = 10000;
const DEFAULT_MOVE_DELAY_MS = 500;

export class GameEngine {
  private chess: Chess;
  private whiteWorker: Worker | null = null;
  private blackWorker: Worker | null = null;
  private whiteReady = false;
  private blackReady = false;
  private state: GameState;
  private onStateChange: (state: GameState) => void;
  private moveDelayMs: number;
  private timeLimitMs: number;
  private abortController: AbortController | null = null;
  private stepping = false;

  constructor(onStateChange: (state: GameState) => void) {
    this.chess = new Chess();
    this.moveDelayMs = DEFAULT_MOVE_DELAY_MS;
    this.timeLimitMs = DEFAULT_TIME_LIMIT_MS;
    this.onStateChange = onStateChange;
    this.state = this.buildState('idle', null);
  }

  private buildState(
    status: GameState['status'],
    result: GameResult,
  ): GameState {
    return {
      status,
      result,
      fen: this.chess.fen(),
      moves: [...(this.state?.moves ?? [])],
      currentTurn: this.chess.turn(),
      whiteBot: this.state?.whiteBot ?? null,
      blackBot: this.state?.blackBot ?? null,
      lastMoveTimeMs: this.state?.lastMoveTimeMs ?? 0,
    };
  }

  private emit(status: GameState['status'], result: GameResult) {
    this.state = this.buildState(status, result);
    this.onStateChange({ ...this.state });
  }

  getState(): GameState {
    return { ...this.state };
  }

  setMoveDelay(ms: number) {
    this.moveDelayMs = ms;
  }

  setTimeLimit(ms: number) {
    this.timeLimitMs = ms;
  }

  async loadBots(whiteBot: BotInfo, blackBot: BotInfo): Promise<void> {
    this.cleanup();
    this.chess = new Chess();
    this.state = {
      status: 'idle',
      result: null,
      fen: INITIAL_FEN,
      moves: [],
      currentTurn: 'w',
      whiteBot,
      blackBot,
      lastMoveTimeMs: 0,
    };

    const base = import.meta.env.BASE_URL;

    // Create workers
    this.whiteWorker = new Worker(
      new URL('../workers/bot-worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.blackWorker = new Worker(
      new URL('../workers/bot-worker.ts', import.meta.url),
      { type: 'module' },
    );

    // Load bots into workers
    const whiteReady = this.waitForReady(this.whiteWorker, 'white');
    const blackReady = this.waitForReady(this.blackWorker, 'black');

    const whiteMsg: WorkerInMessage = {
      type: 'load',
      botUrl: `${base}bots/${whiteBot.username}.js`,
    };
    const blackMsg: WorkerInMessage = {
      type: 'load',
      botUrl: `${base}bots/${blackBot.username}.js`,
    };

    this.whiteWorker.postMessage(whiteMsg);
    this.blackWorker.postMessage(blackMsg);

    await Promise.all([whiteReady, blackReady]);
    this.emit('idle', null);
  }

  private waitForReady(worker: Worker, side: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${side} bot failed to load within 30s`));
      }, 30000);

      const handler = (e: MessageEvent<WorkerOutMessage>) => {
        if (e.data.type === 'ready') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          if (side === 'white') this.whiteReady = true;
          else this.blackReady = true;
          resolve();
        } else if (e.data.type === 'error') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          reject(new Error(`${side} bot load error: ${e.data.message}`));
        }
      };

      worker.addEventListener('message', handler);
    });
  }

  async play(): Promise<void> {
    if (this.state.status === 'finished') return;
    if (this.state.status === 'running') return;

    this.abortController = new AbortController();
    this.emit('running', null);

    try {
      await this.gameLoop(this.abortController.signal);
    } catch {
      // Aborted (pause/reset)
    }
  }

  pause(): void {
    if (this.state.status !== 'running') return;
    this.abortController?.abort();
    this.abortController = null;
    this.emit('paused', null);
  }

  async step(): Promise<void> {
    if (this.state.status === 'finished') return;
    if (this.state.status === 'running') return;
    this.stepping = true;
    await this.executeSingleMove();
    this.stepping = false;
  }

  reset(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.chess = new Chess();
    this.state = {
      ...this.state,
      status: 'idle',
      result: null,
      fen: INITIAL_FEN,
      moves: [],
      currentTurn: 'w',
      lastMoveTimeMs: 0,
    };
    this.emit('idle', null);
  }

  private async gameLoop(signal: AbortSignal): Promise<void> {
    while (!this.chess.isGameOver() && !signal.aborted) {
      await this.executeSingleMove();

      if (this.state.status === 'finished') return;

      // Inter-move delay for visualization
      if (!signal.aborted && this.moveDelayMs > 0) {
        await this.delay(this.moveDelayMs, signal);
      }
    }

    if (!signal.aborted && this.chess.isGameOver()) {
      this.finishGame();
    }
  }

  private async executeSingleMove(): Promise<void> {
    const turn = this.chess.turn();
    const worker = turn === 'w' ? this.whiteWorker : this.blackWorker;

    if (!worker) {
      this.emit('finished', turn === 'w' ? 'white-forfeit-invalid' : 'black-forfeit-invalid');
      return;
    }

    const fen = this.chess.fen();
    const startTime = performance.now();

    let uci: string;
    try {
      uci = await this.requestMove(worker, fen, turn);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timeout')) {
        this.emit('finished', turn === 'w' ? 'white-forfeit-timeout' : 'black-forfeit-timeout');
      } else {
        this.emit('finished', turn === 'w' ? 'white-forfeit-invalid' : 'black-forfeit-invalid');
      }
      return;
    }

    const elapsed = performance.now() - startTime;

    // Validate and apply the move
    try {
      // Convert UCI to move object
      const from = uci.substring(0, 2);
      const to = uci.substring(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;

      const moveResult = this.chess.move({ from, to, promotion });

      if (!moveResult) {
        this.emit('finished', turn === 'w' ? 'white-forfeit-invalid' : 'black-forfeit-invalid');
        return;
      }

      const moveRecord: MoveRecord = {
        moveNumber: Math.ceil(this.state.moves.length / 2) + 1,
        san: moveResult.san,
        uci,
        fen: this.chess.fen(),
        color: turn,
        timeMs: Math.round(elapsed),
      };

      this.state.moves.push(moveRecord);
      this.state.lastMoveTimeMs = Math.round(elapsed);

      if (this.chess.isGameOver()) {
        this.finishGame();
      } else if (!this.stepping) {
        this.emit('running', null);
      } else {
        this.emit('paused', null);
      }
    } catch {
      this.emit('finished', turn === 'w' ? 'white-forfeit-invalid' : 'black-forfeit-invalid');
    }
  }

  private requestMove(worker: Worker, fen: string, turn: 'w' | 'b'): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.removeEventListener('message', handler);
        reject(new Error(`timeout: ${turn === 'w' ? 'White' : 'Black'} bot exceeded time limit`));
      }, this.timeLimitMs + 1000); // +1s grace for WASM overhead

      const handler = (e: MessageEvent<WorkerOutMessage>) => {
        clearTimeout(timeout);
        worker.removeEventListener('message', handler);

        if (e.data.type === 'result') {
          resolve(e.data.uci);
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.message));
        }
      };

      worker.addEventListener('message', handler);

      const msg: WorkerInMessage = {
        type: 'move',
        fen,
        timeLimitMs: this.timeLimitMs,
      };
      worker.postMessage(msg);
    });
  }

  private finishGame(): void {
    let result: GameResult = null;

    if (this.chess.isCheckmate()) {
      // The side whose turn it is has been checkmated
      result = this.chess.turn() === 'w' ? 'black-checkmate' : 'white-checkmate';
    } else if (this.chess.isStalemate()) {
      result = 'stalemate';
    } else if (this.chess.isThreefoldRepetition()) {
      result = 'draw-repetition';
    } else if (this.chess.isInsufficientMaterial()) {
      result = 'draw-insufficient';
    } else if (this.chess.isDraw()) {
      result = 'draw-50-move';
    }

    this.emit('finished', result);
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      }, { once: true });
    });
  }

  cleanup(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.whiteWorker?.terminate();
    this.blackWorker?.terminate();
    this.whiteWorker = null;
    this.blackWorker = null;
    this.whiteReady = false;
    this.blackReady = false;
  }
}
