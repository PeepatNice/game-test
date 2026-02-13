// car.js — Car Physics with Suspension & Skins
const CAR_SKINS = {
    red: { name: '🔴 แดงคลาสสิก', body: '#e74c3c', accent: '#c0392b', hub: '#e74c3c', window: '#85c1e9', headlight: '#f9e74a' },
    blue: { name: '🔵 น้ำเงินเย็น', body: '#3498db', accent: '#2980b9', hub: '#3498db', window: '#a8d8ea', headlight: '#f9e74a' },
    yellow: { name: '🟡 เหลืองซิ่ง', body: '#f1c40f', accent: '#d4ac0d', hub: '#f39c12', window: '#aed6f1', headlight: '#ffffff' },
    green: { name: '🟢 เขียวทหาร', body: '#27ae60', accent: '#1e8449', hub: '#27ae60', window: '#a9dfbf', headlight: '#f9e74a' },
};

const LEVEL_PHYSICS = {
    grassland: { friction: 1.0, fuelMod: 1.0, label: '🌿 ทุ่งหญ้า' },
    desert: { friction: 0.9, fuelMod: 1.3, label: '🏜️ ทะเลทราย' },
    snow: { friction: 0.65, fuelMod: 1.1, label: '❄️ หิมะ' },
};

class Car {
    constructor(x, y, skinId = 'red', levelId = 'grassland') {
        // Body
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.angularVel = 0;
        this.width = 80;
        this.height = 30;
        this.mass = 1.5;

        // Skin
        this.skin = CAR_SKINS[skinId] || CAR_SKINS.red;

        // Level physics
        const lp = LEVEL_PHYSICS[levelId] || LEVEL_PHYSICS.grassland;
        this.frictionMod = lp.friction;
        this.fuelMod = lp.fuelMod;

        // Wheels
        this.wheelBase = 60;
        this.wheelRadius = 12;
        this.frontWheel = { x: 0, y: 0, vy: 0, grounded: false, suspLen: 20, angle: 0 };
        this.rearWheel = { x: 0, y: 0, vy: 0, grounded: false, suspLen: 20, angle: 0 };

        // Suspension parameters
        this.suspRest = 20;
        this.suspStiffness = 0.3;
        this.suspDamping = 0.3;

        // Engine
        this.enginePower = 1.5;
        this.brakePower = 0.2;
        this.maxSpeed = 16;
        this.throttle = 0;
        this.brake = 0;

        // Fuel
        this.fuel = 100;
        this.maxFuel = 100;
        this.fuelConsumption = 0.03 * this.fuelMod;

        // State
        this.crashed = false;
        this.flipTime = 0;
        this.distance = 0;
        this.maxDistance = 0;
        this.rpm = 0;

        // Particles
        this.particles = [];
    }

    update(terrain, dt) {
        if (this.crashed) return;

        const gravity = 0.35;
        const airResistance = 0.998;
        const angularDamping = 0.96;

        // Apply gravity
        this.vy += gravity;

        // Wheel positions in world space
        const cosA = Math.cos(this.angle);
        const sinA = Math.sin(this.angle);

        const rearWX = this.x - cosA * this.wheelBase / 2;
        const rearWY = this.y - sinA * this.wheelBase / 2;
        const frontWX = this.x + cosA * this.wheelBase / 2;
        const frontWY = this.y + sinA * this.wheelBase / 2;

        // Get terrain surface at each wheel
        const rearSurface = terrain.getSurfaceAt(rearWX);
        const frontSurface = terrain.getSurfaceAt(frontWX);

        // Suspension physics for each wheel
        let rearForce = 0;
        let frontForce = 0;

        // Rear wheel
        const rearGroundY = rearSurface.y;
        const rearWheelBottom = rearWY + this.suspRest + this.wheelRadius;
        this.rearWheel.grounded = rearWheelBottom >= rearGroundY;

        if (this.rearWheel.grounded) {
            const compression = rearWheelBottom - rearGroundY;
            rearForce = compression * this.suspStiffness + this.vy * this.suspDamping;
            rearForce = Math.max(0, rearForce);
        }

        // Front wheel  
        const frontGroundY = frontSurface.y;
        const frontWheelBottom = frontWY + this.suspRest + this.wheelRadius;
        this.frontWheel.grounded = frontWheelBottom >= frontGroundY;

        if (this.frontWheel.grounded) {
            const compression = frontWheelBottom - frontGroundY;
            frontForce = compression * this.suspStiffness + this.vy * this.suspDamping;
            frontForce = Math.max(0, frontForce);
        }

        // Apply suspension forces
        const totalForce = rearForce + frontForce;
        this.vy -= totalForce;

        // Angular force from uneven terrain
        const torque = (frontForce - rearForce) * 0.015;
        this.angularVel += torque;

        // Try to align with terrain when grounded
        if (this.rearWheel.grounded && this.frontWheel.grounded) {
            const targetAngle = Math.atan2(frontGroundY - rearGroundY, this.wheelBase);
            const angleDiff = targetAngle - this.angle;
            this.angularVel += angleDiff * 0.08;
        }

        // Engine force (Forward) — apply friction modifier from level
        if (this.throttle > 0 && this.fuel > 0) {
            const grounded = this.rearWheel.grounded || this.frontWheel.grounded;
            if (grounded) {
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                const movingForward = (this.vx * cosA + this.vy * sinA) > -1;

                if (movingForward) {
                    const speedFactor = Math.max(0, 1 - speed / this.maxSpeed);
                    const power = this.enginePower * this.throttle * speedFactor * this.frictionMod;
                    this.vx += cosA * power;
                    this.vy += sinA * power * 0.5;

                    // Dust particles when accelerating
                    if (Math.random() < 0.3) {
                        this.particles.push({
                            x: rearWX,
                            y: rearGroundY - 5,
                            vx: -this.vx * 0.3 + (Math.random() - 0.5) * 2,
                            vy: -Math.random() * 2 - 1,
                            life: 30,
                            maxLife: 30,
                            size: 3 + Math.random() * 4,
                            color: 'rgba(139, 119, 101, 0.4)'
                        });
                    }
                }
            }
            this.fuel -= this.fuelConsumption * this.throttle;
            this.rpm = Math.min(1, this.rpm + 0.05);
        } else if (this.brake > 0 && this.fuel > 0) {
            const forwardVel = this.vx * cosA + this.vy * sinA;
            const grounded = this.rearWheel.grounded || this.frontWheel.grounded;

            if (grounded) {
                if (forwardVel > 0.5) {
                    this.vx *= (1 - this.brakePower * this.brake * this.frictionMod);
                    this.rpm = Math.max(0.1, this.rpm - 0.05);
                } else {
                    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                    const speedFactor = Math.max(0, 1 - speed / (this.maxSpeed * 0.5));

                    const power = this.enginePower * this.brake * 0.6 * speedFactor * this.frictionMod;
                    this.vx -= cosA * power;
                    this.vy -= sinA * power * 0.5;
                    this.rpm = Math.min(0.8, this.rpm + 0.03);
                    this.fuel -= this.fuelConsumption * 0.5 * this.brake;
                }
            }
        } else {
            this.rpm = Math.max(0.1, this.rpm - 0.02);
        }

        // Prevent sinking into terrain
        const bodySurface = terrain.getSurfaceAt(this.x);
        const bodyBottom = this.y + this.height / 2 + 5;
        if (bodyBottom > bodySurface.y) {
            this.y = bodySurface.y - this.height / 2 - 5;
            if (this.vy > 0) this.vy *= -0.1;
            this.vx *= 0.9;
        }

        // Apply velocity
        this.vx *= airResistance;
        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.angularVel;
        this.angularVel *= angularDamping;

        // Update wheel visual positions
        this.rearWheel.x = rearWX;
        this.rearWheel.y = Math.min(rearWY + this.suspRest, rearGroundY - this.wheelRadius);
        this.frontWheel.x = frontWX;
        this.frontWheel.y = Math.min(frontWY + this.suspRest, frontGroundY - this.wheelRadius);

        // Spin wheels based on speed
        const wheelSpin = this.vx * 0.08;
        this.rearWheel.angle += wheelSpin;
        this.frontWheel.angle += wheelSpin;

        // Track distance
        this.distance = Math.max(0, Math.floor((this.x - 100) / 10));
        this.maxDistance = Math.max(this.maxDistance, this.distance);

        // Flip detection
        const absAngle = Math.abs(this.angle % (Math.PI * 2));
        if (absAngle > Math.PI * 0.6 && absAngle < Math.PI * 1.4) {
            this.flipTime += dt;
            if (this.flipTime > 1.5) {
                this.crashed = true;
            }
        } else {
            this.flipTime = Math.max(0, this.flipTime - dt * 2);
        }

        // Fuel empty check  
        if (this.fuel <= 0) {
            this.fuel = 0;
            if (Math.abs(this.vx) < 0.1) {
                this.crashed = true;
            }
        }

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.life--;
            return p.life > 0;
        });

        // Check coin collection
        terrain.coins.forEach(coin => {
            if (coin.collected) return;
            const dx = this.x - coin.x;
            const dy = this.y - coin.y;
            if (Math.sqrt(dx * dx + dy * dy) < 50) {
                coin.collected = true;
                coin._justCollected = true;
            }
        });

        // Check fuel can collection
        terrain.fuelCans.forEach(fuelCan => {
            if (fuelCan.collected) return;
            const dx = this.x - fuelCan.x;
            const dy = this.y - fuelCan.y;
            if (Math.sqrt(dx * dx + dy * dy) < 45) {
                fuelCan.collected = true;
                fuelCan._justCollected = true;
                this.fuel = Math.min(this.maxFuel, this.fuel + 30);
            }
        });

        terrain.ensureGenerated(this.x);
    }

    render(ctx, camera) {
        const cx = ctx.canvas.width / 2;
        const cy = ctx.canvas.height / 2;

        // Draw particles
        this.particles.forEach(p => {
            const sx = p.x - camera.x + cx;
            const sy = p.y - camera.y + cy;
            const alpha = p.life / p.maxLife;
            ctx.beginPath();
            ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2);
            ctx.fillStyle = p.color + alpha * 0.6 + ')';
            ctx.fill();
        });

        const sx = this.x - camera.x + cx;
        const sy = this.y - camera.y + cy;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.angle);

        // --- Car Body ---
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, this.height / 2 + 15, this.width / 2 + 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body base — uses skin color
        ctx.fillStyle = this.skin.body;
        this.roundRect(ctx, -this.width / 2, -this.height / 2, this.width, this.height, 6);
        ctx.fill();

        // Body highlight
        const bodyGrad = ctx.createLinearGradient(0, -this.height / 2, 0, this.height / 2);
        bodyGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
        bodyGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
        bodyGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = bodyGrad;
        this.roundRect(ctx, -this.width / 2, -this.height / 2, this.width, this.height, 6);
        ctx.fill();

        // Cabin/window — uses skin window color
        ctx.fillStyle = this.skin.window;
        ctx.beginPath();
        ctx.moveTo(-5, -this.height / 2);
        ctx.lineTo(15, -this.height / 2 - 16);
        ctx.lineTo(28, -this.height / 2 - 16);
        ctx.lineTo(32, -this.height / 2);
        ctx.closePath();
        ctx.fill();

        // Window shine
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(-2, -this.height / 2);
        ctx.lineTo(10, -this.height / 2 - 12);
        ctx.lineTo(15, -this.height / 2 - 12);
        ctx.lineTo(8, -this.height / 2);
        ctx.closePath();
        ctx.fill();

        // Headlight — uses skin headlight color
        ctx.fillStyle = this.skin.headlight;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.skin.headlight;
        ctx.beginPath();
        ctx.ellipse(this.width / 2 - 3, 2, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Tail light
        ctx.fillStyle = '#ff4444';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ff4444';
        ctx.beginPath();
        ctx.ellipse(-this.width / 2 + 3, 2, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Bumper
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(this.width / 2 - 2, -4, 4, 12);
        ctx.fillRect(-this.width / 2 - 2, -3, 4, 10);

        ctx.restore();

        // --- Wheels ---
        this.renderWheel(ctx, camera, this.rearWheel);
        this.renderWheel(ctx, camera, this.frontWheel);

        // --- Suspension lines ---
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.angle);
        ctx.restore();
    }

    renderWheel(ctx, camera, wheel) {
        const cx = ctx.canvas.width / 2;
        const cy = ctx.canvas.height / 2;
        const wx = wheel.x - camera.x + cx;
        const wy = wheel.y - camera.y + cy;

        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(wheel.angle);

        // Tire
        ctx.beginPath();
        ctx.arc(0, 0, this.wheelRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#2c3e50';
        ctx.fill();
        ctx.strokeStyle = '#1a252f';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rim
        ctx.beginPath();
        ctx.arc(0, 0, this.wheelRadius * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = '#95a5a6';
        ctx.fill();

        // Rim spokes
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * this.wheelRadius * 0.5, Math.sin(a) * this.wheelRadius * 0.5);
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Hub — uses skin hub color
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = this.skin.hub;
        ctx.fill();

        ctx.restore();
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}
