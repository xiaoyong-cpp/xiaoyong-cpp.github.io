(function () {
  "use strict";

  var canvas = document.getElementById("scene");
  var ctx = canvas.getContext("2d");

  /* ---------- 工具 ---------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function wrap(v, min, span) {
    v = (v - min) % span;
    if (v < 0) v += span;
    return min + v;
  }
  function smoothstep(a, b, x) {
    x = clamp((x - a) / (b - a), 0, 1);
    return x * x * (3 - 2 * x);
  }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

  /* ---------- 全局状态 ---------- */
  var FIXED_SEED = 20261026;
  var W = 0, H = 0, DPR = 1;
  var camX = 0, camY = 0, tgtX = 0, tgtY = 0;   // 归一化镜头偏移 [-1, 1]
  var S = {};                                   // 预渲染资源
  var V_PAD = 48;                               // 层画布上下冗余（垂直视差用）

  /* ---------- 时段 / 天气：由 game.js 驱动的显示环境 ---------- */
  var SKY_STOPS = [0, 0.20, 0.38, 0.52, 0.61, 0.667, 0.78, 1];
  var PALETTES = {
    night: [[5, 8, 26], [11, 16, 48], [30, 31, 71], [64, 48, 90], [124, 72, 101], [90, 54, 85], [42, 33, 66], [20, 18, 48]],
    dawn:  [[4, 7, 24], [10, 14, 44], [28, 28, 66], [70, 46, 84], [150, 88, 116], [108, 62, 96], [48, 34, 64], [22, 18, 44]],
    day:   [[10, 14, 32], [20, 26, 50], [40, 46, 70], [66, 66, 82], [112, 96, 104], [88, 78, 88], [56, 56, 74], [34, 38, 54]],
    dusk:  [[6, 9, 28], [14, 18, 50], [34, 32, 74], [78, 56, 96], [122, 74, 108], [92, 58, 92], [48, 36, 72], [24, 20, 52]]
  };
  var SUNRISE_PAL = [[18, 26, 58], [46, 52, 96], [112, 92, 128], [192, 130, 128], [255, 182, 140], [232, 146, 120], [120, 78, 90], [40, 34, 54]];
  var SEG_STAR = { night: 1, dawn: 0.6, day: 0.3, dusk: 0.7 };
  var SEG_FOG = { night: 1.0, dawn: 0.85, day: 0.75, dusk: 1.0 };

  var env = { segment: "night", storm: 0, lost: 0, wound: 0, hunger: 0, exhausted: 0, sunrise: 0 };
  var vis = { storm: 0, lost: 0, wound: 0, hunger: 0, exhausted: 0, sunrise: 0 };
  var skyCur = PALETTES.night.map(function (c) { return [c[0], c[1], c[2]]; });
  var camXS = 0, camYS = 0;
  var snow = [], lastT = 0;

  /* 三分线构图：自屏幕底端向上，底部 1/3 平坦地面，中部 1/3 山脉与松林，顶部 1/3 星空 */
  var GROUND_Y = 2 / 3;                         // 地平线（地面起始 y）
  var STAR_Y = 1 / 3;                           // 星空主要分布区下界
  var GROUND_DEPTH = 150;                       // 地面为最近景平面，视差最强
  var GROUND_PAD = 56;                          // 纵向余量，容纳垂直视差

  /* 山脊参数：全部落在中部 1/3；基线越靠下（数值大）离观察者越近，颜色越深。
     最高峰顶略高于最高的松树，以形成清晰的层次压制关系。 */
  var RIDGES = [
    { base: GROUND_Y - 0.100, amps: [0.028, 0.013, 0.006], freqs: [0.0032, 0.0092, 0.021],
      peaks: 6, peakMin: 0.055, peakMax: 0.090,
      top: [80, 76, 120], bottom: [31, 29, 62], depth: 34, rim: "rgba(196,150,186,0.13)" },
    { base: GROUND_Y - 0.058, amps: [0.034, 0.016, 0.008], freqs: [0.0024, 0.0071, 0.018],
      peaks: 5, peakMin: 0.035, peakMax: 0.058,
      top: [43, 41, 78], bottom: [17, 16, 40], depth: 54, rim: "rgba(178,132,176,0.08)" },
    { base: GROUND_Y - 0.012, amps: [0.030, 0.015, 0.009], freqs: [0.0020, 0.0060, 0.016],
      peaks: 4, peakMin: 0.026, peakMax: 0.044,
      top: [23, 21, 46], bottom: [6, 6, 20], depth: 80, rim: null }
  ];

  /* ---------- 预渲染：云 / 雾 柔边精灵 ---------- */
  function makeBlobSprite(w, h, color, blobs, seed) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d");
    var rnd = mulberry32(seed);
    for (var i = 0; i < blobs; i++) {
      var cx = w * (0.08 + 0.84 * rnd());
      var cy = h * (0.35 + 0.3 * rnd());
      var rx = w * (0.06 + 0.16 * rnd());
      var ry = h * (0.18 + 0.34 * rnd());
      var a = 0.05 + 0.10 * rnd();
      var rg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      rg.addColorStop(0, rgba(color, a));
      rg.addColorStop(1, rgba(color, 0));
      g.fillStyle = rg;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    // 左右渐隐，回绕拼接时无接缝
    g.globalCompositeOperation = "destination-in";
    var lg = g.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, "rgba(0,0,0,0)");
    lg.addColorStop(0.12, "rgba(0,0,0,1)");
    lg.addColorStop(0.88, "rgba(0,0,0,1)");
    lg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "source-over";
    return c;
  }

  /* ---------- 预渲染：山脊层 ---------- */
  function ridgeY(cfg, x, phases, peaks) {
    var y = cfg.base * H;
    for (var k = 0; k < cfg.amps.length; k++) {
      y += Math.sin(x * cfg.freqs[k] + phases[k]) * cfg.amps[k] * H;
    }
    // 叠加高斯尖峰，让远山在和缓起伏之外也有清晰峰顶
    for (var p = 0; p < peaks.length; p++) {
      var pk = peaks[p];
      var d = (x / W - pk.cx) / pk.w;
      y -= pk.h * H * Math.exp(-d * d * 2.4);
    }
    return y + V_PAD;
  }

  function makeRidge(cfg, seed) {
    var rnd = mulberry32(seed);
    var phases = cfg.amps.map(function () { return rnd() * Math.PI * 2; });
    var peaks = [];
    for (var pi = 0; pi < cfg.peaks; pi++) {
      peaks.push({
        cx: -0.06 + rnd() * 1.12,
        w: 0.035 + rnd() * 0.055,
        h: cfg.peakMin + rnd() * (cfg.peakMax - cfg.peakMin)
      });
    }
    var cw = W + 2 * cfg.depth;
    var ch = H + V_PAD * 2;
    var c = document.createElement("canvas");
    c.width = Math.round(cw * DPR);
    c.height = Math.round(ch * DPR);
    var g = c.getContext("2d");
    g.scale(DPR, DPR);

    var grad = g.createLinearGradient(0, cfg.base * H - 0.08 * H, 0, ch);
    grad.addColorStop(0, rgba(cfg.top, 1));
    grad.addColorStop(1, rgba(cfg.bottom, 1));
    g.fillStyle = grad;

    g.beginPath();
    g.moveTo(0, ch);
    for (var x = 0; x <= cw; x += 3) {
      g.lineTo(x, ridgeY(cfg, x - cfg.depth, phases, peaks));
    }
    g.lineTo(cw, ch);
    g.closePath();
    g.fill();

    if (cfg.rim) {
      // 山脊受光边缘的极淡紫粉描边
      g.beginPath();
      for (x = 0; x <= cw; x += 3) {
        var wy = ridgeY(cfg, x - cfg.depth, phases, peaks);
        if (x === 0) g.moveTo(x, wy); else g.lineTo(x, wy);
      }
      g.strokeStyle = cfg.rim;
      g.lineWidth = 1.2;
      g.stroke();
    }
    return { img: c, w: cw, h: ch };
  }

  /* ---------- 松林：连续 Z 分布的树群 ---------- */
  /* 生成单棵树的几何（局部坐标，原点在树干根部，y 向上为负） */
  function makePineShape(h, rnd) {
    var tiers = 4 + Math.floor(rnd() * 3);
    var tw = h * (0.30 + rnd() * 0.10);
    var lists = [];
    for (var i = 0; i < tiers; i++) {
      var t = i / tiers;
      var cy = -h * (0.10 + t * 0.82);
      var cw = tw * (1 - t * 0.72) * (0.85 + rnd() * 0.3);
      var ch = h * (0.26 + rnd() * 0.08);
      lists.push([
        [(rnd() - 0.5) * 5, cy - ch],
        [-cw + (rnd() - 0.5) * 8, cy + ch * 0.32],
        [-cw * 0.45, cy + ch * 0.10],
        [cw + (rnd() - 0.5) * 8, cy + ch * 0.32]
      ]);
    }
    return {
      trunk: [-h * 0.018, -h * 0.12, h * 0.036, h * 0.14],
      tiers: lists
    };
  }

  /* 六个基准深度行，每棵树再做 z 抖动，形成连续的远近层次而非整齐两排 */
  var TREE_ROWS = 6;
  var TREE_Z_FAR = [42, 38, 76];
  var TREE_Z_NEAR = [6, 7, 15];

  function makeForest() {
    var rnd = mulberry32(FIXED_SEED ^ 0xB0);
    var span = W + 2 * 160;
    var list = [];

    for (var r = 0; r < TREE_ROWS; r++) {
      var zr = r / (TREE_ROWS - 1);
      var hNom = lerp(H * 0.048, H * 0.268, zr);
      var x = -40 + rnd() * hNom;
      while (x < span + 40) {
        // 行的深度上下抖动，使相邻行的树交错，不显出"行"的痕迹
        var z = clamp(zr + (rnd() - 0.5) * 0.16, 0, 1);
        var h = lerp(H * 0.048, H * 0.268, z) * (0.72 + rnd() * 0.45);
        // 越靠近观察者的树，根部纵向散布越大，避免树根排成一条线
        var baseY = Math.max(
          GROUND_Y * H + 2,
          lerp(GROUND_Y + 0.002, GROUND_Y + 0.115, z) * H
          + (rnd() - 0.5) * (0.010 + 0.030 * z) * H
        );

        var zc = Math.pow(z, 1.15);
        var c = [
          Math.round(lerp(TREE_Z_FAR[0], TREE_Z_NEAR[0], zc)),
          Math.round(lerp(TREE_Z_FAR[1], TREE_Z_NEAR[1], zc)),
          Math.round(lerp(TREE_Z_FAR[2], TREE_Z_NEAR[2], zc))
        ];

        list.push({
          x: x,
          z: z,
          h: h,
          baseY: baseY,
          depth: lerp(70, 152, z),
          amp: lerp(0.006, 0.024, z) * (0.75 + rnd() * 0.5),
          phase: rnd() * Math.PI * 2,
          speed: 0.5 + rnd() * 0.7,
          color: "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")",
          shape: makePineShape(h, rnd)
        });
        // 间距随树的大小变化：远树小且密，近树大且疏；偶发林间空隙
        var gapMul = 0.45 + rnd() * 0.85;
        if (rnd() < 0.10) gapMul += 1.1 + rnd() * 1.4;
        x += h * gapMul;
      }
    }
    // 由远及近排序，绘制时自然形成前后遮挡
    list.sort(function (a, b) { return a.z - b.z; });
    return list;
  }

  /* ---------- 星空（集中在顶部 1/3，上密下疏 + 独立呼吸相位） ----------
     星空视为无穷远：不参与任何镜头视差，屏幕坐标恒定。 */
  function makeStars(count, seed) {
    var rnd = mulberry32(seed);
    var arr = [];
    for (var i = 0; i < count; i++) {
      var roll = rnd();
      var y;
      // 约 88% 落在顶部 1/3，越靠近天顶越密；少量向下渗透形成自然过渡
      if (roll < 0.88) y = Math.pow(rnd(), 1.7) * H * STAR_Y * 0.94;
      else y = H * (STAR_Y * 0.62 + rnd() * STAR_Y * 0.42);
      var pick = rnd();
      var col = pick < 0.68 ? [223, 228, 255]
              : pick < 0.88 ? [255, 236, 205]
              : [238, 196, 222];
      arr.push({
        x: -40 + rnd() * (W + 80),
        y: y,
        r: 0.4 + rnd() * 1.15,
        base: 0.22 + rnd() * 0.5,
        amp: 0.14 + rnd() * 0.4,
        s1: 0.25 + rnd() * 0.85,     // 每颗星独立频率
        s2: 0.12 + rnd() * 0.5,
        p1: rnd() * Math.PI * 2,    // 每颗星独立相位
        p2: rnd() * Math.PI * 2,
        color: col,
        glow: rnd() < 0.12
      });
    }
    return arr;
  }

  /* ---------- 漂浮元素（云 / 山谷雾 / 林间雾），统一单坐标系回绕 ---------- */
  function makeDrifts() {
    var rnd = mulberry32(FIXED_SEED ^ 0x77);
    var list = [];
    var i, d;

    // 少量高空云（暗紫粉色），仅在顶部 1/3 的天空区域漂浮
    S.cloudSprite = makeBlobSprite(720, 180, [138, 108, 146], 22, FIXED_SEED ^ 0x11);
    for (i = 0; i < 6; i++) {
      list.push({
        group: "cloud",
        x0: rnd() * (W + 600) - 300,
        y: H * (0.05 + rnd() * 0.23),
        scale: 0.55 + rnd() * 0.95,
        speed: 3 + rnd() * 7,
        depth: 22 + rnd() * 10,
        alpha: 0.38 + rnd() * 0.26
      });
    }

    // 山谷雾：柔和的蓝紫雾，按组夹在各山脊层之间（中部 1/3）
    S.hazeSprite = makeBlobSprite(900, 150, [140, 130, 172], 20, FIXED_SEED ^ 0x22);
    var valley = [
      { y: GROUND_Y - 0.067, depth: 40, group: "gap1" },
      { y: GROUND_Y - 0.052, depth: 44, group: "gap1" },
      { y: GROUND_Y - 0.029, depth: 60, group: "gap2" },
      { y: GROUND_Y - 0.015, depth: 64, group: "gap2" },
      { y: GROUND_Y + 0.001, depth: 84, group: "gap3" },
      { y: GROUND_Y + 0.015, depth: 88, group: "gap3" }
    ];
    for (i = 0; i < valley.length; i++) {
      d = valley[i];
      list.push({
        group: d.group,
        sprite: "haze",
        x0: rnd() * (W + 700) - 350,
        y: H * d.y,
        scale: 0.6 + rnd() * 0.8,
        speed: 2 + rnd() * 5,
        depth: d.depth,
        alpha: 0.14 + rnd() * 0.14,
        breathS: 0.08 + rnd() * 0.16,
        breathP: rnd() * Math.PI * 2
      });
    }

    // 地面薄雾：贴近林线漂移，不遮盖地面实体
    S.mistSprite = makeBlobSprite(960, 200, [104, 100, 140], 24, FIXED_SEED ^ 0x33);
    for (i = 0; i < 7; i++) {
      list.push({
        group: "mist",
        sprite: "mist",
        x0: rnd() * (W + 800) - 400,
        y: H * (GROUND_Y + 0.01 + rnd() * 0.07),
        scale: 0.8 + rnd() * 1.1,
        speed: 4 + rnd() * 9,
        depth: 108 + rnd() * 30,
        alpha: 0.14 + rnd() * 0.14,
        breathS: 0.06 + rnd() * 0.14,
        breathP: rnd() * Math.PI * 2
      });
    }
    return list;
  }

  /* ---------- 暗角 ---------- */
  function makeVignette() {
    var c = document.createElement("canvas");
    c.width = Math.round(W * DPR);
    c.height = Math.round(H * DPR);
    var g = c.getContext("2d");
    g.scale(DPR, DPR);
    var rg = g.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.35,
      W / 2, H * 0.5, Math.max(W, H) * 0.78);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(1, "rgba(2,4,14,0.48)");
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
    return c;
  }

  /* ---------- 尺寸 / 重建 ---------- */
  function build() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    S.starsFar = makeStars(150, FIXED_SEED ^ 0x01);
    S.starsNear = makeStars(70, FIXED_SEED ^ 0x02);
    S.ridges = RIDGES.map(function (r, i) {
      var layer = makeRidge(r, FIXED_SEED ^ (0xA0 + i));
      layer.cfg = r;
      return layer;
    });
    S.forest = makeForest();
    S.ground = makeGroundLayer();
    S.drifts = makeDrifts();
    S.vignette = makeVignette();
    initSnow();
  }

  /* ---------- 预渲染：地面层（实体色块，随镜头视差移动） ---------- */
  function makeGroundLayer() {
    var cw = W + 2 * GROUND_DEPTH;
    var ch = H + 2 * GROUND_PAD;
    var c = document.createElement("canvas");
    c.width = Math.round(cw * DPR);
    c.height = Math.round(ch * DPR);
    var g = c.getContext("2d");
    g.scale(DPR, DPR);

    var y0 = GROUND_PAD + Math.round(H * GROUND_Y);

    // 不透明实体地面：整体深色色块，仅顶部带轻微受光渐变
    var grad = g.createLinearGradient(0, y0, 0, ch);
    grad.addColorStop(0.00, "#2a2446");
    grad.addColorStop(0.10, "#1c1a3a");
    grad.addColorStop(0.42, "#111129");
    grad.addColorStop(1.00, "#080a1a");
    g.fillStyle = grad;
    g.fillRect(0, y0, cw, ch - y0);

    // 横向极淡的光斑：地面随镜头移动时的可读参照，仍保持纯色块观感
    var rnd = mulberry32(FIXED_SEED ^ 0xC5);
    for (var i = 0; i < 5; i++) {
      var gx = rnd() * cw;
      var rr = W * (0.18 + rnd() * 0.22);
      var gy = y0 + H * (0.01 + rnd() * 0.05);
      var rg = g.createRadialGradient(gx, gy, 0, gx, gy, rr);
      rg.addColorStop(0, "rgba(132,110,164,0.06)");
      rg.addColorStop(1, "rgba(132,110,164,0)");
      g.fillStyle = rg;
      g.fillRect(0, y0, cw, ch - y0);
    }

    // 地平线暖光与受光细线属于地面本身，随地面一起移动
    var rg2 = g.createRadialGradient(cw / 2, y0, 0, cw / 2, y0, W * 0.55);
    rg2.addColorStop(0, "rgba(196,140,170,0.16)");
    rg2.addColorStop(1, "rgba(196,140,170,0)");
    g.fillStyle = rg2;
    g.fillRect(0, y0, cw, ch - y0);

    g.fillStyle = "rgba(201,150,180,0.16)";
    g.fillRect(0, y0 - 1, cw, 2);

    return { img: c, w: cw, h: ch };
  }

  /* ---------- 绘制 ---------- */
  var skyTmp = PALETTES.night.map(function (c) { return [c[0], c[1], c[2]]; });

  /* 目标色板 = 时段基准色 → 日出金粉 → 暴风雪去饱和提亮 */
  function mixSky(dst) {
    var base = PALETTES[env.segment] || PALETTES.night;
    for (var i = 0; i < dst.length; i++) {
      var s = vis.sunrise;
      var r = lerp(base[i][0], SUNRISE_PAL[i][0], s);
      var gr = lerp(base[i][1], SUNRISE_PAL[i][1], s);
      var b = lerp(base[i][2], SUNRISE_PAL[i][2], s);
      var lum = 0.32 * r + 0.5 * gr + 0.18 * b;
      r = lerp(r, lum, vis.storm * 0.55) + 26 * vis.storm;
      gr = lerp(gr, lum, vis.storm * 0.55) + 28 * vis.storm;
      b = lerp(b, lum, vis.storm * 0.55) + 32 * vis.storm;
      dst[i][0] = r; dst[i][1] = gr; dst[i][2] = b;
    }
  }

  function drawSky() {
    mixSky(skyTmp);
    for (var i = 0; i < skyCur.length; i++) {
      // 逐帧缓动，时段切换是极慢的位移而不是硬切
      skyCur[i][0] = lerp(skyCur[i][0], skyTmp[i][0], 0.055);
      skyCur[i][1] = lerp(skyCur[i][1], skyTmp[i][1], 0.055);
      skyCur[i][2] = lerp(skyCur[i][2], skyTmp[i][2], 0.055);
    }
    var g = ctx.createLinearGradient(0, 0, 0, H);
    for (i = 0; i < SKY_STOPS.length; i++) {
      g.addColorStop(SKY_STOPS[i], "rgb("
        + Math.round(skyCur[i][0]) + "," + Math.round(skyCur[i][1]) + ","
        + Math.round(skyCur[i][2]) + ")");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, -8, W, H + 16);   // 上下留冗余，容纳呼吸位移

    // 地平线暖光：暴风雪时几乎消失
    var warm = 0.16 * (1 - vis.storm * 0.9);
    if (warm > 0.004) {
      var rg = ctx.createRadialGradient(W * 0.5, H * GROUND_Y, 0,
        W * 0.5, H * GROUND_Y, W * 0.62);
      rg.addColorStop(0, "rgba(198,116,134," + warm + ")");
      rg.addColorStop(1, "rgba(198,116,134,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }

    // 日出：地平线金粉渐变，唯一一次真正的亮度跃升
    if (vis.sunrise > 0.02) {
      var gs = ctx.createLinearGradient(0, H * (GROUND_Y - 0.12), 0, H * GROUND_Y);
      gs.addColorStop(0, "rgba(255,214,170,0)");
      gs.addColorStop(1, "rgba(255,196,150," + (0.55 * vis.sunrise) + ")");
      ctx.fillStyle = gs;
      ctx.fillRect(0, H * (GROUND_Y - 0.12), W, H * 0.12 + 2);
    }
  }

  function drawGround() {
    // 地面作为最近景平面参与视差，与最近的树保持同样位移，避免树根在地面上"滑行"
    var dx = -GROUND_DEPTH - camXS * GROUND_DEPTH;
    var dy = -GROUND_PAD - camYS * GROUND_DEPTH * 0.1;
    ctx.drawImage(S.ground.img, dx, dy, S.ground.w, S.ground.h);

    // 饥饿：地面先失去光
    if (vis.hunger > 0.02) {
      ctx.fillStyle = "rgba(6,6,14," + (0.35 * vis.hunger) + ")";
      ctx.fillRect(0, H * GROUND_Y + dy, W, H - H * GROUND_Y - dy);
    }

    // 日出：地面第一次被照亮
    if (vis.sunrise > 0.02) {
      var g = ctx.createLinearGradient(0, H * (GROUND_Y + dy / H), 0, H * 0.94);
      g.addColorStop(0, "rgba(255,196,158," + (0.34 * vis.sunrise) + ")");
      g.addColorStop(0.42, "rgba(198,142,132," + (0.12 * vis.sunrise) + ")");
      g.addColorStop(1, "rgba(120,80,90,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, H * GROUND_Y + dy, W, H - H * GROUND_Y - dy);
    }
  }

  function drawStars(list, t, mul, tw) {
    if (mul < 0.02) return;
    var tt = t * tw;
    for (var i = 0; i < list.length; i++) {
      var st = list[i];
      // 越过三分线（中部 1/3 方向）渐隐
      var fade = 1 - smoothstep(H * STAR_Y * 0.9, H * (STAR_Y + 0.07), st.y);
      if (fade <= 0.01) continue;
      // 双正弦 + 独立相位/频率，保证闪烁错落
      var a = st.base
        + st.amp * Math.sin(tt * st.s1 + st.p1)
        + st.amp * 0.35 * Math.sin(tt * st.s2 * 1.7 + st.p2);
      a = clamp(a, 0.05, 1) * fade * mul;

      // 星空等效 z-index 无穷大：屏幕坐标恒定，不随镜头移动
      var sx = st.x;
      var sy = st.y;

      if (st.glow) {
        var gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, st.r * 4.2);
        gr.addColorStop(0, rgba(st.color, a * 0.5));
        gr.addColorStop(1, rgba(st.color, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(sx, sy, st.r * 4.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = rgba(st.color, a);
      ctx.beginPath();
      ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDrifts(t, group) {
    var spanX = W + 900, minX = -450;
    // 暴风雪把云抹掉，同时把雾推浓；白天雾偏薄，傍晚最黏
    var fogMul = group === "cloud"
      ? (1 - vis.storm * 0.75) * (1 - vis.sunrise * 0.9)
      : (1 + vis.storm * 1.1 + vis.lost * 0.5 + vis.exhausted * 0.25) * (SEG_FOG[env.segment] || 1);
    if (fogMul < 0.02) return;
    for (var i = 0; i < S.drifts.length; i++) {
      var d = S.drifts[i];
      if (d.group !== group) continue;
      var img = group === "cloud" ? S.cloudSprite
        : d.sprite === "haze" ? S.hazeSprite : S.mistSprite;
      // 单一坐标系：基础位置 + 自漂移 - 镜头视差，再回绕
      var x = wrap(d.x0 + t * d.speed - camXS * d.depth, minX, spanX);
      var y = d.y - camYS * d.depth * 0.3;
      var breath = d.breathS
        ? 0.78 + 0.22 * Math.sin(t * d.breathS + d.breathP)
        : 1;
      var dw = img.width * d.scale;
      var dh = img.height * d.scale;
      ctx.globalAlpha = clamp(d.alpha * breath * fogMul, 0, 0.9);
      ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
      // 补一张保证回绕期间不断流
      ctx.drawImage(img, x - dw / 2 + spanX, y - dh / 2, dw, dh);
    }
    ctx.globalAlpha = 1;
  }

  function drawRidgeLayer(layer) {
    var cfg = layer.cfg;
    var dx = -cfg.depth - camXS * cfg.depth;
    var dy = -V_PAD - camYS * cfg.depth * 0.3;
    // 暴风雪中远山被白雾吞掉
    ctx.globalAlpha = 1 - vis.storm * 0.92;
    ctx.drawImage(layer.img, dx, dy, layer.w, layer.h);
    ctx.globalAlpha = 1;
  }

  function drawForest(t) {
    var trees = S.forest;
    var windMul = 1 + vis.storm * 1.8;
    var windFreq = 0.85 + vis.storm * 0.5;
    for (var i = 0; i < trees.length; i++) {
      var tr = trees[i];
      var sx = tr.x - tr.depth - camXS * tr.depth;
      var margin = tr.h * 0.55;
      if (sx < -margin || sx > W + margin) continue;

      var sy = tr.baseY - camYS * tr.depth * 0.3;
      // 连贯风感：一阵风沿画面横扫（共享行波），叠加每棵树独立的相位与频率
      var ang = tr.amp * windMul * (
        0.65 * Math.sin(t * windFreq - tr.x * 0.0042) +
        0.35 * Math.sin(t * tr.speed + tr.phase)
      );

      var shp = tr.shape;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = tr.color;
      ctx.fillRect(shp.trunk[0], shp.trunk[1], shp.trunk[2], shp.trunk[3]);
      for (var j = 0; j < shp.tiers.length; j++) {
        var pts = shp.tiers[j];
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        ctx.lineTo(pts[1][0], pts[1][1]);
        ctx.lineTo(pts[2][0], pts[2][1]);
        ctx.lineTo(pts[3][0], pts[3][1]);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawGroundFog(t) {
    // 只在地平线与林线交界处留一层薄雾，地面本身保持实体色块
    var top = H * (GROUND_Y - 0.055);
    var bot = H * (GROUND_Y + 0.085);
    var g = ctx.createLinearGradient(0, top, 0, bot);
    var breath = 0.92 + 0.08 * Math.sin(t * 0.11 + 1.3);
    var dens = 0.34 * breath * (1 + vis.storm * 1.4 + vis.exhausted * 0.45);
    g.addColorStop(0.00, rgba([24, 26, 52], 0));
    g.addColorStop(0.45, rgba([26, 28, 56], dens));
    g.addColorStop(1.00, rgba([20, 22, 46], 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, bot - top);
  }

  /* ---------- 暴风雪：横向飞雪粒子 ---------- */
  function initSnow() {
    var rnd = mulberry32(FIXED_SEED ^ 0x5E);
    snow = [];
    for (var i = 0; i < 260; i++) {
      snow.push({
        x: rnd() * (W + 120) - 60,
        y: rnd() * (H + 40) - 20,
        len: 5 + rnd() * 20,
        spd: 0.55 + rnd() * 0.9
      });
    }
  }

  function drawSnow(dt) {
    if (vis.storm < 0.02) return;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (var i = 0; i < snow.length; i++) {
      var p = snow[i];
      var spd = (560 + p.spd * 420) * vis.storm;
      p.x -= spd * dt;
      p.y += spd * 0.14 * dt;
      if (p.x < -80) p.x += W + 160; else if (p.x > W + 80) p.x -= W + 160;
      if (p.y > H + 20) p.y -= H + 40; else if (p.y < -20) p.y += H + 40;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.len, p.y - p.len * 0.16);
    }
    ctx.strokeStyle = "rgba(226,232,244," + (0.55 * vis.storm) + ")";
    ctx.stroke();
  }

  /* ---------- 主循环 ---------- */
  function frame(now) {
    if (!lastT) lastT = now;
    var dt = Math.min((now - lastT) / 1000, 0.06);
    lastT = now;
    var t = now / 1000;

    // 环境参数逐帧逼近目标：时段、天气都是极慢的位移，不做硬切
    for (var k in vis) {
      if (vis.hasOwnProperty(k)) vis[k] = lerp(vis[k], env[k], 0.045);
    }

    camX = lerp(camX, tgtX, 0.045);
    camY = lerp(camY, tgtY, 0.045);
    // 迷失时方向感被剥夺：视差幅度收小
    var paral = 1 - 0.55 * vis.lost;
    camXS = camX * paral;
    camYS = camY * paral;

    // 第一人称呼吸：负伤后变慢变重，神经透支时变浅
    var breath = Math.sin(t * (1 - 0.35 * vis.wound))
      * (2.5 + 2.5 * vis.wound) * (1 - 0.5 * vis.exhausted);

    var starMul = (SEG_STAR[env.segment] || 1) * (1 - vis.storm * 0.95) * (1 - vis.sunrise);
    var starTw = 1 + vis.exhausted * 1.8;

    ctx.save();
    // 迷失时地面占比放大：整体世界略上移，地平线压到视线以下
    ctx.translate(0, breath - H * 0.018 * vis.lost);

    drawSky();
    drawStars(S.starsFar, t, starMul, starTw);
    drawStars(S.starsNear, t, starMul, starTw);
    drawDrifts(t, "cloud");

    // 中部 1/3：三层山脉，谷雾夹于层间
    drawRidgeLayer(S.ridges[0]);
    drawDrifts(t, "gap1");
    drawRidgeLayer(S.ridges[1]);
    drawDrifts(t, "gap2");
    drawRidgeLayer(S.ridges[2]);

    // 底部 1/3：平坦地面 + 地平线雾化衔接
    drawGround();
    drawDrifts(t, "gap3");

    // 松林立于地面上，微风摆动，基部由薄雾柔化
    drawForest(t);
    drawDrifts(t, "mist");

    drawGroundFog(t);
    drawSnow(dt);
    ctx.restore();

    // 暴风雪：整体灰白压层
    if (vis.storm > 0.02) {
      ctx.fillStyle = "rgba(176,182,196," + (0.28 * vis.storm) + ")";
      ctx.fillRect(0, 0, W, H);
    }

    // 负伤：视野左侧被雾侵蚀（雾是浅色，压在暗背景上才看得见）
    // 画在暗角之上，避免被暗角压回去
    if (vis.wound > 0.02) {
      var wg = ctx.createLinearGradient(0, 0, W * 0.62, 0);
      wg.addColorStop(0, "rgba(112,105,140," + (0.50 * vis.wound) + ")");
      wg.addColorStop(0.55, "rgba(96,90,124," + (0.18 * vis.wound) + ")");
      wg.addColorStop(1, "rgba(96,90,124,0)");
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, W * 0.62, H);
    }

    // 暗角：负重与迷失时加重
    ctx.globalAlpha = clamp(0.75 + 0.45 * vis.wound + 0.35 * vis.lost, 0, 1);
    ctx.drawImage(S.vignette, 0, 0, W, H);
    ctx.globalAlpha = 1;

    requestAnimationFrame(frame);
  }

  /* ---------- 交互 ---------- */
  function setTarget(clientX, clientY) {
    tgtX = (clientX / W) * 2 - 1;
    tgtY = (clientY / H) * 2 - 1;
  }
  window.addEventListener("mousemove", function (e) {
    setTarget(e.clientX, e.clientY);
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (e.touches.length) setTarget(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener("touchstart", function (e) {
    if (e.touches.length) setTarget(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 120);
  });

  build();
  requestAnimationFrame(frame);

  /* ---------- 对外接口：由 scripts/game.js 驱动 ---------- */
  window.Scene = {
    setSegment: function (seg) {
      if (PALETTES[seg]) env.segment = seg;
    },
    setEnv: function (o) {
      for (var k in o) {
        if (o.hasOwnProperty(k) && env.hasOwnProperty(k)) env[k] = o[k];
      }
    },
    resize: function () { build(); }
  };
})();
