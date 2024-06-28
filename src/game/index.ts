import { SnakeGame } from "./SnakeGame";

const snakeGame = new SnakeGame();

const changeDifficulty = () => {
  switch (snakeGame.difficulty) {
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

export const preventControlButtons = (e: KeyboardEvent) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(
      e.code,
    ) > -1
  ) {
    e.preventDefault();
  }
};

const startGame = () => {
  document.querySelector(".game-start-screen")!.classList.add("hidden");
  window.addEventListener("keydown", preventControlButtons, false);
  snakeGame.startGame();
};

document.getElementById("start-game")!.addEventListener("click", startGame);

document
  .getElementById("change-difficulty")!
  .addEventListener("click", changeDifficulty);

window.addEventListener(
  "keydown",
  (e) => {
    if (e.code === "Escape") {
      e.preventDefault();
      snakeGame.gameOver = true;
      snakeGame.resetGame();
      const countdown = document.querySelector(".countdown")!;

      countdown.classList.add("hidden");
    }
  },
  false,
);
