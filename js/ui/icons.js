/* 16x16 内联 SVG 像素图标。全部自绘，不引用 Mojang 官方贴图。 */
(function (SC) {
  'use strict';
  SC.ui = SC.ui || {};

  var C = {
    k: '#1b1b1f',
    d: '#373737',
    g: '#8b8b8b',
    l: '#c6c6c6',
    w: '#ffffff',
    b: '#8b5a2b',
    B: '#6b4423',
    n: '#3f2a18',
    r: '#ff3b3b',
    R: '#8b1a1a',
    o: '#ff8c1a',
    y: '#ffd700',
    Y: '#fff3a0',
    e: '#17dd62',
    E: '#2e7d32',
    c: '#55ffff',
    C: '#1a6b7a',
    p: '#c060ff',
    P: '#6a2fb5',
    s: '#4a6cff',
    t: '#d8c08a',
    T: '#b09060',
    m: '#7fff2a'
  };

  function R(x, y, w, h, fill) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"/>';
  }

  function wrap(body, label) {
    return (
      '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" role="img" aria-label="' +
      label +
      '">' +
      body +
      '</svg>'
    );
  }

  var icons = {
    logo: wrap(
      R(3, 11, 2, 2, C.b) +
        R(5, 9, 2, 2, C.b) +
        R(7, 7, 2, 2, C.b) +
        R(6, 5, 3, 2, C.g) +
        R(8, 3, 4, 4, C.l) +
        R(9, 4, 2, 2, C.w) +
        R(10, 8, 2, 2, C.b),
      'SENSORCRAFT'
    ),

    camera: wrap(
      R(2, 5, 12, 8, C.k) +
        R(3, 6, 10, 6, C.d) +
        R(5, 7, 6, 4, C.k) +
        R(6, 8, 4, 2, C.y) +
        R(7, 8, 2, 1, C.Y) +
        R(4, 4, 2, 1, C.g) +
        R(10, 4, 2, 1, C.g),
      'camera'
    ),

    microphone: wrap(
      R(6, 2, 4, 7, C.g) +
        R(7, 3, 2, 5, C.d) +
        R(5, 9, 6, 2, C.k) +
        R(6, 11, 4, 1, C.k) +
        R(3, 6, 1, 3, C.c) +
        R(12, 6, 1, 3, C.c) +
        R(2, 7, 1, 1, C.C) +
        R(13, 7, 1, 1, C.C),
      'microphone'
    ),

    torch: wrap(
      R(7, 7, 2, 7, C.B) +
        R(6, 6, 4, 2, C.b) +
        R(7, 4, 2, 3, C.o) +
        R(6, 3, 4, 2, C.y) +
        R(7, 2, 2, 2, C.Y),
      'torch'
    ),

    accelerometer: wrap(
      R(6, 2, 4, 3, C.g) +
        R(5, 4, 6, 3, C.l) +
        R(4, 5, 2, 2, C.g) +
        R(10, 5, 2, 2, C.g) +
        R(7, 7, 2, 7, C.B) +
        R(5, 13, 6, 2, C.d),
      'accelerometer'
    ),

    gyroscope: wrap(
      R(6, 2, 4, 2, C.p) +
        R(4, 4, 8, 4, C.p) +
        R(5, 8, 6, 4, C.P) +
        R(7, 12, 2, 2, C.p) +
        R(7, 6, 2, 2, C.w),
      'gyroscope'
    ),

    compass: wrap(
      R(4, 2, 8, 2, C.g) +
        R(2, 4, 2, 8, C.g) +
        R(12, 4, 2, 8, C.g) +
        R(4, 12, 8, 2, C.g) +
        R(7, 4, 2, 3, C.r) +
        R(6, 7, 4, 2, C.r) +
        R(7, 9, 2, 3, C.w) +
        R(7, 6, 2, 2, C.Y),
      'compass'
    ),

    map: wrap(
      R(2, 3, 12, 10, C.t) +
        R(3, 4, 10, 8, C.T) +
        R(4, 5, 2, 2, C.E) +
        R(8, 6, 3, 2, C.b) +
        R(5, 9, 3, 1, C.b) +
        R(10, 4, 1, 7, C.n) +
        R(4, 9, 1, 1, C.n),
      'map'
    ),

    touch: wrap(
      R(3, 9, 10, 3, C.g) +
        R(4, 10, 8, 1, C.l) +
        R(7, 3, 2, 5, C.d) +
        R(6, 5, 4, 2, C.d) +
        R(7, 8, 2, 2, C.r),
      'touch'
    ),

    speaker: wrap(
      R(3, 4, 10, 9, C.b) +
        R(4, 5, 8, 7, C.B) +
        R(7, 6, 1, 2, C.k) +
        R(8, 8, 1, 2, C.k) +
        R(6, 10, 1, 1, C.k) +
        R(9, 6, 2, 2, C.k),
      'note block'
    ),

    gamepad: wrap(
      R(3, 3, 10, 10, C.o) +
        R(4, 4, 8, 8, C.d) +
        R(5, 5, 2, 2, C.l) +
        R(9, 5, 2, 2, C.l) +
        R(5, 9, 2, 2, C.l) +
        R(9, 9, 2, 2, C.l) +
        R(7, 7, 2, 2, C.y),
      'command block'
    ),

    wakelock: wrap(
      R(3, 12, 10, 2, C.b) +
        R(4, 11, 8, 1, C.B) +
        R(6, 8, 4, 3, C.o) +
        R(7, 6, 2, 3, C.y) +
        R(6, 5, 2, 2, C.r) +
        R(8, 4, 2, 2, C.y),
      'campfire'
    ),

    webgpu: wrap(
      R(3, 10, 10, 3, C.P) +
        R(4, 9, 8, 1, C.p) +
        R(4, 4, 8, 5, C.d) +
        R(6, 3, 4, 2, C.p) +
        R(7, 5, 2, 2, C.w) +
        R(5, 7, 2, 1, C.c),
      'enchanting table'
    ),

    cameraManual: wrap(
      R(4, 3, 2, 10, C.g) +
        R(10, 3, 2, 10, C.g) +
        R(6, 5, 4, 6, C.d) +
        R(6, 7, 4, 2, C.r) +
        R(7, 7, 2, 2, C.y) +
        R(5, 2, 6, 1, C.k),
      'redstone comparator'
    ),

    biometrics: wrap(
      R(4, 3, 8, 10, C.b) +
        R(5, 4, 6, 8, C.g) +
        R(6, 6, 1, 1, C.k) +
        R(9, 6, 1, 1, C.k) +
        R(7, 9, 2, 1, C.n) +
        R(5, 3, 6, 1, C.B),
      'villager'
    ),

    barrier: wrap(
      R(4, 3, 8, 10, C.R) +
        R(5, 4, 6, 8, C.r) +
        R(6, 5, 1, 1, C.w) +
        R(7, 6, 1, 1, C.w) +
        R(8, 7, 1, 1, C.w) +
        R(9, 8, 1, 1, C.w) +
        R(9, 5, 1, 1, C.w) +
        R(6, 9, 1, 1, C.w),
      'locked'
    ),

    ambientLight: wrap(
      R(7, 7, 2, 2, C.y) +
        R(7, 2, 2, 3, C.y) +
        R(7, 11, 2, 3, C.y) +
        R(2, 7, 3, 2, C.y) +
        R(11, 7, 3, 2, C.y) +
        R(4, 4, 2, 2, C.y) +
        R(10, 10, 2, 2, C.y) +
        R(10, 4, 2, 2, C.y) +
        R(4, 10, 2, 2, C.y),
      'sun'
    ),

    magnet: wrap(
      R(3, 4, 3, 8, C.r) +
        R(10, 4, 3, 8, C.r) +
        R(4, 11, 2, 2, C.w) +
        R(10, 11, 2, 2, C.w) +
        R(3, 4, 10, 2, C.R),
      'magnet'
    ),

    barometer: wrap(
      R(4, 2, 8, 2, C.g) +
        R(2, 4, 2, 8, C.g) +
        R(12, 4, 2, 8, C.g) +
        R(4, 12, 8, 2, C.g) +
        R(7, 4, 2, 5, C.r) +
        R(5, 8, 2, 1, C.r) +
        R(9, 5, 2, 1, C.k),
      'gauge'
    ),

    proximity: wrap(
      R(7, 2, 2, 2, C.c) +
        R(5, 4, 6, 2, C.c) +
        R(3, 6, 10, 2, C.c) +
        R(5, 8, 6, 2, C.C) +
        R(7, 10, 2, 2, C.C) +
        R(7, 12, 2, 2, C.d),
      'proximity'
    ),

    lidar: wrap(
      R(2, 4, 2, 2, C.c) +
        R(6, 3, 2, 2, C.c) +
        R(10, 5, 2, 2, C.c) +
        R(3, 9, 2, 2, C.c) +
        R(7, 8, 2, 2, C.c) +
        R(11, 10, 2, 2, C.c) +
        R(5, 12, 2, 2, C.C) +
        R(9, 13, 2, 2, C.C),
      'lidar'
    ),

    bluetooth: wrap(
      R(7, 2, 2, 2, C.s) +
        R(9, 6, 2, 2, C.s) +
        R(5, 6, 2, 2, C.s) +
        R(7, 8, 2, 2, C.s) +
        R(9, 10, 2, 2, C.s) +
        R(5, 10, 2, 2, C.s) +
        R(7, 12, 2, 2, C.s) +
        R(7, 4, 2, 8, C.s),
      'bluetooth'
    ),

    nfc: wrap(
      R(3, 3, 10, 10, C.g) +
        R(4, 4, 8, 8, C.d) +
        R(6, 6, 1, 4, C.c) +
        R(8, 6, 1, 4, C.c) +
        R(10, 7, 1, 2, C.c),
      'nfc'
    ),

    serial: wrap(
      R(6, 2, 4, 4, C.g) +
        R(7, 6, 2, 4, C.k) +
        R(5, 10, 6, 3, C.g) +
        R(7, 13, 2, 1, C.y) +
        R(5, 4, 1, 2, C.d) +
        R(10, 4, 1, 2, C.d),
      'usb'
    ),

    vibration: wrap(
      R(5, 2, 6, 12, C.d) +
        R(6, 3, 4, 10, C.g) +
        R(3, 6, 1, 4, C.c) +
        R(2, 7, 1, 2, C.c) +
        R(12, 6, 1, 4, C.c) +
        R(13, 7, 1, 2, C.c),
      'vibration'
    ),

    battery: wrap(
      R(2, 5, 11, 6, C.g) +
        R(13, 7, 1, 2, C.g) +
        R(3, 6, 2, 4, C.r) +
        R(5, 6, 1, 4, C.d) +
        R(6, 6, 1, 4, C.d),
      'battery'
    ),

    heart: wrap(
      R(4, 4, 3, 3, C.r) +
        R(9, 4, 3, 3, C.r) +
        R(5, 6, 6, 4, C.r) +
        R(7, 9, 2, 2, C.R) +
        R(6, 5, 2, 2, C.r),
      'heart'
    ),

    moon: wrap(
      R(3, 3, 8, 2, C.g) +
        R(2, 5, 2, 6, C.g) +
        R(3, 11, 8, 2, C.g) +
        R(7, 5, 3, 6, C.k) +
        R(9, 4, 2, 2, C.k),
      'moon'
    ),

    chest: wrap(
      R(2, 5, 12, 8, C.b) +
        R(3, 6, 10, 6, C.B) +
        R(3, 7, 10, 1, C.n) +
        R(7, 8, 2, 3, C.y) +
        R(7, 9, 2, 1, C.n),
      'chest'
    ),

    pickaxe: wrap(
      R(3, 3, 2, 2, C.g) +
        R(5, 3, 2, 2, C.l) +
        R(7, 3, 2, 2, C.l) +
        R(9, 3, 2, 2, C.g) +
        R(11, 4, 2, 2, C.g) +
        R(5, 5, 2, 2, C.b) +
        R(7, 7, 2, 2, C.b) +
        R(9, 9, 2, 2, C.b) +
        R(11, 11, 2, 2, C.B),
      'pickaxe'
    )
  };

  SC.ui.icons = icons;
})(window.SC = window.SC || {});
