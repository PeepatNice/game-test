// terrain.js — Procedural Terrain Generation
class Terrain {
    constructor() {
        this.points = [];
        this.segmentWidth = 15;
        this.generatedUpTo = 0;
        this.minX = 0;
        this.coins = [];
        this.fuelCans = [];
        this.generate(0, 3000);
    }

    generate(fromX, toX) {
        const startIndex = this.points.length;
        for (let x = this.generatedUpTo; x <= toX; x += this.segmentWidth) {
            const y = this.getHeight(x);
            this.points.push({ x, y });

            // Spawn coins randomly on terrain
            if (Math.random() < 0.04 && x > 200) {
                this.coins.push({
                    x: x,
                    y: y - 40 - Math.random() * 30,
                    collected: false,
                    radius: 12,
                    angle: 0
                });
            }

            // Spawn fuel cans
            if (Math.random() < 0.012 && x > 400) {
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
        // Flat starting area
        if (x < 150) return 400;
        
        // Smooth transition from flat to hills
        const t = Math.min(1, (x - 150) / 200);

        // Multiple sine waves for natural terrain
        let h = 400;
        h += Math.sin(x * 0.005) * 80 * t;
        h += Math.sin(x * 0.012 + 1.3) * 50 * t;
        h += Math.sin(x * 0.025 + 2.7) * 30 * t;
        h += Math.sin(x * 0.003 + 0.5) * 100 * t;

        // Gradual difficulty — steeper hills as you go further
        const difficultyFactor = Math.min(2.5, 1 + x * 0.00015);
        h += Math.sin(x * 0.008 + 4.1) * 60 * difficultyFactor * t;
        h += Math.sin(x * 0.018 + 3.3) * 25 * difficultyFactor * t;

        return h;
    }

    getSurfaceAt(x) {
        // Find the segment containing x
        const index = Math.floor((x - this.points[0]?.x || 0) / this.segmentWidth);
        if (index < 0 || index >= this.points.length - 1) {
            return { y: 400, normal: { x: 0, y: -1 } };
        }

        const p1 = this.points[index];
        const p2 = this.points[index + 1];
        const t = (x - p1.x) / (p2.x - p1.x);
        const y = p1.y + (p2.y - p1.y) * t;

        // Calculate surface normal
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const normal = { x: -dy / len, y: dx / len };

        // Ensure normal points upward
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

        // Close the terrain shape
        const canvasH = ctx.canvas.height;
        ctx.lineTo(endX - camera.x + ctx.canvas.width / 2, canvasH + 100);
        ctx.lineTo(startX - camera.x + ctx.canvas.width / 2, canvasH + 100);
        ctx.closePath();

        // Terrain gradient
        const grd = ctx.createLinearGradient(0, 300, 0, canvasH);
        grd.addColorStop(0, '#4a7c3f');
        grd.addColorStop(0.3, '#3d6b35');
        grd.addColorStop(0.7, '#5c3d2e');
        grd.addColorStop(1, '#3e2a1f');
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
        ctx.strokeStyle = '#6abf5e';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw grass details on surface
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
                ctx.strokeStyle = '#7dd97a';
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

            // Coin glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffd700';

            // Coin body
            ctx.beginPath();
            ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.fill();
            ctx.strokeStyle = '#daa520';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Dollar sign
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

            // Fuel can body
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-fuel.width / 2, -fuel.height / 2, fuel.width, fuel.height);
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 2;
            ctx.strokeRect(-fuel.width / 2, -fuel.height / 2, fuel.width, fuel.height);

            // Fuel label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('F', 0, 0);

            // Fuel cap
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(-4, -fuel.height / 2 - 5, 8, 7);

            ctx.restore();
        });
    }
}
