import { Spritesheet, Model } from "./lib";
// import config from "#/tilesets/outdoor/tileset.json";
import config from "#/tilesets/outdoor-sprite-slim/spritesheet.json";

const _ = new Model({
  ...config,
  path: "../tilesets/outdoor-sprite-slim",
} as Spritesheet);
