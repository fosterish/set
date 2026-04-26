/* Top-level Mithril app: board, selection, add-3, flash animations. */
(function (global) {
  'use strict';

  var FLASH_MS = 500;

  var state = {
    deck: [],
    board: [],
    selected: [],
    flashKind: null,
    flashIds: null,
    boardFlash: false,
    locked: false
  };

  function startNewGame() {
    var fresh = Game.newGame();
    state.deck = fresh.deck;
    state.board = fresh.board;
    state.selected = [];
    state.flashKind = null;
    state.flashIds = null;
    state.boardFlash = false;
    state.locked = false;
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
    if (state.board.length > 12) {
      // Partial 4th row exists: just remove the 3 selected, no refill.
      state.board = state.board.filter(function (c) {
        return ids.indexOf(c.id) === -1;
      });
    } else {
      // Standard 12-card board: replace each removed slot with a deck card if available.
      var newBoard = [];
      for (var i = 0; i < state.board.length; i++) {
        var c = state.board[i];
        if (ids.indexOf(c.id) !== -1) {
          if (state.deck.length > 0) {
            newBoard.push(state.deck.shift());
          }
          // else: drop the slot (deck empty)
        } else {
          newBoard.push(c);
        }
      }
      state.board = newBoard;
    }
    state.selected = [];
  }

  function addThree() {
    if (state.locked) return;
    if (state.deck.length < 3 || Game.boardHasSet(state.board)) {
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
  }

  function gameOver() {
    return state.deck.length === 0 && !Game.boardHasSet(state.board);
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
      startNewGame();
    },
    view: function () {
      var addDisabled = state.locked || state.deck.length < 3;

      return m('.app', [
        m('h1', 'Set'),
        m('.toolbar', [
          m('button', {
            onclick: addThree,
            disabled: addDisabled,
            title: 'Deals 3 more cards if there is no set on the board'
          }, 'Add 3 cards'),
          m('button', {
            onclick: startNewGame,
            disabled: state.locked
          }, 'New game'),
          m('span.deck-count',
            'Deck: ' + state.deck.length +
            ' \u00b7 Board: ' + state.board.length
          ),
          gameOver() ? m('span.deck-count', { style: 'color:#fbbf24' }, 'Game over') : null
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
