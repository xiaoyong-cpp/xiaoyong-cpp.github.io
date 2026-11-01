(function () {
  "use strict";

  var SEGMENTS = ["day", "dusk", "dawn", "night"];

  var FAST = /(^|&)fast=1(&|$)/.test(location.search.replace(/^\?/, ""));
  var SPEED = FAST ? 4 : 1;

  var T = {
    in: Math.round(1800 / SPEED), hold: Math.round(900 / SPEED), out: Math.round(500 / SPEED),
    rin: Math.round(1300 / SPEED), rhold: Math.round(700 / SPEED), rout: Math.round(450 / SPEED),
    choiceIn: 700
  };

  /* ---------- 状态 ---------- */
  var state = {
    day: 1,
    segIndex: 0,
    food: 8,
    sanity: 8,
    bond: 8,
    hp: 8,
    lost: false,
    lostTries: 0,
    wounded: false,
    bondCd: 0,
    storm: false,
    sunrise: false,
    over: false
  };

  var busy = false;

  /* ---------- DOM ---------- */
  var elLine = document.getElementById("line");
  var elChoices = document.getElementById("choices");
  var elGauges = document.getElementById("gauges");
  var elVeil = document.getElementById("veil");
  var elDay = document.getElementById("day");

  var gauges = {};
  ["hp", "food", "sanity", "bond"].forEach(function (k) {
    var g = elGauges.querySelector(".gauge." + k);
    gauges[k] = { box: g, bot: g.querySelector(".bot"), top: g.querySelector(".top") };
  });

  function clamp8(v) { return v < 0 ? 0 : (v > 8 ? 8 : v); }
  function add(k, v) { state[k] = clamp8(state[k] + v); }

  /* ---------- 文案 ---------- */
  var LINES = {
    seg: {
      day: [
        "雪面硬得像石头。看得比夜里远一点。",
        "云压得很低，天和地是一个颜色。",
        "安静。只有自己的呼吸。"
      ],
      dusk: [
        "紫红色贴着地平线走了一圈，又沉下去。",
        "光退得很快。先没有影子，然后没有天。",
        "风把雪吹成薄薄一层，在脚边响。"
      ],
      dawn: [
        "地平线上还剩一条极细的亮线。",
        "最冷的时候。风停了，反而更冷。",
        "远处的山从雾里露出一点边。"
      ],
      night: [
        "星全在。没有一颗属于我。",
        "黑暗里能听见很远的声音。",
        "雪落在背上，很轻。"
      ]
    },
    segLost: {
      day: ["每一片林子和刚才那片都一样。"],
      dusk: ["太阳应该沉下去了，但说不清在哪个方向。"],
      dawn: ["走了一夜，又回到自己的脚印上。"],
      night: ["树影重复。我数不清这是第几次看到它。"]
    },
    segWounded: {
      day: ["侧腹在疼。每一次呼吸都比上一次短。"],
      dusk: ["血味淡了，但步子迈不大。"],
      dawn: ["醒着的时候，疼是连续的。"],
      night: ["不敢趴下。趴下就起不来了。"]
    },

    huntAlone: [
      "雪下面有活的东西。我等了很久，它才出来。",
      "咬住的时候，热气一下涌上来。",
      "拖回树下吃，吃得很干净。"
    ],
    huntPack: [
      "它们跑在前面。我跟在后面，分到的不多。",
      "围住的那只很大，抢的人也很多。",
      "靠得近了些，能听见它们互相的信号。"
    ],
    doze: [
      "把鼻子埋进尾巴里。风从头顶过去。",
      "睡一会儿。梦里也是雪。",
      "靠着树干闭上眼，时间短得像没有。"
    ],
    heal: [
      "伤口结了薄薄的一层。舔开，又结上。",
      "血味淡了。至少今天没有变坏。"
    ],
    walk: ["在雪上慢慢走了一圈。什么都没做。"],
    huntAloneDusk: ["天暗下来，猎物也谨慎。抓到的不多。"],
    earlyHunt: [
      "天还没亮就出去了。回来时眼睛发涩。",
      "冷空气让脑子里只剩下一个念头。"
    ],
    sleepMore: ["又睡了一会儿。醒来时听见风变了。"],
    nightSleep: [
      "睡得很沉。醒来时雪埋到了背。",
      "听着远处的声音，慢慢睡着。"
    ],
    nightGuard: [
      "在队伍边缘转。它们睡的时候，我醒着。",
      "天亮时，它们看我的眼神不一样了一点。"
    ],
    nightWatch: ["整夜没有躺下。风从侧面来，我一直在听。"],
    nightHeal: ["伤口又暖了一点。睡得断断续续。"],
    nightSleepWoundedFull: ["身体好得差不多了。睡得比之前踏实。"],

    attacked: ["夜里被咬醒。它们比我大。", "争食的时候，腿上挨了一口。"],
    searchOk: ["味道对上了。我朝那边跑。"],
    searchNo: ["绕了一圈，又回到自己的脚印上。", "雪把味道盖住了。", "雾里没有它们留下的东西。"],
    halluc: ["雾里有个影子。走近了，什么都没有。", "听见嗥叫。也可能是风。"]
  };

  var NODES = {
    10: {
      lines: ["风变了。空气里没有一丝水汽。", "同样的一天，要花更多力气才能填满。"],
      apply: function () {}
    },
    20: {
      lines: ["雪横着过来。山的轮廓没了。"],
      apply: function () {}
    },
    23: {
      lines: ["回头的时候，脚印已经被雪盖住。", "狼群不在任何一个方向。"],
      apply: function () { state.lost = true; state.lostTries = 0; }
    },
    25: {
      lines: function () {
        return state.lost
          ? ["雪停了。风还在。", "还是没有他们的味道。"]
          : ["雪停了。风还在。"];
      },
      apply: function () {}
    },
    29: {
      when: function () { return state.lost; },
      lines: ["嗥叫。很近。", "我朝它走过去。"],
      apply: function () { state.lost = false; state.lostTries = 0; }
    },
    30: {
      lines: ["刚回到队伍，就又倒下了。", "有什么在腹侧裂开。"],
      apply: function () { state.wounded = true; state.hp -= 3; }
    }
  };

  /* ---------- 画面同步 ---------- */
  function syncEnv() {
    state.storm = state.day >= 20 && state.day < 25;
    if (!window.Scene) return;
    window.Scene.setEnv({
      storm: state.storm ? 1 : 0,
      lost: state.lost ? 1 : 0,
      wound: state.wounded ? 1 : 0,
      hunger: state.food <= 0 ? 1 : 0,
      exhausted: state.sanity < 2 ? 1 : 0,
      sunrise: state.sunrise ? 1 : 0
    });
  }

  function segmentKey() { return SEGMENTS[state.segIndex]; }

  /* ---------- 刻度 ---------- */
  function setGauge(k, v, open) {
    var el = gauges[k];
    var total = k === "hp" ? 50 : 40;
    var fill = total * clamp8(v) / 8;
    var gs = 18, ge = 22;
    var botH, topH;
    if (open) {
      botH = Math.min(fill, gs);
      topH = Math.max(0, fill - ge);
    } else {
      botH = fill;
      topH = 0;
    }
    el.bot.style.height = botH + "px";
    el.top.style.height = topH + "px";
  }

  function updateGauges() {
    setGauge("hp", state.hp, false);
    setGauge("food", state.food, false);
    setGauge("sanity", state.sanity, state.sanity < 2);
    setGauge("bond", state.bond, state.bond < 2 && !state.lost);
  }

  function updateDay() {
    elDay.textContent = "第 " + state.day + " 天";
  }

  /* ---------- 文字 ---------- */
  function showLine(text, ip, hold, op, cb) {
    elLine.style.transition = "opacity " + ip + "ms ease-in";
    elLine.style.opacity = "0";
    elLine.textContent = text;
    void elLine.offsetWidth;
    elLine.style.opacity = "0.85";
    window.setTimeout(function () {
      elLine.style.transition = "opacity " + op + "ms ease-out";
      elLine.style.opacity = "0";
      window.setTimeout(cb, op);
    }, ip + hold);
  }

  function narrate(lines, done, fast) {
    var list = lines.slice();
    (function next() {
      if (!list.length) { done(); return; }
      var text = list.shift();
      showLine(text, fast ? T.rin : T.in, fast ? T.rhold : T.hold, fast ? T.rout : T.out, next);
    })();
  }

  function pick(pool) {
    if (typeof pool === "string") return pool;
    var i = (state.day * 7 + state.segIndex * 3) % pool.length;
    return pool[i];
  }

  /* ---------- 菜单 ---------- */
  function healItem() {
    return state.hp >= 8
      ? { label: "散步", act: "walk" }
      : { label: "舔舐伤口", act: "heal" };
  }

  function buildMenu() {
    var seg = segmentKey();
    var s = state;
    var items = [];

    if (seg === "day") {
      items.push({ label: "单独猎食", act: "huntAlone" });
      if (!s.lost) items.push({ label: "集体猎食", act: "huntPack" });
      items.push({ label: "偷懒打盹", act: "doze" });
      items.push(healItem());
      if (s.lost) items.push({ label: "寻找狼群", act: "search" });
    } else if (seg === "dusk") {
      items.push({ label: "单独猎食", act: "huntAloneDusk" });
      if (!s.lost) items.push({ label: "集体猎食", act: "huntPack" });
      items.push({ label: "偷懒打盹", act: "doze" });
      items.push(healItem());
    } else if (seg === "dawn") {
      items.push({ label: "起早捕猎", act: "earlyHunt" });
      items.push({ label: "继续睡觉", act: "sleepMore" });
    } else {
      if (s.wounded) {
        items.push(s.hp >= 8
          ? { label: "睡觉", act: "nightSleepWoundedFull" }
          : { label: "舔舐伤口", act: "nightHeal" });
      } else if (s.lost) {
        items.push({ label: "睡觉", act: "nightSleepLost" });
      } else {
        items.push({ label: "睡觉", act: "nightSleep" });
      }
      items.push(s.lost ? { label: "守夜", act: "nightWatch" } : { label: "放哨", act: "nightGuard" });
    }

    // 神经透支：偶尔多出一行灰色选项
    if (s.sanity < 2 && ((s.day * 4 + s.segIndex) % 3 === 0)) {
      items.push({ label: "走进雾里", act: "halluc", grey: true });
    }
    return items;
  }

  function showChoices(menu) {
    elChoices.innerHTML = "";
    menu.forEach(function (it) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "choice" + (it.grey ? " ghost" : "");
      b.textContent = it.label;
      b.addEventListener("click", function () { select(it); });
      elChoices.appendChild(b);
    });
    elChoices.style.transition = "opacity " + T.choiceIn + "ms ease-out";
    void elChoices.offsetWidth;
    elChoices.classList.add("on");
  }

  function hideChoices() {
    elChoices.classList.remove("on");
    elChoices.innerHTML = "";
  }

  /* ---------- 行动 ---------- */
  function applyAction(item) {
    var s = state;
    var res = { lines: [] };

    switch (item.act) {
      case "huntAlone": add("food", 4); break;
      case "huntPack": add("food", 2); add("bond", 2); break;
      case "doze": add("sanity", 3); break;
      case "heal": add("hp", 1); break;
      case "walk": break;
      case "huntAloneDusk": add("food", 3); break;
      case "earlyHunt": add("food", 3); add("sanity", -1); break;
      case "sleepMore": add("sanity", 2); break;
      case "nightSleep": add("sanity", 4); break;
      case "nightGuard": add("bond", 4); break;
      case "nightWatch": break;
      case "nightHeal": add("hp", 2); add("sanity", 1); break;
      case "nightSleepWoundedFull": add("sanity", 2); break;

      case "nightSleepLost":
        if (Math.random() < 0.45) {
          add("hp", -2); add("food", -2);
          res.lines = [pick(LINES.attacked)];
        } else {
          res.lines = [pick(LINES.nightSleep)];
        }
        break;

      case "search":
        var rate = 0.35 + s.lostTries * 0.10;
        if (Math.random() < rate) {
          s.lost = false; s.lostTries = 0;
          res.lines = [pick(LINES.searchOk)];
        } else {
          s.lostTries++;
          res.lines = [pick(LINES.searchNo)];
        }
        break;

      case "halluc":
        add("sanity", -1);
        res.lines = [pick(LINES.halluc)];
        break;
    }

    if (!res.lines.length) res.lines = [pick(LINES[item.act] || "……")];
    return res;
  }

  function select(item) {
    if (busy || state.over) return;
    busy = true;
    hideChoices();

    var res = applyAction(item);
    syncEnv();
    updateGauges();

    narrate(res.lines, function () {
      busy = false;
      if (state.hp <= 0) { death(); return; }
      advanceSegment();
    }, true);
  }

  /* ---------- 时段推进 ---------- */
  function enterSegment() {
    if (state.over) return;
    if (window.Scene) window.Scene.setSegment(segmentKey());
    syncEnv();
    updateGauges();

    var seg = segmentKey();
    var pool = LINES.seg[seg];
    if (state.lost && LINES.segLost[seg]) pool = LINES.segLost[seg];
    else if (state.wounded && LINES.segWounded[seg]) pool = LINES.segWounded[seg];

    var menu = buildMenu();
    narrate([pool[(state.day + state.segIndex) % pool.length]], function () {
      if (state.over) return;
      showChoices(menu);
    });
  }

  function advanceSegment() {
    if (state.over) return;
    state.segIndex++;
    if (state.segIndex >= SEGMENTS.length) {
      state.segIndex = 0;
      settleDay();
    } else {
      enterSegment();
    }
  }

  function decayAmount(day) {
    if (day <= 10) return 2;
    if (day <= 20) return 3;
    if (day <= 30) return 4;
    return 5;
  }

  function settleDay() {
    var s = state;
    var d = decayAmount(s.day);

    s.food = clamp8(s.food - d);
    s.sanity = clamp8(s.sanity - d);
    if (!s.lost) s.bond = clamp8(s.bond - d);

    var lines = [];
    if (s.food <= 0) { s.hp -= 1; lines.push("肚子空了一整夜。"); }
    if (s.sanity < 2) { s.hp -= 1; lines.push("脑子里全是响声，分不清哪个是真的。"); }
    // 冷却先递减，避免触发当次就吃掉一天
    if (s.bondCd > 0) s.bondCd--;
    if (!s.lost && s.bond < 2 && s.bondCd <= 0) {
      s.hp -= 2; s.bond = 4; s.bondCd = 3;
      lines.push("它们咬了我。我退到最外圈。");
    }

    syncEnv();
    updateGauges();
    if (s.day === 1) elGauges.classList.add("on");

    s.day++;
    updateDay();

    if (s.hp <= 0) { death(); return; }
    narrate(lines, startDay, true);
  }

  function startDay() {
    var s = state;
    if (s.over) return;
    if (s.hp <= 0) { death(); return; }
    if (s.day >= 40) { sunrise(); return; }

    var node = NODES[s.day];
    if (node && node.when && !node.when()) node = null;

    if (node) {
      node.apply();
      syncEnv();
      updateGauges();
      if (s.hp <= 0) { death(); return; }
      var lines = typeof node.lines === "function" ? node.lines() : node.lines;
      narrate(lines, enterSegment);
    } else {
      enterSegment();
    }
  }

  /* ---------- 结局 ---------- */
  function death() {
    if (state.over) return;
    state.over = true;
    hideChoices();
    state.sunrise = false;
    syncEnv();

    elVeil.style.transition = "opacity " + Math.round(4500 / SPEED) + "ms ease-in";
    elVeil.style.opacity = "1";

    window.setTimeout(function () {
      elLine.textContent = "雪落在身上，我没有再站起来。";
      elLine.style.transition = "opacity " + T.in + "ms ease-in";
      elLine.style.opacity = "0.85";
    }, Math.round(3400 / SPEED));
  }

  function sunrise() {
    if (state.over) return;
    state.over = true;
    state.sunrise = true;
    hideChoices();
    if (window.Scene) window.Scene.setSegment("day");
    syncEnv();

    narrate(["地平线上有一条亮线。", "它没有像往常那样沉下去。"], function () {
      elLine.style.transition = "opacity " + T.in + "ms ease-in";
      elLine.style.opacity = "0";
      elLine.textContent = "第四十天。我还站着。";
      void elLine.offsetWidth;
      elLine.style.opacity = "0.85";
    });
  }

  /* ---------- 启动 ---------- */
  function applyDebug() {
    var m = location.search.match(/[?&]day=(\d+)/);
    if (!m) return false;
    var d = parseInt(m[1], 10);
    if (!d) return false;
    d = Math.min(40, Math.max(1, d));
    state.day = d;
    state.food = 6;
    state.sanity = 6;
    state.bond = 6;
    state.hp = 7;
    state.lost = d >= 23 && d < 29;
    state.wounded = d >= 30;
    state.lostTries = 0;
    return true;
  }

  function boot() {
    var debug = applyDebug();
    syncEnv();
    updateGauges();
    updateDay();
    if (debug) elGauges.classList.add("on");
    if (window.Scene) window.Scene.setSegment(segmentKey());

    if (state.day >= 40) { sunrise(); return; }
    if (debug) { startDay(); return; }

    narrate([
      "日落之后，太阳就没有再升起来。",
      "四十天以后，它才会回来。"
    ], startDay);
  }

  boot();
})();
