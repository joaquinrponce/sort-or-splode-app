"use strict";

var Game = function () {
  var mainCanvas = document.getElementById('game');
  var backgroundCanvas = document.getElementById('gameBackground');
  var scoreCanvas = document.getElementById('scoreCanvas');
  var menuCanvas = document.getElementById('gameMenu');
  var gameCanvas = document.createElement('canvas');
  var mainCtx = mainCanvas.getContext('2d');
  mainCanvas.width = 800;
  mainCanvas.height = 500;
  var ctx = gameCanvas.getContext('2d');
  gameCanvas.width = 800;
  gameCanvas.height = 500;
  var backgroundCtx = backgroundCanvas.getContext('2d');
  backgroundCanvas.width = 800;
  backgroundCanvas.height = 500;
  var scoreCtx = scoreCanvas.getContext('2d');
  scoreCanvas.width = 800;
  scoreCanvas.height = 500;
  var menuCtx = menuCanvas.getContext('2d');
  menuCanvas.width = 800;
  menuCanvas.height = 500;
  var imageFileNames = ['img/blackBomb.png', 'img/redBomb.png', 'img/blowBomb.png', 'img/bombExplode.png', 'img/background.png', 'img/pauseButton.png', 'img/restartButton.png', 'img/continueButton.png', 'img/startButton.png'];
  var images = {
    blackBomb: new Image(),
    redBomb: new Image(),
    blowBomb: new Image(),
    bombExplode: new Image(),
    background: new Image(),
    pauseButton: new Image(),
    restartButton: new Image(),
    continueButton: new Image(),
    startButton: new Image()
  };
  var sfx = {
    music1: new Audio('sfx/music1.ogg'),
    music2: new Audio('sfx/music2.ogg'),
    bombGrab: new Audio('sfx/bombGrab.mp3'),
    bombExplosion: new Audio('sfx/bombExplosion.mp3'),
    bombBeep: new Audio('sfx/bombBeep.mp3')
  };
  mainCanvas.imageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;
  backgroundCtx.imageSmoothingEnabled = false;
  /* ensure bombs are always at least 5px apart, so they will be clearly visible when overlapped*/

  var randomCoords = function randomCoords() {
    var values = [325, 330, 335, 340, 345, 350, 355, 360, 365, 370, 375, 380, 385, 390, 395, 400, 405, 410, 415, 420, 425, 430, 435, 440, 445, 450, 455, 460, 465, 470, 475];
    var bag = JSON.parse(JSON.stringify(values));

    function shuffle() {
      bag.forEach(function (item, index) {
        var randomIndex = Math.floor(Math.random() * (bag.length - 1));
        var t = bag[index];
        bag[index] = bag[randomIndex];
        bag[randomIndex] = t;
      });
    }
    /* a simple shuffle bag implementation. stores the first value, removes it from the array, restores array to original state when empty, shuffles it for randomness, then returns stored value*/


    function next() {
      var value = bag[0];
      bag.shift();

      if (bag.length === 0) {
        bag = JSON.parse(JSON.stringify(values));
      }

      shuffle();
      return bag[0];
    }

    return {
      next: next
    };
  }();

  var secondsBetweenSpawns = 3;
  var canDrag = false;
  var draggedBomb = null;
  var level = 1;
  var numberOfBombsPerSpawn = 3;
  var currentSecond = 0;
  var dragging = false;
  var gameOver = false;
  var redCapturedBombs = 0;
  var blackCapturedBombs = 0;
  var playerScore = 0;
  var bombs = [createBomb(), createBomb(), createBomb()];
  var currentRequest = null;
  var gamePaused = false;
  var gameStarted = false;
  var currentMusic = 1;
  var showMenu = false;
  var scores = [];
  var secondsPassed = 0;
  var oldTimeStamp = 0;
  var redBoundsX = [0, 175];
  var redBoundsY = [163, 338];
  var blackBoundsX = [625, 800];
  var blackBoundsY = [163, 338];

  function createBomb() {
    var color = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Math.random() > 0.5 ? 'red' : 'black';
    var direction = Math.random() > 0.5 ? Math.sign(-1) : Math.sign(1);
    var offsetX = Math.random() > 0.5 ? 2 : 1;
    var offsetY = offsetX === 2 ? 1 : 2;
    var width = 80;
    var x = randomCoords.next();
    var y = Math.random() > 0.5 ? 0 : mainCanvas.height - width;
    return {
      speed: 50,
      x: x,
      y: y,
      savedX: x,
      savedY: y,
      offsetY: offsetY,
      offsetX: offsetX * direction,
      color: color,
      isDragging: false,
      canMove: true,
      elapsedSeconds: 0,
      blowUpSeconds: 10,
      isBlownUp: false,
      width: width,
      height: width,
      secondsCount: 0,
      grace: width / 10
    };
  }

  function menuButton(text, x, y, width, height, image) {
    var activate = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : function () {
      alert('Activated');
    };
    return {
      image: image,
      activate: activate,
      text: text,
      x: x,
      y: y,
      width: width,
      height: height
    };
  }

  var menuButtons = {
    start: menuButton('Start', 325, 170, 150, 50, images.startButton, function () {
      if (gameStarted) return;
      sfx["music".concat(currentMusic)].play();
      gameStarted = true;
      showMenu = false;
    }),
    "continue": menuButton('Continue', 325, 170, 150, 50, images.continueButton, function () {
      if (gameOver) return;
      sfx["music".concat(currentMusic)].play();
      gamePaused = false;
      showMenu = false;
    }),
    restart: menuButton('Restart', 325, 300, 150, 50, images.restartButton, function () {
      if (!gameStarted) return;
      sfx["music".concat(currentMusic)].pause();
      currentMusic === 2 ? currentMusic = 1 : currentMusic += 1;
      sfx["music".concat(currentMusic)].currentTime = 0;
      sfx["music".concat(currentMusic)].play();
      resetGame();
      gamePaused = false;
      showMenu = false;
    }),
    pause: menuButton('Pause', mainCanvas.width - 50, 0, 50, 50, images.pauseButton, function () {
      sfx["music".concat(currentMusic)].pause();
      gamePaused = true;
      showMenu = true;
    })
  };

  function resetGame() {
    secondsBetweenSpawns = 4;
    canDrag = false;
    draggedBomb = null;
    level = 1;
    numberOfBombsPerSpawn = 3;
    currentSecond = 0;
    dragging = false;
    gameOver = false;
    redCapturedBombs = 0;
    blackCapturedBombs = 0;
    playerScore = 0;
    bombs = [createBomb(), createBomb(), createBomb()];
  }

  function isWithinBounds(boundsX, boundsY, x, y) {
    if (x >= boundsX[0] && x <= boundsX[1] && y >= boundsY[0] && y <= boundsY[1]) return true;
    return false;
  }

  function willHitHorizontalWalls(bomb) {
    if (bomb.x + bomb.offsetX > gameCanvas.width - bomb.width || bomb.x + bomb.offsetX < 0) return true;
    return false;
  }

  function willHitVerticalWalls(bomb) {
    if (bomb.y + bomb.offsetY > gameCanvas.height - bomb.height || bomb.y + bomb.offsetY < 0) return true;
    return false;
  }

  function willHitCaptureZones(bomb) {
    if (isWithinBounds(redBoundsX, redBoundsY, bomb.x + bomb.offsetX, bomb.y + bomb.offsetY) || isWithinBounds(redBoundsX, redBoundsY, bomb.x + bomb.width + bomb.offsetX, bomb.y + bomb.offsetY) || isWithinBounds(redBoundsX, redBoundsY, bomb.x + bomb.offsetX, bomb.y + bomb.height + bomb.offsetY) || isWithinBounds(redBoundsX, redBoundsY, bomb.x + bomb.width + bomb.offsetX, bomb.y + bomb.height + bomb.offsetY) || isWithinBounds(blackBoundsX, blackBoundsY, bomb.x + bomb.offsetX, bomb.y + bomb.offsetY) || isWithinBounds(blackBoundsX, blackBoundsY, bomb.x + bomb.width + bomb.offsetX, bomb.y + bomb.offsetY) || isWithinBounds(blackBoundsX, blackBoundsY, bomb.x + bomb.offsetX, bomb.y + bomb.height + bomb.offsetY) || isWithinBounds(blackBoundsX, blackBoundsY, bomb.x + bomb.width + bomb.offsetX, bomb.y + bomb.height + bomb.offsetY)) {
      return true;
    }
  }

  function collisionIsVertical(bomb) {
    if (bomb.y >= redBoundsY[1] || bomb.y + bomb.height <= redBoundsY[0]) return true;
    return false;
  }

  function endGame() {
    gameOver = true;
    showMenu = true;
    sfx["music".concat(currentMusic)].pause();
    scores.push(playerScore);
    scores.sort(function (a, b) {
      return b - a;
    });
    scores = scores.slice(0, 5);
    saveScores();
  }

  function updateBomb(bomb) {
    if (bomb.isBlownUp) {
      sfx.bombExplosion.play();
      endGame();
    }

    if (!bomb.isDragging && bomb.canMove) {
      if (willHitHorizontalWalls(bomb)) {
        bomb.offsetX = -bomb.offsetX;
      }

      if (willHitVerticalWalls(bomb)) {
        bomb.offsetY = -bomb.offsetY;
      }

      if (willHitCaptureZones(bomb)) {
        collisionIsVertical(bomb) ? bomb.offsetY = -bomb.offsetY : bomb.offsetX = -bomb.offsetX;
      }

      bomb.x += Math.round(bomb.offsetX * bomb.speed * secondsPassed);
      bomb.y += Math.round(bomb.offsetY * bomb.speed * secondsPassed);
    }

    if (bomb.canMove) {
      bomb.elapsedSeconds += secondsPassed;

      if (bomb.elapsedSeconds >= bomb.blowUpSeconds) {
        bomb.isBlownUp = true;
      }
    }

    if (bomb.secondsCount >= .5) bomb.secondsCount = 0;
    bomb.secondsCount += secondsPassed;
  }

  function updateBombs() {
    bombs.forEach(function (bomb) {
      updateBomb(bomb);
    });
  }

  function addExtraBombs() {
    if (bombs.length > 70) return;

    if (currentSecond > secondsBetweenSpawns) {
      for (var i = 0; i < numberOfBombsPerSpawn; i++) {
        bombs.push(createBomb());
      }

      currentSecond = 0;
      level++;

      if (level % 5 === 0) {
        if (secondsBetweenSpawns > 1) {
          secondsBetweenSpawns -= .20;
        } else {
          numberOfBombsPerSpawn++;
        }
      }
    }
  }

  function updateCapturedBombs() {
    if (redCapturedBombs === 20) {
      bombs = bombs.filter(function (bomb) {
        return bomb.canMove && bomb.color === 'red' || bomb.color === 'black';
      });
      playerScore += redCapturedBombs;
      redCapturedBombs = 0;
    } else if (blackCapturedBombs === 20) {
      bombs = bombs.filter(function (bomb) {
        return bomb.canMove && bomb.color === 'black' || bomb.color === 'red';
      });
      playerScore += blackCapturedBombs;
      blackCapturedBombs = 0;
    }
  }

  function drawMenu() {
    menuCtx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);

    if (showMenu) {
      Object.keys(menuButtons).forEach( function(button) {
        if (button === 'start' && (gameStarted || gameOver)) return;
        if (button === 'restart' && !gameStarted) return;
        if (button === 'continue' && !gamePaused) return;
        if (button == 'pause') return;
        button = menuButtons[button];
        menuCtx.drawImage(button.image, button.x, button.y);
        }
      )
    } else {
      menuCtx.drawImage(menuButtons.pause.image, menuButtons.pause.x, menuButtons.pause.y);
    }

    requestAnimationFrame(drawMenu);
  }

  function drawBombs() {
    bombs.forEach(function (bomb) {
      drawBomb(bomb);
    });
  }

  function drawBomb(bomb) {
    var bombSprite = bomb.color === 'red' ? images.redBomb : images.blackBomb;
    var column = bomb.secondsCount < .25 ? 0 : 40;

    if (bomb.isBlownUp) {
      ctx.drawImage(images.bombExplode, bomb.x, bomb.y);
      return;
    }

    if (bomb.blowUpSeconds - bomb.elapsedSeconds < 3 && Math.round(bomb.secondsCount * 10) % 2 === 0 && bomb.canMove) {
      bombSprite = images.blowBomb;
      sfx.bombBeep.play();
    }

    ctx.drawImage(bombSprite, column, 0, 40, 40, bomb.x, bomb.y, bomb.width, bomb.height);
  }

  function drawHighScores(size) {
    var x = 325;
    var y = size * 3 - 15;
    scoreCtx.fillStyle = 'white';
    scoreCtx.fillText("Highscores", x, y);
    y += size * 2;
    scores.forEach(function (score, index) {
      if (index >= 5) return;
      scoreCtx.fillStyle = 'white';
      scoreCtx.fillText("#".concat(index + 1, ":       ").concat(score), x, y);
      y += size;
    });
  }

  function drawPlayerScore() {
    scoreCtx.clearRect(0, 0, scoreCanvas.width, scoreCanvas.height);
    var size = 34;
    scoreCtx.fillStyle = 'white';
    scoreCtx.font = "".concat(size, "px arial");

    if (gameOver) {
      scoreCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      scoreCtx.fillRect(0, 0, scoreCanvas.width, scoreCanvas.height);
      drawHighScores(size);
    } else {
      scoreCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      scoreCtx.fillRect(0, 0, 175, size + 10);
      scoreCtx.fillStyle = 'white';
      scoreCtx.fillText("Score: ".concat(playerScore), 0, size);
    }

    requestAnimationFrame(drawPlayerScore);
  }

  function drawFrame() {
    var timeStamp = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
    secondsPassed = (timeStamp - oldTimeStamp) / 1000;
    secondsPassed = Math.min(secondsPassed, 0.16);
    oldTimeStamp = timeStamp;

    if (gameOver || gamePaused || !gameStarted) {
      currentRequest = requestAnimationFrame(drawFrame);
    } else {
      ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
      updateCapturedBombs();
      updateBombs();
      drawBombs();
      addExtraBombs();
      currentSecond += secondsPassed;
      currentRequest = requestAnimationFrame(drawFrame);
    }
  }

  function drawGame() {
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.drawImage(gameCanvas, 0, 0);
    requestAnimationFrame(drawGame);
  }

  function checkIfBombAtPointerLocation(x, y) {
    /* "DUDE MY MOUSE WAS RIGHT ON TOP OF THE BOMB WTF" - it wasn't even close my friend*/
    var grace = 10;
    /* traverse bomb array in reverse - this way players always grab top-most bombs first*/

    for (var i = bombs.length - 1; i >= 0; i--) {
      var bomb = bombs[i];
      var boundsX = [bomb.x - grace, bomb.x + bomb.width + grace];
      var boundsY = [bomb.y - grace, bomb.y + bomb.width + grace];

      if (isWithinBounds(boundsX, boundsY, x, y)) {
        bombs[i].isDragging = true;
        draggedBomb = bombs[i];
        break;
      }
    }

    return !!draggedBomb;
  }

  function checkIfDraggedBombIsDroppedAtCaptureZone() {
    var isTopLeftInRed = isWithinBounds(redBoundsX, redBoundsY, draggedBomb.x + draggedBomb.grace, draggedBomb.y);
    var isBottomRightInRed = isWithinBounds(redBoundsX, redBoundsY, draggedBomb.x + draggedBomb.width - draggedBomb.grace, draggedBomb.y + draggedBomb.height);
    var isTopLeftInBlack = isWithinBounds(blackBoundsX, blackBoundsY, draggedBomb.x + draggedBomb.grace, draggedBomb.y);
    var isBottomRightInBlack = isWithinBounds(blackBoundsX, blackBoundsY, draggedBomb.x + draggedBomb.width - draggedBomb.grace, draggedBomb.y + draggedBomb.height);

    if (isTopLeftInRed && isBottomRightInRed && draggedBomb.width == 80) {
      if (draggedBomb.color === 'red') {
        draggedBomb.canMove = false;
        redCapturedBombs += 1;
      } else {
        draggedBomb.isBlownUp = true;
      }
    } else if (isTopLeftInBlack && isBottomRightInBlack && draggedBomb.width == 80) {
      if (draggedBomb.color === 'black') {
        draggedBomb.canMove = false;
        blackCapturedBombs += 1;
      } else {
        draggedBomb.isBlownUp = true;
      }
    } else {
      draggedBomb.x = draggedBomb.savedX;
      draggedBomb.y = draggedBomb.savedY;
    }
  }

  function gameClickHandler(e) {
    e.preventDefault();
    var relativeX = 0;
    var relativeY = 0;
    /*touchscreen filter */

    if (e.changedTouches) {
      relativeX = e.changedTouches[0].clientX - mainCanvas.offsetLeft;
      relativeY = e.changedTouches[0].clientY - mainCanvas.offsetTop;
    } else {
      relativeX = e.clientX - mainCanvas.offsetLeft;
      relativeY = e.clientY - mainCanvas.offsetTop;
    }

    var canvasX = relativeX * mainCanvas.width / mainCanvas.clientWidth;
    var canvasY = relativeY * mainCanvas.height / mainCanvas.clientHeight;

    if (isWithinBounds([menuButtons.pause.x, menuButtons.pause.x + menuButtons.pause.width], [menuButtons.pause.y, menuButtons.pause.y + menuButtons.pause.height], canvasX, canvasY)) {
      menuButtons.pause.activate();
      return;
    }

    if (showMenu) {
      Object.keys(menuButtons).forEach( function (button) {
        button = menuButtons[button];
        var boundsX = [button.x, button.x + button.width];
        var boundsY = [button.y, button.y + button.height];
        if (isWithinBounds(boundsX, boundsY, canvasX, canvasY)) {
          button.activate();
        }
      })
    } else {
      if (isWithinBounds(redBoundsX, redBoundsY, canvasX, canvasY) || isWithinBounds(blackBoundsX, blackBoundsY, canvasX, canvasY)) return;

      if (checkIfBombAtPointerLocation(canvasX, canvasY)) {
        sfx.bombGrab.currentTime = 0;
        sfx.bombGrab.play();
        draggedBomb.savedX = draggedBomb.x;
        draggedBomb.savedY = draggedBomb.y;
        canDrag = true;
      }
    }
  }

  function gameDragHandler(e) {
    e.preventDefault();
    /*do not do anything if not allowed to drag*/

    if (!canDrag) return;
    var relativeX = 0;
    var relativeY = 0;
    /* touchscreen filter */

    if (e.changedTouches) {
      relativeX = e.changedTouches[0].clientX - mainCanvas.offsetLeft;
      relativeY = e.changedTouches[0].clientY - mainCanvas.offsetTop;
    } else {
      relativeX = e.clientX - mainCanvas.offsetLeft;
      relativeY = e.clientY - mainCanvas.offsetTop;
    }

    var canvasX = relativeX * mainCanvas.width / mainCanvas.clientWidth;
    var canvasY = relativeY * mainCanvas.height / mainCanvas.clientHeight;
    /* first click determines whether there is a bomb being dragged, then this handler moves that bomb if it exists*/

    if (!!draggedBomb) {
      var center = draggedBomb.width / 2;
      /*snap bomb to mouse by centering it */

      if (!willHitCaptureZones(draggedBomb)) {
        draggedBomb.savedX = draggedBomb.x;
        draggedBomb.savedY = draggedBomb.y;
      }

      if (draggedBomb.width > 80) {
        draggedBomb.width--;
        draggedBomb.height--;
      }

      if (canvasX - center > 0 && canvasX + center < gameCanvas.width) {
        draggedBomb.x = canvasX - center;
      }

      if (canvasY - center > 0 && canvasY + center < gameCanvas.height) {
        draggedBomb.y = canvasY - center;
      }
    }
  }

  function gameUnclickHandler() {
    /*ensure cant drag after lifting mouse click/finger*/
    canDrag = false;
    dragging = false;

    if (!!draggedBomb) {
      checkIfDraggedBombIsDroppedAtCaptureZone();
      draggedBomb.isDragging = false;
      draggedBomb = null;
    }
  }

  document.addEventListener('mousedown', gameClickHandler);
  document.addEventListener('mouseup', gameUnclickHandler);
  document.addEventListener('mousemove', gameDragHandler);
  document.addEventListener('touchstart', gameClickHandler);
  document.addEventListener('touchend', gameUnclickHandler);
  document.addEventListener('touchmove', gameDragHandler);
  document.addEventListener('keydown', function (e) {
    if (e.keyCode === 32) {
      if (!gamePaused) {
        menuButtons.pause.activate();
      } else {
        menuButtons["continue"].activate();
      }
    }
  });

  function resize() {
    backgroundCanvas.style.width = "".concat(window.innerWidth, "px");
    backgroundCanvas.style.height = "".concat(window.innerHeight, "px");
    mainCanvas.style.width = "".concat(window.innerWidth, "px");
    mainCanvas.style.height = "".concat(window.innerHeight, "px");
    menuCanvas.style.width = "".concat(window.innerWidth, "px");
    menuCanvas.style.height = "".concat(window.innerHeight, "px");
    scoreCanvas.style.width = "".concat(window.innerWidth, "px");
    scoreCanvas.style.height = "".concat(window.innerHeight, "px");
    ctx.imageSmoothingEnabled = false;
    backgroundCtx.imageSmoothingEnabled = false;
    mainCtx.imageSmoothingEnabled = false;
    scoreCtx.imageSmoothingEnabled = false;
  }

  window.addEventListener('resize', resize);

  function start() {
    cancelAnimationFrame(currentRequest);
    /* the player is EVIL and will try to make the game restart and if they do that it goes supersonic mode unless you stop it from rendering */

    resetGame();
    resize();
    backgroundCtx.drawImage(images.background, 0, 0);
    showMenu = true;
    gameStarted = false;
    drawMenu();
    drawPlayerScore();
    drawFrame();
    drawGame();
  }

  function setSFXProperties() {
    sfx.music1.loop = true;
    sfx.music1.volume = 0.25;
    sfx.music2.loop = true;
    sfx.music2.volume = 0.25;
    sfx.bombExplosion.volume = 0.5;
    sfx.bombBeep.volume = 0.5;
  }

  function saveScores() {
    window.localStorage.setItem('scores', JSON.stringify(scores));
  }

  function loadHighScores() {
    scores = JSON.parse(window.localStorage.getItem('scores')) || [];
  }

  function load() {
    var imagesToLoad = 0;
    var imagesLoaded = 0;
    var ready = false;

    function checkIfReady() {
      if (imagesLoaded === imageFileNames.length) return true;
    }

    function callback () {
      imagesLoaded++;

      if (checkIfReady()) {
        setSFXProperties();
        loadHighScores();
        start();
      }

    }

    Object.keys(images).forEach(function(image) {
      images[image].onload = callback
      images[image].src = imageFileNames[imagesToLoad];
      imagesToLoad++;
    })
  }

  return {
    load: load
  };
}();

window.onload = function () {
  Game.load();
};
