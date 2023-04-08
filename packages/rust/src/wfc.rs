use rand::seq::SliceRandom;
use serde::Deserialize;
use std::collections::HashSet;

enum Edge {
    Top,
    Right,
    Bottom,
    Left,
}

#[derive(Eq, Hash, Debug, Deserialize)]
struct Sock(u32);

impl PartialEq for Sock {
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

#[derive(Eq, Hash, Debug, Deserialize)]
pub struct Socket(Sock, Sock, Sock);

impl PartialEq for Socket {
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0 && self.1 == other.1 && self.2 == other.2
    }
}

#[derive(Eq, Hash, Debug, Deserialize)]
pub struct TileConfig {
    image: String,
    sockets: (Socket, Socket, Socket, Socket),
}

impl PartialEq for TileConfig {
    fn eq(&self, other: &Self) -> bool {
        self.image == other.image
    }
}

#[derive(PartialEq, Hash, Debug, Deserialize)]
pub struct Tileset {
    pub size: u32,
    pub tiles: Vec<TileConfig>,
}

pub struct Options {
    pub width: Option<usize>,
    pub height: Option<usize>,
    pub framerate: Option<u32>,
    pub seed: Option<u32>,
}

#[derive(Debug)]
struct Settings {
    width: usize,
    height: usize,
    framerate: Option<u32>,
    seed: Option<u32>,
}

#[derive(Clone, Debug)]
struct Cell<'t> {
    possibilities: HashSet<&'t TileConfig>,
}

impl<'t> Cell<'t> {
    fn new(tileset: &'t Tileset) -> Self {
        Cell {
            possibilities: HashSet::from_iter(tileset.tiles.iter()),
        }
    }

    fn constrain(&mut self, other_cell: &Cell, edge: Edge) -> bool {
        if self.is_collapsed() {
            return false;
        }

        let unreachables: Vec<&'t TileConfig> = self
            .possibilities
            .iter()
            .filter_map(|&possibility| {
                if other_cell
                    .possibilities
                    .iter()
                    .any(|config| Cell::connects_to(possibility, config, &edge))
                {
                    None
                } else {
                    Some(possibility)
                }
            })
            .collect();

        for &poss in &unreachables {
            self.possibilities.remove(poss);
        }

        unreachables.len() > 0
    }

    fn connects_to(config: &'t TileConfig, other: &'t TileConfig, edge: &Edge) -> bool {
        let (Socket(start, mid, end), Socket(other_start, other_mid, other_end)) = match edge {
            Edge::Top => (&config.sockets.0, &other.sockets.2),
            Edge::Right => (&config.sockets.1, &other.sockets.3),
            Edge::Bottom => (&config.sockets.2, &other.sockets.0),
            Edge::Left => (&config.sockets.3, &other.sockets.1),
        };

        start == other_end && mid == other_mid && end == other_start
    }

    fn entropy(&self) -> usize {
        self.possibilities.len() - 1
    }

    fn collapse(&mut self) {
        let mut rng = rand::thread_rng();
        let ps = self.possibilities.clone();
        let collapsed = ps.iter().collect::<Vec<_>>();
        let collapsed = collapsed.choose(&mut rng).unwrap().to_owned();
        self.possibilities = HashSet::new();
        self.possibilities.insert(collapsed);
    }

    fn is_collapsed(&self) -> bool {
        self.entropy() == 0
    }

    fn image() {
        todo!()
    }
}

#[derive(Debug)]
pub struct Grid<'t> {
    tileset: &'t Tileset,
    options: Settings,
    cells: Vec<Vec<Cell<'t>>>,
    finished: bool,
}

impl<'t> Grid<'t> {
    fn new(tileset: &'t Tileset, options: Settings) -> Self {
        let mut cells: Vec<Vec<Cell>> = Vec::new();
        for _ in 0..options.height {
            let mut row = Vec::new();
            for _ in 0..options.width {
                row.push(Cell::new(&tileset));
            }

            cells.push(row);
        }

        Grid {
            tileset,
            options,
            cells,
            finished: false,
        }
    }

    fn propagate(&mut self) {
        loop {
            let mut constrained = false;

            for y in 0..self.options.height {
                for x in 0..self.options.width {
                    let mut cell = self.cells[y][x].clone();

                    if let Some(top) = if y > 0 { self.get(x, y - 1) } else { None } {
                        if cell.constrain(&top, Edge::Top) {
                            constrained = true;
                        }
                    }
                    if let Some(right) = if x < self.options.width - 1 {
                        self.get(x + 1, y)
                    } else {
                        None
                    } {
                        if cell.constrain(right, Edge::Right) {
                            constrained = true;
                        }
                    }
                    if let Some(bottom) = if y < self.options.height - 1 {
                        self.get(x, y + 1)
                    } else {
                        None
                    } {
                        if cell.constrain(bottom, Edge::Bottom) {
                            constrained = true;
                        }
                    }
                    if let Some(left) = if x > 0 { self.get(x - 1, y) } else { None } {
                        if cell.constrain(left, Edge::Left) {
                            constrained = true;
                        }
                    }

                    self.cells[y][x] = cell;
                }
            }

            if !constrained {
                break;
            }
        }
    }

    fn next_lowest_entropy(&mut self) -> Option<&mut Cell<'t>> {
        let mut cell_x = 0;
        let mut cell_y = 0;
        let mut entropy = self.tileset.tiles.len();

        for (y, row) in self.cells.iter().enumerate() {
            for (x, cell) in row.iter().enumerate() {
                if cell.is_collapsed() {
                    continue;
                }

                let e = cell.entropy();
                if e < entropy {
                    entropy = e;
                    cell_x = x;
                    cell_y = y;
                }
            }
        }

        self.get(cell_x, cell_y)
    }

    fn step(&mut self) {
        let next = self.next_lowest_entropy().unwrap();
        if next.is_collapsed() {
            self.finished = true;
            return;
        }

        next.collapse();
        self.propagate();
    }

    fn get(&mut self, x: usize, y: usize) -> Option<&mut Cell<'t>> {
        self.cells.get_mut(y)?.get_mut(x)
    }
}

pub struct Model<'t> {
    tileset: &'t Tileset,
    grid: Grid<'t>,
}

const DEFAULT_WIDTH: usize = 10;
const DEFAULT_HEIGHT: usize = 10;

impl<'t> Model<'t> {
    pub fn new(tileset: &'t Tileset, options: Options) -> Self {
        let settings = Settings {
            width: options.width.unwrap_or(DEFAULT_WIDTH),
            height: options.height.unwrap_or(DEFAULT_HEIGHT),
            framerate: None,
            seed: None,
        };

        let grid = Grid::new(&tileset, settings);

        Model { tileset, grid }
    }

    pub fn run(&mut self) {
        loop {
            self.grid.step();
            if self.grid.finished {
                break;
            }
        }
    }
}
