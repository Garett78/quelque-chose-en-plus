/* Démarrage de l'application. */
'use strict';
Screens.home = {enter: renderHomeHint};
Screens.games = {enter: renderGameTiles};
(async () => {
  await loadCore();
  await Promise.all([loadComm(), loadLearn(), loadRec(), loadBirdSongs()]);
  renderHomeHint();
  renderGameTiles();
})();
