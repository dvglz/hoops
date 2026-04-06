import "./style.css";
import { HoopsGame } from "./game";
import { createHud } from "./hud";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const shell = document.createElement("main");
shell.className = "game-shell";
app.append(shell);

const hudRefs = createHud();
shell.append(hudRefs.root);

const game = new HoopsGame(shell, hudRefs);
game.start();

window.render_game_to_text = () => game.renderGameToText();
window.advanceTime = (milliseconds: number) => game.advanceTime(milliseconds);

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (milliseconds: number) => void;
  }
}
