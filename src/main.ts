import { Tileset, WFC } from "./lib";
import tileset from "../tilesets/outdoor/tileset.json";

const sim = new WFC(tileset as Tileset, { width: 10, height: 10 });
