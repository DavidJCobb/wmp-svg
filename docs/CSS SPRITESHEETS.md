
# CSS Spritesheets

The vast majority of our graphics are implemented as spritesheets using CSS. The spritesheet is used as a `background-image`, and we displace the `background-position` by negative values corresponding to the size of sprites. This shifts the desired sprite into view, and then the sheet as a whole gets clipped to the size of the box that has the background.

This is the most efficient approach available for displaying sprites. It's tempting to use SVG `<view />` elements instead, which would give us a "semantic" means of selecting a sprite to display i.e. `url(spritesheet.svg#foo-sprite)`. However, this has two issues:

* As of this writing, both Firefox and Chromium fire new requests for each `url()` change, even if the only part of the URL that has changed is the URI fragment identifier. This means that if we use named SVG views, then the SVG will be reloaded the first time each sprite is requested. Even just testing on my local machine, this causes visible flickering.

* Firefox and Chromium handle SVG sizing inconsistently when dealing with SVG views. Firefox computes the SVG's natural width and height based on the view's `viewBox`, while Chromium continues to use the `width` and `height` attributes present on the root `<svg />` element. The only way to get both browsers to display the sprites consistently is to set the root SVG size to match the size of a single sprite, which in turn means that you can't view the entire spritesheet all at once: all but a single sprite get cropped out of the frame. This is not an insurmountable problem, but it's annoying when developing content.

When dealing with sprites that are of a consistent size, matching their containers, a typical CSS spritesheet works just fine. Some sprites require a more complex arrangement, however.

## The controls tray

Under typical conditions, the controls tray resembles a capsule with a circular bulge in the middle, which makes room for the Play/Pause button. `WMPlayerElement` makes it possible to show and hide different player controls, and hiding all controls on either "wing" of the tray results in a thermometer-like shape extending out to the other side. Hiding all controls except for the Play/Pause button, in turn, results in a simple circle to house the Play/Pause button.

A spritesheet is used for each wing's endcaps, for the middle portion of a wing, and for the bulge behind the Play/Pause button (which may be two-sided, one-sided, or zero-sided). Each of these sprites is a different size, and some sprites are meant to tile. This requires a more complex arrangement of CSS backgrounds.

In practice, since some of our backgrounds repeat horizontally, we have to reserve entire rows for them; and so arranging our sprites vertically is the best approach. In this case, the portions that tile horizontally are fairly simple, and we're using SVG (i.e. data is defined per-shape, not per-pixel), so we could have arbitrarily wide non-tiling sprites without the tiling sprites being "wasteful."

### Wing backgrounds

Our original plan was for the wings to take advantage of `background-clip`, `background-origin`, and `background-repeat` in order to display both their endcaps and their middles as `background-image`s on the same box. The basic idea is that a wing would have a transparent side border matching the thickness of an endcap, and then we'd use a non-repeating endcap background constrained to the border-box for the endcap; then, we'd use a horizontally-repeating middle background constrained to the padding-box. Unfortunately, this caused rounding issues (see [SVG ROUNDING ISSUES.md](SVG%20ROUNDING%20ISSUES.md)).

The final approach for the wings isn't too different. We still take advantage of `background-clip` and `background-origin` on the wing's main box, to define the endcap as a border and restrict the middle background to the padding-box. We just have to use a pseudo-element for the endcap. This results in more consistent rounding.

There is some trickiness with the endcaps. The `background-position` property can be defined as an absolute `<length>` relative to the top-left corner of the box, or it can be defined as a percentage (with keywords like `right` aliasing to `100%`). When defined as a percentage, however, the property *does not* specify a percentage of the box's size. Rather, it describes the percentage "shift" between the box and the background, such that: at `0%`, the box and background align at the top or left edges; at `50%`, they align at their centerpoints; and at `100%`, they align at the bottom or right edges. This means that it's rather complicated to, say, have an endcap that's *n* pixels away from the right edge of the containing spritesheet, and align that endcap with the right edge of the background. In practice, it's easiest to ensure that within the spritesheet, the left edge of the left endcap meets the left edge of the spritesheet, and the right edge of the right endcap meets the right edge of the spritesheet. That's unfortunate: it means that instead of using a simple `<circle />` for the endcaps, we have to either use two circles (which only works if the spritesheet is quite a bit wider than both endcaps), or use a `<path />` to define a capsule which extends to both sides of the spritesheet; we prefer the latter approach.

### Bulge backgrounds

The bulge is much simpler. We have three sprites: one for when both wings are present; one for when only a single wing is present; and one for when there are no wings. We just select the right sprite in the right situation.


## Button hitboxes

Several button sprites have non-square shapes, and accommodating this requires a particular arrangement of pseudo-elements:

* Size the element itself based on the bounding box of the clickable region, and set the element to `pointer-events: none; position: relative`.

* Give the element a `::before` pseudo-element with `position: absolute` to display the sprite.

* Give the element an `::after` pseudo-element with an appropriate size and/or `clip-path`, and set that to `pointer-events: auto`.

The size of the element influences how the button is laid out (e.g. within flex layouts) and affects the size of a displayed focus ring. We use `::after` for the hitboxes of non-square buttons because applying `clip-path` to the element itself would clip the focus ring and the displayed sprite.
