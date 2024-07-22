import React, {useEffect, useMemo, useState} from "react";
import type {Replay} from "../../game/SnakeGame.ts";
import {SnakeGame} from "../../game/SnakeGame";
import {getMe, signIn, signOut} from "../../api/auth";
import type {User} from "../../api/auth.ts";
import {addScore, getLeaderboard, getMyRanks, getReplayById} from "../../api/leaderboard.ts";
import type {Rank, LeaderboardItem} from "../../api/leaderboard.ts";

export const preventControlButtons = (e: KeyboardEvent) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(
      e.code,
    ) > -1
  ) {
    e.preventDefault();
  }
};


const BusinessLogic: React.FC<{code?: string}> = ({code}) => {
  const [open, setIsOpen] = useState(false);
  const [userReplay, setUserReplay] = useState<Replay>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isToastShown, setIsToastShown] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'authorized' | 'unauthorized', score: number, place?: number } | null>(null);
  const [currentReplayId, setCurrentReplayId] = useState<number | null>(null);
  const snakeGame = useMemo(() => new SnakeGame({setUserReplay, setCurrentReplayId}), []);
  const [tab, setTab] = useState<'global' | 'personal'>('global');
  const [myRanks, setMyRanks] = useState<{ranks: Rank[], next: string | null} | null>(null);
  const [loading, setLoading] = useState<'global' | 'personal' | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[] | null>(null);

  const getUser = async () => {
    const user = await getMe();
    setUser(user);
  }

  const addUserScore = async (replay: Replay) => {
    const data = await addScore(replay);
    setUserReplay(null);

    if (user?.bestScore && user.bestScore < replay!.score) {
      setUser({...user, bestScore: replay!.score})
      localStorage.removeItem('userReplay')
      showToast({
        type: 'authorized',
        score: replay!.score,
        place: data.place,
        timeout: 5000,
      })
    }
    getLeaderboardData();
    getMyRanksData();
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

  const getMyRanksData = async () => {
    if (myRanks === null) setLoading('personal');
    const data = await getMyRanks();
    setMyRanks(data)
    setLoading(null);
  }

  const signInUser = async (code: string) => {
    await signIn(code);
    const user = await getMe();
    setUser(user);
    const savedUserReplay = localStorage.getItem('userReplay') ? JSON.parse(localStorage.getItem('userReplay')!) : null
    if (savedUserReplay) {
      await addUserScore(savedUserReplay)
    }
    localStorage.removeItem('userReplay');
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
  } : {
    type: 'authorized' | 'unauthorized',
    score: number,
    timeout: number,
    place?: number,
  }) => {
    setToast({type, score, place});
    setIsToastShown(true);

    if (timeout) {
      setTimeout(() => {
        setIsToastShown(false);
      }, timeout);

      setTimeout(() => {
        setToast(null);
      }, timeout + 1000);
    }
  };

  useEffect(() => {
    if (localStorage.getItem('isLoggedIn') === 'true') getUser();

    document.getElementById('leaderboard-button')?.addEventListener('click', () => {
      setIsOpen((prev) => !prev);
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
    if (!user && userReplay) {
      const savedUserReplayJSON = localStorage.getItem('userReplay')
      const savedUserReplay = savedUserReplayJSON ? JSON.parse(savedUserReplayJSON) as Replay : null;

      if ((savedUserReplay && userReplay.score > savedUserReplay.score) || !savedUserReplay) {
        localStorage.setItem('userReplay', JSON.stringify(userReplay));
        showToast({
          type: 'unauthorized',
          score: userReplay.score,
          timeout: 10000,
        })
      }
    } else if (user && userReplay) {
      addUserScore(userReplay);
    }
  },[user, userReplay])

  useEffect(() => {
    if (tab === 'global' && !leaderboard) {
      getLeaderboardData();
    }
    if (!localStorage.getItem('isLoggedIn')) return;
    if (tab === 'personal' && !myRanks) {
      getMyRanksData();
    }
  },[tab, leaderboard, myRanks])


  return (
    <>
      <div className={`toast ${isToastShown ? 'toast-visible' : ''}`}>
        <img src="/images/cup.png" alt='cup' />
        {toast?.type === 'unauthorized' && (
          <span>New personal highscore: {toast.score}<br/><a href={import.meta.env.PUBLIC_GITGUH_AUTH_LINK}>Sign in with GitHub</a> and save it on the leaderboard</span>
        )}
        {toast?.type === 'authorized' && (
          <span>New personal highscore: {toast.score}<br/>You are on {toast.place} place in global leaderboard</span>
        )}
      </div>
      <div className={`leaderboard-container ${open ? 'visible' : ''}`}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div className="leaderboard-title">Leaderboard</div>
          {user ? (
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}} >
              {user.gitHubName}
              <div style={{cursor: 'pointer', height: '20px'}} onClick={signOutUser}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                     className="feather feather-log-out">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
            </div>
          ) : (
            <a href={import.meta.env.PUBLIC_GITGUH_AUTH_LINK}>Sign in with Github</a>
          )}

        </div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0', gap: '8px'}}>
          <div className={`tab ${tab === 'global' ? 'tab-active' : ''}`} onClick={() => setTab('global')}>Global</div>
          <div className={`tab ${tab === 'personal' ? 'tab-active' : ''}`} onClick={() => setTab('personal')}>Personal</div>
        </div>
        {tab === 'global' ? (
          loading === 'global' ? (
            <div style={{margin: 'auto'}}>Loading...</div>
          ) : (
            <table>
              <tr>
                <th style={{width: '10%'}}>#</th>
                <th style={{width: '100%'}}>Name</th>
                <th>Score</th>
                <th><div style={{width: '16px', height: '16px'}}/> </th>
              </tr>
              <div className="scroll-block">
                <table>
                  {leaderboard?.map((item, index) => (
                    <tr key={item.id}>
                      <td style={{width: '10%'}}>{item.place}</td>
                      <td style={{width: '100%'}}>
                        <a
                          className="user-link"
                          href={`https://github.com/${item.user.name}`}
                          target="_blank"
                        >
                          {item.user.name}
                        </a>
                      </td>
                      <td>{item.score}</td>
                      <td>
                        {currentReplayId === item.id ? (
                          <div style={{cursor: 'pointer', width: '100%', textAlign: 'right'}} onClick={stopGame}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                 fill="#000" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                 strokeLinejoin="round" className="feather feather-square">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            </svg>
                          </div>
                        ) : (
                          <div style={{cursor: 'pointer', width: '100%', textAlign: 'right'}} onClick={() => getReplayData(item.id)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#000"
                                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                 className="feather feather-play">
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </table>
              </div>
            </table>
          )
        ) : (
          !user ? (
            <div style={{margin: 'auto'}}>Sing in to save your highscores</div>
          ) : (
            loading === 'personal' ? (
              <div style={{margin: 'auto'}}>Loading...</div>
            ) : (
              <table>
                <tr>
                  <th style={{width: '50%', textAlign: 'left'}}>Score</th>
                  <th style={{textAlign: "center"}}>Place</th>
                  <th style={{width: '50%', textAlign: "right"}}>Replay</th>
                </tr>
                <div className="scroll-block">
                  <table>
                    {myRanks?.ranks.map((item, index) => (
                      <tr key={item.id + 'myrank'}>
                        <td style={{width: '50%', textAlign: 'left'}}>{item.score}</td>
                        <td style={{textAlign: "center"}}>{item.place}</td>
                        <td style={{width: '50%'}}>
                          {currentReplayId === item.id ? (
                            <div style={{cursor: 'pointer', width: '100%', textAlign: 'right'}} onClick={stopGame}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                   fill="#000" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                   strokeLinejoin="round" className="feather feather-square">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                              </svg>
                            </div>
                          ) : (
                            <div style={{cursor: 'pointer', width: '100%', textAlign: 'right'}} onClick={() => getReplayData(item.id)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#000"
                                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                   className="feather feather-play">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </table>
                </div>
              </table>
            )
          )
        )}
      </div>
    </>

  )
}
export default BusinessLogic;