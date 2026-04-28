/* Top-level Mithril app: board, selection, add-3, flash animations. */
(function (global) {
  'use strict';

  var FLASH_MS = 500;
  var STORAGE_KEY = 'set-game-v1';

  var state = {
    deck: [],
    board: [],
    selected: [],
    flashKind: null,
    flashIds: null,
    boardFlash: false,
    locked: false,
    showSettings: false,
    pendingClaim: false,
    scores: [0, 0],
    capturedSets: [[], []],
    gameOver: false,
    settings: {
      disallowAddWhenSet: false,
      scoringEnabled: false,
      playerCount: 2,
      penaltiesEnabled: false
    }
  };

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: 3,
        deck: state.deck,
        board: state.board,
        scores: state.scores,
        capturedSets: state.capturedSets,
        settings: state.settings
      }));
    } catch (e) {
      // localStorage unavailable or quota exceeded; ignore.
    }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data) return null;
      if (data.v !== 1 && data.v !== 2 && data.v !== 3) return null;
      if (!Array.isArray(data.deck) || !Array.isArray(data.board)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function recomputeGameOver() {
    state.gameOver = state.deck.length === 0 && !Game.boardHasSet(state.board);
  }

  function startNewGame() {
    var fresh = Game.newGame();
    state.deck = fresh.deck;
    state.board = fresh.board;
    state.selected = [];
    state.flashKind = null;
    state.flashIds = null;
    state.boardFlash = false;
    state.locked = false;
    state.pendingClaim = false;
    state.gameOver = false;
    if (state.settings.scoringEnabled) {
      state.scores = new Array(state.settings.playerCount).fill(0);
      state.capturedSets = makeEmptyBuckets(state.settings.playerCount);
    } else {
      state.scores = [];
      state.capturedSets = [];
    }
    saveState();
  }

  function makeEmptyBuckets(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push([]);
    return out;
  }

  function isSelected(card) {
    return state.selected.indexOf(card.id) !== -1;
  }

  function toggleSelect(card) {
    if (state.locked) return;
    var idx = state.selected.indexOf(card.id);
    if (idx === -1) {
      state.selected.push(card.id);
    } else {
      state.selected.splice(idx, 1);
    }
    if (state.selected.length === 3) {
      validateSelection();
    }
  }

  function validateSelection() {
    var picked = state.selected.map(function (id) {
      return state.board.find(function (c) { return c.id === id; });
    });

    if (picked.some(function (c) { return !c; })) {
      state.selected = [];
      return;
    }

    var valid = Game.isSet(picked[0], picked[1], picked[2]);
    state.flashIds = state.selected.slice();
    state.flashKind = valid ? 'valid' : 'invalid';
    state.locked = true;

    if (valid && state.settings.scoringEnabled) {
      // Hold the green glow on the cards and freeze the board until a
      // player claims by tapping their score button.
      state.pendingClaim = true;
      return;
    }

    setTimeout(function () {
      if (valid) {
        applyValidSet();
        recomputeGameOver();
        saveState();
      } else {
        state.selected = [];
      }
      state.flashKind = null;
      state.flashIds = null;
      state.locked = false;
      m.redraw();
    }, FLASH_MS);
  }

  function penalize(playerIndex) {
    if (!state.settings.penaltiesEnabled) return;
    if (state.locked) return;
    if (playerIndex < 0 || playerIndex >= state.scores.length) return;
    if (state.scores[playerIndex] <= 0) return;
    var bucket = state.capturedSets[playerIndex];
    if (!bucket || bucket.length === 0) return;

    var triple = bucket.pop();
    state.scores[playerIndex] -= 1;
    state.deck = state.deck.concat(triple);
    Game.shuffle(state.deck);
    state.selected = [];
    recomputeGameOver();
    saveState();
  }

  function claimSet(playerIndex) {
    if (!state.pendingClaim) return;
    if (playerIndex < 0 || playerIndex >= state.scores.length) return;
    var triple = state.selected
      .map(function (id) {
        return state.board.find(function (c) { return c.id === id; });
      })
      .filter(function (c) { return !!c; });
    if (state.capturedSets[playerIndex]) {
      state.capturedSets[playerIndex].push(triple);
    }
    state.scores[playerIndex] = (state.scores[playerIndex] || 0) + 1;
    applyValidSet();
    state.pendingClaim = false;
    state.flashKind = null;
    state.flashIds = null;
    state.locked = false;
    recomputeGameOver();
    saveState();
  }

  function applyValidSet() {
    var ids = state.selected;
    var dissolveExtraRow = state.board.length > 12;
    var deckEmpty = state.deck.length === 0;

    if (dissolveExtraRow || deckEmpty) {
      // Either we are collapsing a partial 5th row, or the deck cannot
      // refill the holes. Fill each earliest hole with the latest card
      // from the back of the board.
      state.board = fillEarliestWithLatest(state.board, ids);
    } else {
      // Standard 12-card board with a non-empty deck: refill each removed
      // slot in place with the next card from the deck.
      var newBoard = [];
      for (var i = 0; i < state.board.length; i++) {
        var c = state.board[i];
        if (ids.indexOf(c.id) !== -1) {
          if (state.deck.length > 0) {
            newBoard.push(state.deck.shift());
          }
        } else {
          newBoard.push(c);
        }
      }
      state.board = newBoard;
    }
    state.selected = [];
  }

  // For each hole (in left-to-right, top-to-bottom order), pull the
  // latest remaining card from the back of the board into that hole.
  // Trailing nulls are dropped so the board shrinks to fit.
  function fillEarliestWithLatest(board, removedIds) {
    var result = board.slice();
    for (var i = 0; i < result.length; i++) {
      if (removedIds.indexOf(result[i].id) !== -1) {
        result[i] = null;
      }
    }
    for (var h = 0; h < result.length; h++) {
      if (result[h] !== null) continue;
      var j = result.length - 1;
      while (j > h && result[j] === null) j--;
      if (j > h) {
        result[h] = result[j];
        result[j] = null;
      }
    }
    return result.filter(function (c) { return c !== null; });
  }

  function addThree() {
    if (state.locked) return;
    var blocked = state.deck.length < 3 ||
      (state.settings.disallowAddWhenSet && Game.boardHasSet(state.board));
    if (blocked) {
      state.boardFlash = true;
      state.locked = true;
      setTimeout(function () {
        state.boardFlash = false;
        state.locked = false;
        m.redraw();
      }, FLASH_MS);
      return;
    }
    state.board = state.board.concat(state.deck.splice(0, 3));
    recomputeGameOver();
    saveState();
  }

  function toggleSettings() {
    state.showSettings = !state.showSettings;
  }

  function setScoringEnabled(enabled) {
    state.settings.scoringEnabled = !!enabled;
    if (state.settings.scoringEnabled) {
      state.scores = new Array(state.settings.playerCount).fill(0);
      state.capturedSets = makeEmptyBuckets(state.settings.playerCount);
    } else {
      // Resolve any frozen claim back to single-player behavior.
      if (state.pendingClaim) {
        applyValidSet();
        state.pendingClaim = false;
        state.flashKind = null;
        state.flashIds = null;
        state.locked = false;
      }
      state.scores = [];
      state.capturedSets = [];
      state.settings.penaltiesEnabled = false;
      state.gameOver = false;
    }
    recomputeGameOver();
    saveState();
  }

  function setPenaltiesEnabled(enabled) {
    state.settings.penaltiesEnabled = !!enabled;
    saveState();
  }

  function adjustPlayerCount(delta) {
    var next = state.settings.playerCount + delta;
    if (next < 2 || next > 4) return;
    state.settings.playerCount = next;
    if (state.settings.scoringEnabled) {
      if (delta > 0) {
        state.scores.push(0);
        state.capturedSets.push([]);
      } else {
        state.scores.pop();
        state.capturedSets.pop();
      }
    }
    saveState();
  }

  function gearIcon() {
    return m('svg', {
      width: 18, height: 18, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    }, [
      m('circle', { cx: 12, cy: 12, r: 3 }),
      m('path', {
        d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
      })
    ]);
  }

  function cardLabel(card) {
    var n = card.count + 1;
    var shapes = ['pill', 'diamond', 'squiggle'];
    var colors = ['red', 'green', 'purple'];
    var shadings = ['solid', 'striped', 'open'];
    return n + ' ' + shadings[card.shading] + ' ' + colors[card.color] + ' ' +
      shapes[card.shape] + (n > 1 ? 's' : '');
  }

  var App = {
    oninit: function () {
      var saved = loadState();
      if (saved && saved.board.length > 0) {
        state.deck = saved.deck;
        state.board = saved.board;
        if (saved.settings && typeof saved.settings === 'object') {
          state.settings.disallowAddWhenSet =
            !!saved.settings.disallowAddWhenSet;
          state.settings.scoringEnabled =
            !!saved.settings.scoringEnabled;
          state.settings.penaltiesEnabled =
            !!saved.settings.penaltiesEnabled;
          var pc = parseInt(saved.settings.playerCount, 10);
          if (pc >= 2 && pc <= 4) state.settings.playerCount = pc;
        }
        if (state.settings.scoringEnabled) {
          var n = state.settings.playerCount;
          if (Array.isArray(saved.scores)) {
            state.scores = saved.scores.slice(0, n);
            while (state.scores.length < n) state.scores.push(0);
          } else {
            state.scores = new Array(n).fill(0);
          }
          if (Array.isArray(saved.capturedSets)) {
            state.capturedSets = saved.capturedSets
              .slice(0, n)
              .map(function (b) { return Array.isArray(b) ? b : []; });
            while (state.capturedSets.length < n) state.capturedSets.push([]);
          } else {
            state.capturedSets = makeEmptyBuckets(n);
          }
        } else {
          state.scores = [];
          state.capturedSets = [];
          state.settings.penaltiesEnabled = false;
        }
        recomputeGameOver();
      } else {
        startNewGame();
      }
    },
    view: function () {
      var strictMode = state.settings.disallowAddWhenSet;
      var hasSet = strictMode ? Game.boardHasSet(state.board) : false;
      var addDisabled = state.locked || state.deck.length < 3 ||
        (strictMode && hasSet);
      var addCta = strictMode && !hasSet && !addDisabled;
      var scoringOn = state.settings.scoringEnabled;
      var penaltiesOn = scoringOn && state.settings.penaltiesEnabled;
      var maxScore = scoringOn && state.scores.length
        ? Math.max.apply(null, state.scores) : 0;
      var appCls = '.app' +
        (scoringOn ? '.scoring-on.players-' + state.settings.playerCount : '');

      return m(appCls, [
        m('h1', 'Set'),
        m('.toolbar', [
          m('button' + (addCta ? '.pulse-cta' : ''), {
            onclick: addThree,
            disabled: addDisabled,
            title: strictMode && hasSet
              ? 'Find the set on the board first'
              : 'Deal 3 more cards'
          }, 'Add 3 cards'),
          m('button', {
            onclick: startNewGame,
            disabled: state.locked
          }, 'New game'),
          m('.status-group', [
            m('span.deck-count', 'Cards remaining: ' + state.deck.length),
            strictMode
              ? m('span.set-status' + (hasSet ? '.set-present' : '.set-absent'),
                  hasSet ? 'Set present' : 'Set not present')
              : null
          ]),
          m('.settings-wrap', [
            m('button.icon-button', {
              onclick: toggleSettings,
              'aria-label': 'Settings',
              'aria-expanded': state.showSettings ? 'true' : 'false',
              title: 'Settings'
            }, gearIcon()),
            state.showSettings
              ? m('.settings-dropdown', {
                  role: 'menu',
                  oncreate: function (vnode) {
                    vnode.state.outsideClick = function (e) {
                      var wrap = document.querySelector('.settings-wrap');
                      if (wrap && !wrap.contains(e.target)) {
                        state.showSettings = false;
                        m.redraw();
                      }
                    };
                    vnode.state.escapeKey = function (e) {
                      if (e.key === 'Escape') {
                        state.showSettings = false;
                        m.redraw();
                      }
                    };
                    setTimeout(function () {
                      document.addEventListener('click', vnode.state.outsideClick);
                      document.addEventListener('keydown', vnode.state.escapeKey);
                    }, 0);
                  },
                  onremove: function (vnode) {
                    document.removeEventListener('click', vnode.state.outsideClick);
                    document.removeEventListener('keydown', vnode.state.escapeKey);
                  }
                }, [
                  m('label.settings-toggle', [
                    m('input', {
                      type: 'checkbox',
                      checked: state.settings.disallowAddWhenSet,
                      onchange: function (e) {
                        state.settings.disallowAddWhenSet = e.target.checked;
                        saveState();
                      }
                    }),
                    m('span', 'Disallow adding cards when a set is present')
                  ]),
                  m('label.settings-toggle', [
                    m('input', {
                      type: 'checkbox',
                      checked: state.settings.scoringEnabled,
                      onchange: function (e) {
                        setScoringEnabled(e.target.checked);
                      }
                    }),
                    m('span', 'Track player scores')
                  ]),
                  state.settings.scoringEnabled
                    ? m('.settings-counter', [
                        m('span.settings-counter-label', 'Players'),
                        m('.settings-counter-controls', [
                          m('button.counter-button', {
                            onclick: function () { adjustPlayerCount(-1); },
                            disabled: state.settings.playerCount <= 2,
                            'aria-label': 'Decrease player count'
                          }, '\u2212'),
                          m('span.counter-value',
                            { 'aria-live': 'polite' },
                            state.settings.playerCount),
                          m('button.counter-button', {
                            onclick: function () { adjustPlayerCount(1); },
                            disabled: state.settings.playerCount >= 4,
                            'aria-label': 'Increase player count'
                          }, '+')
                        ])
                      ])
                    : null,
                  state.settings.scoringEnabled
                    ? m('label.settings-toggle', [
                        m('input', {
                          type: 'checkbox',
                          checked: state.settings.penaltiesEnabled,
                          onchange: function (e) {
                            setPenaltiesEnabled(e.target.checked);
                          }
                        }),
                        m('span', 'Enable score penalties')
                      ])
                    : null
                ])
              : null
          ])
        ]),
        m('.board' + (state.boardFlash ? '.flash-deny-add' : ''),
          state.board.map(function (card) {
            var cls = '.card';
            var sel = isSelected(card);
            if (sel && state.pendingClaim) {
              cls += '.claim-pending';
            } else if (sel) {
              cls += '.selected';
            }
            if (state.flashIds && state.flashIds.indexOf(card.id) !== -1 &&
                !state.pendingClaim) {
              cls += state.flashKind === 'valid' ? '.flash-valid' : '.flash-invalid';
            }
            return m(cls, {
              key: card.id,
              role: 'button',
              tabindex: 0,
              'aria-pressed': isSelected(card) ? 'true' : 'false',
              'aria-label': cardLabel(card),
              onclick: function () { toggleSelect(card); },
              onkeydown: function (e) {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  toggleSelect(card);
                }
              }
            }, m(CardView, { card: card }));
          })
        ),
        scoringOn
          ? m('.player-buttons.players-' + state.settings.playerCount,
              { role: 'group', 'aria-label': 'Player scores' },
              state.scores.map(function (score, i) {
                var cellCls = '.player-cell.pos-p' + (i + 1);
                var btnCls = '.player-button';
                if (state.pendingClaim) btnCls += '.claimable';
                if (state.gameOver && score === maxScore) btnCls += '.winner';
                var canPenalize = penaltiesOn && score > 0 && !state.locked;
                return m(cellCls, { key: 'p' + i }, [
                  m('button' + btnCls, {
                    onclick: function () { claimSet(i); },
                    disabled: !state.pendingClaim,
                    'aria-label': 'Player ' + (i + 1) + ', score ' + score
                  }, [
                    m('span.player-label', 'P' + (i + 1)),
                    m('span.player-score', score)
                  ]),
                  penaltiesOn
                    ? m('button.player-minus', {
                        onclick: function () { penalize(i); },
                        disabled: !canPenalize,
                        title: 'Subtract a point and return a set to the deck',
                        'aria-label': 'Subtract a point from Player ' + (i + 1)
                      }, '\u2212')
                    : null
                ]);
              })
            )
          : null
      ]);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    m.mount(document.getElementById('root'), App);
  });

  global.SetApp = { state: state, startNewGame: startNewGame };
})(window);
