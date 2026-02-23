import React from 'react';
import type { BotInfo } from '../lib/types';

interface BotSelectorProps {
  bots: BotInfo[];
  whiteBot: BotInfo | null;
  blackBot: BotInfo | null;
  onWhiteChange: (bot: BotInfo | null) => void;
  onBlackChange: (bot: BotInfo | null) => void;
  onStart: () => void;
  disabled: boolean;
  loading: boolean;
}

export const BotSelector: React.FC<BotSelectorProps> = ({
  bots,
  whiteBot,
  blackBot,
  onWhiteChange,
  onBlackChange,
  onStart,
  disabled,
  loading,
}) => {
  const findBot = (username: string) => bots.find((b) => b.username === username) ?? null;

  return (
    <div className="bot-selector">
      <h2>Select Bots</h2>
      <div className="bot-selector-row">
        <div className="bot-pick">
          <label>White</label>
          <div className="bot-pick-inner">
            {whiteBot && (
              <img
                className="bot-avatar"
                src={whiteBot.avatar}
                alt={whiteBot.username}
              />
            )}
            <select
              value={whiteBot?.username ?? ''}
              onChange={(e) => onWhiteChange(findBot(e.target.value))}
              disabled={disabled}
            >
              <option value="">-- Select White Bot --</option>
              {bots.map((b) => (
                <option key={b.username} value={b.username}>
                  {b.username}
                </option>
              ))}
            </select>
          </div>
        </div>

        <span className="vs-label">VS</span>

        <div className="bot-pick">
          <label>Black</label>
          <div className="bot-pick-inner">
            {blackBot && (
              <img
                className="bot-avatar"
                src={blackBot.avatar}
                alt={blackBot.username}
              />
            )}
            <select
              value={blackBot?.username ?? ''}
              onChange={(e) => onBlackChange(findBot(e.target.value))}
              disabled={disabled}
            >
              <option value="">-- Select Black Bot --</option>
              {bots.map((b) => (
                <option key={b.username} value={b.username}>
                  {b.username}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        className="btn-start"
        onClick={onStart}
        disabled={disabled || !whiteBot || !blackBot || loading}
      >
        {loading ? 'Loading Bots...' : 'Start Game'}
      </button>
    </div>
  );
};
