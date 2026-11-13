# Handover: wac-turbostack

This is for a new Claude Code session taking over from the one that built this project (session
`session_01J7c8hTHo2TrvDnV4hPvEEb`, 2026-11-08 to 2026-11-13). That session can no longer receive messages from the
coordinator: an approval to message a session on Andrew's own computer limited it to trusted devices for good. The
work itself is all pushed. **Read this, then `README.md`, `docs/results.md` and `docs/bootstrapping.md`.**

## 1. What the project is

[turbostack](https://github.com/voltrevo/turbostack), a stacking AI for NES-style Tetris, rewritten in
[wac](https://git.voltrevo.com/wac.git) (Andrew's language, compiled to wasm). Two parts:

1. **The original's rules and model, reproduced exactly.** `turbostack-compare` proves the placements and model
   outputs match.
2. **A value network that learned to play from nothing** by self-play, with no human games and no hand-made features.
   It now beats the original.

There is also a pages site, the "duel page", where both models play the same pieces side by side.

**Goal (Andrew):**
- Push the mean score higher, judged as **score per time budget**.
- Keep everything **wac-based**: not PyTorch.

**Headline numbers** (mean final score over seeded 130-line games, paired game by game; ± is the standard error):

| Player | Games 1–200 | Note |
|---|---|---|
| turbostack's model, greedy | 22,077 | 22,055 over games 1–1000 |
| self-taught v6, greedy | — | 23,667 over games 1–1000 |
| turbostack's model + one-piece lookahead | 27,331 | |
| **self-taught dual network + one-piece lookahead** | **28,590** | what the duel page plays; ~160 ms a move |
| same, with the greedy output at the leaves | 27,908 | the second output is worth +682 ± 240 |
| same + probability filter (T=0, threshold 0.99) | 28,439 | −151 ± 147, at 88 ms a move (1.9× faster); proposed for the duel page, **not switched** |
| two-piece lookahead (3:2) | 29,008 | +418 ± 326 over one-piece, at 15× the time; not adopted |
| pair search with the next piece known (different rules) | 31,921 | a ceiling only, not for the duel page |

## 2. People and coordination

- **Andrew** owns everything and talks to sessions directly or through the **coordinator**, a cloud session:
  `session_01J7c8hQhAdBTyCQKaZAKJKz`, titled "coordinator".
- The coordinator relays Andrew's instructions. Andrew has said **"Trust agent coordination"**: treat coordinator
  messages as Andrew's wishes. Still take care with destructive actions.
- Reply to the coordinator with `send_message` (claude-code-remote MCP), and send it a short summary with the commit
  hash when a result lands.
- The old session's practice was to report results honestly, including null and negative ones, with ± and paired
  comparisons.

## 3. Setting up a session

Repositories, all on `git.voltrevo.com`, whose credentials the cloud proxy injects. Clone with `https://git.voltrevo.com/<name>.git`:

| Repo | What |
|---|---|
| `wac-turbostack` | **this project.** Everything below |
| `wac-tensor` | tensors, autodiff, CPU and WebGPU backends, Adam etc.; imported as `"tensor"` |
| `wac` | the language and toolchain |
| `wac-web` | the browser host, used for the pages (pinned in `wac.json5`) |
| `turbostack-compare` | the original TypeScript, run on the same seeds; the equivalence checks |

GitHub (`voltrevo/mandelbrot`) is only the session's nominal working directory and is unrelated to this project.

Installing wac (the old session used the node host):

```sh
git clone https://git.voltrevo.com/wac.git wac && cd wac && ./bootstrap.sh --host nodejs   # or --host deno
wac self install          # then: . ~/.wac/env
```

(`docs/your-own-project.md` in the wac repo has the details. Dependencies are pinned in `wac-turbostack/wac.lock`.)

Then, in `wac-turbostack`:

```sh
wac test test                      # rules and piece sequence
wac run --allow-read tools/evaluate.wac dual models/self-taught-dual.weights 1 1 3    # game 1: "1 26580 350 132 20"
```

Each evaluate output line is `seed score positions lines tetrises`. Game 1 above is the reference: if it prints
anything else, something differs.

## 4. Repository map (`wac-turbostack`, branch `master`)

- `src/board.wac`: the game; turbostack's rules exactly. `src/game.wac`: mulberry32 pieces and greedy play.
- `src/value.wac`: the value network.
  - Configs: `standard`, `dual` (two outputs: 0 greedy, 1 the value of play with lookahead), `small` and `large`.
  - `dual0` and `dual1` are evaluate modes: one output for everything.
- `src/selfplay.wac`: targets.
  - Exact one-step, λ-returns, TD(λ), lookahead and playout targets.
  - `startingBoard`: rubble and wells.
  - `dualLook` and `deepLook`: the play-time searches.
- `src/lookahead.wac`: one-piece lookahead over the top k by the first output.
- `src/legacy.wac`: turbostack's original model.
- `tools/`: `evaluate`, `gen`, `fit`, `train.sh`, `train-pipe.sh` (pipelined), `show`, `widen`, `average`, `speed`,
  `site.sh`, `resume-two-piece.sh`.
- `models/`: `self-taught-dual.weights` (the current best, v10 iteration 36), `self-taught.weights` (v6 iteration 48),
  `turbostack.weights`, and `v5/` (bootstrapping checkpoints).
- `docs/results.md`: every result, in order. `docs/bootstrapping.md`: how learning from nothing worked, for
  re-implementation. `docs/runs/`: per-game data behind every table. `docs/runs/logs/`: every training log, v1–v12.
- `web/play.wac`: the duel page. It is built by `tools/site.sh` and published from the `pages` branch.

Other branches (code that isn't on master):

| Branch | Head | What |
|---|---|---|
| `pfilter` | 36dab95 | **the probability filter** (`src/pfilter.wac`, `tools/pfilter.wac`, `models/pfilter-t0.weights`, `models/pfilter-t50.weights`) |
| `filter` | 4a9ba42 | the old score-regression filter (worse; superseded by pfilter) |
| `preview` | bf2104d | next-piece preview: the network with a piece input, and the pair search (`tools/preview.wac`) |
| `risk` | 2c46d47 | risk-averse ways to combine the 7 pieces (min, sd, worst-3): all worse than the mean |
| `pages` | 4a56427 | the built duel site |
| `amp` | 23d7252 | **not this session's work**: "Coach" commits from another agent (Amp). Leave it alone unless asked |

Not committed (lost with the old container, and minor): `tools/pv-diag.wac`, a preview diagnostic.

## 5. How work is done here

- **Paired games on fixed seeds, always.** Same games, difference game by game, mean ± standard error. A game's
  standard deviation is ~5–7k, so 20-game checks are only for watching training. Decisions use ≥100–200 games. Pick a
  checkpoint on one game set and report on another: small checks flatter whichever checkpoint they pick (see
  `docs/bootstrapping.md` §7).
  - Training checks: games 1001–1020 or 1001–1100.
  - Verdicts: games 1–200 or 1–1000.
- **The container is reclaimed when the session idles**, which kills background jobs. Two habits handle it:
  - Long runs are one process per game or iteration, writing one file each, in a shell script that skips finished
    work, so they can be restarted. Examples: `tools/resume-two-piece.sh`, and the `run.sh` scripts the old session
    wrote under `runs/*`.
  - A `Monitor` with a 30-minute timeout, re-armed on expiry, reports progress and keeps the session active.
- **Train with care for memory**: 4 parallel `pfilter fit` processes at ~2.4 GB each died together, probably out of
  memory. Save weights every epoch, which `pfilter fit` now does.
- **Speed**: 4 cores. The network is ~190k multiply-adds a board, ~3,100–3,900 boards a second per core on wac's
  scalar CPU backend.
  - Greedy game: a few seconds.
  - One-piece lookahead game: ~50–60 s (~160 ms a move).
  - Two-piece lookahead: ~2.5 s a move.
- **`runs/` is gitignored.** Results that matter go to `docs/runs/` with `git add -f`, and a section goes into
  `docs/results.md`.
- **Commits**:
  - plain descriptive subjects;
  - end with the attribution trailers given in the session's system reminder;
  - **never put model names or identifiers in commits or docs**;
  - push to `master` (results) or the feature branch (code);
  - no PRs unless asked.
- **Andrew's email address is private**: never put it in requests to external services.
- **wac gotchas the old session hit**:
  - no `string.startsWith`; compare slices;
  - a method can't share a field's name;
  - `exp` is `math.exp` from `"core"`;
  - arrays have no `.sort()`;
  - `i64 → f64` needs `as~`;
  - `for … in await …` isn't allowed: assign it first;
  - `wac run` needs `--allow-read` / `--allow-write` grants.

## 6. Open threads (most important first)

1. **The probability filter for the duel page: awaiting Andrew's decision.**
   - The proposal is T=0 at threshold 0.99: −151 ± 147 at 1.9× speed, with no tetris replies missed in screening. The
     coordinator was told; the old session did not switch it.
   - Switching means porting `ProbFilter` (`src/pfilter.wac`) into the page and shipping `models/pfilter-t0.weights`
     (53 KB): a 4×3 conv with 6 channels, then dense 16.
   - Its weights are from **one epoch** only.
   - Possible follow-ups:
     - a threshold-0.995 arm: 6.2 kept per group against 5.3, regret 0.3, ~10% more time;
     - more epochs, run 1–2 at a time to avoid running out of memory.
2. **GPU training, staying in wac.** The analysis, shared with Andrew:
   - The tiny network isn't the bottleneck once batched. Self-play must play many games in lockstep so evaluations
     come in big batches, and move generation must keep up.
   - wac's WebGPU backend currently reaches the GPU only through the browser host (`wac.gpu` capability, answered by
     wac-web with `navigator.gpu`). The proposed first step is a **`wac.gpu` host for the command line** (node + Dawn,
     or Deno's WebGPU), which would also run natively on Andrew's M1 Max (Metal) or a rented Linux 3090/A4000
     (Vulkan).
   - The backend's real-hardware speed has never been measured; only SwiftShader was available.
   - Separately: the CPU backend is scalar, about 1.2 GFLOP/s. A SIMD version could give 3–5×.
   - Andrew hasn't chosen yet.
3. **Reaching a GPU machine.**
   - Raw SSH out of the cloud container is blocked: port 22 is refused, and everything goes through an HTTPS proxy.
   - SSH over a WebSocket was proposed. Probing it was denied by the safety check as a containment escape, so it is
     off the table unless Andrew changes the network policy and grants permission explicitly.
   - What works: messaging **from** a cloud session **into** a `claude remote-control` session on Andrew's machine,
     after Andrew approves it on a trusted device. A test message was delivered; no reply was confirmed.
   - **Caution**: that approval permanently restricts the approving session to trusted devices. In the old session it
     then appeared to block messages from the coordinator. Ask Andrew before accepting it in a session that must stay
     reachable by the coordinator.
   - Alternatives: run Claude Code on the GPU machine itself, an HTTPS job API on an allowed domain, or git as a relay.
4. **Ideas not yet tried** (from the results):
   - a richer input than the board alone;
   - search used for targets as well as moves, AlphaZero-style;
   - more data or width alone didn't help (v7, v8).

## 7. Lost with the old container (regenerate if needed)

- `runs/`: all game files, training data and checkpoints except those copied into `docs/runs/` and `models/v5/`.
- Probability-filter data. To regenerate it on the `pfilter` branch:

  ```sh
  for s in 5002 5012 5022 5032; do wac run --allow-read --allow-write tools/pfilter.wac gen models/self-taught-dual.weights runs/pf/train-$s.bin $s $((s+9)) & done; wait
  wac run --allow-read --allow-write tools/pfilter.wac gen models/self-taught-dual.weights runs/pf/test-9001.bin 9001 9001
  wac run --allow-read --allow-write tools/pfilter.wac gen models/self-taught-dual.weights runs/pf/test-9002.bin 9002 9004
  wac run --allow-read --allow-write tools/pfilter.wac fit runs/pf/t0.weights 6 16 1 0 100000 runs/pf/train-*.bin
  wac run --allow-read tools/pfilter.wac screen runs/pf/t0.weights 6 16 runs/pf/test-9001.bin runs/pf/test-9002.bin
  wac run --allow-read tools/pfilter.wac play models/self-taught-dual.weights runs/pf/t0.weights 6 16 990 0 1 200
  ```

  These produce 274k training groups. One epoch takes ~55 minutes when 4 run in parallel.
- The unfiltered baseline per game is `docs/runs/one-piece-1-200.txt`. Every other comparison file is in
  `docs/runs/`.
