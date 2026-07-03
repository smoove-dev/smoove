import "@smoove/player";
import "@smoove/player/styles.css";
import comp from "./composition";

const player = document.querySelector("smoove-player");
if (player) player.composition = comp;
