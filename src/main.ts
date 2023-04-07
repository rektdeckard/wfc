import p5 from "p5";

import tileset from "../tilesets/outdoor/tileset.json";
const SET = "outdoor";

const WIDTH = 10;
const HEIGHT = 10;
const FRAMERATE = null;
let tint = false;

enum Edge {
  TOP,
  RIGHT,
  BOTTOM,
  LEFT,
}

type Socket = [number, number, number];

type TileConfig = {
  image: string;
  sockets: [Socket, Socket, Socket, Socket];
};

type Tileset = { size: number; tiles: TileConfig[] };

type Entry = { cell: Cell; x: number; y: number };

const instance = new p5(async (sketch: p5) => {
  const w = tileset.size * WIDTH;
  const h = tileset.size * HEIGHT;
  let grid: Grid;

  //   function predraw(buff: p5.Graphics) {
  //     while (!grid.finished) grid.step();
  //     grid.draw(buff);
  //   }

  sketch.setup = () => {
    // sketch.randomSeed(11);
    grid = new Grid(sketch, tileset as Tileset);
    sketch.createCanvas(w, h);

    if (FRAMERATE) {
      sketch.frameRate(FRAMERATE);
    }

    if (tint) {
      sketch.tint(
        Math.floor(sketch.random(256)),
        Math.floor(sketch.random(256)),
        Math.floor(sketch.random(256))
      );
    } else {
      sketch.tint(255);
    }
  };

  sketch.draw = () => {
    sketch.background(190, 120, 12);
    if (grid.finished) {
      sketch.noLoop();
    } else {
      grid.step();
    }
    grid.draw();
  };

  sketch.keyPressed = (e: KeyboardEvent) => {
    if (e.key === " ") {
      sketch.setup();
      sketch.loop();
    }
    if (e.key === "c") {
      tint = !tint;
      sketch.setup();
      sketch.loop();
    }
  };
});

class Cell {
  #possibilities: Set<TileConfig>;
  #image?: p5.Image;

  constructor(tileset: Tileset) {
    this.#possibilities = new Set([...tileset.tiles]);
  }

  constrain(otherCell: Cell, edge: Edge): boolean {
    if (this.isCollapsed()) return false;

    let hasBeenReduced = false;
    [...this.#possibilities].forEach((possibility) => {
      const couldWork = [...otherCell.possibilities()].some((config) =>
        this.connectsTo(possibility, config, edge)
      );
      if (!couldWork) {
        this.#possibilities.delete(possibility);
        hasBeenReduced = true;
      }
    });

    return hasBeenReduced;
  }

  connectsTo(config: TileConfig, otherConfig: TileConfig, edge: Edge): boolean {
    // TODO: rotations??
    const [start, middle, end] = config.sockets[edge];
    const [otherStart, otherMiddle, otherEnd] =
      otherConfig.sockets[(edge + 2) % 4];
    return start === otherEnd && middle === otherMiddle && end === otherStart;
  }

  entropy(): number {
    return this.#possibilities.size - 1;
  }

  collapse() {
    const final: TileConfig = instance.random([...this.#possibilities]);
    this.#possibilities = new Set([final]);
    return this;
  }

  isCollapsed() {
    return this.entropy() === 0;
  }

  image() {
    if (!this.isCollapsed()) throw new Error("NOT COLLAPSED!");

    if (!this.#image) {
      const [config] = [...this.#possibilities];
      this.#image = instance.loadImage(`../tilesets/${SET}/${config.image}`);
    }

    return this.#image!;
  }

  possibilities() {
    return this.#possibilities;
  }
}

class Grid {
  #tileset: Tileset;
  #cells: Cell[][];
  finished: boolean = false;

  constructor(instance: p5, tileset: Tileset) {
    this.#tileset = tileset;
    this.#cells = new Array(HEIGHT)
      .fill(null)
      .map((_) => new Array(WIDTH).fill(null).map((_) => new Cell(tileset)));

    const x = Math.floor(instance.random(WIDTH));
    const y = Math.floor(instance.random(HEIGHT));
    const initial = this.get(x, y).collapse();
    this.propagate({ x, y, cell: initial });
  }

  propagate(entry: Entry) {
    // TODO: propagate from entry rather than iterating entire grid

    let constrained;
    do {
      constrained = false;
      this.#cells.forEach((row, y) => {
        row.forEach((cell, x) => {
          // if (cell.isCollapsed()) return;

          const top = y > 0 ? this.get(x, y - 1) : null;
          const right = x < WIDTH - 1 ? this.get(x + 1, y) : null;
          const bottom = y < HEIGHT - 1 ? this.get(x, y + 1) : null;
          const left = x > 0 ? this.get(x - 1, y) : null;

          if (top) {
            constrained ||= cell.constrain(top, Edge.TOP);
          }
          if (right) {
            constrained ||= cell.constrain(right, Edge.RIGHT);
          }
          if (bottom) {
            constrained ||= cell.constrain(bottom, Edge.BOTTOM);
          }
          if (left) {
            constrained ||= cell.constrain(left, Edge.LEFT);
          }
        });
      });
    } while (constrained);
  }

  findNextLowestEntropy(): Entry {
    let cellX = 0;
    let cellY = 0;
    let entropy = Infinity;

    this.#cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.isCollapsed()) return;

        const e = cell.entropy();
        if (e < entropy) {
          entropy = e;
          cellX = x;
          cellY = y;
        }
      });
    });

    return { cell: this.get(cellX, cellY), x: cellX, y: cellY };
  }

  step() {
    const next = this.findNextLowestEntropy();
    if (next.cell.isCollapsed()) {
      this.finished = true;
      return;
    }

    next.cell.collapse();
    this.propagate(next);
  }

  get(x: number, y: number) {
    return this.#cells[y][x];
  }

  draw(buff?: p5.Graphics) {
    const canvas = buff ?? instance;
    this.#cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (!cell.isCollapsed()) return;
        canvas.image(
          cell.image(),
          x * this.#tileset.size,
          y * this.#tileset.size
        );
      });
    });
  }
}
