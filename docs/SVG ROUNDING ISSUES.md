
# SVG rounding issues

Web browsers round a lot of objects to whole pixels, but they do so inconsistently. This causes problems when using SVG-based sprites, particularly when:

* Multiple independently-placed sprites need to line up with each other

* Sprites may have sizes or positions that are not integer quantities of CSS pixels

In general, browsers are horrendous at properly positioning SVG sprites within web content, but this is understandable: we're dealing with SVG content wrapped in CSS backgrounds in order to be applied to the HTML/CSS box model. These issues could potentially be avoided by rendering SVG content directly inline, but that has its own issues, including the lack of any support for flow layout and pollution of the document's ID namespace.

Anyway, a few known problem cases for SVGs and sub-pixel rounding are described herein.


## Case 1: two backgrounds on one box

When designing and implementing the controls tray, I tried displaying multiple sprites as `background` layers on a single box, relying on `background-clip` and friends to control which parts of the box had which sprites. This was a failure: both Firefox and Chrome would display single-pixel gaps between the different parts of the graphic. The issues disappeared when I instead placed a single background on the box, and then placed the other sprite on a pseudo-element of the box.


## Case 2: the Play/Pause button

Player controls are rendered in a "tray" which has a shaped border. This border has a bulge in the middle to accommodate the Play/Pause button, which is larger than all of the other buttons; ergo the Play/Pause button must align with the bulge, so that borders and padding are visually consistent. However, the Play/Pause button was authored at the same scale as Windows Media Player's high-definition graphics (i.e. 2x scale), at which the button is 86x86px; when shown at standard-definition scale, the button is therefore 43x43px, and centering the button within a box thus results in non-integer coordinates. Browsers generally rounded this inconsistently, causing the button to fail to match the tray. (At the time of writing, Firefox was much worse about this than Chromium.)

A cheap hack employed in this project is to round the sprite's position to an integer, and then use `transform: translate3d(0, 0, var(--foo))` to apply the sub-pixel displacement as a CSS transform. I found a handful of sources online which claimed that this would cause the sub-pixel displacement to occur GPU-side, bypassing browsers' usual rounding. In Chromium, this worked perfectly, causing the sprite to actually be displayed at a sub-pixel position. In Firefox, it seemed to just tweak the rounding, and even then not fully consistently.

What's more: the `translate3d` hack is potentially problematic when applied unilaterally to all similar sprites. For example, the Previous button uses the exact same sprites as the Next button, but mirrored (i.e. `transform: scale(-100%, 100%)`), and in practice, compounding these two transforms resulted in heavy blurring in Chromium and sometimes in Firefox. (This was even worse when [accounting for hitboxes](CSS%20SPRITESHEETS.md#Button%20hitboxes), with the mirroring applied to the button element and `transform3d` applied to the sprite pseudo-element.) For the Previous button, we had to hack around the issue:

* Move all transforms to the button element, rather than having separate transforms on the element and one of its pseudo-elements.

* Use vendor-prefixed properties to set the transforms differently.

* In Chromium, manually displace the sprite half a pixel upward, instead of using `transform3d` at all.

This sucks.
