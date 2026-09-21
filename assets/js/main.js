import { Game } from './core/Game.js';

const container = document.getElementById('container');
const game = new Game(container);

game.init().catch((error) => {
  console.error('No fue posible iniciar el juego:', error);
});
