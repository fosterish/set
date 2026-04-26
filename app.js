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
    settings: {
      disallowAddWhenSet: false
    }
  };

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: 1,
        deck: state.deck,
        board: state.board,
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
      if (!data || data.v !== 1) return null;
      if (!Array.isArray(data.deck) || !Array.isArray(data.board)) return null;
      return data;
    } catch (e) {
      return null;
    }
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
    saveState();
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

    setTimeout(function () {
      if (valid) {
        applyValidSet();
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
    saveState();
  }

  function toggleSettings() {
    state.showSettings = !state.showSettings;
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
        }
      } else {
        startNewGame();
      }
    },
    view: function () {
      var strictMode = state.settings.disallowAddWhenSet;
      var hasSet = strictMode ? Game.boardHasSet(state.board) : false;
      var addDisabled = state.locked || state.deck.length < 3 ||
        (strictMode && hasSet);

      return m('.app', [
        m('h1', 'Set'),
        m('.toolbar', [
          m('button', {
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
                  ])
                ])
              : null
          ])
        ]),
        m('.board' + (state.boardFlash ? '.flash-deny-add' : ''),
          state.board.map(function (card) {
            var cls = '.card';
            if (isSelected(card)) cls += '.selected';
            if (state.flashIds && state.flashIds.indexOf(card.id) !== -1) {
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
        )
      ]);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    m.mount(document.getElementById('root'), App);
  });

  global.SetApp = { state: state, startNewGame: startNewGame };
})(window);
