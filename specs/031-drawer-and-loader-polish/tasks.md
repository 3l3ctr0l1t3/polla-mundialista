# 031 — Tasks

- [x] 1. `FullScreenLoader` + states index export; swap into App.tsx + GroupApp.tsx gates.
- [x] 2. Drawer below app bar (zIndex), toggle on hamburger, Menu↔Close icon + aria, paper top
       padding, neutral selected-row bg. (Drawer became PERSISTENT + own Backdrop/Esc — a modal
       drawer aria-hides the toggle button, defeating fix 2/3.)
- [x] 3. `groupNav.closeMenu` in en + es.
- [x] 4. Tests: toggle/icon/aria + loader gates; suite green (229).
- [x] 5. Gates (`npm test` · build · lint · prettier) and backlog row 031.

## Verification command(s)
```
npm test && npm run build && npm run lint
```
