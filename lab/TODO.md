
# To-do

* `WMPlayerElement`
  * Switch from using SVG views to using `background-position`, since the former can still tricker a flicker (as if the browser is actually reloading the SVG?!) when a sprite changes. The flickering isn't common but seems to occur after multitasking for a while on other pages/applications.
    * Be sure to stress-test this change. It's possible (though hopefully unlikely) that the flicker is repaint lag instead and would therefore not be fixed by this change.
  * The "theater" mode (wherein the player controls are overlaid on the video) uses different glyphs from the normal player &mdash; specifically, white glyphs rather than blue.
  * We need "disabled" states for the "previous" and "next" buttons' glassy backing. In the normal player UI, these buttons are never disabled (because WMP will just pick something from your library, same as play/pause), but they can be disabled in the "theater" UI  (wherein the player controls are overlaid on the video). We're mimicking WMP's UI, not the full program design: we won't always have a previous or next media item, so I think we want more visible disable states. (Plus, we need the graphics for "theater" mode either way.)
  * Make it possible to scale the player UI based on a scaling factor relative to the vanilla size *or* maximum main- and cross-axis sizes.
  * Look into a better way to handle the "tray" borders
  * Look into replicating the WMP dark theme for the "tray"
  * Look into offering differing arrangements of buttons
    * Current arrangement
    * Play/pause, seek slider, timestamp, and volume
  * Full-screen toggle button in lower-right corner
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
  * Add APIs/accessors for the following features.
    * Zoom video
      * Present in WMP's context menu
      * Allow zooming to a percentage size. If the percentage is too large, crop.
      * Allow fitting the video to the player or vice versa.
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