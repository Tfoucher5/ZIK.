'use strict';
// Applied as early as possible (in <head>) to avoid animation flash
(function () {
  if (localStorage.getItem('zik_animations') === 'off') {
    document.documentElement.classList.add('no-animations');
  }
})();
