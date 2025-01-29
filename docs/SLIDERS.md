
We use a custom element for sliders within the WMP UI. There are two reasons why `<input type="range" />` isn't sufficient for our use case:

* Not all browsers offer the ability to style both halves of the slider track (the "full" half and the "empty" half) separately. Hacks exist, relying on `box-shadow`, but we need a gradient fill, so that doesn't work for us.

* Browsers expose the slider thumb as a pseudo-element. There's no way to target the `:hover` state of the thumb itself separately from the `:hover` state of the entire slider. In Windows Media Player, hovering over the slider doesn't highlight the thumb; you have to hover directly over the thumb to highlight it.

There is a small advantage to rolling our own slider element, beyond working around those two limitations: we could potentially add the ability to highlight arbitrary ranges on the slider. This could be a good way to show what portions of the seek slider have currently buffered, for large or streaming video files as opposed to locally-hosted ones. (Not sure how I'll test that, yet, though.)