import React, { useEffect } from 'react';
import type { Stage, Match, MatchGame, Participant } from 'brackets-model';
import type { TournamentState } from '../lib/types';

interface TournamentBracketProps {
  tournament: TournamentState | null;
}

const BRACKETS_CONTAINER_ID = 'brackets-viewer-container';

declare global {
  interface Window {
    bracketsViewer?: { render: (data: unknown, config?: { selector?: string; clear?: boolean }) => void };
  }
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ tournament }) => {
  useEffect(() => {
    if (!tournament?.bracketsViewerData) {
      const el = document.getElementById(BRACKETS_CONTAINER_ID);
      if (el) el.innerHTML = '';
      return;
    }

    const viewer = window.bracketsViewer;
    if (!viewer) return;

    const data = tournament.bracketsViewerData;
    const viewerData = {
      stages: data.stages as Stage[],
      matches: data.matches as Match[],
      matchGames: data.matchGames as MatchGame[],
      participants: data.participants as Participant[],
    };

    viewer.render(viewerData, {
      selector: `#${BRACKETS_CONTAINER_ID}`,
      clear: true,
    });
  }, [tournament?.bracketsViewerData]);

  if (!tournament) return null;

  return (
    <div className="tournament-bracket-wrapper">
      <div id={BRACKETS_CONTAINER_ID} className="brackets-viewer" />

      {tournament.status === 'finished' && tournament.champion && (
        <div className="tournament-results">
          <div className="result-line">
            <span className="result-rank">1st</span>
            <span className="result-name">{tournament.champion.username}</span>
          </div>
          {tournament.runnerUp && (
            <div className="result-line">
              <span className="result-rank">2nd</span>
              <span className="result-name">{tournament.runnerUp.username}</span>
            </div>
          )}
          {tournament.thirdPlace && (
            <div className="result-line">
              <span className="result-rank">3rd</span>
              <span className="result-name">{tournament.thirdPlace.username}</span>
            </div>
          )}
          {tournament.fourthPlace && (
            <div className="result-line">
              <span className="result-rank">4th</span>
              <span className="result-name">{tournament.fourthPlace.username}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
