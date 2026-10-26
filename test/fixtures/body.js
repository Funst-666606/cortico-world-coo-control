/** Minimal fixture with the exact stock behaviour blocks the patch targets. */
export const KIT_EXPRESSIONS = ['neutral', 'happy', 'wink', 'love', 'shy', 'surprised', 'angry', 'sleepy'];
export function createBody(host, opts) {
  const words = opts.words || {};
  let roam = 'free';
  const pet = { lastAct: null, mode: 'idle', nextAt: 0, expr: null, exprUntil: 0 };
  const T = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const setMode = () => {};
  const act = () => {};
  const onEvent = () => {};
  const play = () => {};
  function setExpr(n) {
    if (n === 'love') for (let i = 0; i < 4; i++) emitHeart();
  }
  function emitHeart() {}
  function decide() {
    const calm = roam === 'calm';
    const opts2 = [['walk', calm ? 10 : 28], ['run', calm ? 0 : 12], ['look', 14], ['jump', calm ? 2 : 8], ['sit', 16], ['expr', 12], ['wait', calm ? 30 : 10]]
      .filter(o => o[1] > 0 && (o[0] !== pet.lastAct || o[0] === 'wait'));
    let r = Math.random() * opts2.reduce((a, o) => a + o[1], 0), pick = 'wait';
    for (const o of opts2) { if ((r -= o[1]) < 0) { pick = o[0]; break; } }
    if (pick === 'look') { setMode('look'); pet.lastAct = 'look'; }
    else if (pick === 'expr') { setExpr(['happy', 'wink', 'love', 'sleepy', 'surprised', 'shy'][Math.floor(Math.random() * 6)]); pet.lastAct = 'expr'; }
    // a sit she chose decides up front whether it ends in sleep, so she only gets drowsy when she will fall asleep
    else if (pick === 'sit') { setMode('sit', { dur: rnd(6, 9), willSleep: Math.random() < .6 }); pet.lastAct = 'sit'; }
    else if (pick !== 'wait') act(pick);
    if (pet.mode === 'idle' && T >= pet.nextAt) pet.nextAt = T + rnd(2, 4);
  }

  /* particles */
  function pointerUp(p) {
    if (pet.mode === 'drag') return;
    else if (Math.random() < 400) {
      if (pet.mode === 'sleep' || pet.mode === 'sit') {
        setMode('wake', { startle: true });
      } else if (pet.mode !== 'dizzy') {
        play('poke', 'touch');
        const r = ['happy', 'wink', 'surprised', 'love', 'angry'][Math.floor(Math.random() * 5)];
        setExpr(r);
        if (Math.random() < .5 && pet.mode === 'idle') setMode('crouch', { jumpV: 480, jumpVx: 0 });
        onEvent('touch', { kind: 'poke' });
      }
    }
  }
  function pointerMove(p) {
    if (pet.mode === 'sleep') emitHeart();
    else setExpr(Math.random() < .5 ? 'love' : 'shy');
    onEvent('touch', { kind: 'pet', asleep: pet.mode === 'sleep' });
  }
  return {
    do: (w) => w,
    set(s) {
      if (s.theme) doc.documentElement.dataset.theme = s.theme;
    },
  };
}
