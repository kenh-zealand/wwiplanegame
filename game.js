const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Constants
const TARGET_FPS = 60;
const FPS_SAMPLE_SIZE = 10;

const gameState = {
    running: false,
    britishScore: 0,
    germanScore: 0,
    gameOver: false,
    paused: false,
    wave: 0,
    enemiesInWave: 0,
    enemiesDefeated: 0,
    highScore: parseInt(localStorage.getItem('wwiHighScore')) || 0,
    showFPS: false,
    lastFrameTime: Date.now(),
    fps: TARGET_FPS,
    frameTimes: []
};

const keys = {};

// Load sprite sheets and atlas
const sopwithSprite = new Image();
const fokkerSprite = new Image();
let spritesReady = false;
let fokkerReady = false;

// Embed atlas data directly to avoid CORS issues
const sopwithAtlas = {
    "frame_width": 384,
    "frame_height": 341,
    "columns": 4,
    "rows": 3,
    "animations": {
        "fly": {
            "row": 0,
            "frames": [0, 1, 2, 3],
            "fps": 8,
            "loop": true
        },
        "shoot": {
            "row": 1,
            "frames": [0, 1, 2, 3],
            "fps": 12,
            "loop": true
        },
        "explode": {
            "row": 2,
            "frames": [0, 1, 2, 3],
            "fps": 10,
            "loop": false
        }
    }
};

const fokkerAtlas = {
    "frame_width": 384,
    "frame_height": 341,
    "columns": 4,
    "rows": 3,
    "animations": {
        "fly": {
            "row": 0,
            "frames": [0, 1, 2, 3],
            "fps": 8,
            "loop": true
        },
        "shoot": {
            "row": 1,
            "frames": [0, 1, 2, 3],
            "fps": 12,
            "loop": true
        },
        "explode": {
            "row": 2,
            "frames": [0, 1, 2, 3],
            "fps": 10,
            "loop": false
        }
    }
};

console.log('Loading sprite images...');

sopwithSprite.onload = () => {
    spritesReady = true;
    console.log('✓ Sopwith sprites loaded! Size:', sopwithSprite.width, 'x', sopwithSprite.height);
};

sopwithSprite.onerror = (err) => {
    console.error('✗ Sopwith sprite failed to load:', err);
};

fokkerSprite.onload = () => {
    fokkerReady = true;
    console.log('✓ Fokker sprites loaded! Size:', fokkerSprite.width, 'x', fokkerSprite.height);
};

fokkerSprite.onerror = (err) => {
    console.error('✗ Fokker sprite failed to load:', err);
};

sopwithSprite.src = 'assets/sprites/sopwith/sopwith-sprite.png';
fokkerSprite.src = 'assets/sprites/fokker/fokker-sprite.png';

class Plane {
    constructor(x, y, team) {
        this.x = x;
        this.y = y;
        this.team = team;
        // German planes slightly smaller
        if (team === 'german') {
            this.width = 140;
            this.height = 112;
        } else {
            this.width = 160;
            this.height = 128;
        }
        this.speed = 3;
        this.health = 100;
        this.maxHealth = 100;
        this.bullets = [];
        this.lastShot = 0;
        this.shootCooldown = 300;
        this.frame = 0;
        this.frameTimer = 0;
        this.animationState = 'fly';
        this.exploding = false;
        this.shield = false;
        this.shieldTime = 0;
        this.rapidFire = false;
        this.rapidFireTime = 0;
        this.damageFlash = 0;
    }

    draw() {
        ctx.save();
        
        // Draw shield effect
        if (this.shield && this.team === 'british') {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 
                    Math.max(this.width, this.height) / 2 + 10, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Damage flash effect
        if (this.damageFlash > 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.globalAlpha = 1.0;
            this.damageFlash--;
        }
        
        // Select sprite and atlas based on team
        const useSprite = this.team === 'british' ? (spritesReady && sopwithAtlas) : (fokkerReady && fokkerAtlas);
        const sprite = this.team === 'british' ? sopwithSprite : fokkerSprite;
        const atlas = this.team === 'british' ? sopwithAtlas : fokkerAtlas;
        
        if (useSprite) {
            const anim = atlas.animations[this.animationState];
            const frameWidth = atlas.frame_width;
            const frameHeight = atlas.frame_height;
            const fps = anim.fps;
            
            // Animate frames
            this.frameTimer++;
            const frameDelay = Math.floor(60 / fps);
            if (this.frameTimer > frameDelay) {
                this.frame = (this.frame + 1) % anim.frames.length;
                this.frameTimer = 0;
                
                // Handle explosion end
                if (this.animationState === 'explode' && !anim.loop && this.frame === 0) {
                    this.exploding = false;
                    this.animationState = 'fly';
                }
            }
            
            const frameIndex = anim.frames[this.frame];
            const sx = frameIndex * frameWidth;
            const sy = anim.row * frameHeight;
            
            // Team-specific adjustments
            let actualFrameHeight = frameHeight;
            let offsetY = 0;
            
            if (this.team === 'british') {
                // Sopwith adjustments
                actualFrameHeight = frameHeight - 80;
                if (this.animationState === 'shoot' || this.animationState === 'explode') {
                    offsetY = 45;
                }
                ctx.drawImage(sprite, sx, sy, frameWidth, actualFrameHeight, 
                             this.x, this.y + offsetY, this.width, this.height);
            } else {
                // Fokker - apply stronger adjustments
                actualFrameHeight = frameHeight - 100;
                if (this.animationState === 'shoot' || this.animationState === 'explode') {
                    offsetY = 56;
                }
                // Flip horizontally to face left
                ctx.translate(this.x + this.width, this.y + offsetY);
                ctx.scale(-1, 1);
                ctx.drawImage(sprite, sx, sy, frameWidth, actualFrameHeight, 
                             0, 0, this.width, this.height);
            }
        } else {
            // Fallback to simple shapes
            if (this.team === 'british') {
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(this.x, this.y + 15, 60, 10);
            } else {
                ctx.fillStyle = '#696969';
                ctx.fillRect(this.x + 10, this.y + 15, 60, 10);
            }
        }
        
        if (!this.exploding) {
            ctx.restore(); // Restore before drawing health bar
            this.drawHealthBar();
            
            // Draw smoke trail for damaged planes
            if (this.health < this.maxHealth * 0.4 && Math.random() < 0.3) {
                particles.push(new Particle(this.x + this.width / 2, 
                                           this.y + this.height / 2, 'smoke'));
            }
        } else {
            ctx.restore();
        }
    }

    drawHealthBar() {
        const barWidth = 50;
        const barHeight = 5;
        const barX = this.x + (this.width - barWidth) / 2;
        const barY = this.y - 12;
        
        // Background
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Health
        const healthPercent = this.health / this.maxHealth;
        let healthColor;
        if (healthPercent > 0.6) {
            healthColor = '#00FF00';
        } else if (healthPercent > 0.3) {
            healthColor = '#FFA500';
        } else {
            healthColor = '#FF0000';
        }
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, healthPercent * barWidth, barHeight);
        
        // Border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    shoot() {
        const now = Date.now();
        const cooldown = this.rapidFire ? this.shootCooldown / 2 : this.shootCooldown;
        if (now - this.lastShot > cooldown && !this.exploding) {
            const bulletX = this.team === 'british' ? this.x + 120 : this.x + 10;
            const bulletY = this.y + 70; // Adjusted for sprite offset
            this.bullets.push(new Bullet(bulletX, bulletY, this.team));
            this.lastShot = now;
            this.animationState = 'shoot';
            this.frame = 0; // Reset frame when switching animation
            
            // Add muzzle flash particles
            for (let i = 0; i < 5; i++) {
                particles.push(new Particle(bulletX, bulletY, 'muzzle'));
            }
            
            setTimeout(() => {
                if (!this.exploding) {
                    this.animationState = 'fly';
                    this.frame = 0;
                }
            }, 250);
        }
    }

    explode() {
        this.exploding = true;
        this.animationState = 'explode';
        this.frame = 0;
        
        // Create explosion particles
        for (let i = 0; i < 30; i++) {
            particles.push(new Particle(this.x + this.width / 2, 
                                       this.y + this.height / 2, 'explosion'));
        }
    }

    update() {
        // Update power-up timers
        if (this.shield && this.team === 'british') {
            this.shieldTime--;
            if (this.shieldTime <= 0) {
                this.shield = false;
            }
        }
        
        if (this.rapidFire && this.team === 'british') {
            this.rapidFireTime--;
            if (this.rapidFireTime <= 0) {
                this.rapidFire = false;
            }
        }
        
        this.bullets.forEach((bullet, index) => {
            bullet.update();
            if (bullet.x < 0 || bullet.x > canvas.width) {
                this.bullets.splice(index, 1);
            }
        });
    }
    
    applyPowerUp(type) {
        if (type === 'health') {
            this.health = Math.min(this.maxHealth, this.health + 50);
        } else if (type === 'rapidfire') {
            this.rapidFire = true;
            this.rapidFireTime = TARGET_FPS * 5; // 5 seconds
        } else if (type === 'shield') {
            this.shield = true;
            this.shieldTime = TARGET_FPS * 10; // 10 seconds
        }
    }
    
    takeDamage(amount) {
        if (this.shield) {
            return; // Shield blocks damage
        }
        this.health -= amount;
        this.damageFlash = 5;
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
        this.depth = Math.random(); // For parallax effect
    }

    draw() {
        const opacity = 0.5 + this.depth * 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.x += this.speed * (0.5 + this.depth * 0.5);
        if (this.x > canvas.width + this.width) {
            this.x = -this.width;
            this.y = Math.random() * (canvas.height * 0.6);
        }
    }
}

// Particle system for explosions and effects
class Particle {
    constructor(x, y, type = 'explosion') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 1.0;
        
        if (type === 'explosion') {
            this.vx = (Math.random() - 0.5) * 6;
            this.vy = (Math.random() - 0.5) * 6;
            this.size = 3 + Math.random() * 4;
            this.decay = 0.02 + Math.random() * 0.02;
            this.color = Math.random() > 0.5 ? '#FF4500' : '#FFA500';
        } else if (type === 'smoke') {
            this.vx = (Math.random() - 0.5) * 1;
            this.vy = -1 - Math.random() * 2;
            this.size = 5 + Math.random() * 5;
            this.decay = 0.01;
            this.color = '#555555';
        } else if (type === 'muzzle') {
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = (Math.random() - 0.5) * 2;
            this.size = 2 + Math.random() * 3;
            this.decay = 0.08;
            this.color = '#FFFF00';
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vy += 0.1; // Gravity
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// Power-up system
class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.speed = 2;
        const types = ['health', 'rapidfire', 'shield'];
        this.type = types[Math.floor(Math.random() * types.length)];
        this.collected = false;
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.type === 'health' ? '#00FF00' : 
                        this.type === 'rapidfire' ? '#FF00FF' : '#00FFFF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw icon
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icon = this.type === 'health' ? '+' : 
                     this.type === 'rapidfire' ? '⚡' : '🛡';
        ctx.fillText(icon, this.x + this.width / 2, this.y + this.height / 2);
        ctx.restore();
    }

    update() {
        this.x -= this.speed;
    }
}

const britishPlane = new Plane(100, canvas.height / 2 - 15, 'british');
const germanPlanes = [];
const clouds = [];
const particles = [];
const powerUps = [];

for (let i = 0; i < 5; i++) {
    clouds.push(new Cloud());
}

function spawnGermanPlane() {
    const y = 50 + Math.random() * (canvas.height - 150);
    germanPlanes.push(new Plane(canvas.width - 150, y, 'german'));
}

function spawnPowerUp() {
    const y = 50 + Math.random() * (canvas.height - 100);
    powerUps.push(new PowerUp(canvas.width - 50, y));
}

function checkCollisions() {
    // Check bullet hits on German planes (iterate backwards to safely remove)
    for (let bIndex = britishPlane.bullets.length - 1; bIndex >= 0; bIndex--) {
        const bullet = britishPlane.bullets[bIndex];
        for (let pIndex = germanPlanes.length - 1; pIndex >= 0; pIndex--) {
            const plane = germanPlanes[pIndex];
            if (bullet.x > plane.x && bullet.x < plane.x + plane.width &&
                bullet.y > plane.y && bullet.y < plane.y + plane.height && !plane.exploding) {
                britishPlane.bullets.splice(bIndex, 1);
                plane.takeDamage(20);
                if (plane.health <= 0) {
                    plane.explode();
                    setTimeout(() => {
                        const index = germanPlanes.indexOf(plane);
                        if (index > -1) germanPlanes.splice(index, 1);
                    }, 800);
                    gameState.britishScore += 10;
                    gameState.enemiesDefeated++;
                    updateScore();
                    
                    // Chance to spawn power-up
                    if (Math.random() < 0.2) {
                        spawnPowerUp();
                    }
                }
                break; // Bullet hit, no need to check more planes
            }
        }
    }

    // Check German bullet hits on British plane (iterate backwards)
    germanPlanes.forEach(plane => {
        for (let bIndex = plane.bullets.length - 1; bIndex >= 0; bIndex--) {
            const bullet = plane.bullets[bIndex];
            if (bullet.x > britishPlane.x && bullet.x < britishPlane.x + britishPlane.width &&
                bullet.y > britishPlane.y && bullet.y < britishPlane.y + britishPlane.height && !britishPlane.exploding) {
                plane.bullets.splice(bIndex, 1);
                britishPlane.takeDamage(10);
                if (britishPlane.health <= 0) {
                    britishPlane.explode();
                    setTimeout(() => gameOver('German'), 1000);
                }
            }
        }

        // Check plane collision
        if (britishPlane.x < plane.x + plane.width && britishPlane.x + britishPlane.width > plane.x &&
            britishPlane.y < plane.y + plane.height && britishPlane.y + britishPlane.height > plane.y &&
            !britishPlane.exploding && !plane.exploding) {
            britishPlane.explode();
            plane.explode();
            setTimeout(() => gameOver('Collision'), 1000);
        }
    });
    
    // Check power-up collection (iterate backwards)
    for (let index = powerUps.length - 1; index >= 0; index--) {
        const powerUp = powerUps[index];
        if (!powerUp.collected && 
            britishPlane.x < powerUp.x + powerUp.width && 
            britishPlane.x + britishPlane.width > powerUp.x &&
            britishPlane.y < powerUp.y + powerUp.height && 
            britishPlane.y + britishPlane.height > powerUp.y) {
            powerUp.collected = true;
            britishPlane.applyPowerUp(powerUp.type);
            powerUps.splice(index, 1);
        }
    }
}

function updateScore() {
    document.getElementById('british-score').textContent = gameState.britishScore;
    document.getElementById('german-score').textContent = gameState.germanScore;
    
    // Update high score
    if (gameState.britishScore > gameState.highScore) {
        gameState.highScore = gameState.britishScore;
        localStorage.setItem('wwiHighScore', gameState.highScore);
        document.getElementById('high-score').textContent = gameState.highScore;
    }
    
    // Update wave info
    document.getElementById('wave-info').textContent = 
        `Wave ${gameState.wave} | Enemies: ${gameState.enemiesDefeated}/${gameState.enemiesInWave}`;
}

function gameOver(reason) {
    gameState.gameOver = true;
    gameState.running = false;
    const finalScore = gameState.britishScore;
    const isHighScore = finalScore === gameState.highScore && finalScore > 0;
    
    const statusElement = document.getElementById('game-status');
    statusElement.textContent = reason === 'German' ? 
        '💥 You were shot down!' : '💥 Collision!';
    
    const scoreText = document.createElement('br');
    statusElement.appendChild(scoreText);
    
    const scoreInfo = document.createTextNode(`Final Score: ${finalScore}${isHighScore ? ' 🏆 NEW HIGH SCORE!' : ''}`);
    statusElement.appendChild(scoreInfo);
    
    const restartText = document.createElement('br');
    statusElement.appendChild(restartText);
    
    const restartInfo = document.createTextNode('Press R to restart');
    statusElement.appendChild(restartInfo);
}

function resetGame() {
    britishPlane.x = 100;
    britishPlane.y = canvas.height / 2 - 15;
    britishPlane.health = 100;
    britishPlane.bullets = [];
    britishPlane.animationState = 'fly';
    britishPlane.exploding = false;
    britishPlane.frame = 0;
    britishPlane.shield = false;
    britishPlane.rapidFire = false;
    germanPlanes.length = 0;
    particles.length = 0;
    powerUps.length = 0;
    gameState.gameOver = false;
    gameState.running = true;
    gameState.britishScore = 0;
    gameState.germanScore = 0;
    gameState.wave = 1;
    gameState.enemiesInWave = 3;
    gameState.enemiesDefeated = 0;
    updateScore();
    document.getElementById('game-status').textContent = 'Good luck, pilot!';
}

function drawBackground() {
    // Sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.7);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.7);
    
    // Ground
    const groundGradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
    groundGradient.addColorStop(0, '#8FBC8F');
    groundGradient.addColorStop(1, '#556B2F');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);
    
    // Clouds
    clouds.forEach(cloud => {
        cloud.draw();
        if (!gameState.paused) {
            cloud.update();
        }
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

function checkWaveProgress() {
    // Check if wave is complete
    if (gameState.enemiesDefeated >= gameState.enemiesInWave && germanPlanes.length === 0) {
        gameState.wave++;
        gameState.enemiesInWave = 3 + gameState.wave;
        gameState.enemiesDefeated = 0;
        updateScore();
        document.getElementById('game-status').textContent = `Wave ${gameState.wave} - Get Ready!`;
        setTimeout(() => {
            document.getElementById('game-status').textContent = 'Good luck, pilot!';
        }, 2000);
    }
}

function gameLoop() {
    // Calculate FPS with rolling average
    const now = Date.now();
    const delta = now - gameState.lastFrameTime;
    gameState.lastFrameTime = now;
    
    gameState.frameTimes.push(delta);
    if (gameState.frameTimes.length > FPS_SAMPLE_SIZE) {
        gameState.frameTimes.shift();
    }
    const avgDelta = gameState.frameTimes.reduce((a, b) => a + b, 0) / gameState.frameTimes.length;
    gameState.fps = Math.round(1000 / avgDelta);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBackground();

    if (gameState.running && !gameState.paused) {
        if (keys['w'] && britishPlane.y > 20) britishPlane.y -= britishPlane.speed;
        if (keys['s'] && britishPlane.y < canvas.height - britishPlane.height - 20) britishPlane.y += britishPlane.speed;
        if (keys['a'] && britishPlane.x > 10) britishPlane.x -= britishPlane.speed;
        if (keys['d'] && britishPlane.x < canvas.width / 2) britishPlane.x += britishPlane.speed;
        if (keys[' ']) britishPlane.shoot();

        britishPlane.update();
        updateAI();
        checkWaveProgress();

        // Dynamic spawning based on wave
        const maxEnemies = Math.min(3, 1 + Math.floor(gameState.wave / 2));
        const spawnChance = 0.01 + (gameState.wave * 0.002);
        if (Math.random() < spawnChance && germanPlanes.length < maxEnemies) {
            spawnGermanPlane();
        }
        
        // Power-up spawning
        if (Math.random() < 0.001 && powerUps.length < 1) {
            spawnPowerUp();
        }

        germanPlanes.forEach(plane => plane.update());
        
        // Update power-ups (iterate backwards)
        for (let index = powerUps.length - 1; index >= 0; index--) {
            const powerUp = powerUps[index];
            powerUp.update();
            if (powerUp.x < -50) {
                powerUps.splice(index, 1);
            }
        }
        
        checkCollisions();
    }
    
    // Update and draw particles (iterate backwards)
    for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index];
        particle.update();
        if (particle.isDead()) {
            particles.splice(index, 1);
        }
    }

    britishPlane.draw();
    britishPlane.bullets.forEach(bullet => bullet.draw());
    
    germanPlanes.forEach(plane => {
        plane.draw();
        plane.bullets.forEach(bullet => bullet.draw());
    });
    
    powerUps.forEach(powerUp => powerUp.draw());
    particles.forEach(particle => particle.draw());
    
    // Draw power-up status
    if (britishPlane.shield) {
        ctx.fillStyle = '#00FFFF';
        ctx.font = '14px Arial';
        ctx.fillText(`Shield: ${Math.ceil(britishPlane.shieldTime / TARGET_FPS)}s`, 10, 20);
    }
    if (britishPlane.rapidFire) {
        ctx.fillStyle = '#FF00FF';
        ctx.font = '14px Arial';
        ctx.fillText(`Rapid Fire: ${Math.ceil(britishPlane.rapidFireTime / TARGET_FPS)}s`, 10, britishPlane.shield ? 40 : 20);
    }
    
    // Draw FPS counter
    if (gameState.showFPS) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px monospace';
        ctx.fillText(`FPS: ${gameState.fps}`, canvas.width - 70, 20);
    }
    
    // Draw pause indicator
    if (gameState.paused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('Press P to resume', canvas.width / 2, canvas.height / 2 + 40);
        ctx.textAlign = 'left';
    }

    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    
    if (!gameState.running && !gameState.gameOver) {
        gameState.running = true;
        gameState.wave = 1;
        gameState.enemiesInWave = 3;
        gameState.enemiesDefeated = 0;
        document.getElementById('game-status').textContent = 'Good luck, pilot!';
        updateScore();
        spawnGermanPlane();
    }
    
    if (e.key.toLowerCase() === 'r' && gameState.gameOver) {
        resetGame();
    }
    
    if (e.key.toLowerCase() === 'p' && gameState.running) {
        gameState.paused = !gameState.paused;
    }
    
    if (e.key.toLowerCase() === 'f') {
        gameState.showFPS = !gameState.showFPS;
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Initialize high score display
document.getElementById('high-score').textContent = gameState.highScore;

gameLoop();
