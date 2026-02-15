const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gameState = {
    running: false,
    britishScore: 0,
    germanScore: 0,
    gameOver: false
};

const keys = {};

class Plane {
    constructor(x, y, team) {
        this.x = x;
        this.y = y;
        this.team = team;
        this.width = 60;
        this.height = 30;
        this.speed = 3;
        this.health = 100;
        this.bullets = [];
        this.lastShot = 0;
        this.shootCooldown = 300;
    }

    draw() {
        ctx.save();
        
        if (this.team === 'british') {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x, this.y + 10, 50, 8);
            ctx.fillStyle = '#006400';
            ctx.fillRect(this.x + 10, this.y, 40, 4);
            ctx.fillRect(this.x + 10, this.y + 26, 40, 4);
            ctx.fillStyle = '#4169E1';
            ctx.fillRect(this.x + 15, this.y + 12, 25, 6);
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(this.x + 50, this.y + 14, 8, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x + 10, this.y + 10, 50, 8);
            ctx.fillStyle = '#2F4F4F';
            ctx.fillRect(this.x + 10, this.y, 40, 4);
            ctx.fillRect(this.x + 10, this.y + 26, 40, 4);
            ctx.fillStyle = '#696969';
            ctx.fillRect(this.x + 20, this.y + 12, 25, 6);
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(this.x + 10, this.y + 14, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        
        this.drawHealthBar();
        ctx.restore();
    }

    drawHealthBar() {
        const barWidth = 50;
        const barHeight = 4;
        const barX = this.x + 5;
        const barY = this.y - 10;
        
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(barX, barY, (this.health / 100) * barWidth, barHeight);
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    shoot() {
        const now = Date.now();
        if (now - this.lastShot > this.shootCooldown) {
            const bulletX = this.team === 'british' ? this.x + 60 : this.x;
            const bulletY = this.y + 15;
            this.bullets.push(new Bullet(bulletX, bulletY, this.team));
            this.lastShot = now;
        }
    }

    update() {
        this.bullets.forEach((bullet, index) => {
            bullet.update();
            if (bullet.x < 0 || bullet.x > canvas.width) {
                this.bullets.splice(index, 1);
            }
        });
    }
}

class Bullet {
    constructor(x, y, team) {
        this.x = x;
        this.y = y;
        this.team = team;
        this.speed = 8;
        this.width = 8;
        this.height = 3;
    }

    draw() {
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(this.x, this.y + 1, this.width - 2, 1);
    }

    update() {
        if (this.team === 'british') {
            this.x += this.speed;
        } else {
            this.x -= this.speed;
        }
    }
}

class Cloud {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * (canvas.height * 0.6);
        this.width = 80 + Math.random() * 40;
        this.height = 40 + Math.random() * 20;
        this.speed = 0.3 + Math.random() * 0.5;
    }

    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.x += this.speed;
        if (this.x > canvas.width + this.width) {
            this.x = -this.width;
            this.y = Math.random() * (canvas.height * 0.6);
        }
    }
}

const britishPlane = new Plane(100, canvas.height / 2 - 15, 'british');
const germanPlanes = [];
const clouds = [];

for (let i = 0; i < 5; i++) {
    clouds.push(new Cloud());
}

function spawnGermanPlane() {
    const y = 50 + Math.random() * (canvas.height - 150);
    germanPlanes.push(new Plane(canvas.width - 150, y, 'german'));
}

function checkCollisions() {
    britishPlane.bullets.forEach((bullet, bIndex) => {
        germanPlanes.forEach((plane, pIndex) => {
            if (bullet.x > plane.x && bullet.x < plane.x + plane.width &&
                bullet.y > plane.y && bullet.y < plane.y + plane.height) {
                britishPlane.bullets.splice(bIndex, 1);
                plane.health -= 20;
                if (plane.health <= 0) {
                    germanPlanes.splice(pIndex, 1);
                    gameState.britishScore++;
                    updateScore();
                }
            }
        });
    });

    germanPlanes.forEach(plane => {
        plane.bullets.forEach((bullet, bIndex) => {
            if (bullet.x > britishPlane.x && bullet.x < britishPlane.x + britishPlane.width &&
                bullet.y > britishPlane.y && bullet.y < britishPlane.y + britishPlane.height) {
                plane.bullets.splice(bIndex, 1);
                britishPlane.health -= 10;
                if (britishPlane.health <= 0) {
                    gameOver('German');
                }
            }
        });

        if (britishPlane.x < plane.x + plane.width && britishPlane.x + britishPlane.width > plane.x &&
            britishPlane.y < plane.y + plane.height && britishPlane.y + britishPlane.height > plane.y) {
            gameOver('Collision');
        }
    });
}

function updateScore() {
    document.getElementById('british-score').textContent = gameState.britishScore;
    document.getElementById('german-score').textContent = gameState.germanScore;
}

function gameOver(reason) {
    gameState.gameOver = true;
    gameState.running = false;
    document.getElementById('game-status').textContent = 
        reason === 'German' ? '💥 You were shot down! Press R to restart' : 
        '💥 Collision! Press R to restart';
}

function resetGame() {
    britishPlane.x = 100;
    britishPlane.y = canvas.height / 2 - 15;
    britishPlane.health = 100;
    britishPlane.bullets = [];
    germanPlanes.length = 0;
    gameState.gameOver = false;
    gameState.running = true;
    document.getElementById('game-status').textContent = 'Good luck, pilot!';
}

function drawBackground() {
    clouds.forEach(cloud => {
        cloud.draw();
        cloud.update();
    });
}

function updateAI() {
    germanPlanes.forEach(plane => {
        if (plane.y < britishPlane.y - 5) {
            plane.y += plane.speed * 0.6;
        } else if (plane.y > britishPlane.y + 5) {
            plane.y -= plane.speed * 0.6;
        }

        plane.x -= plane.speed * 0.8;

        if (Math.random() < 0.02) {
            plane.shoot();
        }

        if (plane.x < -100) {
            const index = germanPlanes.indexOf(plane);
            germanPlanes.splice(index, 1);
            gameState.germanScore++;
            updateScore();
        }
    });
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBackground();

    if (gameState.running) {
        if (keys['w'] && britishPlane.y > 20) britishPlane.y -= britishPlane.speed;
        if (keys['s'] && britishPlane.y < canvas.height - britishPlane.height - 20) britishPlane.y += britishPlane.speed;
        if (keys['a'] && britishPlane.x > 10) britishPlane.x -= britishPlane.speed;
        if (keys['d'] && britishPlane.x < canvas.width / 2) britishPlane.x += britishPlane.speed;
        if (keys[' ']) britishPlane.shoot();

        britishPlane.update();
        updateAI();

        if (Math.random() < 0.01 && germanPlanes.length < 3) {
            spawnGermanPlane();
        }

        germanPlanes.forEach(plane => plane.update());
        checkCollisions();
    }

    britishPlane.draw();
    britishPlane.bullets.forEach(bullet => bullet.draw());
    
    germanPlanes.forEach(plane => {
        plane.draw();
        plane.bullets.forEach(bullet => bullet.draw());
    });

    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    if (!gameState.running && !gameState.gameOver) {
        gameState.running = true;
        document.getElementById('game-status').textContent = 'Good luck, pilot!';
        spawnGermanPlane();
    }
    
    if (e.key.toLowerCase() === 'r' && gameState.gameOver) {
        resetGame();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

gameLoop();
