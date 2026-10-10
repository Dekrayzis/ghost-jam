# Ghost Jam

A Halloween concert in the browser. FizzBuzz becomes a wall of a hundred lights (Boo for threes, Scary for fives, BooScary for both), three ghosts dance on stage to a track synthesised live with the Web Audio API, and a crowd of ghost fans fills the floor, one wave per loop, until the show sells out.

No audio files and no images: every sound and every shape is made in code.

## What's in it

- **The wall:** 1 to 100 as FizzBuzz, lit in five colours on every beat.
- **The music:** a kick, clap, hi-hats, a sawtooth bass and chord pads at 120 BPM. From the second loop, offbeat chord stabs and a theremin-style lead with an echo join in. The chords run A minor, A minor, G, E major.
- **The band:** a DJ in headphones at the Ghost FM booth, and two dancers, one with a bow and one in a witch's hat. They squash on every beat, hop between, mirror each other and raise their arms on alternate beats.
- **The crowd:** seven fans arrive each loop, in three rows, up to 35. Half bounce on the beat and half on the off-beat, some waving glow sticks.
- **The sky:** a textured crescent moon with a bat looping across it, and stage lights that sweep while the music plays.

## How it stays in time

Notes are scheduled a tenth of a second ahead on the audio clock, which is exact, and each step is queued. The animation loop fires a step's lights when the audio clock reaches it, so sight and sound share one clock however busy the page is.

## Performance

Nothing that moves carries a CSS filter. Glows are painted once behind the ghosts, and the fans' moonlit rims and glow-stick halos are drawn into the SVG, so a full crowd costs barely more than an empty floor. The wall's lights are set through data attributes rather than React state, and React hears about the loop once per loop.

## Accessibility

- The big word flashes once a bar, well under the safe limit for flashing content.
- With reduced motion set in the system, the ghosts, crowd, bat and wall hold still while the music plays.
- The play button reports its state, and the status line ("Jamming · loop 3 · crowd of 21") is announced to screen readers.

## Run it

```bash
npm install
npm run dev
```

`npm run build` makes a static build in `dist/`.

Built with React, TypeScript, Sass and Vite.

## Credits

By Vincent Corleone. Adapted from [Ghost Jam by grauconejo13](https://codepen.io/editor/grauconejo13/pen/01a1120b-8069-772e-9139-f4f217333ef3) on CodePen. The original used animated GIFs and a commercial song; here the ghosts and crowd are redrawn in code, with new colours, and the music is synthesised in the browser.
