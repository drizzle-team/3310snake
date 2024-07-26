import instance from './instance';
import type {Replay} from '../game/SnakeGame.ts';
import {createAuthHeader} from "../utils/createAuthHeader.ts";

export interface LeaderboardItem {
  id: number,
  score: number,
  difficulty: 1 | 2 | 3,
  place: number,
  slug: string,
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

export const addScore = async (data: {replay: Replay, roomId?: number}) => {
  const authHeader = createAuthHeader();
  return instance.post<Rank>('/game/score', data, {
    headers: {
      'X-Analytics': authHeader,
    }
  });
};

export const getLeaderboard = async (roomId?: number) => {
  return instance.get<LeaderboardItem[]>('/game/leaderboard', {params: {roomId}});
};

export const getMyRanks = async ({next, limit, roomId} : {next?: string, limit?: number, roomId?: number}) => {
  return instance.get<{runs: Rank[], next: string | null}>('/game/my-runs', {params: {cursor: next, limit: limit || 50, roomId}});
};

export const getReplayById = async (id: number) => {
  return instance.get<Replay>(`/game/replay/${id}`);
};

export const getSharedReplay = async (slug: string, roomId?: number) => {
  return instance.get<SharedReplay>(`/game/shared/${slug}`, {params: {roomId}});
};

export const assignRanks = async (slugs: string[]) => {
  const authHeader = createAuthHeader();
  return instance.put('/game/assign', {slugs}, {
    headers: {
      'X-Analytics': authHeader,
    }
  });
};

export const createRoom = async (name: string) => {
  return instance.post('/room', {name});
};

export const getRoom = async (name: string) => {
  return instance.get<{id: number}>(`/room/${name}`);
};

export const getUserRuns = async ({next, limit, userId, roomId} : {next?: string, limit?: number, userId: number, roomId?: number}) => {
  return instance.get<{runs: Rank[], next: string | null}>(`/game/${userId}/runs`, {params: {cursor: next, limit: limit || 50, roomId}});
};