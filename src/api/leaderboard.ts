import instance from './instance';
import type {Replay} from '../game/SnakeGame.ts';

export interface LeaderboardItem {
  id: number,
  score: number,
  difficulty: 1 | 2 | 3,
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
  slug: string,
}

export interface SharedReplay {
  id: number,
  score: number,
  difficulty: 1 | 2 | 3,
  place: number,
  user: {
    id: number,
    name: string,
    profilePhoto: string | null,
  },
  replay: Replay,
}

export const addScore = async (replay: Replay) => {
  return instance.post<Rank>('/game/score', {...replay});
};

export const getLeaderboard = async () => {
  return instance.get<LeaderboardItem[]>('/game/leaderboard');
};

export const getMyRanks = async ({next, limit} : {next?: string, limit?: number}) => {
  return instance.get<{ranks: Rank[], next: string | null}>('/game/my-ranks', {params: {cursor: next, limit: limit || 50}});
};

export const getReplayById = async (id: number) => {
  return instance.get<Replay>(`/game/replay/${id}`);
};

export const getSharedReplay = async (slug: string) => {
  return instance.get<SharedReplay>(`/game/shared/${slug}`);
};

export const assignRanks = async (slugs: string[]) => {
  return instance.put('/game/assign', {slugs});
};