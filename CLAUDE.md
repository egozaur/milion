# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Always respond to the user in Polish (zawsze odpowiadaj po polsku). UI text and code comments are in Polish.

## Project

"Milion" is a PL3Y quiz-show game: 12 questions up a money ladder to 1 000 000 zł. Mechanics follow the genre (ladder, guaranteed thresholds, lifelines), but the name, look, logo and music are our own; don't copy the branding, studio design or music of any TV show. Static HTML/CSS/JS, no build step, served at `https://pl3y.pl/milion/` (repo `egozaur/milion`, GitHub Pages). There is no Node or Python on the dev machine.

- `index.html`: menu, **solo** game, **multi host** (TV screen) and **ranking**. Loads the shared PL3Y password gate `/auth.js` (404 locally, so no password there).
- `play.html`: player phone for multi (no password gate; access by room code from the QR). Token per room in `localStorage.milion_p_<CODE>` (`milion_pl_<CODE>` in local mode), so rescanning resumes the game. In the home-screen app (`ML.APP`) the header gets „⌂ PL3Y”.
- `ml.js`: shared code (`window.ML`): `LADDER`, `SAFE` (indices 1 and 6 = 1 000 / 40 000 zł), `TIMES`, `DIFFS` (game difficulty `e` Łatwy / `n` Normalny / `x` Ekstremalny → bank tier for each of the 12 questions; Ekstremalny = tier 5 only), `guaranteed()`, question picking (`pickSet(diff)` for one game, `pickPool(diff)` = 3 rounds for multi; answers are shuffled by `mix()`, used ids remembered in `milion_used`), `audienceSim()` (same rule as the server copy), `Conn` (WebSocket with reconnect/heartbeat, or `LocalSocket` in local mode), `api()`, `joinUrl()`, `qrSvg()`, `nick` (`milion_nick`), `Snd` (WebAudio music + SFX, no audio files; settings in `milion_snd`; `Snd.heat(qi)` raises the music intensity with the level).
- `questions.js`: `window.ML_QUESTIONS`, format `{ id, d: 1..5, q, a: [4], ok: 0..3 }` (`d` = tier: bardzo łatwy, łatwy, średni, trudny, ekspercki). **Generated** from the Excel bank (`Desktop/PL3Y/Mlionerzy/baza_milionerzy_polaczona_500_pytan.xlsx`, sheet 1: ID, …, Poziom trudności, Pytanie, A–D, Poprawna odpowiedź) by `dev/import.ps1 <file.xlsx>`; don't edit it by hand. The import validates the server limits (question ≤ 300, answer ≤ 120 chars) and refuses to write on errors. Every tier must have questions. `play.html` doesn't load it (phones get questions from the server).
- `common.css`: theme tokens (`:hover` rules only inside `@media (hover:hover)`, otherwise touch screens keep the last tapped answer highlighted on the next question) and shared components (studio background `#fx`, `.qbox`, `.ans` states `sel/good/bad/gone/dim`, `.ladder`, `.life`, `.timer`, `.chip`, `.table`, `.aud`, `.ov`). All animations are off under `prefers-reduced-motion`.
- `qrcode.js`: vendored `qrcode-generator` (MIT, Kazuhiko Arase). Don't edit.

### Rules
- Difficulty (Łatwy / Normalny / Ekstremalny) and time per question are chosen before the game in both modes (saved in `milion_time`). The solo ranking is kept separately per difficulty (`lvl`), with sub-tabs on the ranking page; multi ranking is shared.
- Time per question is chosen before the game in both modes (solo: 15/30/45/60 s or no limit; multi: 15–60 s). Clicking an answer submits it immediately (no confirmation).
- Solo: lifelines 50:50, audience (simulated) and swap (a spare question of the same level; restarts the timer), each once per game. „Rezygnuję” takes the last won amount. Wrong answer or timeout pays the guaranteed threshold. Results > 0 go to the shared ranking when a nick is set.
- Multi: server-side rules, see `mafia/CLAUDE.md` („Milion”). Each player has their own lifelines per round; the audience in multi is the eliminated players voting on their phones (simulated when nobody is out). Players who used the swap share the level's spare question; the TV shows it in a separate panel (`#r-sq`, from `view.sq`) with their names and, at reveal, its correct answer. The host page auto-advances 7 s after a reveal (`autoNext`) or on „Dalej”.

### Rendering
Views are string templates. `page(html)` replaces the whole `#app` only when the HTML changes; `paint(key, skeleton, regions)` keeps a skeleton and updates only the regions (`#r-*`) whose HTML changed, so animations don't restart on every server update. The timer bar/number is updated each frame by `loop()` from `T.deadline` (multi: `view.left` from the server). Clicks go through one delegated handler on `data-act`. Escape user text with `esc()`.

## Server
The multi room and the ranking live on the shared PL3Y Worker in the `egozaur/mafia` repo: `worker/src/milion/room.js` (DO `MlRoom`) and `worker/src/milion/scores.js` (DO `MlScores`), tests in `worker/test/milion.suite.js`. Keep both sides of the protocol in sync.

## Local testing
- `powershell -ExecutionPolicy Bypass -File dev\serve.ps1` serves the whole `Documents` folder on port 8091 (keep the script ASCII-only). Open `http://localhost:8091/milion/`.
- `?local=1` = local mode: `dev/local.js` (SharedWorker) runs the real `MlRoom`/`MlScores` imported from `/mafia/worker/src/milion/`, so multi works across tabs of one browser without Cloudflare (rooms and ranking live while a tab is open). The host adds `?local=1` to the player link. Without `?local`, the game talks to the production server.
- `play.html?slot=N` (tests only) keeps a separate player token, so several "phones" can run in one browser.
- End-to-end: `http://localhost:8091/milion/dev/e2e.html` (`?only=solo|multi`, `?dbg`). It drives the real buttons in iframes (solo to the million with all lifelines and a threshold loss; multi: TV + 3 phones, 3 full rounds, audience vote, scoring, no leak of the correct answer before reveal, ranking, rematch). Run it in real time in headless Edge with `--enable-logging=stderr` and read `E2E RESULT` (about 3 minutes). Check the visible text with `innerText`, not `textContent` (that includes script source).
