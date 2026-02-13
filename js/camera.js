// camera.js — Smooth Follow Camera
class Camera {
    constructor(canvas) {
        this.x = 0;
        this.y = 0;
        this.width = canvas.width;
        this.height = canvas.height;
        this.targetX = 0;
        this.targetY = 0;
        this.lerpSpeed = 0.08;
        this.lookAhead = 150;
        this.lookUp = 80;
    }

    follow(car) {
        // Look ahead in direction of travel
        this.targetX = car.x + car.vx * this.lookAhead / 5 + this.lookAhead * 0.3;
        this.targetY = car.y - this.lookUp;

        // Smooth interpolation
        this.x += (this.targetX - this.x) * this.lerpSpeed;
        this.y += (this.targetY - this.y) * this.lerpSpeed;
    }

    resize(canvas) {
        this.width = canvas.width;
        this.height = canvas.height;
    }
}
