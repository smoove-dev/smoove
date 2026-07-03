import "@smoove/player";
import "@smoove/player/styles.css";
import type { Composition } from "@smoove/core";
import type { SmoovePlayer } from "@smoove/player";
import comp from "./composition";

const player = document.querySelector<SmoovePlayer>("smoove-player");
// Our composition types its `props` (the slogan); the player's setter is
// declared with the untyped default, so widen the assignment.
if (player) player.composition = comp as unknown as Composition;
