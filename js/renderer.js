// renderer.js — Background & Environment Rendering
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
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

        // Generate stars for night sky feel
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

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        skyGrad.addColorStop(0, '#1a1a2e');
        skyGrad.addColorStop(0.3, '#16213e');
        skyGrad.addColorStop(0.6, '#0f3460');
        skyGrad.addColorStop(0.85, '#e94560');
        skyGrad.addColorStop(1, '#f5a623');
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

        // Far mountains (slow parallax)
        this.drawMountainLayer(ctx, camera, 0.05, h * 0.45, '#1a1a3e', 0.6, 200, 80);
        // Mid mountains
        this.drawMountainLayer(ctx, camera, 0.1, h * 0.55, '#16213e', 0.7, 150, 100);
        // Near mountains
        this.drawMountainLayer(ctx, camera, 0.2, h * 0.65, '#0f2847', 0.8, 120, 120);

        // Clouds
        this.clouds.forEach(cloud => {
            const sx = ((cloud.x - camera.x * 0.03) % (w + 200) + w + 200) % (w + 200) - 100;
            cloud.x += cloud.speed;

            ctx.save();
            ctx.globalAlpha = cloud.opacity;
            ctx.fillStyle = '#ffffff';

            // Cloud shape with multiple circles
            const cx = sx;
            const cy = cloud.y;
            ctx.beginPath();
            ctx.ellipse(cx, cy, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx - cloud.width * 0.25, cy + 5, cloud.width * 0.3, cloud.height * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + cloud.width * 0.25, cy + 3, cloud.width * 0.35, cloud.height * 0.45, 0, 0, Math.PI * 2);
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
