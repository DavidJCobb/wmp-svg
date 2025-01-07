
# To-do

* `WMPlayerElement`
  * Test that inserting a `<track />` inside of the custom element actually works (i.e. verify that `<video />` and friends will pull tracks that are slotted inside of them rather than inserted directly).
  * We need "disabled" states for the "previous" and "next" buttons (have WMP play a video file in order to see what those look like).
  * Timestamp display (to the left of the controls)
  * Design a way to specify a playlist of videos (e.g. a `srclist` attribute pointing to a `datalist` element, or perhaps just a slotted `datalist` child)
    * This is necessary for the "previous," "next," and "shuffle" buttons' functionality.
  * Implement buttons
    * Loop (consider making this an `input type="checkbox"`)
    * Mute (consider making this an `input type="checkbox"`)
    * Next and previous
    * Shuffle (consider making this an `input type="checkbox"`)
    * Fast-forward and rewind
  * Look into a better way to handle the "tray" borders
  * Look into replicating the WMP dark theme for the "tray"
  * Look into offering differing arrangements of buttons
    * Current arrangement
    * Play/pause, seek slider, timestamp, and volume
  * Full-screen toggle button in lower-right corner
* Button glyphs
  * Shuffle
  * Loop
  * Stop
  * Volume
    * Muted
    * 0%
    * 33%
    * 66%
    * Full
  * Full-screen (enter/exit)