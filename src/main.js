import './style.css';
import { FPVDownGame } from './game.js';

const game = new FPVDownGame();
window.game = game;
game.init().catch((error) => {
  console.error(error);
  document.getElementById('loading-state').textContent = 'Kunde inte starta 3D-motorn. Kontrollera WebGL-stöd.';
});
