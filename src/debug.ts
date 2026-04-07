import {
  AMBIENCE_OPTIONS,
  BALL_SKIN_OPTIONS,
  type DebugPanelRefs,
  type RuntimeSettings,
} from "./constants";

export function createDebugPanel(initialSettings: RuntimeSettings): DebugPanelRefs {
  const root = document.createElement("div");
  root.className = "debug-panel is-open";
  root.innerHTML = `
    <button class="debug-panel__toggle" type="button" aria-expanded="true">
      Debug
    </button>
    <div class="debug-panel__body">
      <label class="debug-control">
        <span class="debug-control__label">Gravity</span>
        <div class="debug-control__row">
          <input data-gravity-input type="range" min="-28" max="-10" step="0.5" />
          <span class="debug-control__value" data-gravity-value></span>
        </div>
      </label>
      <label class="debug-control">
        <span class="debug-control__label">Ambience</span>
        <select data-ambience-select>
          ${AMBIENCE_OPTIONS.map((option) => `<option value="${option.id}">${option.label}</option>`).join("")}
        </select>
      </label>
      <label class="debug-control">
        <span class="debug-control__label">Ball Skin</span>
        <select data-ball-skin-select>
          ${BALL_SKIN_OPTIONS.map((option) => `<option value="${option.id}">${option.label}</option>`).join("")}
        </select>
      </label>
    </div>
  `;

  const refs: DebugPanelRefs = {
    root,
    toggle: root.querySelector(".debug-panel__toggle") as HTMLButtonElement,
    body: root.querySelector(".debug-panel__body") as HTMLDivElement,
    gravityInput: root.querySelector("[data-gravity-input]") as HTMLInputElement,
    gravityValue: root.querySelector("[data-gravity-value]") as HTMLSpanElement,
    ambienceSelect: root.querySelector("[data-ambience-select]") as HTMLSelectElement,
    ballSkinSelect: root.querySelector("[data-ball-skin-select]") as HTMLSelectElement,
  };

  refs.toggle.addEventListener("click", () => {
    const isOpen = refs.root.classList.toggle("is-open");
    refs.toggle.setAttribute("aria-expanded", String(isOpen));
  });

  syncDebugPanel(refs, initialSettings);
  return refs;
}

export function syncDebugPanel(refs: DebugPanelRefs, settings: RuntimeSettings): void {
  refs.gravityInput.value = settings.gravity.toFixed(1);
  refs.gravityValue.textContent = settings.gravity.toFixed(1);
  refs.ambienceSelect.value = settings.ambience;
  refs.ballSkinSelect.value = settings.ballSkin;
}
