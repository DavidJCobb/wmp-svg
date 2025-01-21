
# To-do

Overview:

* Graphics work
  * Previous/Next
  * Controls tray
  * Slider thumb refinements
* API
  * Support different controls layouts
  * Redesign playlist API
* General coding
  * Subtitle support
  * Album art?
  * Switch to TypeScript?

## Specifics

* `WMPlayerElement`
  * Dark tray background
    * Current timestamp is vertically aligned a bit jankily.
    * The height of the tray graphic should adjust to match the total height of the seek slider (including whatever padding we add to it) and the controls. Currently, we do this using lots of explicit heights and whatnot, but it'd be nice if there were some way to automatically compute this based on the grid height. (IIRC `background-size` is relative to the size of the element what has a background, but I don't remember if `border-image`, which we use for the left and right endcaps, works the same way.)
  * We need "disabled" states for the "previous" and "next" buttons' glassy backing. In the normal player UI, these buttons are never disabled (because WMP will just pick something from your library, same as play/pause), but they can be disabled in the "theater" UI  (wherein the player controls are overlaid on the video). We're mimicking WMP's UI, not the full program design: we won't always have a previous or next media item, so I think we want more visible disable states. (Plus, we need the graphics for "theater" mode either way.)
  * Theater: "previous" and "next" don't have a glassy shine on their "normal" state when in this view. We should implement this as a fifth "button sprite" in their spritesheet, setting `--button-sprite-count: 5` and then using `--use-button-sprite: 4` for the "normal" state in the theater view.
  * The tray's fill and borders aren't well-handled. I don't like the mishmash of borders, clip-paths, and positioning tricks we use for it.
    * The tray has too much `--padding` &mdash; 5px including the border thickness, instead of 3px including the border thickness. (If we didn't include the border and similar, we'd want 2px padding.) However, this is complicated to fix due to how we position the Previous and Next buttons relative to the Play/Pause button. These buttons should be at a distance of 2px from the Play/Pause button &mdash; specifically, the center of their inner curve should be that distance from the edge of the Play/Pause button. (For reference, that point on the Next button's curve is at X-position 6 within the SVG, and the SVG is designed at 2x scale.)
    * We should investigate replacing the CSS-based tray border and fill with something relying on SVGs via `background` and/or `border-image`. This could potentially make it easier to swap to different tray shapes (e.g. "Play on the left and buttons only on the right, like a thermometer") for different control layouts.
      * Notably, the existing tray borders aren't accurate for the Library UI or the Now Playing UI. In the latter case, it's semitransparent white but with a two-stroke border, dark then light. See the 2572200 PNG (resource 257/2200).
  * Make it possible to scale the player UI based on a scaling factor relative to the vanilla size *or* maximum main- and cross-axis sizes.
  * Look into offering differing arrangements of buttons
    * Current arrangement
    * Play/pause, seek slider, timestamp, and volume
  * Full-screen toggle button in lower-right corner
  * Tests
    * Support for subtitle tracks, etc.
  * Player APIs in JavaScript
    * We should forward `HTMLMediaElement` events and the events of their subclasses
  * Test programmatic manipulation of the player widget from outside
    * Playing and pausing
    * Manipulating the playlist
    * Muting
    * Setting volume
  * Investigate improvements to the playlist API
    * I don't like that playlist items are immutable.
    * I don't like that there's no API for accessing the current playlist.
      * If we want playlist items to be mutable, then an API that exposes the current playlist needs to wrap playlist items in [gs]etters, so that changes to the current playlist item are immediately reacted to by the player.
    * I don't like that there's no API for removing a playlist item.
      * Ideally it should be possible to do `playerElement.playlist[3]` and `playerElement.playlist.remove(3)` and whatnot.
  * Optional: currently-playing media title offset to the left edge (WMP: seen in music UI, not in video UI).
  * Investigate adding support for displaying an audio file's album art (or at least displaying some accessory image that can be specified when adding the audio file to the current playlist) when in `theater` view.
    * Investigate automatically switching in and out of "theater" mode depending on whether we hit an audio file or a video file
  * Document the fact that our baseline styles line up with the "Library" view in WMP, while the `theater` class lines up with the "Now Playing" view.
  * Investigate adding support for displaying subtitles, lyrics, et cetera.
  * Consider switching this all to TypeScript.
  * Add APIs/accessors for the following features.
    * Zoom video
      * Present in WMP's context menu
      * Allow zooming to a percentage size. If the percentage is too large, crop.
      * Allow fitting the video to the player or vice versa.
  * Investigate features for streaming video, e.g. highlighting the currently buffered time range on the seek slider.
* The thumbs for the seek slider and volume slider have outlines that are too thin, because we're taking the 86x86px jewel from the play/pause graphic and reusing it at a smaller size.
  * The bare minimum fix for this would be to guarantee a minimum outline thickness of 1px using a `non-scaling-stroke`. We already had to split the slider thumb into a separate graphic so we could get rid of the alpha mask and drop shadow that were built into the play/pause button, so we *can* make this fix.
    * But the graphics still end up looking bad at larger sizes (e.g. 2x scale, 3x scale) because the outlines should be thicker for the scrollbar thumbs, basically.
* Button glyphs
  * Full-screen (enter/exit)
  
## Specific features

### Context menus

WMP exposes context menus for some of the player buttons:

* Play/Pause
  * *WMP offers context menu items, with accelerator keys, for controlling playback speed. If you change the playback speed and then use any other functions that change playback speed, like Fast Forward and Rewind, those functions will reset the speed back to normal when they deactivate.*
  * Slow playback
  * Normal playback
  * Fast playback
* Next
  * Fast Forward
* Previous
  * Rewind

  
### Keyboard shortcuts
  
Investigate implementing keyboard shortcuts (they're listed [here](https://www.instructables.com/Keyboard-Shortcuts-for-Windows-Media-Player/)). It's worth noting that in Windows Media Player, some functions, like Fast Forward, are only accessible via these accelerator keys and not via keyboard interactions with their actual on-screen buttons.

Implementation:

* Condition this on a JavaScript property that reflects `data-enable-keyboard-shortcuts`, which should be treated as a Boolean attribute *and* which should default to false.
* When keyboard shortcuts are enabled, install a key event listener on the `window` using a cached bound (`bind`) event handler. Why cached? So we can remove it should keyboard shortcuts be disabled later.
* Consider exposing a JavaScript property that allows us to scope keyboard shortcuts to a particular container element. Default it to the `window` whenever it's not set. Throw if the user tries to set it to something that isn't a container DOM node (but do not require the user to set it to a container that actually contains the player element).