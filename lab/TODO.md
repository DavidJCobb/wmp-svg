
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
  * Tray background
    * Modify the overlaid-controls spritesheet to handle endcaps the same way as the non-overlaid-controls spritesheet.
    * Clean up the spritesheet files.
      * Rename `spritesheet-tray-background.svg` to `spritesheet-tray-background-overlay.svg`.
      * Rename `spritesheet-tray-background-non-overlay.svg` to `spritesheet-tray-background.svg`.
      * Delete the other spritesheets for the tray background and border.
  * When Windows Media Player is in Now Playing view, it displays all button "glass" (and the controls tray border and background) at 92% scale, but button glyphs are still displayed at 100% scale. Right now, we have no means to alter the scale of button glyphs independently of the buttons themselves.
    * The seek slider and current timestamp don't appear to be downscaled in Now Playing view.
    * If we add an independent scaling factor for glyphs, we need to bear in mind that glyphs are shown on the same element as glass (they're two background layers). This means that the two scales can only differ so much before one of the graphics gets clipped *or* before more sprites than intended become visible (i.e. if the total size is too much larger than that of a single sprite). For the scaling difference we intend (92% times the overall scaling factor of the player controls), this won't matter so much, but if outside code alters the scaling, then things may go haywire.
  * Current timestamp widget
    * Fix vertical alignment (non-overlaid controls, dark theme, scale 1)
    * Timestamp should respond to the current `--scale`
    * Add CSS variables:
      * `--timestamp-force-font-size`
      * `--timestamp-scale-font-size` (when not forcing)
      * `--timestamp-min-font-size` (when not forcing)
      * `--timestamp-max-font-size` (when not forcing)
  * We need "disabled" states for the "previous" and "next" buttons' glassy backing. In the normal player UI, these buttons are never disabled (because WMP will just pick something from your library, same as play/pause), but they can be disabled in the "theater" UI  (wherein the player controls are overlaid on the video). We're mimicking WMP's UI, not the full program design: we won't always have a previous or next media item, so I think we want more visible disable states. (Plus, we need the graphics for "theater" mode either way.)
  * Theater: "previous" and "next" don't have a glassy shine on their "normal" state when in this view. We should implement this as a fifth "button sprite" in their spritesheet, setting `--button-sprite-count: 5` and then using `--use-button-sprite: 4` for the "normal" state in the theater view.
  * Make it possible to scale the player UI based on a scaling factor relative to the vanilla size *or* maximum main- and cross-axis sizes.
  * Look into offering differing arrangements of buttons
    * Current arrangement
    * Play/pause, seek slider, timestamp, and volume
    * Better yet: add reflected properties/attributes that consist of a space-separated list of buttons to show e.g. `"shuffle loop stop prev"`.
      * `data-controls-in-tray-left` and `data-controls-in-tray-right`
      * When none of these properties are set, use the default layout. When any properties are set, show only the buttons listed in their values.
        * Note: We need to treat the attributes being absent as `null`, not `""`, so that `""` can be used to hide all optional controls.
      * For now, do not allow moving the Play/Pause button.
      * If a control is listed more than once, then display it in the leftmost position only.
        * Allow `separator` as a value that can appear more than once, spawning an `hr` element.
      * If `seek` is included in any of these, move the seek slider into the tray.
      * If there are no controls on one side of the tray (or if the Play/Pause button is the sole button being shown), then adjust how we render the tray "bulge" behind the Play/Pause button.
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