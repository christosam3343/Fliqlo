# Flip Clock

[Open the clock](https://christosam3343.github.io/Fliqlo/)

A browser-based split-flap clock inspired by [Fliqlo](https://fliqlo.com/). It reads the device’s local time.

1. Open the clock in a separate browser window.
2. Drag the window to your dedicated monitor.
3. Press **F11** in Chrome or Edge on Windows to put that browser window in fullscreen. You can also press **F** or click the fullscreen button in the upper-right corner to use the page’s fullscreen mode. The controls fade until you move the pointer, tap the display, or press a key.

Settings include 12- and 24-hour time, seconds, numeral font and color, size, brightness, and an optional screen wake lock. The browser remembers your settings. Wake lock depends on browser and system support and applies while the page is visible.

Use the **Focus timer** button to start a countdown from 1 to 99 minutes. Reopen it to pause, resume, or end the session. The clock returns automatically when time is up. You can enable a completion chime when starting a session.

Open the clock online once and let it finish loading. You can then launch the installed app or reopen the site offline in the same browser profile. Offline launch uses a service worker on HTTPS or localhost.

The site runs from the root of `main` on GitHub Pages, with no build step. Open `index.html` directly for local use or serve the folder over `localhost` for development.

The numerals use [Barlow Condensed](https://github.com/jpt/barlow), distributed under the [SIL Open Font License](assets/OFL.txt).
