This Javascript application draws [Ford circles](https://en.wikipedia.org/wiki/Ford_circle).


## TODO list:

 - Fix Fraction.valueOf() so that it works correctly with large p and q.
 - When scrolling quickly, the circles that are added by scroll 2 appear before the animation of scroll 1 has finished.
 - Add support for exponent notation (i.e. "1e-9") to Fraction.fromString().
 - Add support for resizing of the window.
 - Decide what to do about SVG warnings when the circles become too large. One solution: replace large enough circles (r > ~1e7) with boxes.

## Feature wishlist:
 - Only recalculate circles that leave or enter screen (is that hard?).
 - Draw the really large circles (I think there can be at most two arbitrarily large circles in the viewport) by ourselves accurately. (SVG bugs out at around radii > 1e40).
 - Add an option to fix zooming around an arbitrary axis parallel to the y-axis. Same for x-axis.
 - Jump to a specific rational number. Mostly so we can see how far we can push the drawing algorithm.
 - Support mobile devices.