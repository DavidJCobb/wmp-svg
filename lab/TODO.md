
# To-do

* Button glyphs
  * Now Playing (enter/exit) (with disabled states too)
* `WMPlayerElement`
  * Now Playing toggle (lower-right in Library view; upper-right in Now Playing view) (name for layout customization: `toggle-overlaid`)
    * Should supersede the effect of `data-overlay-controls`, but maybe only while the button is actually present in the layout
  * Investigate allowing control repositioning to move the current timestamp into the tray, e.g. between Play/Pause and Seek.
  * Optional: currently-playing media title offset to the left edge (WMP: seen in music UI, not in video UI).
  * Add APIs/accessors for the following features.
    * Zoom video
      * Present in WMP's context menu
      * Allow zooming to a percentage size. If the percentage is too large, crop.
      * Allow fitting the video to the player or vice versa.
  * Investigate features for streaming video, e.g. highlighting the currently buffered time range on the seek slider.
  * Make it so that if `data-overlay-controls="any-visual"`, then we overlay controls when playing a video *or* when playing an audio-only item that has a `poster`.
  * Make it possible to scale the player UI based on a scaling factor relative to the vanilla size *or* maximum main- and cross-axis sizes.
    * Would require being able to compute the size of the controls *a priori* within CSS, which in turn would require knowing the controls layout. In other words, this is something that's only possible with a fixed controls layout, and at that point, we may as well go all the way and do the entire set of player controls as a single merged SVG.
* Playlist API improvements
  * Allow [gs]etting the current playlist, i.e. creating an entire `WMPlaylist`, preconfiguring it, and assigning it. Similarly, that would also allow `myPlayer.playlist.index = 3` or whatever.
  * Test accessors on WMPlaylist
    * `.toArray`
    * `.insertAt`
    * `.indexOf`
    * `.moveItemTo`
    * `.remove`
  
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