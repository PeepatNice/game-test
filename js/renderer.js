// renderer.js — Background & Environment Rendering with Level Themes
const SKY_THEMES = {
    grassland: {
        sky: [
            { stop: 0, color: '#1a1a2e' },
            { stop: 0.3, color: '#16213e' },
            { stop: 0.6, color: '#0f3460' },
            { stop: 0.85, color: '#e94560' },
            { stop: 1, color: '#f5a623' },
        ],
        mountains: [
            { parallax: 0.05, baseY: 0.45, color: '#1a1a3e', opacity: 0.6 },
            { parallax: 0.1, baseY: 0.55, color: '#16213e', opacity: 0.7 },
            { parallax: 0.2, baseY: 0.65, color: '#0f2847', opacity: 0.8 },
        ],
        cloudColor: '#ffffff',
    },
    desert: {
        sky: [
            { stop: 0, color: '#1a0f00' },
            { stop: 0.2, color: '#4a2800' },
            { stop: 0.5, color: '#b86e2a' },
            { stop: 0.75, color: '#e8a044' },
            { stop: 1, color: '#ffd280' },
        ],
        mountains: [
            { parallax: 0.05, baseY: 0.50, color: '#5a3010', opacity: 0.5 },
            { parallax: 0.1, baseY: 0.58, color: '#7a4820', opacity: 0.6 },
            { parallax: 0.2, baseY: 0.68, color: '#9a6030', opacity: 0.7 },
        ],
        cloudColor: '#f5e1c0',
    },
    snow: {
        sky: [
            { stop: 0, color: '#0d1b2a' },
            { stop: 0.3, color: '#1b2838' },
            { stop: 0.55, color: '#3a5f7c' },
            { stop: 0.8, color: '#7ba3c4' },
            { stop: 1, color: '#b8d4e8' },
        ],
        mountains: [
            { parallax: 0.05, baseY: 0.42, color: '#1b2838', opacity: 0.6 },
            { parallax: 0.1, baseY: 0.52, color: '#2a4058', opacity: 0.7 },
            { parallax: 0.2, baseY: 0.62, color: '#4a6a85', opacity: 0.8 },
        ],
        cloudColor: '#e0e8f0',
    },
};

class Renderer {
    constructor(canvas, levelId = 'grassland') {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.levelId = levelId;
        this.theme = SKY_THEMES[levelId] || SKY_THEMES.grassland;
        this.clouds = [];
        this.stars = [];

        // Generate clouds
        for (let i = 0; i < 15; i++) {
            this.clouds.push({
                x: Math.random() * 5000,
                y: 30 + Math.random() * 120,
                width: 60 + Math.random() * 100,
                height: 25 + Math.random() * 30,
                speed: 0.1 + Math.random() * 0.2,
                opacity: 0.3 + Math.random() * 0.4
            });
        }

        // Generate stars
        for (let i = 0; i < 30; i++) {
            this.stars.push({
                x: Math.random() * 2000,
                y: Math.random() * 150,
                size: 1 + Math.random() * 2,
                twinkle: Math.random() * Math.PI * 2
            });
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackground(camera) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Sky gradient — uses level theme
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        this.theme.sky.forEach(s => skyGrad.addColorStop(s.stop, s.color));
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Stars
        this.stars.forEach(star => {
            star.twinkle += 0.02;
            const alpha = 0.3 + Math.sin(star.twinkle) * 0.3;
            const sx = ((star.x - camera.x * 0.02) % w + w) % w;
            ctx.beginPath();
            ctx.arc(sx, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
        });

        // Mountains — uses level theme
        this.theme.mountains.forEach(m => {
            this.drawMountainLayer(ctx, camera, m.parallax, h * m.baseY, m.color, m.opacity, 200, 80 + Math.random());
        });

        // Clouds
        this.clouds.forEach(cloud => {
            const sx = ((cloud.x - camera.x * 0.03) % (w + 200) + w + 200) % (w + 200) - 100;
            cloud.x += cloud.speed;

            ctx.save();
            ctx.globalAlpha = cloud.opacity;
            ctx.fillStyle = this.theme.cloudColor;

            const ccx = sx;
            const ccy = cloud.y;
            ctx.beginPath();
            ctx.ellipse(ccx, ccy, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(ccx - cloud.width * 0.25, ccy + 5, cloud.width * 0.3, cloud.height * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(ccx + cloud.width * 0.25, ccy + 3, cloud.width * 0.35, cloud.height * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    }

    drawMountainLayer(ctx, camera, parallax, baseY, color, opacity, spacing, maxHeight) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const offset = camera.x * parallax;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h);

        for (let x = -spacing; x <= w + spacing; x += 5) {
            const worldX = x + offset;
            let mh = 0;
            mh += Math.sin(worldX * 0.005) * maxHeight * 0.5;
            mh += Math.sin(worldX * 0.01 + 1) * maxHeight * 0.3;
            mh += Math.sin(worldX * 0.02 + 2) * maxHeight * 0.2;
            ctx.lineTo(x, baseY - Math.abs(mh));
        }

        ctx.lineTo(w + spacing, h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
