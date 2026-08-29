"use strict";

/* =========================================================
   基本データ
========================================================= */

const app = document.getElementById("app");
const rulesDialog = document.getElementById("rulesDialog");
const rulesButton = document.getElementById("rulesButton");
const closeRulesButton = document.getElementById("closeRulesButton");

const MAX_ROUNDS = 6;

const ACTIONS = {
  distribute: {
    name: "分配",
    icon: "🤝",
    anger: 1,
    description: "ドラゴンの怒り＋1。中央のお宝を1枚獲得します。"
  },
  plunder: {
    name: "強奪",
    icon: "🗡️",
    anger: 2,
    description: "ドラゴンの怒り＋2。中央のお宝を2枚獲得します。"
  },
  guard: {
    name: "警戒",
    icon: "🛡️",
    anger: -2,
    description: "ドラゴンの怒り－2。お宝は獲得できません。"
  },
  accuse: {
    name: "密告",
    icon: "👁️",
    anger: 0,
    description: "指定した相手が強奪なら、お宝をランダムに1枚奪います。"
  }
};

const TREASURE_INFO = {
  coin: {
    category: "coin",
    name: "金貨",
    icon: "🪙",
    typeLabel: "1枚につき1点"
  },
  ruby: {
    category: "gem",
    name: "ルビー",
    icon: "♦️",
    typeLabel: "宝石・同色3枚で8点"
  },
  sapphire: {
    category: "gem",
    name: "サファイア",
    icon: "🔷",
    typeLabel: "宝石・同色3枚で8点"
  },
  emerald: {
    category: "gem",
    name: "エメラルド",
    icon: "💚",
    typeLabel: "宝石・同色3枚で8点"
  },
  weapon: {
    category: "weapon",
    name: "伝説の武器",
    icon: "⚔️",
    typeLabel: "集めるほど高得点"
  },
  fireBook: {
    category: "book",
    name: "炎の魔法書",
    icon: "📕",
    typeLabel: "異なる魔法書を収集"
  },
  waterBook: {
    category: "book",
    name: "水の魔法書",
    icon: "📘",
    typeLabel: "異なる魔法書を収集"
  },
  windBook: {
    category: "book",
    name: "風の魔法書",
    icon: "📗",
    typeLabel: "異なる魔法書を収集"
  },
  darkBook: {
    category: "book",
    name: "闇の魔法書",
    icon: "📓",
    typeLabel: "異なる魔法書を収集"
  },
  crown: {
    category: "crown",
    name: "呪われた王冠",
    icon: "👑",
    typeLabel: "5点・最多所持者は－10点"
  }
};

let setupPlayerCount = 3;
let setupNames = ["冒険者1", "冒険者2", "冒険者3"];

let state = null;
let selectedAction = null;
let selectedAccusationTarget = "";

/* =========================================================
   ダイアログ
========================================================= */

rulesButton.addEventListener("click", () => {
  if (typeof rulesDialog.showModal === "function") {
    rulesDialog.showModal();
  } else {
    rulesDialog.setAttribute("open", "");
  }
});

closeRulesButton.addEventListener("click", () => {
  rulesDialog.close();
});

rulesDialog.addEventListener("click", (event) => {
  if (event.target === rulesDialog) {
    rulesDialog.close();
  }
});

/* =========================================================
   ユーティリティ
========================================================= */

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [result[i], result[randomIndex]] = [
      result[randomIndex],
      result[i]
    ];
  }

  return result;
}

function getRandomItem(array) {
  if (array.length === 0) {
    return null;
  }

  return array[Math.floor(Math.random() * array.length)];
}

function addLog(message) {
  state.logs.unshift(message);
  state.logs = state.logs.slice(0, 30);
}

function playerName(index) {
  return state.players[index]?.name ?? "不明";
}

function orderedPlayerIndexes(startIndex) {
  return Array.from(
    { length: state.players.length },
    (_, offset) => (startIndex + offset) % state.players.length
  );
}

/* =========================================================
   宝物デッキ
========================================================= */

function createTreasureDeck() {
  const cards = [];
  let serial = 1;

  function addCards(kind, count) {
    for (let i = 0; i < count; i += 1) {
      cards.push({
        id: `treasure-${serial}`,
        kind
      });

      serial += 1;
    }
  }

  // 合計50枚
  addCards("coin", 12);

  addCards("ruby", 6);
  addCards("sapphire", 6);
  addCards("emerald", 6);

  addCards("weapon", 9);

  addCards("fireBook", 2);
  addCards("waterBook", 2);
  addCards("windBook", 2);
  addCards("darkBook", 2);

  addCards("crown", 3);

  return shuffle(cards);
}

function drawTreasures(count) {
  const drawn = [];

  for (let i = 0; i < count; i += 1) {
    if (state.deck.length === 0) {
      state.deck = shuffle(state.discardPile);
      state.discardPile = [];
      addLog("捨て札を混ぜ、新しい山札を作りました。");
    }

    const card = state.deck.pop();

    if (card) {
      drawn.push(card);
    }
  }

  return drawn;
}

/* =========================================================
   セットアップ
========================================================= */

function renderSetup() {
  app.innerHTML = `
    <div class="setup-layout">
      <section class="hero-panel">
        <div class="hero-dragon" aria-hidden="true">🐉</div>

        <p class="eyebrow">NEGOTIATION × BLUFF</p>
        <h2>協力するか、<br>裏切るか。</h2>

        <p>
          ドラゴンを倒した冒険者たちによる、お宝の分配会議。
          欲張れば多くを得られますが、全員が欲張ればドラゴンが目を覚まします。
        </p>

        <div class="feature-list">
          <span class="feature-chip">👥 3～6人</span>
          <span class="feature-chip">⏱️ 約20～30分</span>
          <span class="feature-chip">🎭 交渉・ブラフ</span>
          <span class="feature-chip">🚫 脱落なし</span>
        </div>
      </section>

      <section class="setup-panel">
        <p class="eyebrow">GAME SETUP</p>
        <h2>冒険者を招集</h2>
        <p class="muted-text">
          プレイヤー人数と名前を設定してください。
        </p>

        <div class="player-count-control">
          <button
            id="decreasePlayerButton"
            type="button"
            aria-label="プレイヤーを減らす"
          >
            −
          </button>

          <span
            id="playerCountNumber"
            class="player-count-number"
          >
            ${setupPlayerCount}
          </span>

          <button
            id="increasePlayerButton"
            type="button"
            aria-label="プレイヤーを増やす"
          >
            ＋
          </button>

          <span class="muted-text">人で遊ぶ</span>
        </div>

        <div id="nameFields" class="name-fields">
          ${renderNameFields()}
        </div>

        <button
          id="startGameButton"
          class="primary-button setup-start-button"
          type="button"
        >
          冒険を始める
        </button>
      </section>
    </div>
  `;

  document
    .getElementById("decreasePlayerButton")
    .addEventListener("click", () => {
      saveSetupNames();

      if (setupPlayerCount > 3) {
        setupPlayerCount -= 1;
        setupNames = setupNames.slice(0, setupPlayerCount);
        renderSetup();
      }
    });

  document
    .getElementById("increasePlayerButton")
    .addEventListener("click", () => {
      saveSetupNames();

      if (setupPlayerCount < 6) {
        setupPlayerCount += 1;
        setupNames.push(`冒険者${setupPlayerCount}`);
        renderSetup();
      }
    });

  document
    .getElementById("startGameButton")
    .addEventListener("click", startGame);
}

function renderNameFields() {
  return Array.from({ length: setupPlayerCount }, (_, index) => {
    const value = setupNames[index] ?? `冒険者${index + 1}`;

    return `
      <div class="name-field">
        <label for="playerName${index}">
          プレイヤー${index + 1}
        </label>

        <input
          id="playerName${index}"
          type="text"
          maxlength="12"
          value="${escapeHTML(value)}"
          placeholder="冒険者${index + 1}"
        >
      </div>
    `;
  }).join("");
}

function saveSetupNames() {
  setupNames = Array.from(
    { length: setupPlayerCount },
    (_, index) => {
      const input = document.getElementById(`playerName${index}`);
      return input?.value.trim() || `冒険者${index + 1}`;
    }
  );
}

function startGame() {
  saveSetupNames();

  state = {
    phase: "consultation",
    round: 1,
    startPlayer: 0,
    anger: 0,
    players: setupNames.map((name, index) => ({
      id: index,
      name,
      inventory: [],
      action: null,
      accusationTarget: null
    })),
    deck: createTreasureDeck(),
    discardPile: [],
    centerTreasures: [],
    logs: [],
    selectionIndex: 0,
    pickQueue: [],
    currentPicker: null,
    roundSummary: ""
  };

  addLog("冒険者たちがお宝の分配会議を始めました。");
  beginRound();
}

/* =========================================================
   ラウンド進行
========================================================= */

function beginRound() {
  state.players.forEach((player) => {
    player.action = null;
    player.accusationTarget = null;
  });

  state.pickQueue = [];
  state.currentPicker = null;
  state.roundSummary = "";

  const treasureCount = state.players.length * 2;
  state.centerTreasures = drawTreasures(treasureCount);
  state.phase = "consultation";

  addLog(
    `第${state.round}ラウンド：お宝が${state.centerTreasures.length}枚公開されました。`
  );

  renderGame();
}

function beginSecretSelection() {
  state.selectionIndex = 0;
  selectedAction = null;
  selectedAccusationTarget = "";
  state.phase = "selectionPrivacy";
  renderGame();
}

function showCurrentPlayerSelection() {
  selectedAction = null;
  selectedAccusationTarget = "";
  state.phase = "selecting";
  renderGame();
}

function lockCurrentPlayerAction() {
  if (!selectedAction) {
    window.alert("行動を1つ選んでください。");
    return;
  }

  if (selectedAction === "accuse" && selectedAccusationTarget === "") {
    window.alert("密告する相手を選んでください。");
    return;
  }

  const currentIndex = state.selectionIndex;
  const currentPlayer = state.players[currentIndex];

  currentPlayer.action = selectedAction;
  currentPlayer.accusationTarget =
    selectedAction === "accuse"
      ? Number(selectedAccusationTarget)
      : null;

  state.selectionIndex += 1;
  selectedAction = null;
  selectedAccusationTarget = "";

  if (state.selectionIndex >= state.players.length) {
    state.phase = "reveal";
  } else {
    state.phase = "selectionPrivacy";
  }

  renderGame();
}

function calculateAngerChange() {
  return state.players.reduce((total, player) => {
    return total + ACTIONS[player.action].anger;
  }, 0);
}

function resolveRevealedActions() {
  const angerChange = calculateAngerChange();
  state.anger = Math.max(0, state.anger + angerChange);

  addLog(
    `行動によってドラゴンの怒りが${
      angerChange >= 0 ? "+" : ""
    }${angerChange}変化しました。`
  );

  const threshold = state.players.length + 2;

  if (state.anger >= threshold) {
    state.discardPile.push(...state.centerTreasures);
    state.centerTreasures = [];
    state.anger = 0;
    state.roundSummary =
      "ドラゴンが目を覚まし、中央のお宝をすべて持ち去りました！";
    state.phase = "dragonAwake";

    addLog("🐉 ドラゴンが目を覚ましました。中央のお宝は失われました。");
    renderGame();
    return;
  }

  resolveAccusations();
  prepareTreasurePickQueue();

  if (
    state.pickQueue.length === 0 ||
    state.centerTreasures.length === 0
  ) {
    finishTreasurePicking();
    return;
  }

  state.currentPicker = state.pickQueue.shift();
  state.phase = "picking";
  renderGame();
}

function resolveAccusations() {
  state.players.forEach((accuser, accuserIndex) => {
    if (accuser.action !== "accuse") {
      return;
    }

    const targetIndex = accuser.accusationTarget;
    const target = state.players[targetIndex];

    if (!target) {
      return;
    }

    if (target.action !== "plunder") {
      addLog(
        `${accuser.name}の密告は失敗。${target.name}は強奪していませんでした。`
      );
      return;
    }

    if (target.inventory.length === 0) {
      addLog(
        `${accuser.name}の密告は成功しましたが、${target.name}には奪えるお宝がありません。`
      );
      return;
    }

    const stolenCard = getRandomItem(target.inventory);
    const cardIndex = target.inventory.findIndex(
      (card) => card.id === stolenCard.id
    );

    target.inventory.splice(cardIndex, 1);
    accuser.inventory.push(stolenCard);

    addLog(
      `${accuser.name}の密告成功！ ${target.name}から「${
        TREASURE_INFO[stolenCard.kind].name
      }」を奪いました。`
    );
  });
}

function prepareTreasurePickQueue() {
  const order = orderedPlayerIndexes(state.startPlayer);
  const queue = [];

  // 強奪者が先に選ぶ
  order.forEach((playerIndex) => {
    if (state.players[playerIndex].action === "plunder") {
      queue.push({
        playerIndex,
        remaining: 2,
        action: "plunder"
      });
    }
  });

  // その後に分配者
  order.forEach((playerIndex) => {
    if (state.players[playerIndex].action === "distribute") {
      queue.push({
        playerIndex,
        remaining: 1,
        action: "distribute"
      });
    }
  });

  state.pickQueue = queue;
}

function takeTreasure(cardId) {
  if (
    state.phase !== "picking" ||
    !state.currentPicker
  ) {
    return;
  }

  const cardIndex = state.centerTreasures.findIndex(
    (card) => card.id === cardId
  );

  if (cardIndex === -1) {
    return;
  }

  const [card] = state.centerTreasures.splice(cardIndex, 1);
  const player = state.players[state.currentPicker.playerIndex];

  player.inventory.push(card);
  state.currentPicker.remaining -= 1;

  addLog(
    `${player.name}が「${TREASURE_INFO[card.kind].name}」を獲得しました。`
  );

  if (
    state.currentPicker.remaining <= 0 ||
    state.centerTreasures.length === 0
  ) {
    advanceTreasurePicker();
  } else {
    renderGame();
  }
}

function advanceTreasurePicker() {
  if (
    state.pickQueue.length === 0 ||
    state.centerTreasures.length === 0
  ) {
    finishTreasurePicking();
    return;
  }

  state.currentPicker = state.pickQueue.shift();
  renderGame();
}

function finishTreasurePicking() {
  if (state.centerTreasures.length > 0) {
    state.discardPile.push(...state.centerTreasures);
    state.centerTreasures = [];
  }

  determineNextStartPlayer();

  state.currentPicker = null;
  state.roundSummary = "お宝の分配が終了しました。";
  state.phase = "roundEnd";

  addLog(`第${state.round}ラウンドが終了しました。`);
  renderGame();
}

function determineNextStartPlayer() {
  const order = orderedPlayerIndexes(state.startPlayer);
  const guardingPlayer = order.find(
    (playerIndex) => state.players[playerIndex].action === "guard"
  );

  if (guardingPlayer !== undefined) {
    state.startPlayer = guardingPlayer;
    addLog(
      `${playerName(guardingPlayer)}が警戒したため、次のスタートプレイヤーになります。`
    );
  } else {
    state.startPlayer =
      (state.startPlayer + 1) % state.players.length;

    addLog(
      `次のスタートプレイヤーは${playerName(state.startPlayer)}です。`
    );
  }
}

function proceedAfterRound() {
  if (state.phase === "dragonAwake") {
    determineNextStartPlayer();
  }

  if (state.round >= MAX_ROUNDS) {
    state.phase = "gameOver";
    renderGame();
    return;
  }

  state.round += 1;
  beginRound();
}

/* =========================================================
   得点計算
========================================================= */

function countKinds(inventory) {
  return inventory.reduce((counts, card) => {
    counts[card.kind] = (counts[card.kind] || 0) + 1;
    return counts;
  }, {});
}

function calculateBaseScore(player) {
  const counts = countKinds(player.inventory);

  const coinScore = counts.coin || 0;

  const gemKinds = ["ruby", "sapphire", "emerald"];
  const gemScore = gemKinds.reduce((total, kind) => {
    const amount = counts[kind] || 0;
    const completedSets = Math.floor(amount / 3);
    const remainder = amount % 3;

    return total + completedSets * 8 + remainder;
  }, 0);

  const weaponCount = counts.weapon || 0;
  let weaponScore = 0;

  if (weaponCount === 1) weaponScore = 1;
  if (weaponCount === 2) weaponScore = 3;
  if (weaponCount === 3) weaponScore = 6;
  if (weaponCount === 4) weaponScore = 10;
  if (weaponCount >= 5) weaponScore = 15;

  const bookKinds = [
    "fireBook",
    "waterBook",
    "windBook",
    "darkBook"
  ];

  const uniqueBookCount = bookKinds.filter(
    (kind) => (counts[kind] || 0) > 0
  ).length;

  const bookScores = [0, 1, 3, 6, 10];
  const bookScore = bookScores[uniqueBookCount];

  const crownCount = counts.crown || 0;
  const crownScore = crownCount * 5;

  return {
    coinScore,
    gemScore,
    weaponScore,
    bookScore,
    crownScore,
    crownCount,
    subtotal:
      coinScore +
      gemScore +
      weaponScore +
      bookScore +
      crownScore
  };
}

function calculateAllScores() {
  const scoreData = state.players.map((player, index) => ({
    playerIndex: index,
    player,
    ...calculateBaseScore(player)
  }));

  const highestCrownCount = Math.max(
    ...scoreData.map((entry) => entry.crownCount)
  );

  scoreData.forEach((entry) => {
    const receivesCurse =
      highestCrownCount > 0 &&
      entry.crownCount === highestCrownCount;

    entry.cursePenalty = receivesCurse ? -10 : 0;
    entry.total = entry.subtotal + entry.cursePenalty;
  });

  return scoreData.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }

    // 同点なら所持宝物数が多い人を上位表示
    return b.player.inventory.length - a.player.inventory.length;
  });
}

/* =========================================================
   共通レンダリング
========================================================= */

function renderGame() {
  app.innerHTML = `
    <div class="game-layout">
      <section class="game-main">
        ${renderStatusBar()}
        ${renderMainPanel()}
      </section>

      <aside class="game-sidebar">
        ${renderPlayersPanel()}
        ${renderEventLog()}
      </aside>
    </div>
  `;

  attachPhaseEvents();
}

function renderStatusBar() {
  const threshold = state.players.length + 2;
  const angerPercent = Math.min(
    100,
    (state.anger / threshold) * 100
  );

  return `
    <div class="status-bar">
      <article class="status-card">
        <span class="status-label">ラウンド</span>
        <span class="status-value">
          ${state.round} / ${MAX_ROUNDS}
        </span>
      </article>

      <article class="status-card">
        <span class="status-label">スタートプレイヤー</span>
        <span class="status-value">
          ⭐ ${escapeHTML(playerName(state.startPlayer))}
        </span>
      </article>

      <article class="status-card">
        <span class="status-label">ドラゴンの怒り</span>
        <span class="status-value anger-value">
          🔥 ${state.anger} / ${threshold}
        </span>

        <div class="anger-meter" aria-hidden="true">
          <div
            class="anger-meter-fill"
            style="width: ${angerPercent}%"
          ></div>
        </div>
      </article>
    </div>
  `;
}

function renderMainPanel() {
  switch (state.phase) {
    case "consultation":
      return renderConsultationPhase();

    case "selectionPrivacy":
      return renderSelectionPrivacyPhase();

    case "selecting":
      return renderActionSelectionPhase();

    case "reveal":
      return renderRevealPhase();

    case "picking":
      return renderPickingPhase();

    case "dragonAwake":
      return renderDragonAwakePhase();

    case "roundEnd":
      return renderRoundEndPhase();

    case "gameOver":
      return renderGameOverPhase();

    default:
      return "";
  }
}

function renderPanelShell(title, description, phaseText, content) {
  return `
    <section class="game-panel">
      <div class="panel-heading">
        <div>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>

        <span class="phase-badge">${phaseText}</span>
      </div>

      ${content}
    </section>
  `;
}

function renderConsultationPhase() {
  return renderPanelShell(
    "お宝と相談",
    "中央のお宝を確認し、自由に交渉してください。約束を守る義務はありません。",
    "相談フェイズ",
    `
      ${renderTreasureGrid(state.centerTreasures, false)}

      <div class="consultation-box" style="margin-top: 20px;">
        <div class="consultation-icon">🗣️</div>
        <h3>分配会議を始めましょう</h3>

        <p>
          「自分が警戒する」「その宝石を譲ってほしい」など、
          自由に相談できます。相談が終わったら、秘密の行動選択へ進んでください。
        </p>

        <button
          id="beginSelectionButton"
          class="primary-button"
          type="button"
        >
          秘密の行動選択へ
        </button>
      </div>
    `
  );
}

function renderSelectionPrivacyPhase() {
  const currentPlayer = state.players[state.selectionIndex];

  return renderPanelShell(
    "端末を渡してください",
    "行動は他のプレイヤーに見られないように選択します。",
    `選択 ${state.selectionIndex + 1} / ${state.players.length}`,
    `
      <div class="privacy-box">
        <div class="privacy-icon">🙈</div>
        <h3>${escapeHTML(currentPlayer.name)}の番です</h3>

        <p>
          他のプレイヤーは画面を見ないでください。
          準備ができたら、本人が下のボタンを押してください。
        </p>

        <button
          id="showSelectionButton"
          class="primary-button"
          type="button"
        >
          私は${escapeHTML(currentPlayer.name)}です
        </button>
      </div>
    `
  );
}

function renderActionSelectionPhase() {
  const currentPlayer = state.players[state.selectionIndex];

  const actionCards = Object.entries(ACTIONS)
    .map(([key, action]) => {
      const angerText =
        action.anger > 0
          ? `怒り＋${action.anger}`
          : action.anger < 0
            ? `怒り${action.anger}`
            : "怒り±0";

      return `
        <button
          class="action-card ${
            selectedAction === key ? "action-card--selected" : ""
          }"
          type="button"
          data-action="${key}"
        >
          <span class="action-card__icon">${action.icon}</span>
          <span class="action-card__title">${action.name}</span>
          <span class="action-card__description">
            ${action.description}
          </span>
          <span class="action-card__anger">${angerText}</span>
        </button>
      `;
    })
    .join("");

  const targetOptions = state.players
    .map((player, index) => {
      if (index === state.selectionIndex) {
        return "";
      }

      return `
        <option
          value="${index}"
          ${
            String(index) === selectedAccusationTarget
              ? "selected"
              : ""
          }
        >
          ${escapeHTML(player.name)}
        </option>
      `;
    })
    .join("");

  return renderPanelShell(
    `${escapeHTML(currentPlayer.name)}の行動`,
    "今回のラウンドで実行する行動を1つだけ選んでください。",
    "秘密選択中",
    `
      <div class="action-grid">
        ${actionCards}
      </div>

      ${
        selectedAction === "accuse"
          ? `
            <div class="accusation-box">
              <label for="accusationTarget">
                👁️ 誰を密告しますか？
              </label>

              <select id="accusationTarget">
                <option value="">相手を選択</option>
                ${targetOptions}
              </select>
            </div>
          `
          : ""
      }

      <div class="action-footer">
        <button
          id="lockActionButton"
          class="primary-button"
          type="button"
          ${selectedAction ? "" : "disabled"}
        >
          この行動を秘密にして確定
        </button>
      </div>
    `
  );
}

function renderRevealPhase() {
  const angerChange = calculateAngerChange();
  const nextAnger = Math.max(0, state.anger + angerChange);
  const threshold = state.players.length + 2;
  const dragonWillWake = nextAnger >= threshold;

  const revealCards = state.players
    .map((player, index) => {
      const action = ACTIONS[player.action];

      const targetText =
        player.action === "accuse"
          ? `
            <span class="reveal-card__target">
              密告対象：${escapeHTML(
                playerName(player.accusationTarget)
              )}
            </span>
          `
          : "";

      return `
        <article
          class="reveal-card"
          style="animation-delay: ${index * 90}ms"
        >
          <span class="reveal-card__player">
            ${escapeHTML(player.name)}
          </span>

          <span class="reveal-card__icon">
            ${action.icon}
          </span>

          <span class="reveal-card__action">
            ${action.name}
          </span>

          ${targetText}
        </article>
      `;
    })
    .join("");

  return renderPanelShell(
    "一斉公開！",
    "全員が選んだ行動を確認してください。",
    "行動公開",
    `
      <div class="reveal-grid">
        ${revealCards}
      </div>

      <div class="anger-preview">
        怒りの変化：
        <strong>
          ${angerChange >= 0 ? "+" : ""}${angerChange}
        </strong>

        <br>

        ${
          dragonWillWake
            ? "⚠️ ドラゴンが目を覚まします！"
            : `解決後の怒りは ${nextAnger} / ${threshold} です。`
        }
      </div>

      <div class="action-footer">
        <button
          id="resolveActionsButton"
          class="${
            dragonWillWake ? "danger-button" : "primary-button"
          }"
          type="button"
        >
          行動を解決する
        </button>
      </div>
    `
  );
}

function renderPickingPhase() {
  const picker = state.players[state.currentPicker.playerIndex];
  const action = ACTIONS[state.currentPicker.action];

  return renderPanelShell(
    `${escapeHTML(picker.name)}がお宝を選択`,
    `${action.icon} ${action.name}：あと${state.currentPicker.remaining}枚選べます。`,
    "お宝獲得",
    renderTreasureGrid(state.centerTreasures, true)
  );
}

function renderDragonAwakePhase() {
  return renderPanelShell(
    "ドラゴンが目を覚ました！",
    "欲望の気配を察知したドラゴンが、中央のお宝をすべて回収しました。",
    "ラウンド失敗",
    `
      <div class="result-box">
        <div class="result-icon">🔥🐉🔥</div>
        <h3>お宝はすべて失われました</h3>

        <p>
          このラウンドでは誰も中央のお宝を獲得できません。
          ドラゴンの怒りは0に戻りました。
        </p>

        <button
          id="nextRoundButton"
          class="danger-button"
          type="button"
        >
          ${
            state.round >= MAX_ROUNDS
              ? "最終結果を見る"
              : "次のラウンドへ"
          }
        </button>
      </div>
    `
  );
}

function renderRoundEndPhase() {
  return renderPanelShell(
    `第${state.round}ラウンド終了`,
    state.roundSummary,
    "ラウンド終了",
    `
      <div class="result-box">
        <div class="result-icon">🏕️</div>
        <h3>冒険者たちは一休み</h3>

        <p>
          獲得したお宝は右側のプレイヤー欄で確認できます。
          次のラウンドでは、新しいお宝が公開されます。
        </p>

        <button
          id="nextRoundButton"
          class="primary-button"
          type="button"
        >
          ${
            state.round >= MAX_ROUNDS
              ? "最終結果を見る"
              : `第${state.round + 1}ラウンドへ`
          }
        </button>
      </div>
    `
  );
}

function renderGameOverPhase() {
  const rankings = calculateAllScores();
  const highestScore = rankings[0].total;

  const rankingHTML = rankings
    .map((entry, index) => {
      const isWinner = entry.total === highestScore;
      const medal =
        index === 0 ? "🥇" :
        index === 1 ? "🥈" :
        index === 2 ? "🥉" :
        `${index + 1}`;

      const details = [
        `金貨 ${entry.coinScore}`,
        `宝石 ${entry.gemScore}`,
        `武器 ${entry.weaponScore}`,
        `魔法書 ${entry.bookScore}`,
        `王冠 ${entry.crownScore}`,
        entry.cursePenalty < 0 ? "呪い −10" : null
      ]
        .filter(Boolean)
        .join(" / ");

      return `
        <article class="ranking-card ${
          isWinner ? "ranking-card--winner" : ""
        }">
          <div class="rank-number">${medal}</div>

          <div class="rank-detail">
            <strong>
              ${escapeHTML(entry.player.name)}
              ${isWinner ? " 👑" : ""}
            </strong>
            <span>${details}</span>
          </div>

          <div class="rank-score">
            ${entry.total}点
          </div>
        </article>
      `;
    })
    .join("");

  const winners = rankings
    .filter((entry) => entry.total === highestScore)
    .map((entry) => entry.player.name);

  return renderPanelShell(
    "最終結果",
    "6ラウンドの冒険が終了しました。",
    "ゲーム終了",
    `
      <div class="result-box">
        <div class="result-icon">🏆</div>

        <h3>
          ${winners.map(escapeHTML).join("・")}の勝利！
        </h3>

        <p>
          最終得点は${highestScore}点です。
          王冠の呪いを含むすべての得点を計算しています。
        </p>

        <div class="ranking-list">
          ${rankingHTML}
        </div>

        <button
          id="restartButton"
          class="primary-button"
          type="button"
        >
          もう一度遊ぶ
        </button>
      </div>
    `
  );
}

function renderTreasureGrid(cards, selectable) {
  if (cards.length === 0) {
    return `
      <div class="empty-state">
        中央にお宝は残っていません。
      </div>
    `;
  }

  const cardHTML = cards
    .map((card) => {
      const info = TREASURE_INFO[card.kind];
      const tag = selectable ? "button" : "article";
      const buttonAttributes = selectable
        ? `type="button" data-treasure-id="${card.id}"`
        : "";

      return `
        <${tag}
          class="treasure-card treasure-card--${info.category}"
          ${buttonAttributes}
        >
          <span class="treasure-card__icon">
            ${info.icon}
          </span>

          <span class="treasure-card__name">
            ${info.name}
          </span>

          <span class="treasure-card__type">
            ${info.typeLabel}
          </span>
        </${tag}>
      `;
    })
    .join("");

  return `<div class="treasure-grid">${cardHTML}</div>`;
}

function renderPlayersPanel() {
  const playersHTML = state.players
    .map((player, index) => {
      const summary = summarizeInventory(player.inventory);

      return `
        <article class="player-card ${
          index === state.startPlayer
            ? "player-card--starter"
            : ""
        }">
          <div class="player-card__top">
            <span class="player-name">
              ${escapeHTML(player.name)}
            </span>

            ${
              index === state.startPlayer
                ? '<span class="starter-mark">⭐ START</span>'
                : ""
            }
          </div>

          <div class="inventory-summary">
            ${
              summary ||
              '<span class="inventory-empty">お宝なし</span>'
            }
          </div>
        </article>
      `;
    })
    .join("");

  return `<div class="players-list">${playersHTML}</div>`;
}

function summarizeInventory(inventory) {
  if (inventory.length === 0) {
    return "";
  }

  const counts = countKinds(inventory);

  const order = [
    "coin",
    "ruby",
    "sapphire",
    "emerald",
    "weapon",
    "fireBook",
    "waterBook",
    "windBook",
    "darkBook",
    "crown"
  ];

  return order
    .filter((kind) => counts[kind])
    .map((kind) => {
      const info = TREASURE_INFO[kind];

      return `
        <span
          class="inventory-chip"
          title="${info.name}"
        >
          ${info.icon} ×${counts[kind]}
        </span>
      `;
    })
    .join("");
}

function renderEventLog() {
  const logs =
    state.logs.length > 0
      ? state.logs
          .map((message) => `<li>${escapeHTML(message)}</li>`)
          .join("")
      : "<li>まだ出来事はありません。</li>";

  return `
    <section class="event-panel">
      <h3>📜 冒険の記録</h3>
      <ul class="event-log">
        ${logs}
      </ul>
    </section>
  `;
}

/* =========================================================
   イベント設定
========================================================= */

function attachPhaseEvents() {
  if (state.phase === "consultation") {
    document
      .getElementById("beginSelectionButton")
      ?.addEventListener("click", beginSecretSelection);
  }

  if (state.phase === "selectionPrivacy") {
    document
      .getElementById("showSelectionButton")
      ?.addEventListener("click", showCurrentPlayerSelection);
  }

  if (state.phase === "selecting") {
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedAction = button.dataset.action;

        if (selectedAction !== "accuse") {
          selectedAccusationTarget = "";
        }

        renderGame();
      });
    });

    document
      .getElementById("accusationTarget")
      ?.addEventListener("change", (event) => {
        selectedAccusationTarget = event.target.value;
      });

    document
      .getElementById("lockActionButton")
      ?.addEventListener("click", lockCurrentPlayerAction);
  }

  if (state.phase === "reveal") {
    document
      .getElementById("resolveActionsButton")
      ?.addEventListener("click", resolveRevealedActions);
  }

  if (state.phase === "picking") {
    document
      .querySelectorAll("[data-treasure-id]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          takeTreasure(button.dataset.treasureId);
        });
      });
  }

  if (
    state.phase === "dragonAwake" ||
    state.phase === "roundEnd"
  ) {
    document
      .getElementById("nextRoundButton")
      ?.addEventListener("click", proceedAfterRound);
  }

  if (state.phase === "gameOver") {
    document
      .getElementById("restartButton")
      ?.addEventListener("click", () => {
        state = null;
        renderSetup();
      });
  }
}

/* =========================================================
   初期表示
========================================================= */

renderSetup();
