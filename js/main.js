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
};

const WALK_SPEED = 150;
const JUMP_IMPULSE = 280;
const JUMP_ANIM_THRESHOLD = 250; // time in air to trigger jump animation

const ANIMAL_LOCATIONS = {
    fox: { x: 6350, y: 300 },
    ghast: { x: 10256, y: 140 },
    panda: { x: 19550, y: 270 },
    hammy: { x: 4570, y: 725 },
    bacon: { x: 21770, y: 800 },
    porkchop: { x: 13800, y: 800 },
}

const UPDATE_CALLBACKS = [];

let game = new Phaser.Game(config);

let map;
let player;
let cursors;
let groundLayer, coinLayer, bgLayer, bgLayer2, parallaxLayer;
let text;
let score = 0;

let panda, ghast, fox;
let hammy, bacon, porkchop;

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
    let groundTiles = map.addTilesetImage('spritesheet');

    // parallaxLayer = map.createDynamicLayer('Parallax', groundTiles, 150, 60);
    // parallaxLayer.setScale(1.5 * 0.9);
    // parallaxLayer.setScrollFactor(0.8);

    bgLayer = map.createDynamicLayer('Background', groundTiles, 0, 0);
    bgLayer.setScale(1.5);
    bgLayer.forEachTile(tile => tile.tint = 0xEEEEEE);

    bgLayer2 = map.createDynamicLayer('BackgroundProps', groundTiles, 0, 0);
    bgLayer2.setScale(1.5);

    // create the ground layer
    groundLayer = map.createDynamicLayer('World', groundTiles, 0, 0);
    // the player will collide with this layer
    groundLayer.setScale(1.5);
    groundLayer.setCollisionByExclusion([-1]);

    // coin image used as tileset
    // let coinTiles = map.addTilesetImage('coin');
    // add coins as tiles
    coinLayer = map.createDynamicLayer('Coins', groundTiles, 0, 0);
    coinLayer.setScale(1.5);

    // set the boundaries of our game world
    // this.physics.world.bounds.width = groundLayer.width;
    // this.physics.world.bounds.height = groundLayer.height;

    fox = physics.add.sprite(0, 0, 'animals');
    register('Foxy', fox, ANIMAL_LOCATIONS.fox);

    panda = physics.add.sprite(0, 0, 'animals');
    register('MacPanda', panda, ANIMAL_LOCATIONS.panda);

    ghast = physics.add.sprite(0, 0, 'animals');
    register('Ghast', ghast, ANIMAL_LOCATIONS.ghast);

    hammy = physics.add.sprite(0, 0, 'player');
    register('Hammy', hammy, ANIMAL_LOCATIONS.hammy, true);

    bacon = physics.add.sprite(0, 0, 'player');
    register('Bacon', bacon, ANIMAL_LOCATIONS.bacon, true);

    porkchop = physics.add.sprite(0, 0, 'player');
    register('Porkchop', porkchop, ANIMAL_LOCATIONS.porkchop, true);

    // create the player sprite    
    player = physics.add.sprite(0, 0, 'player');
    player.setBounce(0.25); // our player will bounce from items
    player.setCollideWorldBounds(false); // don't go out of the map
    register('Porkbelly', player, { x: 510, y: 940 }, true);

    coinLayer.setTileIndexCallback(32, collectCoin, this);
    // when the player overlaps with a tile with index 9, collectCoin will be called    
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
    })


    cursors = this.input.keyboard.createCursorKeys();

    // set bounds so the camera won't go outside the game world
    // this.cameras.main.setBounds(0, 0, 10, 10);
    this.cameras.main.setZoom(3);
    // make the camera follow the player
    this.cameras.main.startFollow(player, true, 0.1, 0.1);

    // set background color, so the sky is not black    
    this.cameras.main.setBackgroundColor('#78A7FF');

    // this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
    //     console.log('hello world'); // TODO implement zooming
    // });

    this.add.text(418, 850, 'Hurry to the party! ->\nInvite anyone you see along the way!', {
        fontFamily: 'Minecraftia',
        fontSize: '8px',
        color: '#FFFFFF',
        align: 'center'
    });

    function register(name, sprite, location, gravity = false) {
        sprite.setCollideWorldBounds(false);
        sprite.setScale(1, 1);
        sprite.setPosition(location.x, location.y);
        physics.add.collider(groundLayer, sprite);
        sprite.body.allowGravity = gravity;
        sprite.body.setSize(sprite.width * 0.9, sprite.height * 0.85);

        const nameTag = self.add.text(sprite.x, sprite.y - 50, name, {
            fontFamily: 'Minecraftia',
            fontSize: '8px',
            color: '#FFFFFF',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: { x: 2, y: -2 },
            align: 'center'
        });
        nameTag.setOrigin(0.5);

        UPDATE_CALLBACKS.push(() => {
            if (sprite !== player) {
                sprite.flipX = (sprite.x > player.x);
            }
            nameTag.setPosition(sprite.x, sprite.y - 30);
        });
    }
}

function createHud() {
    // this text will show the score
    text = this.add.text(800, 940, 'Score:  0', {
        fontFamily: 'Minecraftia',
        fontSize: '64px',
        color: '#FFFFFF',
        align: 'center'
    });
    // fix the text to the camera
    text.setScrollFactor(0);
}

// this function will be called when the player touches a coin
function collectCoin(sprite, tile) {
    coinLayer.removeTileAt(tile.x, tile.y); // remove the tile/coin
    score++; // add 10 points to the score
    text.setText(`SCORE:  ${score}`); // set the text to show the current score
    return false;
}

let lastTimeOnFloor = false;
function update(time, delta) {
    // parallaxLayer.setPosition(this.cameras.main.scrollX * 0.9 + 120, this.cameras.main.scrollY * 0.9 + 60);

    let animation = false;
    if (cursors.left.isDown)
    {
        player.body.setVelocityX(-WALK_SPEED);
        animation = 'walk';
        player.flipX = true; // flip the sprite to the left
    }
    else if (cursors.right.isDown)
    {
        player.body.setVelocityX(WALK_SPEED);
        animation = 'walk';
        player.flipX = false; // use the original sprite looking to the right
    } else {
        player.body.setVelocityX(0);
        animation = 'idle';
    }
    // jump 
    if (cursors.up.isDown && player.body.onFloor())
    {
        player.body.setVelocityY(-JUMP_IMPULSE);
        console.log(`Position: (${Math.round(player.x)}, ${Math.round(player.y)})`);
    }
    if (player.body.onFloor()) {
        lastTimeOnFloor = time;
    }

    if (time - lastTimeOnFloor >= JUMP_ANIM_THRESHOLD) {
        animation = 'jump';
    }

    if (animation) {
        player.anims.play(animation, true);
    }

    // animal idle animations
    panda.anims.play('panda_idle', true);
    ghast.anims.play('ghast_idle', true);

    UPDATE_CALLBACKS.forEach(callback => callback());
}

function updateHud(time, delta) {

}