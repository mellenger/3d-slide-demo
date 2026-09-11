# Animated ride preview

Open `index.html#features` through a local web server, for example:

    python3 -m http.server 8000

Then visit http://localhost:8000/#features. The Enhanced AR page also links back to this preview.

## Included

- A reusable pool of inner tubes, with the first tube at time zero and another launching every 20 seconds of active playback.
- A flowing water ribbon on the open turquoise spiral, with animated ripple highlights.
- Separate water/tube switches, pause/play, restart, follow camera, reset view and fullscreen.
- Reduced-motion preferences start the animation paused. Hidden tabs suspend the animation clock, so returning does not cause a burst of launches.

The client GLB is unchanged. `ride-effects.js` builds the effects after the existing model loads. It identifies the 50 AB slide assemblies in this particular export, orders them from entry to exit, and projects a sampled route onto the floor. Surface sampling supplies tube tilt; smoothing reduces bumps at exported seams.

## Prototype limits

This is an illustrative animation, not a hydraulic or rider-physics simulation. It currently follows the open turquoise slide only. The approximately 72 m reconstructed route takes about 22.5 seconds; this timing is an artistic setting, not a client specification. Tube shapes are generated placeholders.

The water is a narrow animated surface, not fluid volume, and does not yet include splash particles or wakes. Route fitting is inferred from exported section geometry; close-up floor/wall clearances and all turns should receive an art pass before a client presentation. Original centerline curves would help refine it.

The effects run in the Three.js web viewer. They are not embedded in the GLB and are not included in the separate Model Viewer / native AR experience. A replacement GLB with different assembly names would require updating the route mapping.

## Checks

The site still runs without a build step. Optional local geometry and timing checks:

    npm install
    npm test

Tests load the actual client model and check route continuity/projection coverage, launch spacing and tube identity, pause/restart, effect switches, and sustained playback. Browser checks cover shader rendering, tube visibility, follow mode, fullscreen, and effect switches.
