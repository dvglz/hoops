import "./style.css";
import { DEFAULT_SETTINGS } from "./constants";
import { createDebugPanel } from "./debug";
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

const debugPanelRefs = createDebugPanel(DEFAULT_SETTINGS);
shell.append(debugPanelRefs.root);

const game = new HoopsGame(shell, hudRefs, debugPanelRefs);
game.start();

window.render_game_to_text = () => game.renderGameToText();
window.advanceTime = (milliseconds: number) => game.advanceTime(milliseconds);

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (milliseconds: number) => void;
  }
}
