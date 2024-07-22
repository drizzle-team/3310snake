import instance from './instance';
import type {Replay} from '../game/SnakeGame.ts';

export interface LeaderboardItem {
  id: number,
  score: number,
  difficulty: number,
  place: number,
  user: {
    id: number,
    name: string,
    profilePhoto: string | null,
  }
}

export interface Rank {
  id: number,
  score: number,
  difficulty: 1 | 2 | 3,
  place: number,
}

export const addScore = async (replay: Replay) => {
  return instance.post<Rank>('/game/score', {...replay});
};

export const getLeaderboard = async () => {
  return instance.get<LeaderboardItem[]>('/game/leaderboard');
};

export const getMyRanks = async (next?: string) => {
  return instance.get<{ranks: Rank[], next: string | null}>('/game/my-ranks', {params: {cursor: next, limit: 50}});
};

export const getReplayById = async (id: number) => {
  return instance.get<Replay>(`/game/replay/${id}`);
};