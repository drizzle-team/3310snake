import instance from './instance';

export interface User {
  id: number,
  email: string,
  gitHubName: string,
  profilePhoto: string,
  bestScore: number | null
}

export const refreshAccessToken = () => {
  return instance.get('/auth/refresh');
};

export const signIn = (code: string) => {
  return instance.post('/auth/sign-in', {code});
};

export const signOut = () => {
  return instance.get('/auth/sign-out');
};

export const getMe = () => {
  return instance.get<User>('/users/me')
}
