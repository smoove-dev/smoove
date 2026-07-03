import "@smoove/player";
import "@smoove/player/styles.css";
import type { SmoovePlayer } from "@smoove/player";
import comp from "./composition";

const player = document.querySelector<SmoovePlayer>("smoove-player");
if (player) player.composition = comp;
