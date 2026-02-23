import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BotInfo, GameState } from './lib/types';
import { GameEngine } from './lib/game-engine';
import { BotSelector } from './components/BotSelector';
import { GameBoard } from './components/GameBoard';
import { MoveHistory } from './components/MoveHistory';
import { GameControls } from './components/GameControls';
import './App.css';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const initialGameState: GameState = {
  status: 'idle',
  result: null,
  fen: INITIAL_FEN,
  moves: [],
  currentTurn: 'w',
  whiteBot: null,
  blackBot: null,
  lastMoveTimeMs: 0,
};

function App() {
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [whiteBot, setWhiteBot] = useState<BotInfo | null>(null);
  const [blackBot, setBlackBot] = useState<BotInfo | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moveDelay, setMoveDelay] = useState(500);
  const engineRef = useRef<GameEngine | null>(null);

  // Fetch manifest on mount
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}bots/manifest.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
        return res.json();
      })
      .then((data: BotInfo[]) => setBots(data))
      .catch((err) => setError(`Could not load bot list: ${err.message}`));
  }, []);

  // State change callback for engine
  const onStateChange = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  // Initialize engine
  useEffect(() => {
    engineRef.current = new GameEngine(onStateChange);
    return () => {
      engineRef.current?.cleanup();
    };
  }, [onStateChange]);

  // Update move delay in engine
  useEffect(() => {
    engineRef.current?.setMoveDelay(moveDelay);
  }, [moveDelay]);

  const handleStart = async () => {
    if (!whiteBot || !blackBot || !engineRef.current) return;
    setError(null);
    setLoading(true);
    try {
      await engineRef.current.loadBots(whiteBot, blackBot);
      setLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setLoading(false);
    }
  };

  const handlePlay = () => {
    engineRef.current?.play();
  };

  const handlePause = () => {
    engineRef.current?.pause();
  };

  const handleStep = () => {
    engineRef.current?.step();
  };

  const handleReset = () => {
    engineRef.current?.reset();
  };

  const gameActive = gameState.status !== 'idle' || loading;

  return (
    <div className="app">
      <header className="app-header">
        <h1>♟ Chess Competition</h1>
        <p>Select two bots and watch them battle it out!</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <BotSelector
        bots={bots}
        whiteBot={whiteBot}
        blackBot={blackBot}
        onWhiteChange={setWhiteBot}
        onBlackChange={setBlackBot}
        onStart={handleStart}
        disabled={gameActive}
        loading={loading}
      />

      {(gameState.whiteBot || loading) && (
        <div className="game-layout">
          <div className="game-left">
            <GameBoard gameState={gameState} />
          </div>
          <div className="game-right">
            <GameControls
              gameState={gameState}
              onPlay={handlePlay}
              onPause={handlePause}
              onStep={handleStep}
              onReset={handleReset}
              moveDelay={moveDelay}
              onMoveDelayChange={setMoveDelay}
            />
            <MoveHistory moves={gameState.moves} />
          </div>
        </div>
      )}

      {bots.length === 0 && !error && (
        <div className="loading">Loading bots...</div>
      )}
    </div>
  );
}

export default App;
