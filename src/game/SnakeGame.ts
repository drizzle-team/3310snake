import { mapSnake, gameSegments } from "./mapSnake";
import { preventControlButtons } from "./";

export const difficulties = {
  1: { speed: 208, multiplier: 3 },
  2: { speed: 104, multiplier: 6 },
  3: { speed: 72, multiplier: 9 },
};

const generateGridCoordinates = (gridWidth: number, gridHeight: number) => {
  const coordinates = [];
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      coordinates.push({ x: x, y: y });
    }
  }
  return coordinates;
};

export class SnakeGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  foodCanvas: HTMLCanvasElement;
  foodCtx: CanvasRenderingContext2D;
  snake: { x: number; y: number }[];
  food: { x: number; y: number };
  tileSize: number;
  scale: number;
  gridWidth: number;
  gridHeight: number;
  eatenFood: { x: number; y: number }[];
  gameOver: boolean;
  directionQueue: Array<'UP' | 'LEFT' | 'RIGHT' | 'DOWN'>;
  score: number;
  difficulty: keyof typeof difficulties;
  gridCoordinates: { x: number; y: number }[];
  superFood: {
    segments: { x: number; y: number }[],
    type: keyof typeof gameSegments.superFood
  } | null;
  superFoodCount: number;
  eatenFoodCount: number;
  smallSquareCount: number;
  smallSquareSize: number;
  replay: {
    events: Array <{
      index: number;
      type: 'direction';
      direction: 'UP' | 'LEFT' | 'RIGHT' | 'DOWN';
    } | {
      index: number;
      type: 'food' | keyof typeof gameSegments.superFood;
      x: number;
      y: number;
    }>
    difficulty: keyof typeof difficulties,
    score: number;
  } | null;
  isReplay: boolean;
  tick: number;
  isAboutToDie: boolean;

  constructor() {
    this.canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.foodCanvas = document.getElementById("superfood-canvas") as HTMLCanvasElement;
    this.foodCtx = this.foodCanvas.getContext("2d")!;
    this.tileSize = 16;
    this.gridHeight = 10;
    this.gridWidth = 19;
    this.snake = this.createInitialSnake(5);
    this.directionQueue = ["RIGHT"];
    this.scale = window.devicePixelRatio * 2;
    this.food = { x: 16, y: 2 };
    this.eatenFoodCount = 0;
    this.superFood = null;
    this.superFoodCount = 0;
    this.eatenFood = [];
    this.score = 0;
    this.gameOver = true;
    this.isReplay = false;
    this.difficulty = 2;
    this.smallSquareCount = 4;
    this.smallSquareSize = 4;
    this.gridCoordinates = generateGridCoordinates(
      this.gridWidth,
      this.gridHeight,
    );
    this.replay = null;
    this.tick = 0;
    this.isAboutToDie = false;
    this.resizeCanvas();
    this.redraw();
    window.addEventListener("resize", this.resizeCanvas.bind(this));
    document.addEventListener("keydown", this.changeDirection.bind(this));
  }

  startGame() {
    this.replay = {
      difficulty: this.difficulty,
      score: 0,
      events: []
    }
    this.changeScore(0);
    this.gameOver = false;
    this.gameLoop();
  }

  playReplay(replay: typeof this.replay) {
    this.isReplay = true;
    this.gameOver = false;
    this.changeScore(0);
    this.replay = {...replay!};
    this.replayLoop();
  }

  createInitialSnake(length: number) {
    const initialSnake = [];
    for (let i = 0; i < length; i++) {
      initialSnake.push({ x: length - i, y: 2 });
    }
    return initialSnake;
  }

  resizeCanvas() {
    const gameArea = document.getElementById("game-area");
    const superfoodArea = document.getElementById("superfood-area");

    const gameRect = gameArea!.getBoundingClientRect();
    this.canvas.width = gameRect.width * this.scale;
    this.canvas.height = gameRect.height * this.scale;
    this.canvas.style.width = `${gameRect.width}px`;
    this.canvas.style.height = `${gameRect.height}px`;

    const foodRect = superfoodArea!.getBoundingClientRect();
    this.foodCanvas.width = foodRect.width * this.scale;
    this.foodCanvas.height = foodRect.height * this.scale;
    this.foodCanvas.style.width = `${foodRect.width}px`;
    this.foodCanvas.style.height = `${foodRect.height}px`;

    this.ctx.scale(this.scale, this.scale);
    this.foodCtx.scale(this.scale, this.scale);
    this.redraw();
  }

  redraw() {
    this.clearCanvas();
    this.drawSnake();
    this.drawFood();
    this.drawSuperFood();
  }

  generateFood() {
    const snakeSet = new Set(
      this.snake.map((segment) => `${segment.x},${segment.y}`),
    );
    let freeSegments = this.gridCoordinates.filter(
      (segment) => !snakeSet.has(`${segment.x},${segment.y}`),
    );

    if (freeSegments.length === 1) {
      this.gameOver = true;
      this.blinkFood();
    }

    const foodPosition =
      freeSegments[Math.floor(Math.random() * freeSegments.length)];

    if (!this.isReplay) {
      this.food = foodPosition;
      this.replay!.events.push({index: this.tick + 1, type: "food", ...foodPosition})
    } else {
      this.food = {x: 99, y: 99}
    }

    if (this.eatenFoodCount === 5) {
      let superFoodFreeSegments: { x: number, y:number }[][] = []

      freeSegments = freeSegments.filter(
        (segment) =>
          segment.x !== foodPosition.x && segment.y !== foodPosition.y,
      );

      const segmentsSet = new Set(
        freeSegments.map((segment) => `${segment.x},${segment.y}`),
      );

      freeSegments.forEach(segment => {
        const nextSegment = { x: segment.x + 1, y: segment.y };
        if (segmentsSet.has(`${nextSegment.x},${nextSegment.y}`)) {
          superFoodFreeSegments.push([segment, nextSegment]);
        }
      });

      if (!superFoodFreeSegments.length) return;

      const superFoodSegments = superFoodFreeSegments[Math.floor(Math.random() * superFoodFreeSegments.length)];
      const superFoodType = Object.keys(gameSegments.superFood)[Math.floor(Math.random() * 5)] as keyof typeof gameSegments.superFood;

      if (!this.isReplay) {
        this.replay!.events.push({index: this.tick + 1, type: superFoodType, ...superFoodSegments[0]})
        this.superFood = {
          segments: superFoodSegments,
          type: superFoodType
        };
        this.superFoodCount = 20;
        this.eatenFoodCount = 0;
      } else {
        this.superFood = null;
      }
    }
  }

  changeDirection(event: KeyboardEvent) {
    if (this.gameOver || this.isReplay) return;

    window.addEventListener("keydown", preventControlButtons, false);

    const code = event.code;
    const lastDirection = this.directionQueue[this.directionQueue.length - 1];

    if ((code === "ArrowLeft" || code === "KeyA") && lastDirection !== "RIGHT") {
      this.enqueueDirection("LEFT");
    } else if ((code === "ArrowUp" || code === "KeyW") && lastDirection !== "DOWN") {
      this.enqueueDirection("UP");
    } else if ((code === "ArrowRight" || code === "KeyD") && lastDirection !== "LEFT") {
      this.enqueueDirection("RIGHT");
    } else if ((code === "ArrowDown" || code === "KeyS") && lastDirection !== "UP") {
      this.enqueueDirection("DOWN");
    }
  }

  enqueueDirection(newDirection: typeof this.directionQueue[number]) {
    if (this.directionQueue.length < 3) {
      this.directionQueue.push(newDirection);
    }
  }

  replayLoop() {
    setTimeout(() => {
      if (this.isReplay && !this.gameOver) {
        const replayEvents = this.replay!.events.filter(({index}) => index === this.tick)
        replayEvents.forEach((event) => {
          if (event.type === "direction") {
            this.directionQueue = [event.direction]
          } else if (event.type === "food") {
            this.food = {x: event.x, y: event.y};
          } else {
            this.superFood = {
              segments: [
                {x: event.x, y: event.y},
                {x: event.x + 1, y: event.y},
              ],
              type: event.type,
            }
            this.superFoodCount = 20;
            this.eatenFoodCount = 0
          }
        })
        this.moveSnake();
        this.countdownSuperFood();
        this.redraw();
        this.checkGameOver();
        this.tick++
        this.replayLoop();
      }
    }, difficulties[this.replay!.difficulty].speed);
  }

  gameLoop() {
    setTimeout(() => {
      if (!this.gameOver) {
        this.moveSnake();
        this.countdownSuperFood();
        this.redraw();
        this.checkGameOver();
        this.tick++
        this.gameLoop();
      }
    }, difficulties[this.difficulty].speed);
  }

  countdownSuperFood() {
    if (!this.superFoodCount) {
      this.superFood = null;
      document.querySelector(".countdown")!.classList.add("hidden");
      return;
    }

    document.getElementById("countdown")!.innerText =
      this.superFoodCount.toString();
    document.querySelector(".countdown")!.classList.remove("hidden");

    this.superFoodCount--;
  }

  clearCanvas() {
    this.ctx.fillStyle = "#73a582";
    this.ctx.fillRect(
      0,
      0,
      this.canvas.width / this.scale,
      this.canvas.height / this.scale,
    );
    this.foodCtx.fillStyle = "#73a582";
    this.foodCtx.fillRect(
      0,
      0,
      this.foodCanvas.width / this.scale,
      this.foodCanvas.height / this.scale,
    );
  }

  drawSuperFood() {
    if (this.superFood) {
      this.superFood.segments.forEach((segment, index) => {
        this.drawSegment(gameSegments.superFood[this.superFood!.type][index as 0 | 1], { ...segment })
        this.drawSegment(gameSegments.superFood[this.superFood!.type][index as 0 | 1], { x: index, y: 0 }, this.foodCtx)
      })
    }
  }

  drawFood() {
    this.drawSegment(gameSegments.food, { ...this.food });
  }

  moveSnake() {
    const currentDirection = this.directionQueue[0];
    const head = { x: this.snake[0].x, y: this.snake[0].y };
    const tail = { x: this.snake[this.snake.length -1].x, y: this.snake[this.snake.length -1].y }
    if (currentDirection === "RIGHT") head.x += 1;
    else if (currentDirection === "LEFT") head.x -= 1;
    else if (currentDirection === "UP") head.y -= 1;
    else if (currentDirection === "DOWN") head.y += 1;

    if (this.snake.some((segment, index) => (
      segment.x === head.x && segment.y === head.y && index !== this.snake.length - 1
    ) && !this.isAboutToDie)) {
        this.isAboutToDie = true;
        if (this.directionQueue.length > 1) {
          if (!this.isReplay) {
            this.replay!.events.push({ index: this.tick + 1, type: 'direction', direction: this.directionQueue[1]})
          }
          this.directionQueue.shift();
        }
        return;
    }

    this.isAboutToDie = false;

    if (head.x === this.gridWidth) {
      head.x = 0;
    } else if (head.x < 0) {
      head.x = this.gridWidth - 1;
    }

    if (head.y === this.gridHeight) {
      head.y = 0;
    } else if (head.y < 0) {
      head.y = this.gridHeight - 1;
    }

    this.snake.unshift(head);

    this.eatenFood = [
      ...this.eatenFood.filter((eatenFood) =>
        !(tail.x === eatenFood.x && tail.y === eatenFood.y)
      ),
    ];

    if (head.x === this.food.x && head.y === this.food.y) {
      this.eatenFood.unshift({ ...this.food });
      this.eatenFoodCount++;
      this.generateFood();
      if (this.isReplay) {
        this.changeScore(this.score + difficulties[this.replay!.difficulty].multiplier);
      } else {
        this.changeScore(this.score + difficulties[this.difficulty].multiplier);
      }
    } else if (this.superFood && this.superFood.segments.some(({x, y}) => head.x === x && head.y === y)) {
      this.eatenFood.unshift({ ...head });
      this.eatenFoodCount = 0;
      this.superFood = null;
      this.superFoodCount = 0;
      if (this.isReplay) {
        this.changeScore(
          this.score + 5 * difficulties[this.replay!.difficulty].multiplier,
        );
      } else {
        this.changeScore(
          this.score + 5 * difficulties[this.difficulty].multiplier,
        );
      }
    } else {
      this.snake.pop();
    }

    if (this.directionQueue.length > 1) {
      if (!this.isReplay) {
        this.replay!.events.push({ index: this.tick + 1, type: 'direction', direction: this.directionQueue[1]})
      }
      this.directionQueue.shift();
    }
  }

  changeScore(score: number) {
    document.getElementById("score")!.innerText = score
      .toString()
      .padStart(4, "0");
    this.score = score;
    this.replay!.score = score;
  }

  drawSnake() {
    mapSnake({
      snake: this.snake,
      gridHeight: this.gridHeight,
      gridWidth: this.gridWidth,
      food: this.food,
      eatenFood: this.eatenFood,
      superFood: this.superFood || undefined,
    }).forEach(({ x, y, segment }) => {
      this.drawSegment(segment, { x, y });
    });
  }

  drawDebugGrid() {
    this.ctx.strokeStyle = "#000";
    this.ctx.lineWidth = 1;
    for (let i = 1; i < this.gridWidth; i++) {
      this.ctx.moveTo(i * this.tileSize, 0);
      this.ctx.lineTo(i * this.tileSize, this.gridHeight * this.tileSize);
      this.ctx.stroke();
    }
    for (let i = 1; i < this.gridHeight; i++) {
      this.ctx.moveTo(0, i * this.tileSize);
      this.ctx.lineTo(this.gridWidth * this.tileSize, i * this.tileSize);
      this.ctx.stroke();
    }
  }

  drawGrid() {
    this.ctx.strokeStyle = "#73a582";
    this.ctx.lineWidth = 0.33;

    for (let i = 1; i < this.gridWidth * this.smallSquareCount; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * this.smallSquareSize, 0);
      this.ctx.lineTo(
        i * this.smallSquareSize,
        this.gridHeight * this.tileSize,
      );
      this.ctx.stroke();
    }
    for (let i = 1; i < this.gridHeight * this.smallSquareCount; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * this.smallSquareSize);
      this.ctx.lineTo(this.gridWidth * this.tileSize, i * this.smallSquareSize);
      this.ctx.stroke();
    }
  }

  drawSegment(gameSegment: number[][], segment: { x: number; y: number }, ctx = this.ctx) {
    ctx.fillStyle = "#73a582";
    ctx.fillRect(
      segment.x * 16,
      segment.y * 16,
      this.tileSize,
      this.tileSize,
    );

    const topLeftCornerX = segment.x * 16;
    const topLeftCornerY = segment.y * 16;

    ctx.fillStyle = "#000";
    for (let i = 0; i < this.smallSquareCount; i++) {
      for (let j = 0; j < this.smallSquareCount; j++) {
        if (gameSegment[i][j]) {
          const x = topLeftCornerX + j * this.smallSquareSize;
          const y = topLeftCornerY + i * this.smallSquareSize;
          ctx.fillRect(x, y, this.smallSquareSize, this.smallSquareSize);
        }
      }
    }
  }

  checkGameOver() {
    const head = this.snake[0];

    for (let i = 1; i < this.snake.length; i++) {
      if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
        this.gameOver = true;
        this.blinkSnake();
      }
    }
  }

  blinkSnake() {
    let blinkCount = 0;
    const blinkInterval = setInterval(() => {
      if (blinkCount < 10) {
        this.clearCanvas();
        this.drawFood();
        if (blinkCount % 2 === 0) {
          this.drawSnake();
        }
        this.drawSuperFood();
        blinkCount++;
      } else {
        clearInterval(blinkInterval);
        this.resetGame();
      }
    }, 200);
  }

  blinkFood() {
    let blinkCount = 0;
    const blinkInterval = setInterval(() => {
      if (blinkCount < 10) {
        this.clearCanvas();
        this.drawSnake();
        if (blinkCount % 2 === 0) {
          this.drawFood();
        }
        blinkCount++;
      } else {
        clearInterval(blinkInterval);
        this.resetGame();
      }
    }, 200);
  }

  resetGame() {
    document.querySelector(".game-start-screen")!.classList.remove("hidden");
    document.querySelector(".countdown")!.classList.add("hidden");
    this.snake = this.createInitialSnake(5);
    this.directionQueue = ["RIGHT"];
    this.eatenFood = [];
    this.eatenFoodCount = 0;
    this.superFood = null;
    this.superFoodCount = 0;
    this.tick = 0;
    this.isReplay = false;
    this.food = { x: 16, y: 2 };
    this.redraw();
  }
}
