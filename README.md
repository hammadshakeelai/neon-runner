# Neon Runner

An **original**, dependency-free **WebGL2** cyberpunk-city driving sandbox that runs
entirely in the browser and can be hosted for free on **GitHub Pages**.

> **Honest disclaimer.** This is *not* Cyberpunk 2077, *not* GTA V, and *not* a
> WebAssembly port of any commercial game. It is a small procedural tech demo written
> from scratch: a grid of neon-lit buildings, a glowing road grid, and a car you drive
> around. It contains **no** copyrighted game assets, no leaked code, and no download
> of anyone else's game. The engine is ~15 KB of original JavaScript.

---

## Why not a real "GTA/Cyberpunk in the browser"?

Because, as of now, that does not exist as something you can legally or reliably clone:

| Claim | Reality |
| --- | --- |
| "Clone a working GTA V browser port from GitHub" | The real one (`playgta5.com`) lived ~a few hours in Oct 2026, was built from **leaked source**, and had **no public repo**. There is nothing to clone. |
| "There's an open-source Cyberpunk 2077 WASM port" | There isn't. Cyberpunk 2077 is a DX12-Ultimate engine (ray tracing, mesh shaders, bindless textures) that WebGPU cannot represent, and it needs 12–16 GB RAM + a fast NVMe. Modding tools (WolvenKit, redscript) are not a game port. |
| "Host the 20–100 GB of assets on GitHub Pages for free" | GitHub Pages caps files at 100 MB and a repo would be DMCA'd. Also, a WASM port runs **on your own device** — it never offloads work, so it cannot avoid your device being the bottleneck. |

Sites that still promise "GTA 5 in your browser" today are almost always stuck-loading
loops, ad/redirect farms, or credential phishing. If a page asks you to download a
`.exe`/launcher, install an extension, or enter a Rockstar/Steam login — close it.

This demo gives you the *real* version of what's achievable for free: a genuine,
playable, cyberpunk-*styled* WebGL scene.

---

## Features

- Procedurally generated neon city (≈1,600 buildings) — new layout every reload
- Emissive magenta/cyan windows, glowing road grid, distance fog
- Arcade car physics: throttle, braking, reverse, speed-sensitive steering (Shift to boost)
- AABB collision against every building, fenced city bounds
- Zero dependencies, zero build step, single HTML + JS file
- Runs on any browser with WebGL2 + hardware acceleration

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | Throttle |
| `S` / `↓` | Brake / reverse |
| `A` / `D` (or `←` / `→`) | Steer |
| `Shift` | Boost |
| `R` | Reset position |

---

## Run locally

Just open `index.html` in your browser, **or** serve it (recommended so relative paths
behave exactly like production):

```powershell
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages (free)

1. Create a new **public** repo on GitHub (no README/License needed).
2. From this folder, run the helper:

   ```powershell
   .\push-to-github.ps1 -RepoUrl https://github.com/<you>/<repo>.git
   ```

   (or do it manually: `git init`, `git add .`, `git commit -m "Neon Runner"`,
   `git remote add origin <url>`, `git branch -M main`, `git push -u origin main`)
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
   Branch: `main` / `(root)` → Save.**
4. In ~1 minute it's live at `https://<you>.github.io/<repo>/`.

## Files

```
index.html          # page shell, styles, HUD, WebGL2 fallback message
app.js              # the whole engine (matrices, shaders, city gen, physics, loop)
push-to-github.ps1  # one-command git init + commit + push helper
.nojekyll           # tells GitHub Pages to serve files as-is
README.md
```
