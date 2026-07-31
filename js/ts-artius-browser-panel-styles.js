export const tsPanelStyles = `<style>
                :host {
                    display: flex;
                    flex: 1 1 auto;
                    min-height: 0;
                    height: 100%;
                    color: var(--input-text, var(--fg-color, inherit));
                    font-family: var(--font-family, "Segoe UI", sans-serif);
                    --ts-accent: var(--p-button-primary-background, var(--theme-color, var(--input-text, var(--fg-color, currentColor))));
                    --ts-accent-contrast: var(--p-button-primary-color, var(--comfy-menu-bg, var(--bg-color, inherit)));
                    --ts-bg-0: var(--comfy-menu-bg, var(--bg-color, transparent));
                    --ts-bg-1: var(--comfy-input-bg, var(--comfy-menu-secondary-bg, var(--ts-bg-0)));
                    --ts-bg-2: var(--content-bg, var(--comfy-input-bg, var(--ts-bg-1)));
                    --ts-text: var(--input-text, var(--fg-color, inherit));
                    --ts-bg-3: color-mix(in srgb, var(--ts-text) 5%, var(--ts-bg-0));
                    --ts-border: var(--border-color, color-mix(in srgb, var(--ts-text) 14%, transparent));
                    --ts-muted: var(--descrip-text, color-mix(in srgb, var(--ts-text) 72%, transparent));
                    --ts-shadow-color: color-mix(in srgb, var(--ts-bg-0) 72%, black);
                    --ts-shadow: 0 4px 18px color-mix(in srgb, var(--ts-shadow-color) 22%, transparent);
                    --ts-surface-ghost: color-mix(in srgb, var(--ts-text) 4%, transparent);
                    --ts-surface-soft: color-mix(in srgb, var(--ts-bg-0) 68%, var(--ts-bg-2));
                    --ts-surface-overlay: color-mix(in srgb, var(--ts-bg-0) 72%, transparent);
                    --ts-surface-overlay-strong: color-mix(in srgb, var(--ts-bg-0) 82%, transparent);
                    --ts-surface-overlay-soft: color-mix(in srgb, var(--ts-bg-0) 58%, transparent);
                    --ts-folder-icon: var(--ts-muted);
                    --ts-progress-track: color-mix(in srgb, var(--ts-text) 10%, transparent);
                    --ts-progress-glow: color-mix(in srgb, var(--ts-accent) 72%, var(--ts-text));
                    --ts-card-overlay-top: color-mix(in srgb, var(--ts-bg-0) 16%, transparent);
                    --ts-card-overlay-bottom: color-mix(in srgb, var(--ts-bg-0) 88%, transparent);
                    --ts-danger: color-mix(in srgb, #d24b4b 72%, var(--ts-text));
                    --ts-danger-surface: color-mix(in srgb, #d24b4b 18%, var(--ts-bg-2));
                    --ts-danger-surface-hover: color-mix(in srgb, #d24b4b 26%, var(--ts-bg-2));
                }

                .ts-shell {
                    flex: 1 1 auto;
                    min-height: 0;
                    height: 100%;
                    display: grid;
                    grid-template-rows: auto 1fr;
                    background: var(--ts-bg-0);
                }

                .ts-shell:focus-visible {
                    outline: 2px solid var(--ts-accent);
                    outline-offset: -2px;
                }

                .ts-filter-panel {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 10px;
                    border-top: 1px solid var(--ts-border);
                    background: var(--ts-surface-ghost);
                }

                .ts-filter-panel[data-open="false"] {
                    display: none;
                }

                .ts-filter-field {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .ts-filter-label {
                    font-size: 11px;
                    color: var(--ts-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .ts-filter-dash {
                    color: var(--ts-muted);
                }

                .ts-filter-panel input {
                    background: var(--ts-bg-2);
                    color: var(--ts-text);
                    border: 1px solid var(--ts-border);
                    border-radius: 6px;
                    padding: 3px 6px;
                    font: inherit;
                    font-size: 12px;
                }

                .ts-filter-panel input[type="number"] {
                    width: 68px;
                }

                .ts-filter-clear {
                    appearance: none;
                    border: 1px solid var(--ts-border);
                    background: var(--ts-bg-2);
                    color: var(--ts-text);
                    border-radius: 7px;
                    padding: 4px 12px;
                    font: inherit;
                    font-size: 12px;
                    cursor: pointer;
                }

                .ts-filter-clear:hover {
                    border-color: var(--ts-accent);
                }

                .ts-context-menu {
                    position: absolute;
                    z-index: 40;
                    min-width: 168px;
                    padding: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    border: 1px solid var(--ts-border);
                    border-radius: 10px;
                    background: var(--ts-surface-overlay-strong);
                    backdrop-filter: blur(10px);
                    box-shadow: var(--ts-shadow);
                }

                .ts-context-menu[data-open="false"] {
                    display: none;
                }

                .ts-context-item {
                    appearance: none;
                    border: 0;
                    background: transparent;
                    color: var(--ts-text);
                    text-align: left;
                    font: inherit;
                    font-size: 12px;
                    padding: 7px 10px;
                    border-radius: 7px;
                    cursor: pointer;
                }

                .ts-context-item:hover:not(:disabled),
                .ts-context-item:focus-visible {
                    background: color-mix(in srgb, var(--ts-accent) 18%, transparent);
                    outline: none;
                }

                .ts-context-item[data-danger="true"] {
                    color: var(--ts-danger);
                }

                .ts-context-item[data-danger="true"]:hover:not(:disabled) {
                    background: var(--ts-danger-surface);
                }

                .ts-context-item:disabled {
                    opacity: 0.4;
                    cursor: default;
                }

                .ts-shortcuts {
                    position: absolute;
                    inset: 0;
                    z-index: 60;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    background: color-mix(in srgb, var(--ts-bg-0) 55%, transparent);
                    backdrop-filter: blur(3px);
                }

                .ts-shortcuts[data-open="false"] {
                    display: none;
                }

                .ts-shortcuts-panel {
                    width: min(440px, 100%);
                    max-height: 100%;
                    overflow: auto;
                    border: 1px solid var(--ts-border);
                    border-radius: 14px;
                    background: var(--ts-bg-1);
                    box-shadow: var(--ts-shadow);
                }

                .ts-shortcuts-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--ts-border);
                }

                .ts-shortcuts-head h3 {
                    margin: 0;
                    font-size: 13px;
                    font-weight: 600;
                }

                .ts-shortcuts-close {
                    appearance: none;
                    border: 0;
                    background: transparent;
                    color: var(--ts-muted);
                    font-size: 20px;
                    line-height: 1;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 6px;
                }

                .ts-shortcuts-close:hover {
                    color: var(--ts-text);
                    background: var(--ts-surface-ghost);
                }

                .ts-shortcuts-body {
                    padding: 8px 16px 16px;
                    display: grid;
                    gap: 14px;
                }

                .ts-shortcuts-section h4 {
                    margin: 8px 0 6px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--ts-muted);
                }

                .ts-shortcuts-row {
                    display: grid;
                    grid-template-columns: 108px 1fr;
                    gap: 10px;
                    align-items: baseline;
                    padding: 3px 0;
                    font-size: 12px;
                }

                .ts-shortcuts-row kbd {
                    justify-self: start;
                    padding: 2px 7px;
                    border: 1px solid var(--ts-border);
                    border-bottom-width: 2px;
                    border-radius: 6px;
                    background: var(--ts-bg-2);
                    font: 600 11px/1.4 "Cascadia Code", "Consolas", monospace;
                    color: var(--ts-text);
                }

                .ts-toolbar {
                    display: grid;
                    gap: 6px;
                    padding: 10px;
                    border-bottom: 1px solid var(--ts-border);
                    background: var(--ts-bg-1);
                }

                .ts-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                }

                .ts-title-link {
                    color: inherit;
                    text-decoration: none;
                }

                .ts-title-link:hover {
                    text-decoration: underline;
                }

                .ts-donate {
                    display: inline-flex;
                    align-items: center;
                    padding: 1px 7px;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    background: #8b7fc4;
                    color: #ffffff;
                    font-size: 10px;
                    font-weight: 500;
                    letter-spacing: 0.02em;
                    text-decoration: none;
                    transition: background 0.14s ease, transform 0.06s ease;
                }

                .ts-donate:hover {
                    background: #7a6db3;
                    text-decoration: none;
                }

                .ts-donate:active {
                    transform: translateY(1px);
                }

                .ts-version {
                    display: inline-flex;
                    align-items: center;
                    font-size: 10px;
                    font-weight: 500;
                    letter-spacing: 0.02em;
                    color: inherit;
                    opacity: 0.55;
                    user-select: text;
                }

                .ts-version[hidden] {
                    display: none;
                }

                .ts-update-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 1px 7px;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    background: #5fa14f;
                    color: #ffffff;
                    font-size: 10px;
                    font-weight: 500;
                    letter-spacing: 0.02em;
                    text-decoration: none;
                    transition: background 0.14s ease, transform 0.06s ease;
                }

                .ts-update-badge:hover {
                    background: #4f8a40;
                    text-decoration: none;
                }

                .ts-update-badge:active {
                    transform: translateY(1px);
                }

                .ts-update-badge[hidden] {
                    display: none;
                }

                .ts-toolbar-main {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .ts-toolbar-cluster {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                    min-height: 32px;
                    padding: 3px;
                    border: 1px solid var(--ts-border);
                    border-radius: 10px;
                    background: color-mix(in srgb, var(--ts-bg-2) 78%, transparent);
                }

                .ts-toolbar-main-wrap {
                    overflow: hidden;
                }

                .ts-toolbar-main-wrap > .ts-toolbar-main {
                    transform: scale(var(--ts-toolbar-scale, 1));
                    transform-origin: top left;
                    width: calc(100% / var(--ts-toolbar-scale, 1));
                }

                .ts-toolbar-resizer {
                    position: relative;
                    height: 6px;
                    margin-top: -2px;
                    cursor: row-resize;
                    background: transparent;
                    transition: background 0.14s ease;
                    touch-action: none;
                    user-select: none;
                }

                .ts-toolbar-resizer::after {
                    content: "";
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: 32px;
                    height: 2px;
                    border-radius: 999px;
                    background: var(--ts-border);
                    opacity: 0;
                    transition: opacity 0.14s ease, background 0.14s ease;
                }

                .ts-toolbar-resizer:hover::after,
                .ts-toolbar-resizer[data-dragging="true"]::after {
                    opacity: 1;
                    background: var(--ts-accent);
                }

                .ts-type-chips {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .ts-section-button {
                    min-width: 84px;
                }

                .ts-root-select,
                .ts-sort-select,
                .ts-sort-direction {
                    appearance: none;
                    -webkit-appearance: none;
                    font: inherit;
                    cursor: pointer;
                    padding: 0 28px 0 10px;
                    border-radius: 8px;
                    color: var(--ts-text);
                    background: transparent;
                    background-image:
                        linear-gradient(45deg, transparent 50%, var(--ts-muted) 50%),
                        linear-gradient(135deg, var(--ts-muted) 50%, transparent 50%);
                    background-position:
                        calc(100% - 14px) calc(50% - 2px),
                        calc(100% - 9px) calc(50% - 2px);
                    background-size: 5px 5px, 5px 5px;
                    background-repeat: no-repeat;
                }

                .ts-sort-select,
                .ts-sort-direction {
                    padding: 0 20px 0 10px;
                    background-position:
                        calc(100% - 11px) calc(50% - 2px),
                        calc(100% - 6px) calc(50% - 2px);
                }

                .ts-sort-group {
                    gap: 3px;
                }

                .ts-root-select option,
                .ts-sort-select option {
                    color: var(--ts-text);
                    background: var(--ts-bg-1);
                }

                .ts-root-select::-ms-expand,
                .ts-sort-select::-ms-expand {
                    display: none;
                }

                .ts-toolbar-cluster button,
                .ts-toolbar-cluster select,
                .ts-type-chips .ts-chip,
                .ts-sort-group button,
                .ts-sort-group select,
                .ts-mode-group .ts-mode-button {
                    min-height: 26px;
                    border-color: transparent;
                    background: transparent;
                    box-shadow: none;
                }

                .ts-toolbar-cluster button:hover,
                .ts-toolbar-cluster select:hover,
                .ts-type-chips .ts-chip:hover,
                .ts-sort-group button:hover,
                .ts-sort-group select:hover,
                .ts-mode-group .ts-mode-button:hover {
                    border-color: color-mix(in srgb, var(--ts-accent) 52%, transparent);
                    background: color-mix(in srgb, var(--ts-bg-3) 70%, transparent);
                }
                .ts-toggle-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    min-height: 32px;
                    padding: 0 12px;
                    border: 1px solid var(--ts-border);
                    border-radius: 999px;
                    background: var(--ts-bg-2);
                    color: var(--ts-muted);
                    user-select: none;
                    font-size: 12px;
                }

                .ts-toggle-button::before {
                    content: "";
                    width: 10px;
                    height: 10px;
                    flex: 0 0 10px;
                    border-radius: 999px;
                    background: color-mix(in srgb, var(--ts-text) 24%, transparent);
                    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ts-text) 10%, transparent);
                    transition: background 0.14s ease;
                }

                .ts-toggle-button[data-active="true"] {
                    border-color: color-mix(in srgb, var(--ts-accent) 58%, transparent);
                    color: var(--ts-accent-contrast);
                    background: color-mix(in srgb, var(--ts-accent) 22%, var(--ts-bg-2));
                }

                .ts-toggle-button[data-active="true"]::before {
                    background: var(--ts-accent);
                }

                .ts-rebuild-cache {
                    border-color: color-mix(in srgb, var(--ts-danger) 52%, var(--ts-border));
                    background: var(--ts-danger-surface);
                    color: var(--ts-text);
                }

                .ts-rebuild-cache:hover {
                    border-color: color-mix(in srgb, var(--ts-danger) 72%, transparent);
                    background: var(--ts-danger-surface-hover);
                }

                .ts-search {
                    min-width: 180px;
                    flex: 1 1 220px;
                }

                /* The prompt-scope toggle sits INSIDE the search field's right
                   edge. As a normal cluster child it wrapped onto a second row
                   in a narrow sidebar, leaving the search field taller than
                   every neighbouring control. The cluster therefore drops its
                   own chrome and only positions the toggle; the field keeps the
                   shared 32px control height. */
                .ts-search-cluster {
                    position: relative;
                    flex: 1 1 220px;
                    min-width: 150px;
                    padding: 0;
                    border: 0;
                    background: transparent;
                    flex-wrap: nowrap;
                }

                .ts-search-cluster .ts-search {
                    flex: 1 1 auto;
                    width: 100%;
                    min-width: 0;
                    /* Reserve exactly the toggle's measured width (set from JS
                       so the reservation follows the translated label). */
                    padding-right: calc(var(--ts-search-scope-inset, 0px) + 10px);
                }

                .ts-toolbar-cluster.ts-search-cluster .ts-search-scope {
                    position: absolute;
                    top: 50%;
                    right: 4px;
                    transform: translateY(-50%);
                    min-height: 22px;
                    height: 22px;
                    padding: 0 9px;
                    gap: 5px;
                    border: 1px solid var(--ts-border);
                    border-radius: 999px;
                    background: var(--ts-bg-3);
                    font-size: 11px;
                    line-height: 1;
                    white-space: nowrap;
                }

                .ts-toolbar-cluster.ts-search-cluster .ts-search-scope::before {
                    width: 7px;
                    height: 7px;
                    flex: 0 0 7px;
                }

                .ts-toolbar-cluster.ts-search-cluster .ts-search-scope:hover {
                    border-color: color-mix(in srgb, var(--ts-accent) 52%, transparent);
                }

                .ts-toolbar-cluster.ts-search-cluster .ts-search-scope[data-active="true"] {
                    border-color: color-mix(in srgb, var(--ts-accent) 58%, transparent);
                    background: color-mix(in srgb, var(--ts-accent) 24%, var(--ts-bg-2));
                    color: var(--ts-accent-contrast);
                }

                .ts-search,
                select,
                input[type="search"] {
                    color: inherit;
                    background: var(--ts-bg-2);
                    border: 1px solid var(--ts-border);
                    border-radius: 8px;
                    padding: 7px 10px;
                    min-height: 32px;
                    outline: none;
                }

                input[type="range"] {
                    accent-color: var(--ts-accent);
                }

                button,
                .ts-chip {
                    border: 1px solid var(--ts-border);
                    border-radius: 8px;
                    min-height: 32px;
                    padding: 6px 10px;
                    color: inherit;
                    background: var(--ts-bg-2);
                    cursor: pointer;
                    transition: border-color 0.14s ease, background 0.14s ease, opacity 0.14s ease;
                }

                button:hover,
                .ts-chip:hover {
                    border-color: var(--ts-accent);
                }

                button[disabled] {
                    opacity: 0.5;
                    cursor: default;
                }

                .ts-chip[data-active="true"],
                .ts-section-button[data-active="true"],
                .ts-mode-button[data-active="true"] {
                    background: color-mix(in srgb, var(--ts-accent) 20%, var(--ts-bg-2));
                    border-color: var(--ts-accent);
                    color: var(--ts-accent-contrast);
                }

                .ts-status,
                .ts-health,
                .ts-tree-count {
                    color: var(--ts-muted);
                    font-size: 12px;
                }

                /* Missing ffmpeg/ffprobe is not a passing note — it silently
                   disables every video/audio preview, so it reads as a warning
                   chip with an actionable tooltip. */
                .ts-health[data-state="warning"] {
                    display: inline-flex;
                    align-items: center;
                    margin-top: 4px;
                    padding: 3px 10px;
                    border: 1px solid color-mix(in srgb, var(--ts-danger) 45%, transparent);
                    border-radius: 999px;
                    background: var(--ts-danger-surface);
                    color: var(--ts-text);
                    cursor: help;
                }

                .ts-health[hidden] {
                    display: none;
                }

                .ts-progress {
                    display: none;
                    gap: 6px;
                }

                .ts-progress[data-visible="true"] {
                    display: grid;
                }

                .ts-progress-track {
                    position: relative;
                    height: 6px;
                    border-radius: 999px;
                    background: var(--ts-progress-track);
                    overflow: hidden;
                }

                .ts-progress-fill {
                    position: absolute;
                    inset: 0 auto 0 0;
                    width: 0%;
                    border-radius: inherit;
                    background: linear-gradient(90deg, var(--ts-progress-glow), var(--ts-accent));
                    transition: width 0.16s ease;
                }

                .ts-progress[data-indeterminate="true"] .ts-progress-fill {
                    width: 34%;
                    animation: ts-progress-indeterminate 1.15s ease-in-out infinite;
                }

                .ts-progress-caption {
                    color: var(--ts-muted);
                    font-size: 11px;
                }

                @keyframes ts-progress-indeterminate {
                    0% { transform: translateX(-120%); }
                    100% { transform: translateX(340%); }
                }

                .ts-body {
                    min-height: 0;
                    display: grid;
                    grid-template-columns: var(--ts-tree-width, 220px) 4px 1fr;
                }

                .ts-body[data-mode="flat"] {
                    grid-template-columns: 1fr;
                }

                .ts-tree-panel {
                    border-right: 1px solid var(--ts-border);
                    overflow: auto;
                    padding: 10px 8px;
                    background: var(--ts-bg-1);
                }

                .ts-body[data-mode="flat"] .ts-tree-panel {
                    display: none;
                }

                .ts-tree-resizer {
                    position: relative;
                    cursor: col-resize;
                    background: transparent;
                    user-select: none;
                    touch-action: none;
                    transition: background 0.14s ease;
                }

                .ts-tree-resizer::after {
                    content: "";
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: -3px;
                    right: -3px;
                }

                .ts-tree-resizer:hover,
                .ts-tree-resizer[data-dragging="true"] {
                    background: color-mix(in srgb, var(--ts-accent) 60%, transparent);
                }

                .ts-body[data-mode="flat"] .ts-tree-resizer {
                    display: none;
                }

                .ts-tree-row {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding-left: calc(var(--ts-depth, 0) * 12px);
                    margin-bottom: 2px;
                }

                .ts-tree-toggle {
                    width: 16px;
                    min-height: 16px;
                    padding: 0;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    font-size: 11px;
                    color: var(--ts-muted);
                    opacity: 0.9;
                }

                .ts-tree-toggle:hover {
                    border: 0;
                    background: transparent;
                    color: inherit;
                }

                .ts-tree-toggle-spacer {
                    width: 16px;
                    flex: 0 0 16px;
                }

                .ts-tree-name {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .ts-tree-name::before {
                    content: "";
                    width: 13px;
                    height: 13px;
                    flex: 0 0 13px;
                    opacity: 0.92;
                    background-color: var(--ts-folder-icon);
                    mask: no-repeat center / contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'%3E%3Cpath d='M3.75 7.5a2.25 2.25 0 0 1 2.25-2.25h4.09a2.25 2.25 0 0 1 1.59.66l1.06 1.06a2.25 2.25 0 0 0 1.59.66H18a2.25 2.25 0 0 1 2.25 2.25v6.75A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25V7.5Z'/%3E%3C/svg%3E");
                    -webkit-mask: no-repeat center / contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'%3E%3Cpath d='M3.75 7.5a2.25 2.25 0 0 1 2.25-2.25h4.09a2.25 2.25 0 0 1 1.59.66l1.06 1.06a2.25 2.25 0 0 0 1.59.66H18a2.25 2.25 0 0 1 2.25 2.25v6.75A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25V7.5Z'/%3E%3C/svg%3E");
                }

                .ts-tree-folder {
                    flex: 1 1 auto;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    min-height: 26px;
                    border-radius: 7px;
                    border: 1px solid transparent;
                    background: transparent;
                    padding: 3px 6px;
                    text-align: left;
                }

                .ts-tree-folder[data-active="true"] {
                    background: var(--ts-bg-3);
                    border-color: var(--ts-accent);
                }

                .ts-gallery-wrap {
                    min-height: 0;
                    position: relative;
                    background: var(--ts-bg-0);
                }

                .ts-gallery-scroll {
                    position: absolute;
                    inset: 0;
                    overflow: auto;
                }

                .ts-gallery-spacer {
                    position: relative;
                    width: 100%;
                }

                .ts-gallery-content {
                    position: absolute;
                    inset: 0 auto auto 0;
                    width: 100%;
                }

                /* One-shot entrance when a fresh list replaces skeletons. Only
                   opacity/transform animate (no layout thrash); the flag is
                   cleared after the animation so scrolling never re-triggers it. */
                @keyframes ts-grid-enter {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: none; }
                }

                .ts-gallery-content[data-entering="true"] {
                    animation: ts-grid-enter 0.22s ease both;
                }

                @keyframes ts-skeleton-shimmer {
                    0% { background-position: -160% 0; }
                    100% { background-position: 160% 0; }
                }

                .ts-card {
                    position: absolute;
                    border-radius: var(--ts-card-radius, 10px);
                    border: 1px solid var(--ts-border);
                    background: var(--ts-bg-1);
                    box-shadow: none;
                    overflow: hidden;
                    /* No transform transition: cards are recreated wholesale by
                       the virtualized renderer rather than moved, so it never
                       animated anything. */
                    transition: border-color 0.14s ease, box-shadow 0.14s ease;
                    user-select: none;
                    /* Skip painting cards scrolled out of view (perf on big libraries). */
                    content-visibility: auto;
                    contain-intrinsic-size: var(--ts-card-preview-height, 220px);
                }

                .ts-card-skeleton {
                    cursor: default;
                    pointer-events: none;
                }

                .ts-card-skeleton .ts-card-media {
                    cursor: default;
                    background-image: linear-gradient(
                        100deg,
                        var(--ts-bg-2) 30%,
                        color-mix(in srgb, var(--ts-text) 8%, var(--ts-bg-2)) 50%,
                        var(--ts-bg-2) 70%
                    );
                    background-size: 220% 100%;
                    animation: ts-skeleton-shimmer 1.15s ease-in-out infinite;
                }

                @media (prefers-reduced-motion: reduce) {
                    .ts-gallery-content[data-entering="true"] { animation: none; }
                    .ts-card-skeleton .ts-card-media { animation: none; }
                }

                /* No transform here: virtualized cards carry an inline
                   transform:translate(...) for positioning, and an inline
                   declaration always beats a selector-based one. A hover
                   transform silently never applied - and forcing it with
                   !important would throw the card out of its grid slot.
                   Border and shadow carry the hover affordance instead. */
                .ts-card:hover {
                    border-color: color-mix(in srgb, var(--ts-accent) 70%, var(--ts-border));
                    box-shadow: 0 8px 24px color-mix(in srgb, var(--ts-shadow-color) 34%, transparent);
                }

                .ts-card[data-selected="true"] {
                    border-color: var(--ts-accent);
                }

                .ts-card-media {
                    position: relative;
                    background: var(--ts-bg-2);
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: var(--ts-card-preview-height, 220px);
                    cursor: pointer;
                }

                .ts-card-media::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, var(--ts-card-overlay-top) 0%, transparent 34%, var(--ts-card-overlay-bottom) 100%);
                    opacity: 0;
                    transition: opacity 0.14s ease;
                    pointer-events: none;
                }

                .ts-card:hover .ts-card-media::after,
                .ts-card[data-selected="true"] .ts-card-media::after {
                    opacity: 1;
                }

                .ts-card-media img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }

                .ts-card-media img.ts-workflow-preview {
                    object-fit: cover;
                }

                .ts-card-media video {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }

                .ts-card-media video.ts-workflow-preview {
                    object-fit: cover;
                }

                .ts-card-placeholder {
                    display: grid;
                    place-items: center;
                    width: 100%;
                    height: 100%;
                    color: var(--ts-muted);
                    padding: 14px;
                    text-align: center;
                    font-size: 16px;
                    line-height: 1.25;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                    word-break: break-word;
                    overflow-wrap: anywhere;
                }
                .ts-card-actions {
                    position: absolute;
                    top: var(--ts-card-inset, 8px);
                    right: var(--ts-card-inset, 8px);
                    display: flex;
                    gap: var(--ts-card-action-gap, 4px);
                    opacity: 0;
                    transform: translateY(-2px);
                    transition: opacity 0.14s ease, transform 0.14s ease;
                    z-index: 2;
                }

                .ts-card:hover .ts-card-actions,
                .ts-card[data-selected="true"] .ts-card-actions {
                    opacity: 1;
                    transform: translateY(0);
                }
                .ts-card-actions button {
                    min-height: var(--ts-card-action-size, 22px);
                    width: var(--ts-card-action-size, 22px);
                    padding: 0;
                    border-radius: var(--ts-card-action-radius, 5px);
                    background: var(--ts-surface-overlay-strong);
                    font-size: var(--ts-card-action-font-size, 10px);
                    font-weight: 700;
                }

                /* Top-left star, opposite the hover action cluster. Unlike those
                   actions it stays visible once set, so a starred asset reads
                   as starred at a glance while scrolling. */
                .ts-card-favorite {
                    position: absolute;
                    top: var(--ts-card-inset, 8px);
                    left: var(--ts-card-inset, 8px);
                    min-height: var(--ts-card-action-size, 22px);
                    width: var(--ts-card-action-size, 22px);
                    padding: 0;
                    border: 0;
                    border-radius: 999px;
                    background: var(--ts-surface-overlay-strong);
                    color: color-mix(in srgb, var(--ts-text) 55%, transparent);
                    font-size: calc(var(--ts-card-action-font-size, 10px) + 2px);
                    line-height: 1;
                    opacity: 0;
                    transition: opacity 0.14s ease, color 0.14s ease, transform 0.06s ease;
                    z-index: 2;
                }

                .ts-card:hover .ts-card-favorite,
                .ts-card[data-selected="true"] .ts-card-favorite,
                .ts-card-favorite[data-favorite="true"] {
                    opacity: 1;
                }

                .ts-card-favorite[data-favorite="true"] {
                    color: #f2c14e;
                }

                .ts-card-favorite:hover {
                    color: #f2c14e;
                    border-color: transparent;
                }

                .ts-card-favorite:active {
                    transform: scale(0.92);
                }

                .ts-card-badges {
                    position: absolute;
                    left: var(--ts-card-inset, 8px);
                    bottom: var(--ts-card-inset, 8px);
                    display: flex;
                    align-items: center;
                    gap: var(--ts-card-action-gap, 4px);
                    flex-wrap: wrap;
                    z-index: 2;
                    pointer-events: none;
                }

                .ts-card-badge {
                    padding: var(--ts-card-badge-pad-y, 3px) var(--ts-card-badge-pad-x, 6px);
                    border-radius: var(--ts-card-badge-radius, 5px);
                    background: var(--ts-surface-overlay-strong);
                    font-size: var(--ts-card-badge-font-size, 10px);
                    line-height: 1.1;
                    white-space: nowrap;
                }

                .ts-card-badge[data-kind="meta"] {
                    background: var(--ts-surface-overlay-soft);
                }

                .ts-card-badge[data-kind="workflow-folder"] {
                    background: var(--ts-surface-overlay-soft);
                    max-width: calc(100% - (var(--ts-card-inset, 8px) * 2));
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .ts-empty {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    place-items: center;
                    /* The overlay itself must not swallow grid interaction; only
                       the action button inside it is clickable. */
                    pointer-events: none;
                    color: var(--ts-muted);
                    text-align: center;
                    padding: 24px;
                    font-size: 12px;
                }

                .ts-empty-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    max-width: 420px;
                }

                .ts-empty-title {
                    margin: 0;
                    color: var(--ts-text);
                    font-size: 13px;
                    font-weight: 600;
                }

                .ts-empty-line {
                    margin: 0;
                    line-height: 1.45;
                }

                .ts-empty-action {
                    margin-top: 8px;
                    pointer-events: auto;
                    max-width: 100%;
                    padding: 6px 14px;
                    /* Not a pill: in a narrow sidebar the label wraps to two or
                       three lines, and a 999px radius turns it into a blob. */
                    border-radius: 8px;
                    font-size: 12px;
                    line-height: 1.35;
                }

                @media (max-width: 960px) {
                    .ts-body {
                        grid-template-columns: 1fr;
                    }

                    .ts-tree-panel {
                        max-height: 200px;
                        border-right: 0;
                        border-bottom: 1px solid var(--ts-border);
                    }

                    .ts-tree-resizer {
                        display: none;
                    }
                }
            </style>`;
