let config = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {y: 500},
            debug: false
        }
    },
    scene: [
        {
            key: 'main',
            preload: preload,
            create: create,
            update: update,
        },
        {
            key: 'hud',
            preload: preloadHud,
            create: createHud,
            update: updateHud,
        },
    ],
    pixelArt: true,
    roundPixels: true,
};

const WALK_SPEED = 150;
const JUMP_IMPULSE = 280;
const JUMP_ANIM_THRESHOLD = 250; // time in air to trigger jump animation
const FOOTSTEP_THRESHOLD = 250; // time between footstep sounds
const INTERACT_DISTANCE = 150;
const ZONES = [];
const INVITED = [];
const SOUNDS = {};
let musictrack = false;
let max_invited_guests = 0;

const AUDIO_FILES = [];
const MUSIC_VOLUME = 0.5;
const SFX_VOLUME = 0.09;
const TULIP_VOLUME = 0.04;
const DIALOGUE_VOLUME = 1.0;

// load files from assets/sounds/animals/*
for (let i = 1; i <= 4; i++) {
    ['fox', 'ghast', 'panda'].forEach(animal => {
        AUDIO_FILES.push(`assets/sounds/animals/${animal}${i}.ogg`);
    });
    if (i < 4) {
        AUDIO_FILES.push(`assets/sounds/animals/pig${i}.ogg`);
    }
}

// load music files
['cave', 'desert', 'forest', 'plains', 'party'].forEach(land => {
    AUDIO_FILES.push(`assets/sounds/music/${land}.ogg`);
});

// steps
for (let i = 1; i <= 5; i++) {
    AUDIO_FILES.push(`assets/sounds/step${i}.ogg`);
}

// remaining audio files
['firework', 'stage_complete', 'tulip'].forEach(file => {
    AUDIO_FILES.push(`assets/sounds/${file}.ogg`);
})

const PLAYER_SPAWN_LOCATION = { x: 510, y: 940 };
const ANIMAL_LOCATIONS = {
    fox: { x: 6350, y: 300 },
    ghast: { x: 10256, y: 140 },
    panda: { x: 19550, y: 270 },
    hammy: { x: 4570, y: 730 },
    bacon: { x: 21770, y: 800 },
    porkchop: { x: 13800, y: 800 },
    pika: { x: 9400, y: 500 },
}

const CREDITS_TEXT = `[CREDITS]

PROGRAMMING
Raymond W

PIXEL ART
Martin Wörister
Clarisse R

QA TESTING
Alea E

MUSIC + SFX
Mojang/Minecraft
Saja Boys

Powered by
PHASER.io
`;

const UPDATE_CALLBACKS = [];

let game = new Phaser.Game(config);

let map;
let player;
let cursors;
let key = { w: false, a: false, s: false, d: false, space: false };
let groundLayer, coinLayer, bgLayer, bgLayer2, parallaxLayer;
let scoreText, stageText, mainText, credits;
let score = 0;
let hud;

let panda, ghast, fox;
let hammy, bacon, porkchop;
let pika;

function preload() {
    // map made with Tiled in JSON format
    this.load.tilemapTiledJSON('map', 'assets/map.json');
    // tiles in spritesheet 
    this.load.spritesheet('spritesheet', 'assets/spritesheet.png', {frameWidth: 16, frameHeight: 16});
    // this.load.spritesheet('tiles', 'assets/tiles.png', {frameWidth: 70, frameHeight: 70});
    // simple coin image
    // this.load.image('coin', 'assets/coinGold.png');
    // player animations
    this.load.atlas('player', 'assets/player.png', 'assets/player.json');
    this.load.atlas('animals', 'assets/animals_sprites.png', 'assets/animals_sprites.json');
    this.load.atlas('animals_2', 'assets/animals_sprites_2.png', 'assets/animals_sprites_2.json');
    this.load.atlas('firework_spritesheet', 'assets/firework_spritesheet.png', 'assets/firework_sprites.json')

    AUDIO_FILES.forEach(filepath => {
        const name = filepath.split('/').pop().split('.').shift();
        SOUNDS[name] = { audio: this.load.audio(name, filepath) };
        let volume = SFX_VOLUME;
        if (name.startsWith('fox') || name.startsWith('ghast') || name.startsWith('panda') || name.startsWith('pig')) {
            volume = DIALOGUE_VOLUME;
        }
        if (name === 'cave' || name === 'desert' || name === 'forest' || name === 'plains' || name === 'plains') {
            volume = MUSIC_VOLUME;
        }
        SOUNDS[name].volume = volume;
    })
}

function preloadHud() {

}

function create() {
    const self = this;
    const physics = self.physics;

    this.scene.launch('hud');

    // load the map 
    map = this.make.tilemap({key: 'map'});

    // tiles for the ground layer
    const groundTiles = map.addTilesetImage('spritesheet');

    // parallaxLayer = map.createDynamicLayer('Parallax', groundTiles, 150, 60);
    // parallaxLayer.setScale(1.5 * 0.9);
    // parallaxLayer.setScrollFactor(0.8);

    bgLayer = map.createLayer('Background', groundTiles, 0, 0);
    bgLayer.setScale(1.5);
    bgLayer.forEachTile(tile => tile.tint = 0xEEEEEE);

    bgLayer2 = map.createLayer('BackgroundProps', groundTiles, 0, 0);
    bgLayer2.setScale(1.5);

    // create the ground layer
    groundLayer = map.createLayer('World', groundTiles, 0, 0);
    // the player will collide with this layer
    groundLayer.setScale(1.5);
    groundLayer.setCollisionByExclusion([-1]);

    // coin image used as tileset
    // let coinTiles = map.addTilesetImage('coin');
    // add coins as tiles
    coinLayer = map.createLayer('Coins', groundTiles, 0, 0);
    coinLayer.setScale(1.5);

    // set the boundaries of our game world
    // this.physics.world.bounds.width = groundLayer.width;
    // this.physics.world.bounds.height = groundLayer.height;

    // load sounds
    for (let file of Object.keys(SOUNDS)) {
        const isMusc = (file === 'cave' || file === 'desert' || file === 'forest' || file === 'plains');
        const volume = SOUNDS[file].volume;
        SOUNDS[file] = self.sound.add(file, { loop: isMusc});
        SOUNDS[file].setVolume(volume);
    }

    fox = physics.add.sprite(0, 0, 'animals');
    fox.sounds = [SOUNDS.fox1, SOUNDS.fox2, SOUNDS.fox3, SOUNDS.fox4];
    register('Foxy', fox, ANIMAL_LOCATIONS.fox, false, ['Oh, hello there Porkbelly', 'How did a pig get up here....?', 'A party?', 'Sure, I can go!', 'I\'ll see you at the party Porkbelly!']);
    fox.partyLocation = {x: 23265, y: 250};

    panda = physics.add.sprite(0, 0, 'animals');
    panda.sounds = [SOUNDS.panda1, SOUNDS.panda2, SOUNDS.panda3, SOUNDS.panda4];
    register('MacPanda', panda, ANIMAL_LOCATIONS.panda, false, ['*sneeze*', 'Oh hi!', 'How did you climb up here?', 'You\'re having a party?', 'Oh, that\'s soon!', 'Yeah I can go to it', 'Thanks for the invite, stinky!']);
    panda.partyLocation = {x: 23230, y: 290};

    ghast = physics.add.sprite(0, 0, 'animals');
    ghast.sounds = [SOUNDS.ghast1, SOUNDS.ghast2, SOUNDS.ghast3, SOUNDS.ghast4];
    register('Happy', ghast, ANIMAL_LOCATIONS.ghast, false, [':o   a pig!', 'Hello there pig!', 'Nice to meet you Porkbelly', 'A party later sounds fun!', 'Okay, I\'ll be there!', 'See you at the party, new friend!']);
    ghast.partyLocation = {x: 23055, y: 235};

    hammy = physics.add.sprite(0, 0, 'animals_2');
    hammy.sounds = [SOUNDS.pig1, SOUNDS.pig2, SOUNDS.pig3];
    register('Hammy', hammy, ANIMAL_LOCATIONS.hammy, true, ['Hi Ms. Porkbelly! :D', 'Oh a party later?', 'Sure, I would love to go!', 'You should ask the other pigs too', 'See you at the party!']);
    hammy.partyLocation = {x: 23040, y: 290};

    bacon = physics.add.sprite(0, 0, 'animals_2');
    bacon.sounds = hammy.sounds;
    register('Bacon', bacon, ANIMAL_LOCATIONS.bacon, true, ['Oh hi hi!', 'A party? Up the hill?', 'Oh, and it starts soon?', 'I can\'t wait to go!', 'I\'ll see you there Porkbelly!']);
    bacon.partyLocation = {x: 23088, y: 290};

    porkchop = physics.add.sprite(0, 0, 'animals_2');
    porkchop.sounds = bacon.sounds;
    register('Porkchop', porkchop, ANIMAL_LOCATIONS.porkchop, true, ['Hello Porkbelly!', 'I would love to go to a party, when is it?', 'Oh okay, I can go later today!', 'Thanks for the invite Porkbelly!']);
    porkchop.partyLocation = {x: 23190, y: 290};

    pika = physics.add.sprite(0, 0, 'animals_2');
    pika.sounds = fox.sounds;
    register('Pika', pika, ANIMAL_LOCATIONS.pika, true, ['*woof* thank you for rescuing me! *woof*']);
    pika.partyLocation = {x: 23133, y: 290};

    // create the player sprite    
    player = physics.add.sprite(0, 0, 'player');
    player.setBounce(0.25); // our player will bounce from items
    player.setCollideWorldBounds(false); // don't go out of the map
    register('Porkbelly', player, PLAYER_SPAWN_LOCATION, true);

    coinLayer.setTileIndexCallback(32, collectTulip, this);
    // when the player overlaps with a tile with index 9, collectTulip will be called    
    physics.add.overlap(player, coinLayer);

    // player walk animation
    this.anims.create({
        key: 'walk',
        frames: this.anims.generateFrameNames('player', {prefix: 'frame_', start: 1, end: 9, zeroPad: 2}),
        frameRate: 20,
        repeat: 1
    });
    // idle with only one frame, so repeat is not neaded
    this.anims.create({
        key: 'idle',
        frames: [{key: 'player', frame: 'p1_stand'}],
        frameRate: 10,
    });
    this.anims.create({
        key: 'jump',
        frames: [{key: 'player', frame: 'frame_04'}],
        frameRate: 10,
    });
    this.anims.create({
        key: 'panda_idle',
        frames: this.anims.generateFrameNames('animals', {prefix: 'panda_', start: 0, end: 15, zeroPad: 2}),
        frameRate: 5,
    });
    this.anims.create({
        key: 'ghast_idle',
        frames: this.anims.generateFrameNames('animals', {prefix: 'ghast_', start: 0, end: 9, zeroPad: 2}),
        frameRate: 10,
    });
    this.anims.create({
        key: 'firework_anim',
        frames: this.anims.generateFrameNames('firework_spritesheet', {prefix: 'firework_', start: 0, end: 5, zeroPad: 1}),
        frameRate: 10,
    });
    ['pika', 'hammy', 'porkchop', 'bacon'].forEach(name => {
        this.anims.create({
            key: name,
            frames: [{key: 'animals_2', frame: name}],
        });
    });


    cursors = this.input.keyboard.createCursorKeys();
    for (let keybind of Object.keys(key)) {
        if (keybind.toUpperCase() in Phaser.Input.Keyboard.KeyCodes) {
            key[keybind] = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[keybind.toUpperCase()]);
        } else {
            console.log(`Failed to find keycode for ${keybind}!`);
        }
    }

    // create interaction zones
    createZoneInteraction(2000, 720, 50, () => {
        setStageText('Stage 1: The Forest');
        setTrack(SOUNDS.forest);
    });
    createZoneInteraction(6500, 900, 50, () => {
        setStageText('Stage 2: The Caves');
        setTrack(SOUNDS.cave);
    });
    createZoneInteraction(12100, 700, 50, () => {
        setStageText('Stage 3: The Desert');
        setTrack(SOUNDS.desert);
    });
    createZoneInteraction(16300, 730, 50, () => {
        setStageText('Stage 4: The Plains');
        setTrack(SOUNDS.plains);
    });

    createZoneInteraction(6130, 827, 100, player => {
        setMainText('Stage  1  Complete!');
        for (let i = 0; i < 20; i++) {
            this.time.delayedCall(i * 250, () => spawnFirework(player.x + (Math.random() * 150) - 75, player.y - Math.random() * 100), [], this);
        }
        SOUNDS.stage_complete.play();
    });
    createZoneInteraction(11500, 730, 100, player => {
        setMainText('Stage  2  Complete!');
        for (let i = 0; i < 20; i++) {
            this.time.delayedCall(i * 250, () => spawnFirework(player.x + (Math.random() * 150) - 75, player.y - Math.random() * 100), [], this);
        }
        SOUNDS.stage_complete.play();
    });
    createZoneInteraction(16000, 707, 100, player => {
        setMainText('Stage  3  Complete!');
        for (let i = 0; i < 20; i++) {
            this.time.delayedCall(i * 250, () => spawnFirework(player.x + (Math.random() * 150) - 75, player.y - Math.random() * 100), [], this);
        }
        SOUNDS.stage_complete.play();
    });

    createZoneInteraction(22400, 467, 200, () => {
        INVITED.forEach(animal => {
            animal.x = animal.partyLocation.x;
            animal.y = animal.partyLocation.y;
            animal.dialogueText.setText('');
        });
    });

    createZoneInteraction(23250, 300, 200, () => {
        if (musictrack) {
            musictrack.stop();
        }
        SOUNDS.party.play();
        setMainText('Happy birthday bby!');

        const jumping = [];
        INVITED.forEach(animal => {
            self.time.delayedCall(Math.random() * 1000, () => {
                animal.dialogueText.setText('Happy Birthday Alexia!');
                if (animal.body.allowGravity) {
                    jumping.push(animal);
                }
            });
        });
        for (let i = 0; i < 4000; i++) {
            self.time.delayedCall(i * 100, () => {
                spawnFirework(player.x + (Math.random() * 500) - 250, player.y - Math.random() * 300, false);
            }, [], this);
        }

        UPDATE_CALLBACKS.push(() => {
            jumping.forEach(animal => {
                if (animal.body.onFloor()) {
                    animal.body.setVelocityY(-JUMP_IMPULSE / (1.25 + Math.random() / 2));
                }
            });
        });

        showCredits();
    });


    // set bounds so the camera won't go outside the game world
    // this.cameras.main.setBounds(0, 0, 10, 10);
    this.cameras.main.setZoom(3);
    // make the camera follow the player
    this.cameras.main.startFollow(player, true, 0.05, 0.05, 0, 20);

    // set background color, so the sky is not black    
    this.cameras.main.setBackgroundColor('#78A7FF');

    // this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
    //     console.log('hello world'); // TODO implement zooming
    // });

    this.add.text(418, 850, 'Hurry to the party! ->\nInvite anyone you see along the way!', {
        fontFamily: 'Minecraftia',
        fontSize: '32px',
        color: '#FFFFFF',
        align: 'center',
    }).setShadow(0, 0, '#000000', 8, true, true).setScale(0.25);

    this.add.text(4570, 770, 'Click on other animals to\ninvite them to the party!', {
        fontFamily: 'Minecraftia',
        fontSize: '32px',
        color: '#FFFFFF',
        align: 'center',
    }).setShadow(0, 0, '#000000', 8, true, true).setOrigin(0.5).setScale(0.25);

    function register(name, sprite, location, gravity = false, dialogue = []) {
        sprite.name = name;
        sprite.setCollideWorldBounds(false);
        if (name === 'Pika') {
            sprite.setScale(0.75, 0.75);
        } else {
            sprite.setScale(1, 1);
        }
        sprite.setPosition(location.x, location.y);
        physics.add.collider(groundLayer, sprite);
        sprite.body.allowGravity = gravity;
        if (name === 'Hammy') {
            sprite.body.setSize(sprite.width * 0.1, sprite.height * 0.1);
        } else if (name === 'Bacon') {
            sprite.body.setSize(sprite.width * 0.5, sprite.height * 0.575);
        } else if (name === 'Porkchop') {
            sprite.body.setSize(sprite.width * 0.5, sprite.height * 0.5);
        } else if (name === 'Pika') {
            sprite.body.setSize(sprite.width * 0.9, sprite.height * 0.75);
        } else {
            sprite.body.setSize(sprite.width * 0.9, sprite.height * 0.9);
        }

        const nameTag = self.add.text(sprite.x, sprite.y - 30, name, {
            fontFamily: 'Minecraftia',
            fontSize: '32px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: { x: 8, y: 4 },
            align: 'center'
        });
        nameTag.setOrigin(0.5);
        nameTag.setScale(0.25);

        UPDATE_CALLBACKS.push(() => {
            if (sprite !== player) {
                sprite.flipX = (sprite.x > player.x);
                if (sprite.dialogueText) {
                    sprite.dialogueText.setPosition(sprite.x, sprite.y - 50);
                }
            }
            nameTag.setPosition(sprite.x, sprite.y - 30);
        });

        if (dialogue.length > 0) {
            sprite.setInteractive();
            sprite.dialogueText = self.add.text(sprite.x, sprite.y - 50, '', {
                fontFamily: 'Minecraftia',
                fontSize: '32px',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                padding: { x: 6 * 4, y: 6 * 4 },
                align: 'center',
            });
            sprite.dialogueText.setOrigin(0.5);
            sprite.dialogueText.setScale(0.25);
            sprite.dialogueText.setVisible(false);
            sprite.on('pointerdown', () => {
                if (distance(sprite, player) > INTERACT_DISTANCE) {
                    setStageText(`Move closer to talk to ${name}`);
                    return;
                }
                if (dialogue.length <= 0) {
                    return;
                }

                sprite.dialogueText.setVisible(true);

                const sound = sprite.sounds[Math.floor(Math.random() * sprite.sounds.length)];
                sound.play();

                const nextLine = dialogue.shift();
                sprite.dialogueText.setText(nextLine);
                if (dialogue.length <= 0) {
                    INVITED.push(sprite);
                    setStageText(`${INVITED.length}/${max_invited_guests} guests invited!`);
                }
            });
        }

        if (sprite !== player) {
            max_invited_guests++;
        }
    }

    function createZoneInteraction(x, y, radius, callback) {
        ZONES.push({x, y, radius, callback, isInside: (sprite) => (distance(sprite, {x, y}) <= radius)});
    }

    function spawnFirework(x, y, sound = true) {
        const firework = self.add.sprite(x, y, 'firework_spritesheet');
        firework.anims.play('firework_anim', false);
        firework.on('animationcomplete', () => firework.destroy());
        SOUNDS.firework.setVolume(Math.random());
        if (sound) SOUNDS.firework.play();
    }

    function setTrack(soundtrack) {
        if (musictrack) {
            self.tweens.add({
                targets: musictrack,
                volume: 0,
                duration: 2000,
                onComplete: () => {
                    musictrack.stop();
                    startTrack(soundtrack);
                }
            });
        } else {
            startTrack(soundtrack);
        }

        function startTrack(track) {
            musictrack = track;
            musictrack.play();
        }
    }
}

function createHud() {
    hud = this;

    //  scoreText will show the score
    scoreText = this.add.text(1480, 60, 'SCORE:  0', {
        fontFamily: 'Minecraftia',
        fontSize: '64px',
        color: '#FFFFFF',
        align: 'right',
    });

    stageText = this.add.text(100, 60, '', {
        fontFamily: 'Minecraftia',
        fontSize: '64px',
        color: '#FFFFFF',
        align: 'left',
    });

    mainText = this.add.text(config.width * 0.5, config.height * 0.75, '', {
        fontFamily: 'Minecraftia',
        fontSize: '128px',
        color: '#FFFFFF',
        align: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: { x: 1000, y: 25 },
    });
    mainText.setOrigin(0.5);
    mainText.alpha = 0;

    credits = this.add.text(config.width - 250, config.height * 0.5 + 100, CREDITS_TEXT, {
        fontFamily: 'Minecraftia',
        fontSize: '32px',
        color: '#FFFFFF',
        align: 'right',
    });
    credits.setOrigin(0.5);
    credits.alpha = 0;

    scoreText.setShadow(8, 8, '#000000', 2, true, true);
    stageText.setShadow(8, 8, '#000000', 2, true, true);
    credits.setShadow(0, 0, '#000000', 10, true, true);


    // fix all text to the camera
    scoreText.setScrollFactor(0);
    stageText.setScrollFactor(0);
    credits.setScrollFactor(0);
}

// this function will be called when the player touches a coin
function collectTulip(sprite, tile) {
    coinLayer.removeTileAt(tile.x, tile.y); // remove the tile/coin
    score++; // add 10 points to the score
    scoreText.setText(`SCORE:  ${score}`); // set the scoreText to show the current score
    SOUNDS.tulip.setVolume(TULIP_VOLUME);
    SOUNDS.tulip.play();
    return false;
}

function setStageText(text) {
    const letters = text.split('');
    const shownText = [];
    for (let i = 0; i < letters.length; i++) {
        hud.time.delayedCall(i * 100, () => {
            shownText.push(letters[i]);
            stageText.setText(shownText.join(''));
        }, [], this);
    }

    hud.time.delayedCall(letters.length * 100 + 3000, () => {
        hud.tweens.add({
            targets: stageText,
            alpha: 0,
            duration: 2000,
            ease: 'Linear',
            onComplete: () => {
                stageText.setText('');
                stageText.alpha = 1;
            }
        });
    });
}


function setMainText(text) {
    mainText.alpha = 1;
    const letters = text.split('');
    const shownText = [];
    for (let i = 0; i < letters.length; i++) {
        hud.time.delayedCall(i * 100, () => {
            shownText.push(letters[i]);
            mainText.setText(shownText.join(''));
        }, [], this);
    }

    hud.time.delayedCall(letters.length * 100 + 2000, () => {
        hud.tweens.add({
            targets: mainText,
            alpha: 0,
            duration: 1000,
            ease: 'Linear',
            onComplete: () => {
                mainText.setText('');
            }
        });
    });
}

function showCredits() {
    hud.time.delayedCall(5000, () => {
        hud.tweens.add({
            targets: credits,
            alpha: 1,
            duration: 2000,
            ease: 'Linear',
        });
    });
}

let lastTimeOnFloor = false;
let lastPlayedStep = false;
function update(time, delta) {
    const self = this;
    // parallaxLayer.setPosition(this.cameras.main.scrollX * 0.9 + 120, this.cameras.main.scrollY * 0.9 + 60);

    let animation = false;
    // L/R movement
    if (key.a.isDown || cursors.left.isDown)
    {
        player.body.setVelocityX(-WALK_SPEED);
        animation = 'walk';
        player.flipX = true; // flip the sprite to the left
    }
    else if (key.d.isDown || cursors.right.isDown)
    {
        player.body.setVelocityX(WALK_SPEED);
        animation = 'walk';
        player.flipX = false; // use the original sprite looking to the right
    } else {
        player.body.setVelocityX(0);
        animation = 'idle';
    }
    // jump 
    if ((key.w.isDown || key.space.isDown || cursors.up.isDown) && player.body.onFloor())
    {
        player.body.setVelocityY(-JUMP_IMPULSE);
    }

    // animation logic
    if (player.body.onFloor()) {
        lastTimeOnFloor = time;
    }
    if (time - lastTimeOnFloor >= JUMP_ANIM_THRESHOLD) {
        animation = 'jump';
    }
    if (animation) {
        player.anims.play(animation, true);
    }

    // footsteps audio logic
    if (!lastPlayedStep) {
        lastPlayedStep = time;
    }
    if (animation === 'walk' && time - lastPlayedStep >= FOOTSTEP_THRESHOLD) {
        lastPlayedStep = time;
        const steps = [ SOUNDS.step1, SOUNDS.step2, SOUNDS.step3, SOUNDS.step4 ];
        const random = steps[Math.floor(Math.random() * steps.length)];
        random.play();
    }

    // catch, in case player falls
    if (player.y > 1200) {
        player.y = PLAYER_SPAWN_LOCATION.y;
    }


    // for debugging
    if (cursors.down.isDown) {
        console.log(`(${Math.round(player.x * 10) / 10}, ${Math.round(player.y * 10) / 10})`);
    }

    // animal idle animations
    panda.anims.play('panda_idle', true);
    ghast.anims.play('ghast_idle', true);
    hammy.anims.play('hammy', false);
    bacon.anims.play('bacon', false);
    porkchop.anims.play('porkchop', false);
    pika.anims.play('pika', false);

    ZONES.forEach(zone => {
        if (!zone.activated && zone.isInside(player)) {
            zone.callback(player);
            zone.activated = true;
        }
    });

    UPDATE_CALLBACKS.forEach(callback => callback());
}

function updateHud(time, delta) {

}

function distance(spriteA, spriteB) {
    const dx = spriteA.x - spriteB.x;
    const dy = spriteA.y - spriteB.y;
    return Math.sqrt(dx * dx + dy * dy);
}
