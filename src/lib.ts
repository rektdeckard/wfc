import p5 from "p5";

const SET = "outdoor";

enum Edge {
  TOP,
  RIGHT,
  BOTTOM,
  LEFT,
}

export type Socket = [number | string, number | string, number | string];

export type TileConfig = {
  image: string;
  sockets: [Socket, Socket, Socket, Socket];
};

export type Tileset = { size: number; tiles: TileConfig[] };

export type WFCOptions = {
  width?: number;
  height?: number;
  framerate?: number | null;
  tint?: boolean | Parameters<p5["tint"]>;
  seed?: number | undefined;
};

export type WFCSettings = {
  width: number;
  height: number;
  framerate: number | null;
  tint: boolean | Parameters<p5["tint"]>;
  seed: number | undefined;
};

type Entry = { cell: Cell; x: number; y: number };

const DEFAULT_WIDTH = 10;
const DEFAULT_HEIGHT = 10;
const DEFAULT_FRAMERATE = null;
const DEFAULT_TINT = false;

export class WFC {
  instance: p5;
  tint?: boolean | Parameters<p5["tint"]>;

  constructor(tileset: Tileset, options?: WFCOptions) {
    const simOptions: WFCSettings = {
      width: options?.width ?? DEFAULT_WIDTH,
      height: options?.height ?? DEFAULT_HEIGHT,
      framerate: options?.framerate ?? DEFAULT_FRAMERATE,
      tint: options?.tint ?? DEFAULT_TINT,
      seed: options?.seed,
    };

    this.instance = new p5(async (sketch: p5) => {
      const w = tileset.size * simOptions.width;
      const h = tileset.size * simOptions.height;
      let grid: Grid;

      sketch.setup = () => {
        if (simOptions.seed) {
          sketch.randomSeed(simOptions.seed);
        }

        if (simOptions.framerate) {
          sketch.frameRate(simOptions.framerate);
        }

        grid = new Grid(sketch, simOptions, tileset);
        sketch.createCanvas(w, h);

        if (this.tint === true) {
          sketch.tint(
            Math.floor(sketch.random(256)),
            Math.floor(sketch.random(256)),
            Math.floor(sketch.random(256))
          );
        } else if (!!this.tint) {
          sketch.tint(...this.tint!);
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
          this.tint = !this.tint;
          sketch.setup();
          sketch.loop();
        }
      };
    });
  }
}

class Cell {
  #instance: p5;
  #possibilities: Set<TileConfig>;
  #image?: p5.Image;

  constructor(instance: p5, tileset: Tileset) {
    this.#instance = instance;
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
    const final: TileConfig = this.#instance.random([...this.#possibilities]);
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
      this.#image = this.#instance.loadImage(
        `../tilesets/${SET}/${config.image}`
      );
    }

    return this.#image!;
  }

  possibilities() {
    return this.#possibilities;
  }
}

class Grid {
  #instance: p5;
  #options: WFCSettings;
  #tileset: Tileset;
  #cells: Cell[][];
  finished: boolean = false;

  constructor(instance: p5, options: WFCSettings, tileset: Tileset) {
    this.#instance = instance;
    this.#options = options;
    this.#tileset = tileset;
    this.#cells = new Array(options.height)
      .fill(null)
      .map((_) =>
        new Array(options.width)
          .fill(null)
          .map((_) => new Cell(instance, tileset))
      );

    const x = Math.floor(instance.random(options.width));
    const y = Math.floor(instance.random(options.height));
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
          const right = x < this.#options.width - 1 ? this.get(x + 1, y) : null;
          const bottom =
            y < this.#options.height - 1 ? this.get(x, y + 1) : null;
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
    const canvas = buff ?? this.#instance;
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
