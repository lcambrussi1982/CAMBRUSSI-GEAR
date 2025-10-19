
// js/main.js — Splash (2 giros) com "cambrussi games inc." segura 2s e fade
(() => {
  'use strict';
  const splash = document.getElementById('splash');
  const txt = splash.querySelector('.spinTxt');

  function proceed(){
    // segura 2s com texto parado, depois fade do texto e do splash
    txt.classList.add('hold');
    setTimeout(() => {
      txt.classList.add('fadeText');
      splash.classList.add('fade');
      setTimeout(() => {
        splash.remove();
        window.__miniGame.start();
      }, 720); // após o fade do splash
    }, 2000);
  }

  txt.addEventListener('animationend', proceed);

  // tocar/ clicar também já considera um gesto p/ áudio no mobile
  splash.addEventListener('pointerdown', () => {
    // pula direto para o estado final do giro
    txt.style.animationPlayState = 'paused';
    txt.style.transform = 'rotateY(720deg)';
    txt.dispatchEvent(new Event('animationend'));
  }, { once: true });
})();
