# Test-Game
Repository for Testing Different Code

## Host on GitHub Pages

1. Create a GitHub repository and add `index.html`, `styles.css`, `game.js`, and any optional `assets/` folder.
2. Commit and push to the `main` branch.
3. In **Repository Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/** (root)
4. Your game will be available at:

```
https://<username>.github.io/<repo>/
```

### iPhone install
1. Open the game in **Safari** on iOS.
2. Tap **Share** → **Add to Home Screen** to install it like an app.

### Troubleshooting
- Perform a hard refresh if updates do not appear.
- Append a cache-busting query string (e.g., `index.html?v=2`).
- Ensure all paths are relative (e.g., `./styles.css`, no `C:\` or `file:///`).
- If an older cached build loads, clear site data/storage for the page and reload.
