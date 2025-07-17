(() => {
  // === TAB SWITCHING ===
  const tabs = document.querySelectorAll('.tab');
  const tictactoeContainer = document.getElementById('tictactoe-container');
  const puzzleContainer = document.getElementById('puzzle-container');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.game === 'tictactoe') {
        tictactoeContainer.style.display = 'block';
        puzzleContainer.style.display = 'none';
      } else {
        tictactoeContainer.style.display = 'none';
        puzzleContainer.style.display = 'flex';
      }
    });
  });

  // ====== TIC TAC TOE GAME ======
  const canvas = document.getElementById('renderCanvas');
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  let scene;
  const BOARD_SIZE = 3;
  let boardMeshes = [];
  let xMeshes = [];
  let oMeshes = [];
  let board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
  let currentPlayer = 'X';
  let gameOver = false;
  let gameMode = 'pvp';

  let scoreX = 0, scoreO = 0, scoreDraw = 0;

  // Materials
  let boardMaterial, highlightMaterial, xMaterial, oMaterial;

  // Sounds
  const sounds = {
    move: new Audio('https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg'),
    win: new Audio('https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg'),
    draw: new Audio('https://actions.google.com/sounds/v1/cartoon/slide_whistle_to_drum_hit.ogg')
  };

  function createScene() {
    const scn = new BABYLON.Scene(engine);
    scn.clearColor = new BABYLON.Color4(0.07, 0.07, 0.12, 1);

    const camera = new BABYLON.ArcRotateCamera('cam', Math.PI / 4, Math.PI / 3, 10, BABYLON.Vector3.Zero(), scn);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 7;
    camera.upperRadiusLimit = 15;
    camera.wheelPrecision = 50;

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(1, 1, 0), scn);
    light.intensity = 0.9;

    boardMaterial = new BABYLON.StandardMaterial('boardMat', scn);
    boardMaterial.diffuseColor = new BABYLON.Color3(0.35, 0.35, 0.6);

    highlightMaterial = new BABYLON.StandardMaterial('highlightMat', scn);
    highlightMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.8, 0.3);

    xMaterial = new BABYLON.StandardMaterial('xMat', scn);
    xMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.1, 0.1);

    oMaterial = new BABYLON.StandardMaterial('oMat', scn);
    oMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.8);

    const squareSize = 2;
    const startPos = -(squareSize * (BOARD_SIZE - 1)) / 2;

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const square = BABYLON.MeshBuilder.CreateBox('square', { size: squareSize, height: 0.3 }, scn);
        square.position.x = startPos + col * squareSize;
        square.position.z = startPos + row * squareSize;
        square.material = boardMaterial;
        square.metadata = { index: row * BOARD_SIZE + col };
        boardMeshes.push(square);
      }
    }
    return scn;
  }

  scene = createScene();

  function createXMesh(scene) {
    const xMesh = new BABYLON.Mesh('X', scene);
    const line1 = BABYLON.MeshBuilder.CreateLines('line1', { points: [new BABYLON.Vector3(-0.7, 0, -0.7), new BABYLON.Vector3(0.7, 0, 0.7)] }, scene);
    const line2 = BABYLON.MeshBuilder.CreateLines('line2', { points: [new BABYLON.Vector3(-0.7, 0, 0.7), new BABYLON.Vector3(0.7, 0, -0.7)] }, scene);
    line1.color = xMaterial.diffuseColor;
    line2.color = xMaterial.diffuseColor;
    line1.parent = xMesh;
    line2.parent = xMesh;
    return xMesh;
  }

  function createOMesh(scene) {
    const circle = BABYLON.MeshBuilder.CreateTorus('O', {diameter:1.5, thickness:0.3, tessellation:30}, scene);
    circle.material = oMaterial;
    return circle;
  }

  function placeMove(index, player) {
    if (board[index] !== null) return false;
    board[index] = player;

    const square = boardMeshes[index];
    if (player === 'X') {
      const xMesh = createXMesh(scene);
      xMesh.position = square.position.clone();
      xMesh.position.y = 0.35;
      scene.addMesh(xMesh);
      xMeshes.push(xMesh);
    } else {
      const oMesh = createOMesh(scene);
      oMesh.position = square.position.clone();
      oMesh.position.y = 0.35;
      scene.addMesh(oMesh);
      oMeshes.push(oMesh);
    }

    sounds.move.play();
    return true;
  }

  function checkWinner() {
    const lines = [
      [0,1,2], [3,4,5], [6,7,8],
      [0,3,6], [1,4,7], [2,5,8],
      [0,4,8], [2,4,6]
    ];
    for (let line of lines) {
      const [a,b,c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    if (board.every(cell => cell !== null)) return 'draw';
    return null;
  }

  function updateScoreboard() {
    document.getElementById('score-x').textContent = scoreX;
    document.getElementById('score-o').textContent = scoreO;
    document.getElementById('score-draw').textContent = scoreDraw;
  }

  function resetBoard() {
    board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    xMeshes.forEach(mesh => mesh.dispose());
    oMeshes.forEach(mesh => mesh.dispose());
    xMeshes = [];
    oMeshes = [];
    gameOver = false;
    currentPlayer = 'X';
  }

  function getAvailableMoves(board) {
    return board.map((v, i) => v === null ? i : null).filter(v => v !== null);
  }

  function minimax(newBoard, player, depth, maxDepth) {
    const availSpots = getAvailableMoves(newBoard);
    const winnerCheck = checkWinnerStatic(newBoard);
    if (winnerCheck === 'X') return { score: -10 + depth };
    else if (winnerCheck === 'O') return { score: 10 - depth };
    else if (winnerCheck === 'draw') return { score: 0 };
    if (depth >= maxDepth) return { score: 0 };

    let moves = [];
    for (let i of availSpots) {
      const move = {};
      move.index = i;
      newBoard[i] = player;
      let result = minimax(newBoard, player === 'O' ? 'X' : 'O', depth + 1, maxDepth);
      move.score = result.score;
      newBoard[i] = null;
      moves.push(move);
    }

    let bestMove;
    if (player === 'O') {
      let bestScore = -Infinity;
      for (let m of moves) {
        if (m.score > bestScore) {
          bestScore = m.score;
          bestMove = m;
        }
      }
    } else {
      let bestScore = Infinity;
      for (let m of moves) {
        if (m.score < bestScore) {
          bestScore = m.score;
          bestMove = m;
        }
      }
    }
    return bestMove;
  }

  function checkWinnerStatic(boardState) {
    const lines = [
      [0,1,2], [3,4,5], [6,7,8],
      [0,3,6], [1,4,7], [2,5,8],
      [0,4,8], [2,4,6]
    ];
    for (let line of lines) {
      const [a,b,c] = line;
      if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
        return boardState[a];
      }
    }
    if (boardState.every(cell => cell !== null)) return 'draw';
    return null;
  }

  function aiMove() {
    if (gameOver) return;
    let depthLimit = 6;
    if (gameMode === 'easy') depthLimit = 1;
    else if (gameMode === 'medium') depthLimit = 3;

    let move = minimax(board.slice(), 'O', 0, depthLimit);
    if (move && move.index !== undefined) {
      placeMove(move.index, 'O');
      let winner = checkWinner();
      if (winner) endGame(winner);
      else currentPlayer = 'X';
    }
  }

  function endGame(winner) {
    gameOver = true;
    if (winner === 'X') {
      scoreX++;
      sounds.win.play();
      alert("Player X Wins!");
    } else if (winner === 'O') {
      scoreO++;
      sounds.win.play();
      alert("Player O Wins!");
    } else {
      scoreDraw++;
      sounds.draw.play();
      alert("It's a Draw!");
    }
    updateScoreboard();
    resetBoard();
  }

  canvas.addEventListener('pointerdown', evt => {
    if (gameOver) return;
    if (gameMode !== 'pvp' && currentPlayer === 'O') return;

    const pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit) {
      const mesh = pickResult.pickedMesh;
      if (mesh && mesh.metadata && mesh.metadata.index !== undefined) {
        if (placeMove(mesh.metadata.index, currentPlayer)) {
          let winner = checkWinner();
          if (winner) {
            endGame(winner);
            return;
          }
          currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
          if (gameMode !== 'pvp' && currentPlayer === 'O') {
            setTimeout(aiMove, 500);
          }
        }
      }
    }
  });

  const modeSelect = document.getElementById('game-mode-select');
  modeSelect.addEventListener('change', () => {
    gameMode = modeSelect.value;
    resetBoard();
    updateScoreboard();
    if (gameMode !== 'pvp' && currentPlayer === 'O') {
      setTimeout(aiMove, 500);
    }
  });

  engine.runRenderLoop(() => {
    scene.render();
  });
  window.addEventListener('resize', () => engine.resize());

  // SLIDING PUZZLE
  const puzzleBoard = document.getElementById('puzzle-board');
  const puzzleMovesDisplay = document.getElementById('puzzle-moves');
  const puzzleTimeDisplay = document.getElementById('puzzle-time');
  const puzzleShuffleBtn = document.getElementById('puzzle-shuffle');

  const PUZZLE_SIZE = 4;
  let puzzleState = [];
  let emptyIndex;
  let puzzleMoves = 0;
  let puzzleTimer = null;
  let puzzleSeconds = 0;
  let puzzleStarted = false;

  function initPuzzle() {
    puzzleState = [];
    for (let i = 1; i < PUZZLE_SIZE * PUZZLE_SIZE; i++) {
      puzzleState.push(i);
    }
    puzzleState.push(null);
    emptyIndex = puzzleState.length - 1;
    puzzleMoves = 0;
    puzzleSeconds = 0;
    puzzleStarted = false;
    updatePuzzleDisplay();
    updatePuzzleStats();
    if (puzzleTimer) clearInterval(puzzleTimer);
  }

  function shufflePuzzle() {
    let shuffleCount = 1000;
    for (let i = 0; i < shuffleCount; i++) {
      const neighbors = getNeighbors(emptyIndex);
      const randNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
      swapTiles(emptyIndex, randNeighbor);
      emptyIndex = randNeighbor;
    }
    puzzleMoves = 0;
    puzzleSeconds = 0;
    puzzleStarted = true;
    updatePuzzleDisplay();
    updatePuzzleStats();
    if (puzzleTimer) clearInterval(puzzleTimer);
    puzzleTimer = setInterval(() => {
      puzzleSeconds++;
      updatePuzzleStats();
    }, 1000);
  }

  function updatePuzzleDisplay() {
    puzzleBoard.innerHTML = '';
    for (let i = 0; i < puzzleState.length; i++) {
      const tile = document.createElement('div');
      tile.classList.add('puzzle-tile');
      if (puzzleState[i] === null) {
        tile.classList.add('empty');
      } else {
        tile.textContent = puzzleState[i];
        tile.addEventListener('click', () => {
          if (canMove(i)) {
            moveTile(i);
          }
        });
      }
      puzzleBoard.appendChild(tile);
    }
  }

  function updatePuzzleStats() {
    puzzleMovesDisplay.textContent = puzzleMoves;
    const mins = Math.floor(puzzleSeconds / 60);
    const secs = puzzleSeconds % 60;
    puzzleTimeDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getNeighbors(index) {
    let neighbors = [];
    const row = Math.floor(index / PUZZLE_SIZE);
    const col = index % PUZZLE_SIZE;
    if (row > 0) neighbors.push(index - PUZZLE_SIZE);
    if (row < PUZZLE_SIZE - 1) neighbors.push(index + PUZZLE_SIZE);
    if (col > 0) neighbors.push(index - 1);
    if (col < PUZZLE_SIZE - 1) neighbors.push(index + 1);
    return neighbors;
  }

  function canMove(tileIndex) {
    return getNeighbors(emptyIndex).includes(tileIndex);
  }

  function swapTiles(i1, i2) {
    [puzzleState[i1], puzzleState[i2]] = [puzzleState[i2], puzzleState[i1]];
  }

  function moveTile(tileIndex) {
    swapTiles(tileIndex, emptyIndex);
    emptyIndex = tileIndex;
    puzzleMoves++;
    updatePuzzleDisplay();
    updatePuzzleStats();
    checkPuzzleWin();
  }

  function checkPuzzleWin() {
    for (let i = 0; i < puzzleState.length - 1; i++) {
      if (puzzleState[i] !== i + 1) return false;
    }
    if (puzzleState[puzzleState.length - 1] === null) {
      if (puzzleTimer) clearInterval(puzzleTimer);
      puzzleStarted = false;
      setTimeout(() => alert("Congratulations! You solved the puzzle!"), 200);
      return true;
    }
    return false;
  }

  puzzleShuffleBtn.addEventListener('click', () => {
    shufflePuzzle();
  });

  initPuzzle();

})();
