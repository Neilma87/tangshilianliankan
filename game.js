/* 唐诗连连看 —— 一笔连线成诗
 * 题库: window.TANG_POEMS (poems.js，源自 chinese-poetry/chinese-poetry《水墨唐诗》)
 */
(function () {
  'use strict';

  var TOTAL = Math.min(50, window.TANG_POEMS.length); // 唐诗数量上限 50
  var MIN_SENIOR = 6;                                  // 每局至少 6 首高中必背篇目（高于“至少5首”的要求）
  var MAX_ATTEMPTS = 2;                                // 每题只有两次连线机会
  var SCORE_PER_ANSWER = 2;                            // 每答对一次 2 分
  var LS_KEY = 'tslk-last-set';                        // 记录上一局题面，保证刷新后不与上一局完全相同

  // ---------- DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), svgEl = $('line-layer');
  var hudLevel = $('hud-level'), hudScore = $('hud-score'), hudTime = $('hud-time');
  var scorePop = $('score-pop'), progressBar = $('progress-bar');
  var poemTitleEl = $('poem-title'), poemAuthorEl = $('poem-author'), tierBadgeEl = $('tier-badge'), slotsEl = $('slots');
  var startScreen = $('start-screen'), endScreen = $('end-screen'), poemCard = $('poem-card');
  var endTimeEl = $('end-time'), endScoreEl = $('end-score'), endRemarkEl = $('end-remark');
  var cardTitle = $('card-title'), cardAuthor = $('card-author'), cardBody = $('card-body');
  var btnPrevQ = $('btn-prev-q'), btnNextQ = $('btn-next-q'), navStatus = $('nav-status');
  var chancesEl = $('chances');

  // ---------- 状态 ----------
  var order = [], levelIdx = 0, score = 0;
  var answered = {};              // 已答对的题：{ 关卡索引: true }（跳过的题不在其中，可返回补答）
  var failed = {};                // 两次连线均错、被锁定的题：{ 关卡索引: true }（不得分、答案不可更改）
  var attempts = {};              // 各题已用掉的错误连线次数：{ 关卡索引: 0|1|2 }
  var answerSeq = [];             // 当前题正确答案在 9 格中的索引序列（用于失败后揭示）
  var cells = [];                 // 9 个格 {char}
  var chain = [];                 // 已连格子的索引（一笔路径）
  var drawing = false, locked = false, started = false, advancing = false;
  // 当前这一笔手势：active=按住中, pointerId=手势归属, judged=是否已判定（防重复判题）
  var gesture = { active: false, pointerId: null, judged: false };
  var startTime = 0, timerId = null, finishElapsed = 0;
  var cellEls = [];
  var pointer = { x: 0, y: 0, active: false };
  var cardTimer = null, wrongTimer = null, settleTimer = null, audioCtx = null;

  // 干扰字池：全部诗中的汉字，去掉本句用字
  var distractorPool = [];
  (function buildPool() {
    var set = {};
    window.TANG_POEMS.forEach(function (p) {
      p.paragraphs.join('').replace(/[\u4e00-\u9fa5]/g, function (ch) { set[ch] = 1; return ch; });
    });
    distractorPool = Object.keys(set);
  })();

  // ---------- 工具 ----------
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    var m = (s / 60) | 0;
    s = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  // 规整原数据中“？。”这类叠用标点
  function normalizeText(t) {
    return t.replace(/([，。！？；])[，。！？；]+/g, '$1');
  }

  function currentPoem() { return order[levelIdx]; }

  function answeredCount() { return Object.keys(answered).length; }
  function isDone(idx) { return !!answered[idx]; }
  function isFailed(idx) { return !!failed[idx]; }
  function isSettled(idx) { return !!answered[idx] || !!failed[idx]; }
  function chancesLeft(idx) { return failed[idx] ? 0 : MAX_ATTEMPTS - (attempts[idx] || 0); }

  // ---------- 抽题：每局从题库随机抽 20 首，保证高中必背 ≥ MIN_SENIOR 首，
  //            且不与上一局（刷新前）题面完全相同 ----------
  function signature(list) {
    return list.map(function (p) { return p.line; }).sort().join('|');
  }

  function drawSelection() {
    var pool = window.TANG_POEMS;
    var needSenior = Math.min(MIN_SENIOR, TOTAL,
      pool.filter(function (p) { return p.tier === 'sr'; }).length);
    var prevSig = null;
    try { prevSig = sessionStorage.getItem(LS_KEY); } catch (e) {}

    for (var attempt = 0; attempt < 20; attempt++) {
      var seniors = shuffle(pool.filter(function (p) { return p.tier === 'sr'; }));
      var picked = seniors.slice(0, needSenior);
      // 其余名额只从经典名篇中抽取，保证每局恰好 needSenior 首高中、分布稳定
      var juniors = shuffle(pool.filter(function (p) { return p.tier !== 'sr'; }));
      picked = picked.concat(juniors.slice(0, TOTAL - needSenior));
      picked = shuffle(picked);
      var sig = signature(picked);
      if (sig !== prevSig || attempt === 19) {
        try { sessionStorage.setItem(LS_KEY, sig); } catch (e) {}
        return picked;
      }
    }
  }

  // ---------- 音效（WebAudio，无外部资源） ----------
  function tone(freq, dur, type, vol, delay) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var t0 = audioCtx.currentTime + (delay || 0);
      var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.06, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (e) { /* 不支持音频时静默 */ }
  }
  var sndAdd = function () { tone(620, 0.06, 'sine', 0.045); };
  var sndBack = function () { tone(420, 0.05, 'sine', 0.035); };
  var sndRight = function () { tone(523, 0.12, 'sine', 0.07); tone(659, 0.16, 'sine', 0.07, 0.11); tone(784, 0.2, 'sine', 0.06, 0.23); };
  var sndWrong = function () { tone(190, 0.28, 'sawtooth', 0.05); };

  // ---------- 生成棋盘：把 7 个字铺成随机的一笔(正交相邻)蛇形路径，另 2 格放干扰字 ----------
  function makeSnake(len) {
    for (var tries = 0; tries < 400; tries++) {
      var start = (Math.random() * 9) | 0;
      var used = {}, path = [start], cur = start;
      used[start] = 1;
      while (path.length < len) {
        var r = (cur / 3) | 0, c = cur % 3;
        var cand = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
          .filter(function (p) { return p[0] >= 0 && p[0] < 3 && p[1] >= 0 && p[1] < 3; })
          .map(function (p) { return p[0] * 3 + p[1]; })
          .filter(function (i) { return !used[i]; });
        if (!cand.length) break;
        cur = shuffle(cand)[0];
        used[cur] = 1;
        path.push(cur);
      }
      if (path.length === len) return path;
    }
    return [0, 3, 6, 7, 4, 1, 2]; // 理论兜底
  }

  function buildLevel() {
    var poem = currentPoem();
    var path = makeSnake(poem.line.length);
    cells = [];
    for (var i = 0; i < 9; i++) cells.push({ char: '' });
    for (var k = 0; k < poem.line.length; k++) cells[path[k]].char = poem.line.charAt(k);

    var used = {};
    poem.line.split('').forEach(function (ch) { used[ch] = 1; });
    var pool = shuffle(distractorPool.filter(function (ch) { return !used[ch]; }));
    for (var d = 0, i2 = 0; i2 < 9; i2++) {
      if (!cells[i2].char) { cells[i2].char = pool[d++ % pool.length]; used[cells[i2].char] = 1; }
    }

    // 记录正确路径格子序列（句内无重复字、干扰池不含句字，故每字在棋盘中唯一）
    answerSeq = poem.line.split('').map(function (ch) {
      for (var ci = 0; ci < 9; ci++) if (cells[ci].char === ch) return ci;
      return -1;
    });

    chain = [];
    resetGesture();
    boardEl.classList.remove('correct', 'wrong');
    boardEl.classList.toggle('done', isDone(levelIdx));
    boardEl.classList.toggle('failed', isFailed(levelIdx));

    boardEl.innerHTML = '';
    cellEls = [];
    cells.forEach(function (cell) {
      var div = document.createElement('div');
      div.className = 'cell';
      var span = document.createElement('span');
      span.className = 'char';
      span.textContent = cell.char;
      div.appendChild(span);
      boardEl.appendChild(div);
      cellEls.push(div);
    });

    poemTitleEl.textContent = poem.title;
    poemAuthorEl.textContent = '〔唐〕' + poem.author;
    // 所有题目的徽标文案与样式统一，不再按学段区分
    tierBadgeEl.textContent = '经典名篇';
    tierBadgeEl.className = 'tier-badge tier-jr';
    hudLevel.textContent = levelIdx + 1;
    progressBar.style.width = (answeredCount() / TOTAL * 100) + '%';
    renderChain();
    updateNav();
  }

  // ---------- 渲染连线 ----------
  function boardRect() { return boardEl.getBoundingClientRect(); }
  function cellCenter(i, br) {
    var r = cellEls[i].getBoundingClientRect();
    return { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 };
  }

  function renderChain() {
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    var br = boardRect();
    svgEl.setAttribute('width', br.width);
    svgEl.setAttribute('height', br.height);

    var pts = chain.map(function (i) { return cellCenter(i, br); });
    if (pointer.active && drawing) pts.push({ x: pointer.x - br.left, y: pointer.y - br.top });

    // 已选格高亮 + 填空
    var failedNow = isFailed(levelIdx);
    cellEls.forEach(function (el, i) {
      el.classList.toggle('on', chain.indexOf(i) !== -1);
      // 两次机会用尽：在棋盘上标出正确路径
      el.classList.toggle('reveal-fail', failedNow && answerSeq.indexOf(i) !== -1);
    });
    var slotSpans = slotsEl.children;
    var doneNow = isDone(levelIdx);
    var lineNow = currentPoem().line;
    for (var s = 0; s < lineNow.length; s++) {
      if (slotSpans[s]) {
        // 已答对 / 已失败（上一题返回查看时）直接把整句填在空格中，棋盘锁定不可再画
        slotSpans[s].textContent = (doneNow || failedNow) ? lineNow.charAt(s)
          : (chain[s] !== undefined ? cells[chain[s]].char : '');
        slotSpans[s].classList.toggle('filled', doneNow || failedNow || chain[s] !== undefined);
        slotSpans[s].classList.toggle('locked', doneNow || failedNow);
        slotSpans[s].classList.toggle('fail', failedNow);
      }
    }

    if (pts.length >= 2) {
      var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('class', 'link-line');
      poly.setAttribute('points', pts.map(function (p) { return p.x + ',' + p.y; }).join(' '));
      svgEl.appendChild(poly);
    }
    chain.forEach(function (ci, n) {
      var c = cellCenter(ci, br);
      var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('class', 'link-dot' + (n === 0 ? ' link-dot-start' : ''));
      dot.setAttribute('cx', c.x);
      dot.setAttribute('cy', c.y);
      dot.setAttribute('r', n === 0 ? 8 : 6);
      svgEl.appendChild(dot);
    });
  }

  // ---------- 一笔连线交互 ----------
  function hitCell(clientX, clientY) {
    var br = boardRect();
    var size = br.width / 3;
    var best = -1, bestD = Infinity;
    for (var i = 0; i < 9; i++) {
      var c = cellCenter(i, br);
      var dx = clientX - (br.left + c.x), dy = clientY - (br.top + c.y);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = i; }
    }
    return bestD < size * 0.52 ? best : -1;
  }

  function isAdjacent(a, b) {
    var ra = (a / 3) | 0, ca = a % 3, rb = (b / 3) | 0, cb = b % 3;
    return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
  }

  function resetGesture() {
    gesture = { active: false, pointerId: null, judged: false };
    drawing = false;
    pointer.active = false;
  }

  // 严格校验：必须连满 7 格、格子不重复、两两上下相邻，且逐字正好等于答案整句
  function validateChain() {
    var line = currentPoem().line;
    if (!chain || chain.length !== line.length) return false;
    var seen = {};
    for (var i = 0; i < chain.length; i++) {
      var idx = chain[i];
      if (typeof idx !== 'number' || idx < 0 || idx > 8 || seen[idx]) return false;
      seen[idx] = 1;
      if (!cells[idx] || cells[idx].char !== line.charAt(i)) return false;
      if (i > 0 && !isAdjacent(chain[i - 1], idx)) return false;
    }
    return true;
  }

  function onDown(e) {
    if (!started || locked || gesture.active || isSettled(levelIdx)) return;
    var target = e.target.closest ? e.target.closest('.cell') : null;
    if (!target || !boardEl.contains(target)) return;
    e.preventDefault();
    var idx = cellEls.indexOf(target);
    if (idx === -1) return;
    boardEl.classList.remove('wrong');
    chain = [idx];
    gesture = { active: true, pointerId: e.pointerId, judged: false };
    drawing = true;
    pointer = { x: e.clientX, y: e.clientY, active: true };
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
    sndAdd();
    renderChain();
  }

  function onMove(e) {
    if (!gesture.active || e.pointerId !== gesture.pointerId || locked) return;
    pointer = { x: e.clientX, y: e.clientY, active: true };
    var hit = hitCell(e.clientX, e.clientY);
    if (hit !== -1) {
      var last = chain[chain.length - 1];
      var lineLen = currentPoem().line.length;
      if (chain.length >= 2 && hit === chain[chain.length - 2]) {
        // 沿原路回退一笔
        chain.pop();
        sndBack();
      } else if (chain.length < lineLen && chain.indexOf(hit) === -1 && isAdjacent(last, hit)) {
        // 连满整句后不再继续吞格子，避免“已连对又多拖一格反被判错”
        chain.push(hit);
        sndAdd();
      }
    }
    renderChain();
  }

  // 松手时统一判定（全游戏唯一判题入口，幂等）：
  //   只点了单字/没形成连线 -> 不做任何对错判定，直接清空
  //   连线不完整/连错      -> 答错
  //   连满整句且逐字正确   -> 答对
  function finishGesture() {
    if (!gesture.active || gesture.judged || locked) return;
    gesture.judged = true;
    var pid = gesture.pointerId;
    gesture.active = false;
    drawing = false;
    pointer.active = false;
    try { if (pid !== null && pid !== undefined) boardEl.releasePointerCapture(pid); } catch (err) {}

    if (chain.length <= 1) {
      chain = [];
      renderChain();
    } else if (validateChain()) {
      handleCorrect();
    } else {
      handleWrong();
    }
  }

  // 手势被系统取消（来电、浏览器手势打断等）：静默清空，绝不判题
  function cancelGesture() {
    if (!gesture.active) return;
    resetGesture();
    chain = [];
    renderChain();
  }

  boardEl.addEventListener('pointerdown', onDown);
  boardEl.addEventListener('pointermove', onMove);
  boardEl.addEventListener('pointerup', finishGesture);
  boardEl.addEventListener('pointercancel', cancelGesture);
  // 手指在棋盘外松手也要能正常判定；finishGesture 幂等，冒泡重复触发不会二次判题
  window.addEventListener('pointerup', finishGesture);
  window.addEventListener('pointercancel', cancelGesture);

  // ---------- 判题 ----------
  function handleWrong() {
    locked = true;
    boardEl.classList.add('wrong');
    sndWrong();
    attempts[levelIdx] = (attempts[levelIdx] || 0) + 1;
    var usedNow = attempts[levelIdx];

    wrongTimer = setTimeout(function () {
      wrongTimer = null;
      boardEl.classList.remove('wrong');
      chain = [];
      resetGesture();
      locked = false;
      if (usedNow >= MAX_ATTEMPTS) {
        // 两次连线机会用尽：本题判负并永久锁定——答案揭示、不得分、不可再更改
        lockFailedAndMoveOn();
      } else {
        renderChain();
        updateNav();
      }
    }, 480);
  }

  // 两次错误后锁定本题，展示正确答案，稍后自动去往下一道未处理的题（或结算）
  function lockFailedAndMoveOn() {
    failed[levelIdx] = true;
    boardEl.classList.add('failed');
    renderChain();
    updateNav();
    var from = levelIdx;
    settleTimer = setTimeout(function () {
      settleTimer = null;
      var next = nextUnsettled(from);
      if (next === -1) finishGame();
      else gotoLevel(next);
    }, 2200);
  }

  function handleCorrect() {
    locked = true;
    boardEl.classList.add('correct');
    sndRight();

    answered[levelIdx] = true;
    score += SCORE_PER_ANSWER;
    hudScore.textContent = score;
    updateNav(); // 答对瞬间即刷新“已答对 x/20”（最后一题直接结算、不再 buildLevel 时也不会停留旧数字）
    scorePop.classList.remove('pop');
    void scorePop.offsetWidth;
    scorePop.classList.add('pop');

    var poem = currentPoem();
    cardTitle.textContent = poem.title;
    cardAuthor.textContent = '〔唐〕' + poem.author;
    var isLong = poem.paragraphs.join('').length > 90;
    poemCard.classList.toggle('long', isLong);
    cardBody.innerHTML = poem.paragraphs.map(function (para) {
      var safe = normalizeText(para)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var marked = safe.replace(poem.line, '<span class="answer">' + poem.line + '</span>');
      return '<p>' + marked + '</p>';
    }).join('');
    poemCard.classList.remove('hidden');

    cardTimer = setTimeout(advance, 2400);
  }

  // 答对卡片关闭后的推进：跳到下一道“尚未处理”的题（跳过/答错未满两次的题会回头遇到）；
  // 全部处理完（答对或两次失败）则结算。与手动翻页 gotoLevel 相互独立。
  function advance() {
    // 定时器自动继续与点击卡片可能同时发生，只允许一次；卡片隐藏后的迟到点击忽略
    if (advancing || poemCard.classList.contains('hidden')) return;
    advancing = true;
    var from = levelIdx;
    var next = nextUnsettled(from);
    poemCard.classList.add('hidden');
    if (next === -1) {
      clearTimeout(cardTimer);
      chain = [];
      resetGesture();
      locked = false;
      finishGame();
    } else {
      gotoLevel(next);
    }
    advancing = false;
  }

  // 从 from 之后（环形）找第一道未处理的题（没答对且没用尽机会），全部处理完返回 -1
  function nextUnsettled(from) {
    for (var step = 1; step <= TOTAL; step++) {
      var idx = (from + step) % TOTAL;
      if (!isSettled(idx)) return idx;
    }
    return -1;
  }

  // 手动翻页（上一题 / 下一题 / 跳过）：中途打断手势、答错抖动、失败揭示与答对卡片
  function gotoLevel(idx) {
    if (!started || idx < 0 || idx >= TOTAL || idx === levelIdx) return;
    clearTimeout(cardTimer);
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    if (wrongTimer) { clearTimeout(wrongTimer); wrongTimer = null; }
    poemCard.classList.add('hidden');
    chain = [];
    resetGesture();
    locked = false;
    boardEl.classList.remove('correct', 'wrong');
    levelIdx = idx;
    buildLevel();
  }

  // 翻页按钮与机会提示
  function updateNav() {
    btnPrevQ.disabled = !started || levelIdx === 0;
    btnNextQ.disabled = !started || levelIdx === TOTAL - 1;
    navStatus.textContent = '已答对 ' + answeredCount() + ' / ' + TOTAL;
    if (isDone(levelIdx)) {
      chancesEl.textContent = '本题已答对 +' + SCORE_PER_ANSWER + ' 分';
      chancesEl.className = 'chances done';
    } else if (isFailed(levelIdx)) {
      chancesEl.textContent = '两次机会已用完，答案已锁定，本题不得分';
      chancesEl.className = 'chances fail';
    } else {
      chancesEl.textContent = '剩余连线机会：' + chancesLeft(levelIdx) + ' / ' + MAX_ATTEMPTS;
      chancesEl.className = 'chances' + (chancesLeft(levelIdx) === 1 ? ' warn' : '');
    }
  }

  poemCard.addEventListener('click', advance);

  // ---------- 计时 ----------
  function startTimer() {
    stopTimer();
    startTime = Date.now();
    hudTime.textContent = '00:00';
    timerId = setInterval(function () {
      hudTime.textContent = fmtTime(Date.now() - startTime);
    }, 250);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  // ---------- 流程 ----------
  // freshDraw=false: 使用页面加载时已抽好的一局（点“开始游戏”所见即所玩）
  // freshDraw=true : 重新随机抽一局（重新开始 / 再玩一次）
  function startGame(freshDraw) {
    clearTimeout(cardTimer);
    if (wrongTimer) { clearTimeout(wrongTimer); wrongTimer = null; }
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
    advancing = false;
    if (freshDraw || !order.length) order = drawSelection();
    levelIdx = 0;
    score = 0;
    answered = {};
    failed = {};
    attempts = {};
    hudScore.textContent = '0';
    started = true;
    chain = [];
    resetGesture();
    locked = false;
    boardEl.classList.remove('correct', 'wrong');
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    poemCard.classList.add('hidden');
    buildLevel();
    startTimer();
  }

  function finishGame() {
    finishElapsed = Date.now() - startTime;
    stopTimer();
    hudTime.textContent = fmtTime(finishElapsed);
    progressBar.style.width = '100%';
    endTimeEl.textContent = fmtTime(finishElapsed);
    endScoreEl.textContent = score;
    var sec = finishElapsed / 1000;
    var remark = sec < 120 ? '妙笔生花，才思敏捷！'
      : sec < 240 ? '诗成七步，文采斐然！'
      : sec < 360 ? '出口成章，可喜可贺！'
      : '熟读唐诗三百首，不会作诗也会吟！';
    endRemarkEl.textContent = remark;
    endScreen.classList.remove('hidden');
  }

  $('btn-start').addEventListener('click', function () { startGame(false); });
  $('btn-again').addEventListener('click', function () { startGame(true); });
  $('btn-restart').addEventListener('click', function () { startGame(true); });
  $('btn-clear').addEventListener('click', function () {
    if (locked || !started || isSettled(levelIdx)) return;
    chain = [];
    resetGesture(); // 连 chain 带按住中的手势状态一起复位，避免残留 active 吞掉下一笔
    boardEl.classList.remove('wrong');
    renderChain();
  });

  // 上一题 / 下一题（下一题在当前题未答对时即“跳过”，不扣分）
  btnPrevQ.addEventListener('click', function () {
    if (started) gotoLevel(levelIdx - 1);
  });
  btnNextQ.addEventListener('click', function () {
    if (started) gotoLevel(levelIdx + 1);
  });

  window.addEventListener('resize', function () { if (started) renderChain(); });

  // 初始：刷新页面即随机抽一局布在开始页背景（保证刷新后题面随机且与上一局不同）
  (function init() {
    order = drawSelection();
    slotsEl.innerHTML = '';
    for (var i = 0; i < 7; i++) {
      var sp = document.createElement('span');
      sp.className = 'slot';
      slotsEl.appendChild(sp);
    }
    buildLevel();
    updateNav();
  })();
})();
