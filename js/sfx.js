// Which MK2 clips (assets/sounds/<group>/mk2-NNNNN.mp3) play for each game event. The announcer, names
// and voice lines were identified by transcribing every clip; effects by length and character.

const SFX = (() => {
  const g = (group, ids) => ids.map(id => `${group}/mk2-${id}`);
  return {
    // Shao Kahn
    fight: g('shaokahn', ['00972']),
    finishHim: g('shaokahn', ['00942']),
    finishHer: g('shaokahn', ['00945']),
    fatality: g('shaokahn', ['00948']),
    flawless: g('shaokahn', ['00951']),
    wins: g('shaokahn', ['00900_02']),
    excellent: g('shaokahn', ['00954']),
    outstanding: g('shaokahn', ['00960']),
    welldone: g('shaokahn', ['00963']),
    superb: g('shaokahn', ['00966']),
    taunt: g('shaokahn', ['01190', '01193', '01196', '01175', '01178', '01184', '01166', '01172']),
    name_liukang: g('shaokahn/names', ['00900_01']),
    name_kunglao: g('shaokahn/names', ['00903_01']),
    name_johnnycage: g('shaokahn/names', ['00906_01']),
    name_reptile: g('shaokahn/names', ['00909_01']),
    name_subzero: g('shaokahn/names', ['00912_01']),
    name_shangtsung: g('shaokahn/names', ['00915_01']),
    name_kitana: g('shaokahn/names', ['00918_01']),
    name_jax: g('shaokahn/names', ['00921_01']),
    name_mileena: g('shaokahn/names', ['00924_01']),
    name_baraka: g('shaokahn/names', ['00927_01']),
    name_scorpion: g('shaokahn/names', ['00930_01']),
    name_raiden: g('shaokahn/names', ['00933_01']),

    // Fighters' voices
    maleAttack: g('male', ['00600', '00603', '00606', '00609', '00612', '00650', '00653', '00656', '00662']),
    maleHurt: g('male', ['00615', '00618', '00621', '00624', '00630', '00671', '00674', '00839', '00868']),
    maleScream: g('male', ['00627', '00636', '00683', '00836', '00883']),
    femaleAttack: g('female', ['00700', '00703', '00706', '00709', '00712']),
    femaleHurt: g('female', ['00715', '00718', '00721', '00724', '00727', '00742']),
    femaleScream: g('female', ['00730', '00733', '00736', '00739', '00745']),
    liukangSpecial: g('liukang', ['00750']),
    scorpionSpecial: g('scorpion', ['00827']),
    getOverHere: g('scorpion', ['00824']),
    raidenSpecial: g('raiden', ['00695', '00800', '00686']),
    jaxSpecial: g('jax', ['00818']),
    toasty: g('danforden', ['00645']),

    // Hits and moves
    punchHit: g('hitsounds', ['00100', '00103', '00115', '00118', '00121', '00124']),
    kickHit: g('hitsounds', ['00106', '00112', '00127', '00157', '00160']),
    uppercutHit: g('hitsounds', ['00193', '00196']),
    swing: g('hitsounds', ['00130', '00139', '00190']),
    fallThud: g('hitsounds', ['00148', '00172']),
    gore: g('hitsounds', ['00447_03', '00447_07', '00447_09', '00447_11']),
    projectile: g('specialfx', ['00274']),
    spear: g('specialfx', ['00256']),
    freeze: g('specialfx', ['00292']),
    specialHit: g('hitsounds', ['01000_01', '01000_02']),
    explode: g('explosions', ['00280', '00459', '00892']),
    cheer: g('arenas', ['00289']),

    // Interface and music
    cursor: g('ui', ['00524']),
    select: g('ui', ['00533']),
    reveal: g('ui', ['00223']),
    miss: g('ui', ['00530']),
    buzz: g('ui', ['00536']),
    selectMusic: g('musiccues', ['00090']),
    finishMusic: g('musiccues', ['finish1a']),
    fatalityMusic: g('musiccues', ['fatal1']),
  };
})();
