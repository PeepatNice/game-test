// terrain.js — Procedural Terrain Generation with Level Themes
const LEVEL_THEMES = {
    grassland: {
        terrainGradient: [
            { stop: 0, color: '#4a7c3f' },
            { stop: 0.3, color: '#3d6b35' },
            { stop: 0.7, color: '#5c3d2e' },
            { stop: 1, color: '#3e2a1f' },
        ],
        surfaceLine: '#6abf5e',
        grassColor: '#7dd97a',
        difficultyScale: 1.0,
        coinRate: 0.04,
        fuelRate: 0.012,
    },
    desert: {
        terrainGradient: [
            { stop: 0, color: '#d4a853' },
            { stop: 0.3, color: '#c49340' },
            { stop: 0.7, color: '#a07030' },
            { stop: 1, color: '#6e4b26' },
        ],
        surfaceLine: '#e8c96a',
        grassColor: '#c4a44a',
        difficultyScale: 1.4,
        coinRate: 0.035,
        fuelRate: 0.008,
    },
    snow: {
        terrainGradient: [
            { stop: 0, color: '#e8edf2' },
            { stop: 0.3, color: '#ccd5de' },
            { stop: 0.7, color: '#8fa5b8' },
            { stop: 1, color: '#5a7a95' },
        ],
        surfaceLine: '#f0f4f8',
        grassColor: '#d0dce8',
        difficultyScale: 1.1,
        coinRate: 0.04,
        fuelRate: 0.01,
    },
};

class Terrain {
    constructor(levelId = 'grassland') {
        this.levelId = levelId;
        this.theme = LEVEL_THEMES[levelId] || LEVEL_THEMES.grassland;
        this.points = [];
        this.segmentWidth = 15;
        this.generatedUpTo = 0;
        this.minX = 0;
        this.coins = [];
        this.fuelCans = [];
        this.generate(0, 3000);
    }

    generate(fromX, toX) {
        for (let x = this.generatedUpTo; x <= toX; x += this.segmentWidth) {
            const y = this.getHeight(x);
            this.points.push({ x, y });

            // Spawn coins
            if (Math.random() < this.theme.coinRate && x > 200) {
                this.coins.push({
                    x: x,
                    y: y - 40 - Math.random() * 30,
                    collected: false,
                    radius: 12,
                    angle: 0
                });
            }

            // Spawn fuel cans
            if (Math.random() < this.theme.fuelRate && x > 400) {
                this.fuelCans.push({
                    x: x,
                    y: y - 35,
                    collected: false,
                    width: 20,
                    height: 25
                });
            }
        }
        this.generatedUpTo = toX;
    }

    getHeight(x) {
        if (x < 150) return 400;

        const t = Math.min(1, (x - 150) / 200);
        const ds = this.theme.difficultyScale;

        let h = 400;
        h += Math.sin(x * 0.005) * 80 * t;
        h += Math.sin(x * 0.012 + 1.3) * 50 * t;
        h += Math.sin(x * 0.025 + 2.7) * 30 * t * ds;
        h += Math.sin(x * 0.003 + 0.5) * 100 * t;

        const difficultyFactor = Math.min(2.5, 1 + x * 0.00015) * ds;
        h += Math.sin(x * 0.008 + 4.1) * 60 * difficultyFactor * t;
        h += Math.sin(x * 0.018 + 3.3) * 25 * difficultyFactor * t;

        return h;
    }

    getSurfaceAt(x) {
        const index = Math.floor((x - this.points[0]?.x || 0) / this.segmentWidth);
        if (index < 0 || index >= this.points.length - 1) {
            return { y: 400, normal: { x: 0, y: -1 } };
        }

        const p1 = this.points[index];
        const p2 = this.points[index + 1];
        const t = (x - p1.x) / (p2.x - p1.x);
        const y = p1.y + (p2.y - p1.y) * t;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const normal = { x: -dy / len, y: dx / len };

        if (normal.y > 0) {
            normal.x = -normal.x;
            normal.y = -normal.y;
        }

        return { y, normal, slope: dy / dx };
    }

    ensureGenerated(x) {
        if (x + 1500 > this.generatedUpTo) {
            this.generate(this.generatedUpTo, this.generatedUpTo + 3000);
        }
    }

    render(ctx, camera) {
        const startX = camera.x - camera.width / 2 - 50;
        const endX = camera.x + camera.width / 2 + 50;

        // Draw terrain fill
        ctx.beginPath();
        let started = false;

        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            if (p.x < startX - 50) continue;
            if (p.x > endX + 50) break;

            const screenX = p.x - camera.x + ctx.canvas.width / 2;
            const screenY = p.y - camera.y + ctx.canvas.height / 2;

            if (!started) {
                ctx.moveTo(screenX, screenY);
                started = true;
            } else {
                ctx.lineTo(screenX, screenY);
            }
        }

        const canvasH = ctx.canvas.height;
        ctx.lineTo(endX - camera.x + ctx.canvas.width / 2, canvasH + 100);
        ctx.lineTo(startX - camera.x + ctx.canvas.width / 2, canvasH + 100);
        ctx.closePath();

        // Terrain gradient — uses level theme
        const grd = ctx.createLinearGradient(0, 300, 0, canvasH);
        this.theme.terrainGradient.forEach(g => grd.addColorStop(g.stop, g.color));
        ctx.fillStyle = grd;
        ctx.fill();

        // Terrain surface line
        ctx.beginPath();
        started = false;
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            if (p.x < startX - 50) continue;
            if (p.x > endX + 50) break;
            const screenX = p.x - camera.x + ctx.canvas.width / 2;
            const screenY = p.y - camera.y + ctx.canvas.height / 2;
            if (!started) {
                ctx.moveTo(screenX, screenY);
                started = true;
            } else {
                ctx.lineTo(screenX, screenY);
            }
        }
        ctx.strokeStyle = this.theme.surfaceLine;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw grass/surface details
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            if (p.x < startX) continue;
            if (p.x > endX) break;
            const screenX = p.x - camera.x + ctx.canvas.width / 2;
            const screenY = p.y - camera.y + ctx.canvas.height / 2;

            if (i % 2 === 0) {
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX - 3, screenY - 8);
                ctx.lineTo(screenX + 3, screenY - 6);
                ctx.strokeStyle = this.theme.grassColor;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Draw coins
        this.coins.forEach(coin => {
            if (coin.collected) return;
            const sx = coin.x - camera.x + ctx.canvas.width / 2;
            const sy = coin.y - camera.y + ctx.canvas.height / 2;
            if (sx < -30 || sx > ctx.canvas.width + 30) return;

            coin.angle += 0.05;
            const scaleX = Math.abs(Math.cos(coin.angle));

            ctx.save();
            ctx.translate(sx, sy);
            ctx.scale(scaleX, 1);

            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffd700';

            ctx.beginPath();
            ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.fill();
            ctx.strokeStyle = '#daa520';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#b8860b';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 0);

            ctx.restore();
        });

        // Draw fuel cans
        this.fuelCans.forEach(fuel => {
            if (fuel.collected) return;
            const sx = fuel.x - camera.x + ctx.canvas.width / 2;
            const sy = fuel.y - camera.y + ctx.canvas.height / 2;
            if (sx < -30 || sx > ctx.canvas.width + 30) return;

            ctx.save();
            ctx.translate(sx, sy);

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-fuel.width / 2, -fuel.height / 2, fuel.width, fuel.height);
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 2;
            ctx.strokeRect(-fuel.width / 2, -fuel.height / 2, fuel.width, fuel.height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('F', 0, 0);

            ctx.fillStyle = '#c0392b';
            ctx.fillRect(-4, -fuel.height / 2 - 5, 8, 7);

            ctx.restore();
        });
    }
}
