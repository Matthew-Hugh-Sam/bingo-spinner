const path = require("path");
const express = require("express");
const { Game } = require("./game");

const PORT = Number(process.env.PORT) || 3001;
const root = path.join(__dirname, "..");
const game = new Game(path.join(root, "data", "state.json"));

const app = express();
app.use(express.json());
app.use(express.static(path.join(root, "public")));

// Serve the 3D and physics libraries straight from node_modules (no build step).
app.use("/vendor/three", express.static(path.join(root, "node_modules", "three")));
app.use("/vendor/cannon-es", express.static(path.join(root, "node_modules", "cannon-es", "dist")));

app.get("/api/state", (req, res) => res.json(game.state()));

app.post("/api/draw", (req, res) => {
  const number = game.draw();
  if (number === null) return res.status(409).json({ error: "All 90 balls have been drawn" });
  res.json({ number, ...game.state() });
});

app.post("/api/reset", (req, res) => {
  game.reset();
  res.json(game.state());
});

app.listen(PORT, () => {
  console.log(`Bingo spinner running at http://localhost:${PORT}`);
});
