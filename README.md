# Ops Copilot

Local-first Manifest V3 Chrome extension for operational work tracking, terminal commands, voice capture, focus sessions, browser context capture, shift-aware planning, reports, and optional OpenAI assistance.

## Quick Start

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

Load the built extension from `dist`:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select this project’s `dist` folder.

## Main Surfaces

- `sidepanel.html`: compact operational workspace.
- `dashboard.html`: full dashboard/options view.
- `background.js`: MV3 service worker for storage access, side panel opening, alarms, notifications, AI/voice calls, context menus, and privileged runtime messages.
- `content.js`: Shadow DOM floating launcher injected into supported pages.

## OpenAI

AI and voice are optional. Add an OpenAI API key in Settings. The key is stored in `chrome.storage.local`, access is restricted to trusted extension contexts, and content scripts only communicate through the background worker.

Default models:

- Text and command interpretation: `gpt-5.4-mini`
- Performance reports: `gpt-5.5`
- Transcription: `gpt-4o-mini-transcribe`

## Notes

- Data is stored locally in IndexedDB through Dexie.
- Reminders and focus completions use `chrome.alarms` so they survive MV3 service worker sleep.
- CSV, Excel, Markdown, and TXT exports are implemented. PDF remains future scope per the spec.
