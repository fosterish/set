/* Mithril component that renders a Set card via SVG. Exposes `CardView`. */
(function (global) {
  'use strict';

  var COLORS = ['#d92626', '#1ea155', '#7b3aa8'];
  var COLOR_NAMES = ['red', 'green', 'purple'];

  // Each shape is drawn within a 30x50 local box, then translated by (x, y).
  function shapeNode(shape, x, y, fill, stroke) {
    var common = {
      fill: fill,
      stroke: stroke,
      'stroke-width': 2,
      'stroke-linejoin': 'round'
    };

    if (shape === 0) {
      // Pill: rectangle with fully rounded (semicircular) ends.
      return m('rect', Object.assign({
        x: x + 5, y: y + 3,
        width: 20, height: 44,
        rx: 10, ry: 10
      }, common));
    }

    if (shape === 1) {
      var pts = [
        [x + 15, y + 3],
        [x + 27, y + 25],
        [x + 15, y + 47],
        [x + 3, y + 25]
      ].map(function (p) { return p.join(','); }).join(' ');
      return m('polygon', Object.assign({ points: pts }, common));
    }

    // Squiggle: closed "S" silhouette in a 30x50 box.
    // Outline traces (clockwise from upper-left):
    //   1. top arc bulging up from upper-left to upper-right
    //   2. descending S-curve along the right side (bulges left at top, right at bottom)
    //   3. bottom arc bulging down from lower-right to lower-left
    //   4. ascending S-curve along the left side (mirror of #2)
    var d = [
      'M', x + 6, y + 8,
      'Q', x + 16, y - 2, x + 26, y + 8,
      'C', x + 8, y + 18, x + 38, y + 32, x + 26, y + 42,
      'Q', x + 16, y + 52, x + 6, y + 42,
      'C', x + 24, y + 32, x - 6, y + 18, x + 6, y + 8,
      'Z'
    ].join(' ');
    return m('path', Object.assign({ d: d }, common));
  }

  function CardView() {
    return {
      view: function (vnode) {
        var card = vnode.attrs.card;
        var color = COLORS[card.color];
        var colorName = COLOR_NAMES[card.color];
        var count = card.count + 1;
        var shading = card.shading;

        var patternId = 'stripes-' + colorName + '-' + card.id;
        var fill;
        if (shading === 0) {
          fill = color;
        } else if (shading === 2) {
          fill = 'none';
        } else {
          fill = 'url(#' + patternId + ')';
        }

        var shapeWidth = 30;
        var gap = 6;
        var totalWidth = count * shapeWidth + (count - 1) * gap;
        var startX = (120 - totalWidth) / 2;
        var y = 5;

        var shapes = [];
        for (var i = 0; i < count; i++) {
          shapes.push(shapeNode(
            card.shape,
            startX + i * (shapeWidth + gap),
            y,
            fill,
            color
          ));
        }

        var defs = m('defs', [
          m('pattern', {
            id: patternId,
            patternUnits: 'userSpaceOnUse',
            width: 4,
            height: 4
          }, [
            m('rect', { x: 0, y: 0, width: 4, height: 1.2, fill: color })
          ])
        ]);

        return m('svg', {
          viewBox: '0 0 120 60',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-label': describe(card)
        }, [defs, shapes]);
      }
    };
  }

  function describe(card) {
    var n = card.count + 1;
    var shapes = ['pill', 'diamond', 'squiggle'];
    var colors = ['red', 'green', 'purple'];
    var shadings = ['solid', 'striped', 'open'];
    return n + ' ' + shadings[card.shading] + ' ' + colors[card.color] + ' ' +
      shapes[card.shape] + (n > 1 ? 's' : '');
  }

  global.CardView = CardView;
})(window);
