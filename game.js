'use strict';

class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    plus(vector) {
        if (!(vector instanceof Vector)) {
            throw new Error('Можно прибавлять к вектору только вектор типа Vector');
        }
        return new Vector(this.x + vector.x, this.y + vector.y);
    }

    times(number) {
        return new Vector(this.x * number, this.y * number);
    }
}


class Actor {
    constructor(pos = new Vector(0, 0), size = new Vector(1, 1), speed = new Vector(0, 0)) {
        if (!(pos instanceof Vector) || !(size instanceof Vector) || !(speed instanceof Vector)) {
            throw new Error('Не является объектом типа Vector');
        }

        this.pos = pos;
        this.size = size;
        this.speed = speed;
    }

    act() {
    }

    get left() {
        return this.pos.x;
    }
    get top() {
        return this.pos.y;
    }
    get right() {
        return this.pos.x + this.size.x;
    }
    get bottom() {
        return this.pos.y + this.size.y;
    }

    get type() {
        return 'actor';
    }

    isIntersect(actor) {
        if (!(actor instanceof Actor)) {
            throw new Error('Не является объектом типа Actor');
        }
        if (actor === this) {
            return false;
        }
        return actor.left < this.right &&
               actor.right > this.left &&
               actor.top < this.bottom &&
               actor.bottom > this.top;
    }
}


class Level {
    constructor(grid = [], actors = []) {
        this.grid = grid;
        this.actors = actors;
        this.height = grid.length;
        this.width = Math.max(0, ...this.grid.map(array => array.length));
        this.status = null;
        this.finishDelay = 1;
        this.player = this.actors.find(actor => actor.type === 'player');
    }

    isFinished() {
        return this.status != null && this.finishDelay < 0;
    }

    actorAt(actor) {
        if (!(actor instanceof Actor)) {
            throw new Error('Не является объектом типа Actor');
        }

        return this.actors.find(act => act.isIntersect(actor));
    }

    obstacleAt(pos, size) {
        if (!(pos instanceof Vector) || !(size instanceof Vector)) {
            throw new Error('Не является объектом типа Vector');
        }

        const left = Math.floor(pos.x);
        const right = Math.ceil(pos.x + size.x);
        const top = Math.floor(pos.y);
        const bottom = Math.ceil(pos.y + size.y);


        if ((left < 0) || (right > this.width) || (top < 0)) {
            return 'wall';
        }
        if (bottom > this.height) {
            return 'lava';
        }
        for (let y = top; y < bottom; y++) {
            for (let x = left; x < right; x++) {
                const obstacle = this.grid[y][x];
                if (obstacle) {
                  return obstacle;
                }
            }
        }
    }

    removeActor(actor) {
        const index = this.actors.indexOf(actor);
        if (index !== -1) {
            this.actors.splice(index, 1);
        }
    }

    noMoreActors(type) {
        return !this.actors.some((actor) => actor.type === type);
    }

    playerTouched(type, actor) {
        if (this.status !== null) {
            return;
        }
        if ((type === 'lava') || (type === 'fireball')) {
            this.status = 'lost';
            return;
        }
        if (type === 'coin'){
            this.removeActor(actor);
            if (this.noMoreActors('coin')) {
                this.status = 'won';
            }
        }
    }
}


class LevelParser {
    constructor(dictionary) {
        this.dictionary = Object.assign({}, dictionary);
    }

    actorFromSymbol(symbol) {
        return this.dictionary[symbol];
     }

    obstacleFromSymbol(symbol) {
        if (symbol === 'x') {
            return 'wall';
        }
        if (symbol === '!') {
            return 'lava';
        }
    }

    createGrid(array) {
        return array.map(line => line.split('')).map(line => line.map(line => this.obstacleFromSymbol(line)));
    }

    createActors(array) {
        const actors = [];
        array.forEach((line, y) => {
            line.split('').forEach((symbol, x) => {
                const constr = this.actorFromSymbol(symbol);
                if (typeof constr === 'function'){
                    const actor = new constr(new Vector(x, y));
                    if (actor instanceof Actor){
                        actors.push(actor);
                    }
                }
            });
        });
        return actors;
    }

    parse(array) {
        return new Level(this.createGrid(array), this.createActors(array));
    }
}


class Fireball extends Actor {
    constructor(pos = new Vector(0, 0), speed = new Vector(0, 0)) {
        const size = new Vector(1, 1);
        super(pos, size, speed);
    }

    get type() {
        return 'fireball';
    }

    getNextPosition(time = 1) {
        return this.pos.plus(this.speed.times(time));
    }

    handleObstacle() {
        this.speed = this.speed.times(-1);
    }

    act(time, level) {
        const nextPosition = this.getNextPosition(time);
        if (level.obstacleAt(nextPosition, this.size)) {
            this.handleObstacle();
        } else {
            this.pos = nextPosition;
        }
    }
}


class HorizontalFireball extends Fireball {
    constructor(pos = new Vector(0, 0)) {
        const speed = new Vector(2, 0);
        super(pos, speed);
    }
}

class VerticalFireball extends Fireball {
    constructor(pos = new Vector(0)) {
        const speed = new Vector(0, 2);
        super(pos, speed);
    }
}

class FireRain extends Fireball {
    constructor(pos = new Vector(0, 0)) {
        const speed = new Vector(0, 3);
        super(pos, speed);
        this.startPos = pos;
    }

    handleObstacle() {
        this.pos = this.startPos;
   }
}

class Coin extends Actor {
    constructor(pos = new Vector(0, 0)) {
        const newPos = pos.plus(new Vector(0.2, 0.1));;
        const size = new Vector(0.6, 0.6);
        super(newPos, size);
        this.springSpeed = 8;
        this.springDist = 0.07;
        this.spring = Math.random() * 2 * Math.PI;
        this.startPos = newPos;
    }

    get type() {
        return 'coin';
    }

    updateSpring(time = 1) {
        this.spring += this.springSpeed * time;
    }

    getSpringVector() {
        return new Vector(0, Math.sin(this.spring) * this.springDist)
    }

    getNextPosition(time = 1) {
        this.updateSpring(time);
        return this.startPos.plus(this.getSpringVector());
    }

    act(time) {
        this.pos = this.getNextPosition(time);
    }
}

class Player extends Actor {
    constructor(pos = new Vector(0, 0)) {
        const newPos = pos.plus(new Vector(0, - 0.5));
        const size = new Vector(0.8, 1.5);
        const speed = new Vector(0, 0);
        super(newPos, size, speed);
    }

    get type() {
        return 'player';
    }
}


const actorDict = {
    '@': Player,
    'o': Coin,
    '=': HorizontalFireball,
    '|': VerticalFireball,
    'v': FireRain
};

const parser = new LevelParser(actorDict);

loadLevels()
    .then(schemas => {
        return runGame(JSON.parse(schemas), parser, DOMDisplay);
    })
    .then(() => alert('Вы выиграли приз!'));