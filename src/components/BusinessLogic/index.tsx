import React, {useEffect, useMemo, useRef, useState} from "react";
import type {Replay} from "../../game/SnakeGame.ts";
import {SnakeGame} from "../../game/SnakeGame";
import {getMe, signIn, signOut} from "../../api/auth";
import type {User} from "../../api/auth.ts";
import {
  addScore,
  assignRanks,
  getLeaderboard,
  getMyRanks,
  getReplayById,
  getSharedReplay
} from "../../api/leaderboard.ts";
import type {Rank, LeaderboardItem, SharedReplay} from "../../api/leaderboard.ts";
import InfiniteScroll from "react-infinite-scroll-component";
import {githubAuthLink} from "../../const";

export const preventControlButtons = (e: KeyboardEvent) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(
      e.code,
    ) > -1
  ) {
    e.preventDefault();
  }
};

const isLeaderboardOpen = !!localStorage.getItem('isLeaderboardOpen')

const BusinessLogic: React.FC<{code?: string, replaySlug?: string}> = ({code, replaySlug}) => {
  const [open, setIsOpen] = useState(!!replaySlug || isLeaderboardOpen);
  const [userReplay, setUserReplay] = useState<Replay>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isToastShown, setIsToastShown] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'authorized' | 'unauthorized' | 'copied', score?: number, place?: number, rankSlug?: string } | null>(null);
  const [currentReplayId, setCurrentReplayId] = useState<number | null>(null);
  const snakeGame = useMemo(() => new SnakeGame({setUserReplay, setCurrentReplayId}), []);
  const [tab, setTab] = useState<'global' | 'personal' | 'shared'>(replaySlug ? 'shared' : 'global');
  const [myRanks, setMyRanks] = useState<{ranks: Rank[], next: string | null} | null>(null);
  const [loading, setLoading] = useState<'global' | 'personal' | 'shared' | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[] | null>(null);
  const [sharedReplay, setSharedReplay] = useState<SharedReplay | null | undefined>(null);
  const toastTimeoutRef = useRef<any>(null);
  const hideToastTimeoutRef = useRef<any>(null);

  const getUser = async () => {
    const user = await getMe();
    setUser(user);
  }

  const addUserScore = async (replay: Replay) => {
    const data = await addScore(replay);
    setUserReplay(null);

    if (user) {
      if (!user.bestScore || user.bestScore < replay!.score) {
        setUser({...user, bestScore: replay!.score})
        showToast({
          type: 'authorized',
          score: replay!.score,
          place: data.place,
          timeout: 5000,
        })
      }
      getLeaderboardData();
      getMyRanksData({limit: myRanks?.ranks.length ? myRanks?.ranks.length + 1 : 30});
    } else {
      const userRanksJSON = localStorage.getItem('userRanks');
      const userRanks = userRanksJSON ? JSON.parse(userRanksJSON) as {maxScore: number, slugs: string[]} : null
      if (userRanks) {
        if (userRanks.maxScore < replay!.score) {
          showToast({
            type: 'unauthorized',
            score: replay!.score,
            place: data.place,
            timeout: 10000,
          })
          localStorage.setItem('userRanks', JSON.stringify({
            maxScore: replay!.score,
            slugs: [...userRanks.slugs, data.slug]
          }))
        } else {
          localStorage.setItem('userRanks', JSON.stringify({
            ...userRanks,
            slugs: [...userRanks.slugs, data.slug]
          }))
        }
      } else {
        showToast({
          type: 'unauthorized',
          score: replay!.score,
          place: data.place,
          timeout: 10000,
        })
        localStorage.setItem('userRanks', JSON.stringify({
          maxScore: replay!.score,
          slugs: [data.slug]
        }))
      }
    }
  }

  const getLeaderboardData = async () => {
    if (leaderboard === null) setLoading('global');
    const data = await getLeaderboard();
    setLeaderboard(data)
    setLoading(null);
  }

  const getReplayData = async (id: number) => {
    if (!snakeGame.isReplay && snakeGame.tick)  return;

    const data = await getReplayById(id);
    setCurrentReplayId(id);
    playReplay(data);
  }

  const playSharedReplay = () => {
    if ((!snakeGame.isReplay && snakeGame.tick) || !sharedReplay)  return;
    setCurrentReplayId(sharedReplay.id);
    playReplay(sharedReplay.replay);
  }

  const getSharedReplayData = async (slug: string) => {
    try {
      setLoading('shared');
      const data = await getSharedReplay(slug);
      setSharedReplay(data);
      setCurrentReplayId(data.id);
      playReplay(data.replay);
    } catch (e) {
      setSharedReplay(undefined)
    } finally {
      setLoading(null);
    }
  }

  const shareRank = async (slug: string) => {
    await navigator.clipboard.writeText(`https://3310snake.com/?replay=${slug}`);
    showToast({type: 'copied', timeout: 2000, rankSlug: slug})
  }

  const getMyRanksData = async ({next, limit} : {next?: string, limit?: number}) => {
    if (myRanks === null) setLoading('personal');
    const data = await getMyRanks({next, limit});
    if (next) {
      setMyRanks((prev) => ({ranks: [...prev!.ranks, ...data.ranks], next: data.next}))
    } else {
      setMyRanks(data)
    }

    setLoading(null);
  }

  const signInUser = async (code: string) => {
    await signIn(code);
    const userRanksJSON = localStorage.getItem('userRanks');
    const userRanks = userRanksJSON ? JSON.parse(userRanksJSON) as {maxScore: number, slugs: string[]} : null;
    if (userRanks?.slugs) await assignRanks(userRanks.slugs);
    const user = await getMe();
    setUser(user);
    getLeaderboardData();
    localStorage.removeItem('userRanks');
    localStorage.setItem('isLoggedIn', 'true');
  }

  const signOutUser = async () => {
    await signOut();
    setUser(null);
    localStorage.removeItem('isLoggedIn');
  }

  const changeDifficulty = () => {
    switch (Number(snakeGame.difficulty)) {
      case 1:
        document.getElementById("game-difficulty")!.innerText = `Normal`;
        snakeGame.difficulty = 2;
        break;
      case 2:
        document.getElementById("game-difficulty")!.innerText = `Hard`;
        snakeGame.difficulty = 3;
        break;
      case 3:
        document.getElementById("game-difficulty")!.innerText = `Easy`;
        snakeGame.difficulty = 1;
        break;
    }
  };

  const getDifficultyName = (value: 1 | 2 | 3) => {
    switch (value) {
      case 1:
        return 'Easy';
      case 2:
        return 'Normal';
      case 3:
        return 'Hard';
    }
  };

  const startGame = () => {
    document.querySelector(".game-start-screen")!.classList.add("hidden");
    window.addEventListener("keydown", preventControlButtons, false);
    snakeGame.startGame();
  };

  const playReplay = (replay: typeof snakeGame.replay) => {
    if (replay) {
      snakeGame.playReplay(replay);
      document.querySelector(".game-start-screen")!.classList.add("hidden");
      document.querySelector(".game-loading-screen")!.classList.add("hidden");
      window.addEventListener("keydown", preventControlButtons, false);
    }
  };

  const stopGame = () => {
    snakeGame.gameOver = true;
    snakeGame.replay = null;
    snakeGame.resetGame();
    const countdown = document.querySelector(".countdown")!;
    countdown.classList.add("hidden");
    setCurrentReplayId(null);
  }

  const showToast = ({
    type,
    score,
    timeout,
    place,
    rankSlug,
  } : {
    type: 'authorized' | 'unauthorized' | 'copied',
    score?: number,
    timeout: number,
    place?: number,
    rankSlug?: string
  }) => {
    setToast({ type, score, place, rankSlug });
    setIsToastShown(true);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (hideToastTimeoutRef.current) {
      clearTimeout(hideToastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setIsToastShown(false);
      hideToastTimeoutRef.current = setTimeout(() => {
        setToast(null);
      }, 500);
    }, timeout);
  };

  useEffect(() => {
    if (localStorage.getItem('isLoggedIn') === 'true') getUser();

    document.getElementById('leaderboard-button')?.addEventListener('click', () => {
      setIsOpen((prev) => {
        if (!prev) {
          localStorage.setItem('isLeaderboardOpen', 'true')
        } else {
          localStorage.removeItem('isLeaderboardOpen')
        }
        return !prev
      });

      setTab((prev) => prev === 'shared' ? 'global' : prev)
    });

    document.getElementById("start-game")!.addEventListener("click", startGame);

    document
      .getElementById("change-difficulty")!
      .addEventListener("click", changeDifficulty);

    window.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape") {
          e.preventDefault();
          stopGame();
        }
      },
      false,
    );
  },[])

  useEffect(() => {
    if (code) signInUser(code);
  }, [code])

  useEffect(() => {
    if (replaySlug) getSharedReplayData(replaySlug)
  }, [replaySlug]);

  useEffect(() => {
     if (userReplay) addUserScore(userReplay);
  },[userReplay])

  useEffect(() => {
    if (tab === 'global' && !leaderboard) {
      getLeaderboardData();
    }
    if (!localStorage.getItem('isLoggedIn')) return;
    if (tab === 'personal' && !myRanks) {
      getMyRanksData({});
    }
  },[tab, leaderboard, myRanks])


  return (
    <>
      <div className={`toast ${isToastShown ? 'toast-visible' : ''}`}>
        {toast?.type !== 'copied' ? (
          <img src="/images/cup.png" alt='cup' />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2"
               className="feather feather-check">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
        {toast?.type === 'unauthorized' && (
          <span>New personal highscore: {toast.score}<br/><a href={githubAuthLink}>Sign in with GitHub</a> and save your highscores on the leaderboard</span>
        )}
        {toast?.type === 'authorized' && (
          <span>New personal highscore: {toast.score}<br/>You are on {toast.place} place in global ranking</span>
        )}
        {toast?.type === 'copied' && (
          <span>Share link copied</span>
        )}
      </div>
      <div className={`leaderboard-container ${open ? 'visible' : ''}`}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'}}>
            <div className={`tab ${tab === 'global' ? 'tab-active' : ''}`} onClick={() => setTab('global')}>Global ranking</div>
            <div className={`tab ${tab === 'personal' ? 'tab-active' : ''}`} onClick={() => setTab('personal')}>My ranks</div>
          </div>
          {user ? (
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}} >
              {user.gitHubName}
              <div style={{cursor: 'pointer', height: '20px'}} onClick={signOutUser}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2"
                     className="feather feather-log-out">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
            </div>
          ) : (
            <a href={githubAuthLink}>Sign in with Github</a>
          )}
        </div>
        <div style={{width: 'calc(100% + 32px)', height: '1px', background: '#555', margin: '16px -16px 0'}}/>
        {tab === 'global' && (
          loading === 'global' ? (
            <div style={{margin: 'auto'}}>Loading...</div>
          ) : (
            <div className="scroll-block">
              <div className="leaderboard-line">
                {leaderboard?.map((item, index) => (
                  <>
                    <div>#{item.place}</div>
                    <div style={{textAlign: 'right'}}>{item.score} <span style={{fontSize: '12px'}}>PTS</span></div>
                    <div>
                      <a
                        className="user-link"
                        href={`https://github.com/${item.user.name}`}
                        target="_blank"
                      >
                        {item.user.name}
                      </a>
                    </div>
                    <div>
                      {currentReplayId === item.id ? (
                        <div style={{textAlign: 'right'}}>
                        <span className="replay-button" onClick={stopGame}>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="feather feather-square"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          </svg>
                          Stop
                        </span>
                        </div>
                      ) : (
                        <div style={{textAlign: 'right'}}>
                        <span className="replay-button" onClick={() => getReplayData(item.id)}>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="feather feather-play"
                          >
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                          Replay
                        </span>
                        </div>
                      )}
                    </div>
                  </>
                ))}
              </div>
            </div>
          )
        )}
        {tab === 'personal' && (
          !user ? (
            <div style={{margin: 'auto'}}>Sing in to save your highscores</div>
          ) : (
            loading === 'personal' ? (
              <div style={{margin: 'auto'}}>Loading...</div>
            ) : (
              <div className="scroll-block" id="scrollableDiv">
                <InfiniteScroll
                  dataLength={myRanks?.ranks.length || 0}
                  next={() => getMyRanksData({next: myRanks?.next || undefined})}
                  hasMore={!!myRanks?.next}
                  scrollableTarget="scrollableDiv"
                  loader={undefined}
                >
                  <div className="my-ranks-line">
                    {myRanks?.ranks.map((item, index) => (
                      <>
                        <div>#{item.place}</div>
                        <div style={{textAlign: 'right'}}>{item.score} <span style={{fontSize: '12px'}}>PTS</span></div>
                        <div>{getDifficultyName(item.difficulty)}</div>
                        <div>
                          {currentReplayId === item.id ? (
                            <div style={{textAlign: 'right'}}>
                            <span className="replay-button" onClick={stopGame}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="feather feather-square"
                              >
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                              </svg>
                              Stop
                            </span>
                            </div>
                          ) : (
                            <div style={{textAlign: 'right'}}>
                            <span className="replay-button" onClick={() => getReplayData(item.id)}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="feather feather-play"
                              >
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              Replay
                            </span>
                            </div>
                          )}
                        </div>
                        {isToastShown && toast?.rankSlug === item.slug ? (
                          <div style={{height: '20px'}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" strokeWidth="2"
                                 className="feather feather-check">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        ) : (
                          <div style={{height: '20px', cursor: "pointer"}} onClick={() => shareRank(item.slug)}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="feather feather-share">
                              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                              <polyline points="16 6 12 2 8 6"/>
                              <line x1="12" y1="2" x2="12" y2="15"/>
                            </svg>
                          </div>
                        )}
                      </>
                    ))}
                  </div>
                </InfiniteScroll>
              </div>
            )
          )
        )}
        {tab === 'shared' && (
          typeof sharedReplay === 'undefined' ? (
            <div style={{margin: 'auto'}}>Broken share link :(</div>
          ) : (
            loading === 'shared' ? (
              <div style={{margin: 'auto'}}>Loading...</div>
            ) : (
              <div style={{margin: 'auto', display: "flex", flexDirection: "column", alignItems: 'center', gap: '8px'}}>
                <a
                  style={{fontSize: '20px'}}
                  className="user-link"
                  href={`https://github.com/${sharedReplay?.user.name}`}
                  target="_blank"
                >
                  {sharedReplay?.user.name}
                </a>
                <div>Place in global ranking: {sharedReplay?.place}</div>
                <div>Difficulty: {getDifficultyName(sharedReplay?.difficulty || 1)}</div>
                <div>Score: {sharedReplay?.score}</div>
                <div>
                  {currentReplayId === sharedReplay?.id ? (
                    <div style={{textAlign: 'right'}}>
                      <span className="replay-button" onClick={stopGame}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="feather feather-square"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        </svg>
                        Stop
                      </span>
                    </div>
                  ) : (
                    <div style={{textAlign: 'right'}}>
                      <span className="replay-button" onClick={playSharedReplay}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="feather feather-play"
                        >
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Replay
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>
    </>

  )
}
export default BusinessLogic;