const Game = (function () {
  const mainCanvas = document.getElementById('game')
  const backgroundCanvas = document.getElementById('gameBackground')
  const scoreCanvas = document.getElementById('scoreCanvas')
  const menuCanvas = document.getElementById('gameMenu')
  const gameCanvas = document.createElement('canvas')

  const mainCtx = mainCanvas.getContext('2d')
  mainCanvas.width = 800
  mainCanvas.height = 500

  const ctx = gameCanvas.getContext('2d')
  gameCanvas.width = 800
  gameCanvas.height = 500

  const backgroundCtx = backgroundCanvas.getContext('2d')
  backgroundCanvas.width = 800
  backgroundCanvas.height = 500

  const scoreCtx = scoreCanvas.getContext('2d')
  scoreCanvas.width = 200
  scoreCanvas.height = 80

  const menuCtx = menuCanvas.getContext('2d')
  menuCanvas.width = 800
  menuCanvas.height = 500

  const imageFileNames = ['img/blackBomb.png', 'img/redBomb.png', 'img/blowBomb.png', 'img/bombExplode.png', 'img/background.png', 'img/pauseButton.png', 'img/restartButton.png', 'img/continueButton.png', 'img/startButton.png']

  const images = {
    blackBomb: new Image(),
    redBomb: new Image(),
    blowBomb:new Image(),
    bombExplode: new Image(),
    background: new Image(),
    pauseButton: new Image(),
    restartButton: new Image(),
    continueButton: new Image(),
    startButton: new Image(),
  }

  const sfx = {
    music1: new Audio('sfx/music1.wav'),
    music2: new Audio('sfx/music2.ogg'),
    music3: new Audio('sfx/music3.ogg'),
    bombGrab : new Audio('sfx/bombGrab.mp3'),
    bombExplosion: new Audio('sfx/bombExplosion.mp3'),
    bombBeep: new Audio('sfx/bombBeep.mp3')
  }

  mainCanvas.imageSmoothingEnabled = false
  ctx.imageSmoothingEnabled = false
  backgroundCtx.imageSmoothingEnabled = false

  /* ensure bombs are always at least 5px apart, so they will be clearly visible when overlapped*/
  const randomCoords = (function randomCoords () {
    const values = [325, 330, 335, 340, 345, 350, 355, 360, 365, 370, 375, 380, 385, 390, 395, 400, 405, 410, 415, 420, 425, 430, 435, 440, 445, 450, 455, 460, 465, 470, 475]
    let bag = JSON.parse(JSON.stringify(values))
    function shuffle () {
      bag.forEach((item, index) => {
        let randomIndex = Math.floor(Math.random() * (bag.length - 1))
        const t = bag[index]
        bag[index] = bag[randomIndex]
        bag[randomIndex] = t
      })
    }
    /* a simple shuffle bag implementation. stores the first value, removes it from the array, restores array to original state when empty, shuffles it for randomness, then returns stored value*/
    function next () {
      const value = bag[0]
      bag.shift()
      if (bag.length === 0) {
        bag = JSON.parse(JSON.stringify(values))
      }
      shuffle()
      return bag[0]
    }
    return {next: next}
  })()


  let secondsBetweenSpawns = 3
  let canDrag = false
  let draggedBomb = null
  let level = 1
  let numberOfBombsPerSpawn = 3
  let currentSecond = 0
  let dragging = false
  let gameOver = false
  let redCapturedBombs = 0
  let blackCapturedBombs = 0
  let playerScore = 0
  let bombs = [createBomb(), createBomb(), createBomb()]
  let currentRequest = null
  let gamePaused = false
  let gameStarted = false
  let currentMusic = 1

  let secondsPassed = 0;
  let oldTimeStamp = 0;

  const redBoundsX = [0, 175]
  const redBoundsY = [163, 338]
  const blackBoundsX = [625, 800]
  const blackBoundsY = [163, 338]


  function createBomb (color = Math.random() > 0.5 ? 'red' : 'black')  {
    const direction = Math.random() > 0.5 ? Math.sign(-1) : Math.sign(1)
    const offsetX = Math.random() > 0.5 ? 2 : 1
    const offsetY = offsetX === 2 ? 1 : 2
    const width = 80
    let x = randomCoords.next()
    let y = Math.random() > 0.5 ? 0 : mainCanvas.height - width
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
    }
  }

  function menuButton (text, x, y, width, height, image, activate = function () { alert('Activated')}) {
    return {
      image: image,
      activate: activate,
      text: text,
      x: x,
      y: y,
      width: width,
      height: height
    }
  }

  const menuButtons = {
    start: menuButton('Start', 325, 170, 150, 50, images.startButton, () => {
      sfx[`music${currentMusic}`].play()
      gameStarted = true
      gamePaused = false
    }),
    continue: menuButton('Continue', 325, 170, 150, 50, images.continueButton, () => {
      sfx[`music${currentMusic}`].play()
      gamePaused = false
    }),
    restart: menuButton('Restart', 325, 300, 150, 50, images.restartButton, () => {
      sfx[`music${currentMusic}`].pause()
      currentMusic === 3 ? currentMusic = 1 : currentMusic += 1
      sfx[`music${currentMusic}`].currentTime = 0
      sfx[`music${currentMusic}`].play()
      resetGame()
      gamePaused = false
    }),
    pause: menuButton('Pause', mainCanvas.width - 50, 0, 50, 50, images.pauseButton, () => {
      sfx[`music${currentMusic}`].pause()
      gamePaused = true
    })
  }

  function resetGame () {
    secondsBetweenSpawns = 4
    canDrag = false
    draggedBomb = null
    level = 1
    numberOfBombsPerSpawn = 3
    currentSecond = 0
    dragging = false
    gameOver = false
    redCapturedBombs = 0
    blackCapturedBombs = 0
    playerScore = 0
    bombs = [createBomb(), createBomb(), createBomb()]
  }

  function isWithinBounds (boundsX, boundsY, x, y) {
    if (x >= boundsX[0] && x <= boundsX[1] && y >= boundsY[0] && y <= boundsY[1]) return true
    return false
  }

  function willHitHorizontalWalls (bomb) {
    if (bomb.x + bomb.offsetX > gameCanvas.width - bomb.width || bomb.x + bomb.offsetX < 0) return true
    return false
  }

  function willHitVerticalWalls (bomb) {
    if (bomb.y + bomb.offsetY > gameCanvas.height - bomb.height || bomb.y + bomb.offsetY < 0) return true
    return false
  }


  function willHitCaptureZones (bomb) {
    if (
        (
          isWithinBounds(redBoundsX, redBoundsY, bomb.x + bomb.offsetX, bomb.y + bomb.offsetY) ||
          isWithinBounds(redBoundsX, redBoundsY, bomb.x + bomb.width + bomb.offsetX, bomb.y + bomb.offsetY) ||
          isWithinBounds(redBoundsX, redBoundsY, bomb.x + bomb.offsetX, bomb.y + bomb.height + bomb.offsetY) ||
          isWithinBounds(redBoundsX, redBoundsY, bomb.x + bomb.width + bomb.offsetX, bomb.y + bomb.height + bomb.offsetY)
        ) ||
        (
          isWithinBounds(blackBoundsX, blackBoundsY, bomb.x + bomb.offsetX, bomb.y + bomb.offsetY) ||
          isWithinBounds(blackBoundsX, blackBoundsY, bomb.x + bomb.width + bomb.offsetX, bomb.y + bomb.offsetY) ||
          isWithinBounds(blackBoundsX, blackBoundsY, bomb.x + bomb.offsetX, bomb.y + bomb.height + bomb.offsetY) ||
          isWithinBounds(blackBoundsX, blackBoundsY, bomb.x + bomb.width + bomb.offsetX, bomb.y + bomb.height + bomb.offsetY)
        )
       )
      {
      return true
    }
  }

  function collisionIsVertical(bomb) {
    if (bomb.y >= redBoundsY[1] || bomb.y + bomb.height <= redBoundsY[0]) return true
    return false
  }


  function updateBomb (bomb) {
    if (bomb.isBlownUp) {
      sfx.bombExplosion.play()
      gameOver = true
      sfx[`music${currentMusic}`].pause()
    }
    if (!bomb.isDragging && bomb.canMove) {
      if (willHitHorizontalWalls(bomb)) {
        bomb.offsetX = -bomb.offsetX
      }
      if (willHitVerticalWalls(bomb)) {
        bomb.offsetY = -bomb.offsetY
      }
      if (willHitCaptureZones(bomb)) {
        collisionIsVertical(bomb) ? bomb.offsetY = -bomb.offsetY : bomb.offsetX = -bomb.offsetX
      }
      bomb.x += Math.round((bomb.offsetX * bomb.speed * secondsPassed))
      bomb.y += Math.round((bomb.offsetY * bomb.speed * secondsPassed))
    }
    if (bomb.canMove) {
      bomb.elapsedSeconds += secondsPassed
      if (bomb.elapsedSeconds >= bomb.blowUpSeconds) {
        bomb.isBlownUp = true
      }
    }
    if (bomb.secondsCount >= .5)  bomb.secondsCount = 0
    bomb.secondsCount += secondsPassed
  }

  function updateBombs () {
    bombs.forEach(bomb => {
      updateBomb(bomb)
    })
  }

  function addExtraBombs () {
    if (bombs.length > 70) return
    if (currentSecond > secondsBetweenSpawns) {
      for (let i = 0; i < numberOfBombsPerSpawn; i++) {
        bombs.push(createBomb())
      }
      currentSecond = 0
      level++
      if (level % 5 === 0) {
        if (secondsBetweenSpawns > 1) {
          secondsBetweenSpawns -= .20
        } else {
          numberOfBombsPerSpawn++
        }
      }
    }
  }

  function updateCapturedBombs() {
    if (redCapturedBombs === 20) {
      bombs = bombs.filter(bomb => (bomb.canMove && bomb.color === 'red') || bomb.color === 'black')
      playerScore += redCapturedBombs
      redCapturedBombs = 0
    } else if (blackCapturedBombs === 20) {
      bombs = bombs.filter(bomb => (bomb.canMove && bomb.color === 'black') || bomb.color === 'red')
      playerScore += blackCapturedBombs
      blackCapturedBombs = 0
    }
  }

  function drawMenu () {
    menuCtx.clearRect(0, 0, menuCanvas.width, menuCanvas.height)
    if (gamePaused || gameOver) {
      for (button in menuButtons) {
        if ((gameOver || gameStarted) && button === 'start') continue
        if (!gameStarted && button === 'restart') continue
        if ((!gameStarted || gameOver) && button === 'continue') continue
        if (button === 'pause') continue
        button = menuButtons[button]
        menuCtx.drawImage(button.image, button.x, button.y)
      }
    } else {
      const button = menuButtons.pause
      menuCtx.drawImage(button.image, button.x, button.y)
    }
    requestAnimationFrame(drawMenu)
  }

  function drawBombs() {
    bombs.forEach(bomb => {
      drawBomb(bomb)
    })
  }

  function drawBomb(bomb) {
    let bombSprite = bomb.color === 'red' ? images.redBomb : images.blackBomb
    let column = bomb.secondsCount < .25 ?  0 :  40
    if (bomb.isBlownUp) {
      ctx.drawImage(images.bombExplode, bomb.x, bomb.y)
      return
    }
    if ((bomb.blowUpSeconds - bomb.elapsedSeconds) < 3 && Math.round(bomb.secondsCount * 10) % 2 === 0 && bomb.canMove) {
      bombSprite = images.blowBomb
      sfx.bombBeep.play()
    }
    ctx.drawImage(bombSprite, column, 0, 40, 40, bomb.x, bomb.y, bomb.width, bomb.height)
  }

  function drawPlayerScore () {
    const size = window.innerWidth * 0.03
    scoreCtx.clearRect(0, 0, scoreCanvas.height, scoreCanvas.width)
    scoreCtx.fillStyle = 'white'
    scoreCtx.font = `${size}px serif`
    scoreCtx.fillText('Score: ' + playerScore, 0, size)
    requestAnimationFrame(drawPlayerScore)
  }

  function drawFrame (timeStamp) {
    secondsPassed = (timeStamp - oldTimeStamp) / 1000;
    secondsPassed = Math.min(secondsPassed, 0.16)
    oldTimeStamp = timeStamp;
    if (gameOver || gamePaused ) {
      currentRequest = requestAnimationFrame(drawFrame)
    } else {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
    updateCapturedBombs()
    updateBombs()
    drawBombs()
    addExtraBombs()
    currentSecond += secondsPassed
    currentRequest = requestAnimationFrame(drawFrame)
    }
  }

  function drawGame () {
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
    mainCtx.drawImage(gameCanvas, 0, 0)
    requestAnimationFrame(drawGame)
  }

  function checkIfBombAtPointerLocation (x, y)  {
    /* "DUDE MY MOUSE WAS RIGHT ON TOP OF THE BOMB WTF" - it wasn't even close my friend*/
    const grace = 10
    /* traverse bomb array in reverse - this way players always grab top-most bombs first*/
    for (let i = bombs.length -1; i >= 0; i--)  {
      const bomb = bombs[i]
      const boundsX = [bomb.x - grace, bomb.x + bomb.width + grace]
      const boundsY = [bomb.y - grace, bomb.y + bomb.width + grace]
      if (isWithinBounds(boundsX, boundsY, x, y)) {
        bombs[i].isDragging = true
        draggedBomb = bombs[i]
        break
      }
    }
    return !!draggedBomb
  }

  function checkIfDraggedBombIsDroppedAtCaptureZone ()  {
    const isTopLeftInRed = isWithinBounds(redBoundsX, redBoundsY, draggedBomb.x + draggedBomb.grace, draggedBomb.y)
    const isBottomRightInRed = isWithinBounds(redBoundsX, redBoundsY, draggedBomb.x + draggedBomb.width - draggedBomb.grace, draggedBomb.y + draggedBomb.height)
    const isTopLeftInBlack = isWithinBounds(blackBoundsX, blackBoundsY, draggedBomb.x + draggedBomb.grace, draggedBomb.y)
    const isBottomRightInBlack = isWithinBounds(blackBoundsX, blackBoundsY, draggedBomb.x + draggedBomb.width - draggedBomb.grace, draggedBomb.y + draggedBomb.height)
    if (isTopLeftInRed && isBottomRightInRed && draggedBomb.width == 80) {
      if (draggedBomb.color === 'red') {
        draggedBomb.canMove = false
        redCapturedBombs += 1
      } else {
        draggedBomb.isBlownUp = true
      }
    } else if (isTopLeftInBlack && isBottomRightInBlack && draggedBomb.width == 80) {
      if (draggedBomb.color === 'black') {
        draggedBomb.canMove = false
        blackCapturedBombs += 1
      } else {
        draggedBomb.isBlownUp = true
      }
    } else {
      draggedBomb.x = draggedBomb.savedX
      draggedBomb.y = draggedBomb.savedY
    }
  }


  function gameClickHandler (e) {
    e.preventDefault()
    let relativeX = 0
    let relativeY = 0
    /*touchscreen filter */
    if (e.changedTouches) {
      relativeX = e.changedTouches[0].clientX - mainCanvas.offsetLeft
      relativeY = e.changedTouches[0].clientY - mainCanvas.offsetTop
    } else {
      relativeX = e.clientX - mainCanvas.offsetLeft
      relativeY = e.clientY - mainCanvas.offsetTop
    }
    const canvasX = relativeX * mainCanvas.width / mainCanvas.clientWidth
    const canvasY = relativeY * mainCanvas.height / mainCanvas.clientHeight
    if (isWithinBounds([menuButtons.pause.x, menuButtons.pause.x + menuButtons.pause.width], [menuButtons.pause.y, menuButtons.pause.y + menuButtons.pause.height], canvasX, canvasY)) {
      menuButtons.pause.activate()
      return
    }
    if (gameOver || gamePaused) {
      for (button in menuButtons) {
        button = menuButtons[button]
        const boundsX = [button.x, button.x + button.width]
        const boundsY = [button.y, button.y + button.height]
        if (isWithinBounds(boundsX, boundsY, canvasX, canvasY)) {
          button.activate()
        }
      }
    } else {
      if (isWithinBounds(redBoundsX, redBoundsY, canvasX, canvasY) || isWithinBounds(blackBoundsX, blackBoundsY, canvasX, canvasY)) return
      if (checkIfBombAtPointerLocation(canvasX, canvasY)) {
        sfx.bombGrab.currentTime = 0
        sfx.bombGrab.play()
        draggedBomb.savedX = draggedBomb.x
        draggedBomb.savedY = draggedBomb.y
        canDrag = true
      }
    }
  }

  function gameDragHandler (e) {
    e.preventDefault()
    /*do not do anything if not allowed to drag*/
    if (!canDrag) return
    let relativeX = 0
    let relativeY = 0
    /* touchscreen filter */
    if (e.changedTouches) {
      relativeX = e.changedTouches[0].clientX - mainCanvas.offsetLeft
      relativeY = e.changedTouches[0].clientY - mainCanvas.offsetTop
    } else {
      relativeX = e.clientX - mainCanvas.offsetLeft
      relativeY = e.clientY - mainCanvas.offsetTop
    }
    const canvasX = relativeX * mainCanvas.width / mainCanvas.clientWidth
    const canvasY = relativeY * mainCanvas.height / mainCanvas.clientHeight
    /* first click determines whether there is a bomb being dragged, then this handler moves that bomb if it exists*/
    if (!!draggedBomb) {
      const center = draggedBomb.width / 2 /*snap bomb to mouse by centering it */
      if (!willHitCaptureZones(draggedBomb)) {
        draggedBomb.savedX = draggedBomb.x
        draggedBomb.savedY = draggedBomb.y
      }
      if (draggedBomb.width > 80) {
        draggedBomb.width--
        draggedBomb.height--
      }
      if (canvasX - center > 0 && canvasX + center < gameCanvas.width) {
        draggedBomb.x = canvasX - center
      }
      if (canvasY - center > 0 && canvasY + center < gameCanvas.height) {
        draggedBomb.y = canvasY - center
      }
    }
  }

  function gameUnclickHandler () {
    /*ensure cant drag after lifting mouse click/finger*/
    canDrag = false
    dragging = false
    if (!!draggedBomb) {
      checkIfDraggedBombIsDroppedAtCaptureZone()
      draggedBomb.isDragging = false
      draggedBomb = null
    }
  }

  document.addEventListener('mousedown', gameClickHandler)
  document.addEventListener('mouseup', gameUnclickHandler)
  document.addEventListener('mousemove', gameDragHandler)

  document.addEventListener('touchstart', gameClickHandler)
  document.addEventListener('touchend', gameUnclickHandler)
  document.addEventListener('touchmove', gameDragHandler)

  document.addEventListener('keydown', (e) => {
    if (e.keyCode === 32) {
      if (!gamePaused) {
        menuButtons.pause.activate()
      } else {
        menuButtons.continue.activate()
      }

    }
  })


  function resize () {
      backgroundCanvas.style.width = `${window.innerWidth}px`
      backgroundCanvas.style.height = `${window.innerHeight}px`
      mainCanvas.style.width = `${window.innerWidth}px`
      mainCanvas.style.height = `${window.innerHeight}px`
      menuCanvas.style.width = `${window.innerWidth}px`
      menuCanvas.style.height = `${window.innerHeight}px`
      scoreCanvas.style.width = `${window.innerWidth}px`
      scoreCanvas.style.height = `${window.innerHeight}px`
      scoreCanvas.width = window.innerWidth
      scoreCanvas.height = window.innerHeight
      ctx.imageSmoothingEnabled = false
      backgroundCtx.imageSmoothingEnabled = false
      mainCtx.imageSmoothingEnabled = false
  }

  window.addEventListener('resize', resize)


  function start () {
    cancelAnimationFrame(currentRequest) /* the player is EVIL and will try to make the game restart and if they do that it goes supersonic mode unless you stop it from rendering */
    resetGame()
    resize()
    backgroundCtx.drawImage(images.background, 0, 0)
    gamePaused = true
    drawMenu()
    drawPlayerScore()
    drawFrame()
    drawGame()
  }

  function setSFXProperties () {
    sfx.music1.loop = true
    sfx.music1.volume = 0.25
    sfx.music2.loop = true
    sfx.music2.volume = 0.25
    sfx.music3.loop = true
    sfx.music3.volume = 0.25
    sfx.bombExplosion.volume = 0.5
    sfx.bombBeep.volume = 0.5
  }


  function load() {
    let imagesToLoad = 0
    let imagesLoaded = 0
    let ready = false
    function checkIfReady() {
      if (imagesLoaded === imageFileNames.length) return true
    }
    for (image in images) {
      images[image].onload = function() {
      imagesLoaded++
      if (checkIfReady()) {
          setSFXProperties()
          start()
        }
      }
      images[image].src = imageFileNames[imagesToLoad]
      imagesToLoad++
    }
  }

  return { load: load }

})()

window.onload = () => {
  Game.load()
}
