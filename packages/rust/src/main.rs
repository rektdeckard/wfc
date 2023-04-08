mod wfc;

use std::{fs, path::Path};
use wfc::{Model, Options};

fn main() {
    let data = fs::read_to_string(Path::new("../../tilesets/outdoor/tileset.json"))
        .expect("Could not read tileset!");

    let tileset = serde_json::from_str(&data).expect("Could not deserialize tileset");

    let mut model = Model::new(
        &tileset,
        Options {
            width: None,
            height: None,
            framerate: None,
            seed: None,
        },
    );

    model.run();
}
