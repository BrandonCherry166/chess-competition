import { BracketsManager } from 'brackets-manager';
import { InMemoryDatabase } from 'brackets-memory-db';
import { Status } from 'brackets-model';
import type { BotInfo } from './types';
import { shuffleBots } from './tournament';

const TOURNAMENT_ID = 0;

/** Matches with both opponents ready (or running). Status.Ready=2, Status.Running=3 */
const ONGOING_STATUSES = [Status.Ready, Status.Running];

/** Get playable matches for double elimination (brackets-manager doesn't implement currentMatches for double elim). */
export async function getCurrentMatches(
  storage: InMemoryDatabase,
  stageId: number,
): Promise<{ id: number; opponent1?: { id: number | null }; opponent2?: { id: number | null } }[]> {
  const matches = (await storage.select('match', { stage_id: stageId })) as { id: number; status: number; opponent1?: { id: number | null }; opponent2?: { id: number | null } }[] | null;
  if (!matches) return [];
  return matches.filter((m) => ONGOING_STATUSES.includes(m.status));
}

export interface BracketsTournamentContext {
  manager: BracketsManager;
  storage: InMemoryDatabase;
  tournamentId: number;
  stageId: number;
  participantMap: Map<number, BotInfo>;
  botToParticipantId: Map<string, number>;
}

function nextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
}

export async function createBracketsTournament(bots: BotInfo[]): Promise<BracketsTournamentContext> {
  const storage = new InMemoryDatabase();
  const manager = new BracketsManager(storage, false);

  const shuffled = shuffleBots(bots);
  const targetSize = nextPowerOfTwo(shuffled.length);
  const seeding: (string | null)[] = [...shuffled.map((b) => b.username)];
  while (seeding.length < targetSize) {
    seeding.push(null);
  }

  await manager.create.stage({
    tournamentId: TOURNAMENT_ID,
    name: 'Double Elimination',
    type: 'double_elimination',
    seeding,
    settings: {
      grandFinal: 'double',
      matchesChildCount: 0,
      seedOrdering: ['inner_outer'],
      balanceByes: true,
    },
  });

  const stages = (await storage.select('stage', { tournament_id: TOURNAMENT_ID })) as { id: number }[] | null;
  const stage = stages?.[0];
  if (!stage) throw new Error('Stage not found');
  const stageId = stage.id;

  const participantMap = new Map<number, BotInfo>();
  const botToParticipantId = new Map<string, number>();

  const participants = (await storage.select('participant', { tournament_id: TOURNAMENT_ID })) as { id: number; name: string }[] | null;
  if (participants) {
    for (const p of participants) {
      const pp = p;
      const bot = shuffled.find((b) => b.username === pp.name);
      if (bot) {
        participantMap.set(pp.id, bot);
        botToParticipantId.set(bot.username, pp.id);
      }
    }
  }

  return {
    manager,
    storage,
    tournamentId: TOURNAMENT_ID,
    stageId,
    participantMap,
    botToParticipantId,
  };
}

export async function updateMatchResult(
  manager: BracketsManager,
  matchId: number,
  match: { opponent1?: { id: number | null } | null; opponent2?: { id: number | null } | null },
  winnerParticipantId: number,
  loserParticipantId: number,
  winnerScore: number,
  loserScore: number,
): Promise<void> {
  const isWinnerOpponent1 = match.opponent1?.id === winnerParticipantId;
  await manager.update.match({
    id: matchId,
    status: Status.Completed,
    opponent1: {
      id: isWinnerOpponent1 ? winnerParticipantId : loserParticipantId,
      score: isWinnerOpponent1 ? winnerScore : loserScore,
      result: isWinnerOpponent1 ? 'win' : 'loss',
    },
    opponent2: {
      id: isWinnerOpponent1 ? loserParticipantId : winnerParticipantId,
      score: isWinnerOpponent1 ? loserScore : winnerScore,
      result: isWinnerOpponent1 ? 'loss' : 'win',
    },
  });
}
