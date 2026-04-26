/* Pure game logic for Set. Exposed as a global `Game` object. */
(function (global) {
  'use strict';

  var ATTRS = ['count', 'shape', 'color', 'shading'];

  function buildDeck() {
    var deck = [];
    var id = 0;
    for (var c = 0; c < 3; c++) {
      for (var s = 0; s < 3; s++) {
        for (var col = 0; col < 3; col++) {
          for (var sh = 0; sh < 3; sh++) {
            deck.push({
              id: id++,
              count: c,
              shape: s,
              color: col,
              shading: sh
            });
          }
        }
      }
    }
    return deck;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function isSet(a, b, c) {
    for (var i = 0; i < ATTRS.length; i++) {
      var k = ATTRS[i];
      if ((a[k] + b[k] + c[k]) % 3 !== 0) return false;
    }
    return true;
  }

  function boardHasSet(cards) {
    var n = cards.length;
    for (var i = 0; i < n - 2; i++) {
      for (var j = i + 1; j < n - 1; j++) {
        for (var k = j + 1; k < n; k++) {
          if (isSet(cards[i], cards[j], cards[k])) return true;
        }
      }
    }
    return false;
  }

  // Returns indices [i,j,k] of the first valid set found, or null.
  function findSet(cards) {
    var n = cards.length;
    for (var i = 0; i < n - 2; i++) {
      for (var j = i + 1; j < n - 1; j++) {
        for (var k = j + 1; k < n; k++) {
          if (isSet(cards[i], cards[j], cards[k])) return [i, j, k];
        }
      }
    }
    return null;
  }

  function newGame() {
    var deck = shuffle(buildDeck());
    var board = deck.splice(0, 12);
    return { deck: deck, board: board };
  }

  global.Game = {
    ATTRS: ATTRS,
    buildDeck: buildDeck,
    shuffle: shuffle,
    isSet: isSet,
    boardHasSet: boardHasSet,
    findSet: findSet,
    newGame: newGame
  };
})(window);
