
// js/main.js — Splash (2 giros) com "cambrussi games inc." segura 2s e fade
(() => {
  'use strict';
  const splash = document.getElementById('splash');
  const txt = splash.querySelector('.spinTxt');

  function proceed(){
    txt.classList.add('hold');
    setTimeout(() => {
      txt.classList.add('fadeText');
      splash.classList.add('fade');
      setTimeout(() => {
        splash.remove();
        window.__miniGame.start();
      }, 720);
    }, 2000);
  }

  txt.addEventListener('animationend', proceed);
  const failSafe = setTimeout(() => { if (document.getElementById('splash')) proceed(); }, 2500);

  splash.addEventListener('pointerdown', () => {
    txt.style.animationPlayState = 'paused';
    txt.style.transform = 'rotateY(720deg)';
    txt.dispatchEvent(new Event('animationend'));
  }, { once: true });
})();
