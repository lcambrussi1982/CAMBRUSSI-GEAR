// Splash: 2 giros, segura 2s, fade e entra no jogo. Tap em qualquer lugar também pula.
(() => {
  'use strict';
  const splash = document.getElementById('splash');
  const txt = splash.querySelector('.spinTxt');

  function proceed() {
    txt.classList.add('hold');                 // para no final do giro
    setTimeout(() => {
      txt.classList.add('fadeText');           // some o texto
      splash.classList.add('fade');            // fade do backdrop
      setTimeout(() => {
        splash.remove();
        if (window.__miniGame && window.__miniGame.start) {
          window.__miniGame.start();
        }
      }, 720);
    }, 2000); // 2s parado
  }

  // fim da animação => executa sequência
  txt.addEventListener('animationend', proceed, { once: true });

  // fail-safe (se animação for bloqueada no iOS antigo)
  setTimeout(() => {
    if (document.getElementById('splash')) proceed();
  }, 2500);

  // toque para pular imediatamente (fixo em mobile)
  splash.addEventListener('pointerdown', () => {
    txt.style.animationPlayState = 'paused';
    txt.style.transform = 'rotateY(720deg)';
    proceed();
  }, { once: true });
})();
