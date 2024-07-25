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
  getReplayById, getRoom,
  getSharedReplay, getUserRuns
} from "../../api/leaderboard.ts";
import type {Rank, LeaderboardItem, SharedReplay} from "../../api/leaderboard.ts";
import InfiniteScroll from "react-infinite-scroll-component";
import {getGithubAuthLink} from "../../const";
import CreateRoomModal from "../CreateRoomModal";
import {BackIcon} from "../icons/BackIcon.tsx";
import {StopIcon} from "../icons/StopIcon.tsx";
import {PlayIcon} from "../icons/PlayIcon.tsx";
import {CheckIcon} from "../icons/CheckIcon.tsx";
import {ShareIcon} from "../icons/ShareIcon.tsx";

interface Props {
  code?: string,
  replaySlug?: string,
  roomName?: string,
}

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

const BusinessLogic: React.FC<Props> = ({code, replaySlug, roomName}) => {
  const [open, setIsOpen] = useState(!!replaySlug || !!roomName || isLeaderboardOpen);
  const [userReplay, setUserReplay] = useState<Replay>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isToastShown, setIsToastShown] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'authorized' | 'unauthorized' | 'copied', score?: number, place?: number, rankSlug?: string } | null>(null);
  const [currentReplayId, setCurrentReplayId] = useState<number | null>(null);
  const snakeGame = useMemo(() => new SnakeGame({setUserReplay, setCurrentReplayId}), []);
  const [tab, setTab] = useState<'global' | 'personal' | 'shared' | 'user'>(replaySlug ? 'shared' : 'global');
  const [myRuns, setMyRuns] = useState<{runs: Rank[], next: string | null} | null>(null);
  const [userRuns, setUserRuns] = useState<{runs: Rank[], next: string | null} | null>(null);
  const [loading, setLoading] = useState<'global' | 'personal' | 'shared' | 'user' | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[] | null>(null);
  const [sharedReplay, setSharedReplay] = useState<SharedReplay | null | undefined>(null);
  const toastTimeoutRef = useRef<any>(null);
  const hideToastTimeoutRef = useRef<any>(null);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [roomId, setRoomId] = useState<number | undefined>(undefined);
  const [isRoomExist, setIsRoomExist] = useState<boolean | undefined>(undefined);
  const [currentUser, setCurrentUser] = useState<{ name: string, id: number } | null>(null)

  const getUser = async () => {
    const user = await getMe();
    setUser(user);
  }

  const addUserScore = async (replay: Replay) => {
    const data = await addScore({replay, roomId});
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
      getMyRanksData({limit: myRuns?.runs.length ? myRuns?.runs.length + 1 : 30});
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
    const data = await getLeaderboard(roomId);
    setLeaderboard(data)
    setLoading(null);
  }

  const getReplayData = async (id: number) => {
    if (!snakeGame.isReplay && snakeGame.tick)  return;

    const data = await getReplayById(id);
    setCurrentReplayId(id);
    playReplay(data);
  }

  const getUserRunsData = async ({next, limit, userId} : {next?: string, limit?: number, userId: number, roomId?: number}) => {
    if (userRuns === null) setLoading('user');
    const data = await getUserRuns({next, limit, userId: userId, roomId});
    if (next) {
      setUserRuns((prev) => ({runs: [...prev!.runs, ...data.runs], next: data.next}))
    } else {
      setUserRuns(data)
    }

    setLoading(null);
  }

  const openUserRuns = (user: {name: string, id: number}) => {
    setTab("user");
    setCurrentUser(user);
    getUserRunsData({userId: user.id, roomId})
  }

  const playSharedReplay = () => {
    if ((!snakeGame.isReplay && snakeGame.tick) || !sharedReplay)  return;
    setCurrentReplayId(sharedReplay.id);
    playReplay(sharedReplay.replay);
  }

  const getSharedReplayData = async (slug: string, roomId?: number) => {
    try {
      setLoading('shared');
      const data = await getSharedReplay(slug, roomId);
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
    if (roomName) {
      await navigator.clipboard.writeText(`https://3310snake.com/${roomName}?replay=${slug}`);
    } else {
      await navigator.clipboard.writeText(`https://3310snake.com/?replay=${slug}`);
    }
    showToast({type: 'copied', timeout: 2000, rankSlug: slug})
  }

  const shareRoom = async (room: string) => {
    await navigator.clipboard.writeText(`https://3310snake.com/${room}`);
    showToast({type: 'copied', timeout: 2000, rankSlug: room})
  }

  const getMyRanksData = async ({next, limit} : {next?: string, limit?: number}) => {
    if (myRuns === null) setLoading('personal');
    const data = await getMyRanks({next, limit, roomId});
    if (next) {
      setMyRuns((prev) => ({runs: [...prev!.runs, ...data.runs], next: data.next}))
    } else {
      setMyRuns(data)
    }

    setLoading(null);
  }

  const getRoomData = async (roomName: string) => {
    try {
      const data = await getRoom(roomName);
      setRoomId(data.id)
      setIsRoomExist(true);
    } catch (e) {
      setIsRoomExist(false)
    }
  }

  const signInUser = async (code: string) => {
    if (localStorage.getItem('isLoggedIn')) return;
    await signIn(code);
    const userRanksJSON = localStorage.getItem('userRanks');
    const userRanks = userRanksJSON ? JSON.parse(userRanksJSON) as {maxScore: number, slugs: string[]} : null;
    if (userRanks?.slugs) await assignRanks(userRanks.slugs);
    const user = await getMe();
    setUser(user);
    if (!roomName) getLeaderboardData();
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
    window.removeEventListener("keydown", preventControlButtons, false);
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
    if (roomName) getRoomData(roomName);

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
    if (replaySlug && ((roomId && roomName) || !roomName)) getSharedReplayData(replaySlug, roomId)
  }, [replaySlug, roomName, roomId]);

  useEffect(() => {
     if (userReplay) addUserScore(userReplay);
  },[userReplay])

  useEffect(() => {
    if (tab === 'global' && !leaderboard && ((roomId && roomName) || !roomName)) {
      getLeaderboardData();
    }
    if (!localStorage.getItem('isLoggedIn')) return;
    if (tab === 'personal' && !myRuns && ((roomId && roomName) || !roomName)) {
      getMyRanksData({});
    }
  },[tab, leaderboard, myRuns, roomId, roomName])


  return (
    <>
      <CreateRoomModal
        open={isCreateRoomModalOpen}
        onClose={() => setIsCreateRoomModalOpen(false)}
        isLoggedIn={!!user}
      />
      <div className={`toast ${isToastShown ? 'toast-visible' : ''}`}>
        {toast?.type !== 'copied' ? (
          <img src="/images/cup.png" alt='cup' />
        ) : (
          <CheckIcon />
        )}
        {toast?.type === 'unauthorized' && (
          <span>New personal highscore: {toast.score}<br/><a href={getGithubAuthLink(roomName || '')}>Sign in with GitHub</a> and save your highscores on the leaderboard</span>
        )}
        {toast?.type === 'authorized' && (
          <span>New personal highscore: {toast.score}<br/>You are on {toast.place} place in {roomId ? 'room' : 'global'} ranking</span>
        )}
        {toast?.type === 'copied' && (
          <span>Share link copied</span>
        )}
      </div>
      <div className={`leaderboard-wrap ${open ? 'visible' : ''}`}>
        {roomName ? (
          <div className='room-container'>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <a href='/' className='back-button'>
                <BackIcon />
              </a>
              {roomName}
              <div style={{width: '2px', background: '#000', height: '16px'}}/>
              Room
            </div>
            {isRoomExist && (
              isToastShown && toast?.rankSlug === roomName ? (
                <div style={{height: '20px'}}><CheckIcon /></div>
              ) : (
                <div style={{height: '20px', cursor: "pointer"}} onClick={() => shareRoom(roomName)}>
                  <ShareIcon />
                </div>
              )
            )}
          </div>
        ) : (
          <div className='create-room-button' onClick={() => setIsCreateRoomModalOpen(true)}>
            Create company room
          </div>
        )}

        <div className="leaderboard-container">
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'}}>
              {tab !== 'global' && tab !== 'personal' ? (
                tab === 'user' ? (
                  <div style={{display: "flex", alignItems: 'center', gap: '8px', fontSize: '14px'}}>
                    <div
                      className='back-button'
                      onClick={() => {
                        stopGame();
                        setCurrentUser(null);
                        setUserRuns(null);
                        setTab('global')
                      }}
                    >
                      <BackIcon />
                    </div>
                    <a
                      href={`https://github.com/${currentUser?.name}`}
                      target="_blank"
                      className="user-link"
                    >
                      {currentUser?.name}
                    </a>
                  </div>
                ) : (
                  <div
                    className='back-button'
                    onClick={() => {
                      stopGame();
                      setCurrentUser(null);
                      setUserRuns(null);
                      setTab('global')
                    }}
                  >
                    <BackIcon />
                    Back to ranking
                  </div>
                )
              ) : (
                <>
                  <div className={`tab ${tab === 'global' ? 'tab-active' : ''}`} onClick={() => setTab('global')}>
                    {roomName ? (
                      'Room ranking'
                    ) : (
                      'Global ranking'
                    )}
                  </div>
                  <div className={`tab ${tab === 'personal' ? 'tab-active' : ''}`} onClick={() => setTab('personal')}>My runs</div>
                </>
              )}
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
              <a href={getGithubAuthLink(roomName || '')}>Sign in with Github</a>
            )}
          </div>
          <div style={{width: 'calc(100% + 32px)', height: '1px', background: '#555', margin: '16px -16px 0'}}/>
          {tab === 'global' && (
            loading === 'global' ? (
              <div style={{margin: 'auto'}}>Loading...</div>
            ) : (
              isRoomExist === false ? (
                <div style={{margin: 'auto'}}>Room doesn't exist</div>
              ) : (
                <div className="scroll-block">
                  <div className="leaderboard-grid">
                    {leaderboard?.map((item, index) => (
                      <div key={'leaderboard' + item.id} className="leaderboard-line">
                        <div className="cell">#{item.place}</div>
                        <div className="cell" style={{justifyContent: 'flex-end'}}><div>{item.score}<span style={{fontSize: '12px'}}>pts</span></div></div>
                        <div className="cell">
                          <div
                            className="user-link"
                            onClick={() => openUserRuns(item.user)}
                          >
                            {item.user.name}
                          </div>
                        </div>
                        <div className={`leaderboard-button cell ${currentReplayId === item.id ? 'leaderboard-button-visible' : ''}`} style={{justifyContent: 'flex-end'}}>
                          {currentReplayId === item.id ? (
                            <div>
                              <span className="replay-button" onClick={stopGame}>
                                <StopIcon />
                                Stop
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="replay-button" onClick={() => getReplayData(item.id)}><PlayIcon />Replay</span>
                            </div>
                          )}
                        </div>
                        <div className={`leaderboard-button cell ${currentReplayId === item.id ? 'leaderboard-button-visible' : ''}`}>
                          {isToastShown && toast?.rankSlug === item.slug ? (
                            <div style={{ height: '20px'}}><CheckIcon /></div>
                          ) : (
                            <div style={{cursor: "pointer", height: '20px'}} onClick={() => shareRank(item.slug)}>
                              <ShareIcon/>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
          )}
          {tab === 'personal' && (
            !user ? (
              <div style={{margin: 'auto'}}>Sing in to save your highscores</div>
            ) : (
              loading === 'personal' ? (
                <div style={{margin: 'auto'}}>Loading...</div>
              ) : (
                isRoomExist === false ? (
                  <div style={{margin: 'auto'}}>Room doesn't exist</div>
                  ) : (
                  <div className="scroll-block" id="scrollableDiv">
                    <InfiniteScroll
                      dataLength={myRuns?.runs.length || 0}
                      next={() => getMyRanksData({next: myRuns?.next || undefined})}
                      hasMore={!!myRuns?.next}
                      scrollableTarget="scrollableDiv"
                      loader={undefined}
                    >
                      <div className="leaderboard-grid">
                        {myRuns?.runs.map((item, index) => (
                          <div key={'myRuns' + item.id} className="leaderboard-line">
                            <div className="cell">#{item.place}</div>
                            <div className="cell" style={{justifyContent: 'flex-end'}}><div>{item.score}<span style={{fontSize: '12px'}}>pts</span></div></div>
                            <div className="cell">
                              {getDifficultyName(item.difficulty)}
                            </div>
                            <div className={`leaderboard-button cell ${currentReplayId === item.id ? 'leaderboard-button-visible' : ''}`} style={{justifyContent: 'flex-end'}}>
                              {currentReplayId === item.id ? (
                                <div>
                              <span className="replay-button" onClick={stopGame}>
                                <StopIcon />
                                Stop
                              </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="replay-button" onClick={() => getReplayData(item.id)}><PlayIcon />Replay</span>
                                </div>
                              )}
                            </div>
                            <div className={`leaderboard-button cell ${currentReplayId === item.id ? 'leaderboard-button-visible' : ''}`}>
                              {isToastShown && toast?.rankSlug === item.slug ? (
                                <div style={{ height: '20px'}}><CheckIcon /></div>
                              ) : (
                                <div style={{cursor: "pointer", height: '20px'}} onClick={() => shareRank(item.slug)}>
                                  <ShareIcon/>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </InfiniteScroll>
                  </div>
                )
              )
            )
          )}
          {tab === 'shared' && (
            typeof sharedReplay === 'undefined' || (!!roomName && isRoomExist === false) ? (
              <div style={{margin: 'auto'}}>Broken share link :(</div>
            ) : (
              loading === 'shared' || (!!roomName && typeof isRoomExist === 'undefined') ? (
                <div style={{margin: 'auto'}}>Loading...</div>
              ) : (
                <div style={{margin: 'auto', display: "flex", flexDirection: "column", alignItems: 'center', gap: '8px'}}>
                  <div style={{fontSize: '20px', display: 'flex', gap: '8px', alignItems: "center"}}><span>#{sharedReplay?.place}</span><div style={{width: '2px', background: '#000', height: '20px'}}/><span>{sharedReplay?.score}<span style={{fontSize: '14px'}}>PTS</span></span></div>
                  <div
                    style={{fontSize: '16px'}}
                    className="user-link"
                    onClick={() => openUserRuns(sharedReplay!.user)}
                  >
                    {sharedReplay?.user.name}
                  </div>
                  <div>Difficulty: {getDifficultyName(sharedReplay?.difficulty || 1)}</div>
                  <div>
                    {currentReplayId === sharedReplay?.id ? (
                      <div style={{textAlign: 'right'}}>
                      <span className="replay-button" onClick={stopGame}>
                        <StopIcon />
                        Stop
                      </span>
                      </div>
                    ) : (
                      <div style={{textAlign: 'right'}}>
                      <span className="replay-button" onClick={playSharedReplay}><PlayIcon />Replay</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            )
          )}
          {tab === 'user' && (
            loading === 'user' ? (
              <div style={{margin: 'auto'}}>Loading...</div>
            ) : (
              <div className="scroll-block" id="scrollableUserDiv">
                <InfiniteScroll
                  dataLength={userRuns?.runs.length || 0}
                  next={() => getUserRunsData({next: userRuns?.next || undefined, userId: currentUser!.id})}
                  hasMore={!!userRuns?.next}
                  scrollableTarget="scrollableUserDiv"
                  loader={undefined}
                >
                  <div className="leaderboard-grid">
                    {userRuns?.runs.map((item, index) => (
                      <div key={'userRuns' + item.id} className="leaderboard-line">
                        <div className="cell">#{item.place}</div>
                        <div className="cell" style={{justifyContent: 'flex-end'}}><div>{item.score}<span style={{fontSize: '12px'}}>pts</span></div></div>
                        <div className="cell">
                          {getDifficultyName(item.difficulty)}
                        </div>
                        <div className={`leaderboard-button cell ${currentReplayId === item.id ? 'leaderboard-button-visible' : ''}`} style={{justifyContent: 'flex-end'}}>
                          {currentReplayId === item.id ? (
                            <div>
                              <span className="replay-button" onClick={stopGame}>
                                <StopIcon />
                                Stop
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="replay-button" onClick={() => getReplayData(item.id)}><PlayIcon />Replay</span>
                            </div>
                          )}
                        </div>
                        <div className={`leaderboard-button cell ${currentReplayId === item.id ? 'leaderboard-button-visible' : ''}`}>
                          {isToastShown && toast?.rankSlug === item.slug ? (
                            <div style={{ height: '20px'}}><CheckIcon /></div>
                          ) : (
                            <div style={{cursor: "pointer", height: '20px'}} onClick={() => shareRank(item.slug)}>
                              <ShareIcon/>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </InfiniteScroll>
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}
export default BusinessLogic;