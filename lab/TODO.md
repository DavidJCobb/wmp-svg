
# To-do

* `WMPlayerElement`
  * Shim programmatic access to the `playbackRate` property on the wrapped media element.
    * Track the `playbackRate` privately, so we can restore it when fast-forwarding stops.
    * If the playback rate is modified while fast-forwarding, halt the fast-forwarding operation ([consistent with WMP](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/wmp/controls-fastreverse)).
  * Switch from using SVG views to using `background-position`, since the former can still tricker a flicker (as if the browser is actually reloading the SVG?!) when a sprite changes.
  * The "theater" mode (wherein the player controls are overlaid on the video) uses different glyphs from the normal player &mdash; specifically, white glyphs rather than blue.
  * We need "disabled" states for the "previous" and "next" buttons' glassy backing. In the normal player UI, these buttons are never disabled (because WMP will just pick something from your library, same as play/pause), but they can be disabled in the "theater" UI  (wherein the player controls are overlaid on the video). We're mimicking WMP's UI, not the full program design: we won't always have a previous or next media item, so I think we want more visible disable states. (Plus, we just need the graphics for "theater" mode anyway.)
  * Timestamp display (to the left of the controls)
  * Clicking and holding on the "prev" button should engage rewind
    * Only when watching a video. Disable the button during audio-only playback.
    * WMP implements this by rewinding at 500% speed but only showing keyframes. Not all browsers support negative `playbackRate`s, so we'll have to do something similar: pause the video for as long as the button is held, and jump back 5 seconds in the video for every 1 second the button is held. Then, auto-resume the video when the rewind button is released.
      * Windows Media Player updates the state of the play/pause button while rewinding, as if the video is paused.
      * Windows Media Player resumes playback of the video even if the rewind operation began while the video was paused. I don't think we should mimic this behavior.
  * Tooltips for prev/rewind
    * "Previous"
    * "Press and hold to rewind"
  * If the current playlist only contains a single video, then make the Previous and Next buttons always show the Rewind and Fast Forward glyphs and display as enabled, but make them still require being pressed and held to perform those functions. This will be consistent with Windows Media Player's behavior when playing a single video file (even when you back out to Now Playing such that the video itself isn't visible but its audio is still playing).
    * The Fast Forward button should use the tooltip "Press and hold to fast-forward" in that case, rather than "Next (press and hold to fast-forward)".
  * Look into a better way to handle the "tray" borders
  * Look into replicating the WMP dark theme for the "tray"
  * Look into offering differing arrangements of buttons
    * Current arrangement
    * Play/pause, seek slider, timestamp, and volume
  * Full-screen toggle button in lower-right corner
  * Test on audio files
    * Can we add support for album art somehow?
    * Investigate automatically switching in and out of "theater" mode depending on whether we hit an audio file or a video file
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
* The thumbs for the seek slider and volume slider have outlines that are too thin, because we're taking the 86x86px jewel from the play/pause graphic and reusing it at a smaller size.
  * The bare minimum fix for this would be to guarantee a minimum outline thickness of 1px using a `non-scaling-stroke`. We already had to split the slider thumb into a separate graphic so we could get rid of the alpha mask and drop shadow that were built into the play/pause button, so we *can* make this fix.
    * But the graphics still end up looking bad at larger sizes (e.g. 2x scale, 3x scale) because the outlines should be thicker for the scrollbar thumbs, basically.
* Button glyphs
  * Full-screen (enter/exit)