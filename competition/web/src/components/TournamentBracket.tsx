import React from 'react';
import type { TournamentState, TournamentMatch } from '../lib/types';

interface TournamentBracketProps {
  tournament: TournamentState | null;
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ tournament }) => {
  if (!tournament) return null;

  return (
    <div className="tournament-bracket">
      {tournament.rounds.map((round, roundIndex) => (
        <div key={roundIndex} className="bracket-round">
          <div className="round-title">{round.title}</div>
          {round.matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ))}

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
        </div>
      )}
    </div>
  );
};

interface MatchCardProps {
  match: TournamentMatch;
}

const MatchCard: React.FC<MatchCardProps> = ({ match }) => {
  const white = match.whiteBot;
  const black = match.blackBot;

  const whiteClass = match.winner?.username === white?.username
    ? 'winner'
    : match.loser?.username === white?.username
      ? 'loser'
      : '';

  const blackClass = match.winner?.username === black?.username
    ? 'winner'
    : match.loser?.username === black?.username
      ? 'loser'
      : '';

  return (
    <div className={`bracket-match ${match.status}`}>
      <div className={`match-player ${whiteClass}`}>
        <span className="player-name">{white?.username ?? 'BYE'}</span>
      </div>
      <div className={`match-player ${blackClass}`}>
        <span className="player-name">{black?.username ?? 'BYE'}</span>
      </div>
      {match.status === 'running' && <div className="match-status">Playing</div>}
      {match.status === 'bye' && <div className="match-status">Bye</div>}
      {match.status === 'finished' && match.winner && (
        <div className="match-status">Winner: {match.winner.username}</div>
      )}
    </div>
  );
};
