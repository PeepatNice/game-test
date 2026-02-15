// game.js — Main Game Loop & State Management

// Determine API URL based on environment
// If running on mobile (Capacitor) or not on local dev server, use Production Backend
const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '3000';
const API_BASE_URL = isLocalDev ? '' : 'https://game-test-8mxn.onrender.com';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.renderer = new Renderer(this.canvas);
        this.audio = new AudioManager();
        this.camera = new Camera(this.canvas);

        this.state = 'login'; // login, menu, playing, gameover
        this.score = 0;
        this.coins = 0;
        this.playerName = '';
        this.selectedLevel = 'grassland';
        this.selectedSkin = 'red';
        this.highScore = parseInt(localStorage.getItem('hcr_highScore') || '0');
        this.highDistance = parseInt(localStorage.getItem('hcr_highDist') || '0');

        // Input state
        this.keys = {};
        this.touchGas = false;
        this.touchBrake = false;

        // Score popups
        this.popups = [];

        // Time
        this.lastTime = 0;
        this.dt = 0;

        this.setupInput();
        this.setupLogin();
        this.setupSelections();
        this.setupScoreboard();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Start loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.camera.resize(this.canvas);
        this.renderer = new Renderer(this.canvas, this.selectedLevel);
    }

    // ─── Login System ────────────────────────────────────────
    setupLogin() {
        const loginBtn = document.getElementById('loginBtn');
        const nameInput = document.getElementById('playerNameInput');

        loginBtn.addEventListener('click', () => this.handleLogin());
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
    }

    async handleLogin() {
        const nameInput = document.getElementById('playerNameInput');
        const errorDiv = document.getElementById('loginError');
        const loadingDiv = document.getElementById('loginLoading');
        const loginBtn = document.getElementById('loginBtn');
        const name = nameInput.value.trim();

        if (!name) {
            errorDiv.textContent = 'กรุณากรอกชื่อผู้เล่น';
            nameInput.focus();
            return;
        }

        errorDiv.textContent = '';
        loadingDiv.style.display = 'block';
        loginBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');

            this.playerName = name;

            if (data.player) {
                this.highScore = data.player.score_statistics || 0;
                this.highDistance = data.player.distance_statistics || 0;
                localStorage.setItem('hcr_highScore', this.highScore);
                localStorage.setItem('hcr_highDist', this.highDistance);
            }

            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('menuScreen').style.display = 'flex';
            document.getElementById('playerNameDisplay').textContent = this.playerName;
            document.getElementById('menuHighScore').textContent = this.highScore;

            this.state = 'menu';
        } catch (err) {
            errorDiv.textContent = err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        } finally {
            loadingDiv.style.display = 'none';
            loginBtn.disabled = false;
        }
    }

    // ─── Level & Skin Selection ──────────────────────────────
    setupSelections() {
        // Level selection
        document.querySelectorAll('[data-level]').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('[data-level]').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedLevel = card.dataset.level;
            });
        });

        // Skin selection
        document.querySelectorAll('[data-skin]').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('[data-skin]').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedSkin = card.dataset.skin;
            });
        });
    }

    // ─── Scoreboard Modal ────────────────────────────────────
    setupScoreboard() {
        document.getElementById('scoreboardBtn').addEventListener('click', () => this.openScoreboard());
        document.getElementById('closeScoreboardBtn').addEventListener('click', () => this.closeScoreboard());

        // Close on backdrop click
        document.getElementById('scoreboardModal').addEventListener('click', (e) => {
            if (e.target.id === 'scoreboardModal') this.closeScoreboard();
        });
    }

    async openScoreboard() {
        const modal = document.getElementById('scoreboardModal');
        const loadingDiv = document.getElementById('modalLeaderboardLoading');
        const tableEl = document.getElementById('modalLeaderboardTable');
        const bodyEl = document.getElementById('modalLeaderboardBody');

        modal.style.display = 'flex';
        loadingDiv.style.display = 'block';
        loadingDiv.textContent = 'กำลังโหลด...';
        tableEl.style.display = 'none';

        try {
            const res = await fetch(`${API_BASE_URL}/api/leaderboard`);
            const data = await res.json();

            if (data.leaderboard && data.leaderboard.length > 0) {
                bodyEl.innerHTML = '';
                data.leaderboard.forEach((entry, i) => {
                    const row = document.createElement('tr');
                    if (entry.name === this.playerName) row.classList.add('current-player');
                    const medals = ['🥇', '🥈', '🥉'];
                    row.innerHTML = `
                        <td>${i < 3 ? medals[i] : (i + 1)}</td>
                        <td>${entry.name}</td>
                        <td>${entry.distance_statistics}m</td>
                        <td>${entry.score_statistics}</td>
                    `;
                    bodyEl.appendChild(row);
                });
                loadingDiv.style.display = 'none';
                tableEl.style.display = 'table';
            } else {
                loadingDiv.textContent = 'ยังไม่มีข้อมูล';
            }
        } catch (err) {
            loadingDiv.textContent = 'ไม่สามารถโหลดข้อมูลได้';
        }
    }

    closeScoreboard() {
        document.getElementById('scoreboardModal').style.display = 'none';
    }

    // ─── Leaderboard (Game Over) ─────────────────────────────
    async loadLeaderboard() {
        const loadingDiv = document.getElementById('leaderboardLoading');
        const tableEl = document.getElementById('leaderboardTable');
        const bodyEl = document.getElementById('leaderboardBody');

        loadingDiv.style.display = 'block';
        loadingDiv.textContent = 'กำลังโหลด...';
        tableEl.style.display = 'none';

        try {
            const res = await fetch(`${API_BASE_URL}/api/leaderboard`);
            const data = await res.json();

            if (data.leaderboard && data.leaderboard.length > 0) {
                bodyEl.innerHTML = '';
                data.leaderboard.forEach((entry, i) => {
                    const row = document.createElement('tr');
                    if (entry.name === this.playerName) row.classList.add('current-player');
                    const medals = ['🥇', '🥈', '🥉'];
                    row.innerHTML = `
                        <td>${i < 3 ? medals[i] : (i + 1)}</td>
                        <td>${entry.name}</td>
                        <td>${entry.distance_statistics}m</td>
                        <td>${entry.score_statistics}</td>
                    `;
                    bodyEl.appendChild(row);
                });
                loadingDiv.style.display = 'none';
                tableEl.style.display = 'table';
            } else {
                loadingDiv.textContent = 'ยังไม่มีข้อมูล';
            }
        } catch (err) {
            loadingDiv.textContent = 'ไม่สามารถโหลดข้อมูลได้';
        }
    }

    // ─── Save Score to DB ────────────────────────────────────
    async saveScore() {
        try {
            await fetch(`${API_BASE_URL}/api/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: this.playerName,
                    coin: this.coins,
                    distance: this.car.maxDistance,
                    score: this.score
                })
            });
        } catch (err) {
            console.error('Failed to save score:', err);
        }
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

        // Buttons
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());
        document.getElementById('mainMenuBtn').addEventListener('click', () => this.goToMenu());

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

    goToMenu() {
        this.state = 'menu';
        document.getElementById('gameOverScreen').style.display = 'none';
        document.getElementById('gameUI').style.display = 'none';
        document.getElementById('controls').style.display = 'none';
        document.getElementById('menuScreen').style.display = 'flex';
        document.getElementById('menuHighScore').textContent = this.highScore;
    }

    startGame() {
        this.audio.init();

        // Create terrain and car with selected level/skin
        this.terrain = new Terrain(this.selectedLevel);
        this.car = new Car(100, 380, this.selectedSkin, this.selectedLevel);
        this.renderer = new Renderer(this.canvas, this.selectedLevel);

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

    async gameOver() {
        this.state = 'gameover';
        this.audio.playCrashSound();
        this.audio.stopEngine();

        this.score = this.car.distance + this.coins * 50;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('hcr_highScore', this.highScore);
        }
        if (this.car.maxDistance > this.highDistance) {
            this.highDistance = this.car.maxDistance;
            localStorage.setItem('hcr_highDist', this.highDistance);
        }

        await this.saveScore();

        document.getElementById('gameUI').style.display = 'none';
        document.getElementById('controls').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'flex';
        document.getElementById('finalDistance').textContent = this.car.maxDistance + 'm';
        document.getElementById('finalCoins').textContent = this.coins;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('bestDistance').textContent = this.highDistance + 'm';
        document.getElementById('bestScore').textContent = this.highScore;

        this.loadLeaderboard();
    }

    update() {
        if (this.state !== 'playing') return;

        const gas = this.keys['ArrowUp'] || this.keys['w'] || this.keys['W'] || this.touchGas;
        const brake = this.keys['ArrowDown'] || this.keys['s'] || this.keys['S'] || this.touchBrake;

        const gasKey = document.getElementById('key-gas');
        const brakeKey = document.getElementById('key-brake');
        if (gasKey) gasKey.classList.toggle('active', !!gas);
        if (brakeKey) brakeKey.classList.toggle('active', !!brake);

        this.car.throttle = gas ? 1 : 0;
        this.car.brake = brake ? 1 : 0;

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

        this.camera.follow(this.car);
        this.audio.updateEngine(this.car.rpm, this.car.throttle);

        this.popups = this.popups.filter(p => {
            p.y -= 1;
            p.life--;
            return p.life > 0;
        });

        this.updateUI();

        if (this.car.crashed) {
            this.gameOver();
        }
    }

    updateUI() {
        const fuelFill = document.getElementById('fuelFill');
        const fuelPercent = (this.car.fuel / this.car.maxFuel) * 100;
        fuelFill.style.width = fuelPercent + '%';

        if (fuelPercent > 50) {
            fuelFill.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
        } else if (fuelPercent > 25) {
            fuelFill.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
        } else {
            fuelFill.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
            fuelFill.style.animation = 'pulse 0.5s infinite';
        }

        if (fuelPercent > 25) {
            fuelFill.style.animation = 'none';
        }

        document.getElementById('distance').textContent = this.car.distance + 'm';
        document.getElementById('coinCount').textContent = this.coins;
    }

    render() {
        const ctx = this.ctx;

        this.renderer.drawBackground(this.camera);

        if (this.state === 'playing' || this.state === 'gameover') {
            this.terrain.render(ctx, this.camera);
            this.car.render(ctx, this.camera);

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
