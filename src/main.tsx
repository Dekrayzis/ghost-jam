import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GhostJam } from "./ghost-jam/GhostJam";
import "./index.scss";
import "./sections/_ghost-jam.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="page">
      <h1 className="sr-only">Ghost Jam</h1>
      <GhostJam />
    </main>
    <footer className="credit">
      <p>
        By Vincent Corleone. Adapted from{" "}
        <a
          href="https://codepen.io/editor/grauconejo13/pen/01a1120b-8069-772e-9139-f4f217333ef3"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ghost Jam by grauconejo13<span className="sr-only"> (opens in a new tab)</span>
        </a>{" "}
        on CodePen.
      </p>
    </footer>
  </StrictMode>,
);
