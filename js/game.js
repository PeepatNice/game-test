// game.js — Main Game Loop & State Management
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.renderer = new Renderer(this.canvas);
        this.audio = new AudioManager();
        this.camera = new Camera(this.canvas);

        this.state = 'menu'; // menu, playing, gameover
        this.score = 0;
        this.coins = 0;
        this.highScore = parseInt(localStorage.getItem('hcr_highScore') || '0');
        this.highDistance = parseInt(localStorage.getItem('hcr_highDist') || '0');

        // Input state
        this.keys = {};
        this.touchGas = false;
        this.touchGas = false;
        this.touchBrake = false;

        // Score popups
        this.popups = [];

        // Time
        this.lastTime = 0;
        this.dt = 0;

        this.setupInput();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Start menu loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.camera.resize(this.canvas);
        this.renderer = new Renderer(this.canvas);
    }

    setupInput() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === ' ' || e.key === 'Enter') {
                if (this.state === 'menu' || this.state === 'gameover') {
                    this.startGame();
                }
            }
            if (e.key === 'm' || e.key === 'M') {
                const muted = this.audio.toggleMute();
                document.getElementById('muteBtn').textContent = muted ? '🔇' : '🔊';
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        // Touch controls
        const gasBtn = document.getElementById('gasBtn');
        const brakeBtn = document.getElementById('brakeBtn');

        const addTouchListeners = (btn, onStart, onEnd) => {
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(); });
            btn.addEventListener('touchend', (e) => { e.preventDefault(); onEnd(); });
            btn.addEventListener('touchcancel', (e) => { e.preventDefault(); onEnd(); });
            btn.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(); });
            btn.addEventListener('mouseup', (e) => { e.preventDefault(); onEnd(); });
            btn.addEventListener('mouseleave', (e) => { onEnd(); });
        };

        addTouchListeners(gasBtn,
            () => this.touchGas = true,
            () => this.touchGas = false
        );
        addTouchListeners(brakeBtn,
            () => this.touchBrake = true,
            () => this.touchBrake = false
        );

        // Start button
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());

        // Mute button
        document.getElementById('muteBtn').addEventListener('click', () => {
            const muted = this.audio.toggleMute();
            document.getElementById('muteBtn').textContent = muted ? '🔇' : '🔊';
        });

        // Tap to start on canvas for menu
        this.canvas.addEventListener('click', () => {
            if (this.state === 'menu') this.startGame();
        });
    }

    startGame() {
        this.audio.init();
        this.terrain = new Terrain();
        this.terrain = new Terrain();
        this.car = new Car(100, 380); // Spawn closer to ground (y=400 is ground)
        this.camera.x = this.car.x;
        this.camera.y = this.car.y - 80;
        this.state = 'playing';
        this.score = 0;
        this.coins = 0;
        this.popups = [];

        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        document.getElementById('gameUI').style.display = 'flex';
        document.getElementById('controls').style.display = 'flex';
    }

    gameOver() {
        this.state = 'gameover';
        this.audio.playCrashSound();
        this.audio.stopEngine();

        // Calculate final score
        this.score = this.car.distance + this.coins * 50;

        // Update high scores
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('hcr_highScore', this.highScore);
        }
        if (this.car.maxDistance > this.highDistance) {
            this.highDistance = this.car.maxDistance;
            localStorage.setItem('hcr_highDist', this.highDistance);
        }

        // Show game over screen
        document.getElementById('gameUI').style.display = 'none';
        document.getElementById('controls').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'flex';
        document.getElementById('finalDistance').textContent = this.car.maxDistance + 'm';
        document.getElementById('finalCoins').textContent = this.coins;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestDistance').textContent = this.highDistance + 'm';
        document.getElementById('bestScore').textContent = this.highScore;
    }

    update() {
        if (this.state !== 'playing') return;

        // Input processing
        const gas = this.keys['ArrowUp'] || this.keys['w'] || this.keys['W'] || this.touchGas;
        const brake = this.keys['ArrowDown'] || this.keys['s'] || this.keys['S'] || this.touchBrake;

        // Visual indicators
        const gasKey = document.getElementById('key-gas');
        const brakeKey = document.getElementById('key-brake');
        if (gasKey) gasKey.classList.toggle('active', !!gas);
        if (brakeKey) brakeKey.classList.toggle('active', !!brake);

        this.car.throttle = gas ? 1 : 0;
        this.car.brake = brake ? 1 : 0;

        // Update car physics
        this.car.update(this.terrain, this.dt);

        // Check for coin collection
        this.terrain.coins.forEach(coin => {
            if (coin._justCollected) {
                coin._justCollected = false;
                this.coins++;
                this.audio.playCoinSound();
                this.audio.playVoice('รวยไม่ไหวแล้ว');
                this.popups.push({
                    x: coin.x,
                    y: coin.y - 20,
                    text: '+50',
                    color: '#ffd700',
                    life: 60
                });
            }
        });

        // Check for fuel collection
        this.terrain.fuelCans.forEach(fuel => {
            if (fuel._justCollected) {
                fuel._justCollected = false;
                this.audio.playFuelSound();
                this.popups.push({
                    x: fuel.x,
                    y: fuel.y - 20,
                    text: '+FUEL',
                    color: '#2ecc71',
                    life: 60
                });
            }
        });

        // Update camera
        this.camera.follow(this.car);

        // Update audio
        this.audio.updateEngine(this.car.rpm, this.car.throttle);

        // Update popups
        this.popups = this.popups.filter(p => {
            p.y -= 1;
            p.life--;
            return p.life > 0;
        });

        // Update UI
        this.updateUI();

        // Check game over
        if (this.car.crashed) {
            this.gameOver();
        }
    }

    updateUI() {
        // Fuel bar
        const fuelFill = document.getElementById('fuelFill');
        const fuelPercent = (this.car.fuel / this.car.maxFuel) * 100;
        fuelFill.style.width = fuelPercent + '%';

        if (fuelPercent > 50) {
            fuelFill.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
        } else if (fuelPercent > 25) {
            fuelFill.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
        } else {
            fuelFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
            // Pulse animation when low
            fuelFill.style.animation = 'pulse 0.5s infinite';
        }

        if (fuelPercent > 25) {
            fuelFill.style.animation = 'none';
        }

        // Distance
        document.getElementById('distance').textContent = this.car.distance + 'm';

        // Coins
        document.getElementById('coinCount').textContent = this.coins;
    }

    render() {
        const ctx = this.ctx;

        // Draw background
        this.renderer.drawBackground(this.camera);

        if (this.state === 'playing' || this.state === 'gameover') {
            // Draw terrain
            this.terrain.render(ctx, this.camera);
            // Draw car
            this.car.render(ctx, this.camera);

            // Draw popups
            const cx = ctx.canvas.width / 2;
            const cy = ctx.canvas.height / 2;
            this.popups.forEach(p => {
                const sx = p.x - this.camera.x + cx;
                const sy = p.y - this.camera.y + cy;
                const alpha = p.life / 60;
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.font = 'bold 20px "Outfit", sans-serif';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 10;
                ctx.shadowColor = p.color;
                ctx.fillText(p.text, sx, sy);
                ctx.restore();
            });
        }
    }

    loop(time) {
        this.dt = Math.min(0.05, (time - this.lastTime) / 1000);
        this.lastTime = time;

        this.update();
        this.render();

        requestAnimationFrame(this.loop);
    }
}

// Start game when page loads
window.addEventListener('load', () => {
    window.game = new Game();
});
