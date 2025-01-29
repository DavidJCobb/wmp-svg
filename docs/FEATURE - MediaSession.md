
As of this writing, browsers other than Firefox offer the `navigator.mediaSession` API, which can be used to supply information about the currently playing media to the browser. Browsers can then pass this information on to the OS:

* In Windows 10, when you adjust the current volume using media keys, buttons on your headset, etc., an OS-level UI appears towards the upper-left showing the currently-playing media, previous/next buttons, and a play/pause button. The `MediaSession` API influences what appears here.

* On Android, the `MediaSession` API influences the player controls and information that appear in your notifications.

This player has basic support for `MediaSession`: if metadata is supplied to a [playlist item](FEATURE%20-%20PLAYLISTS.md), then we can ferry it onto `MediaSession` in browsers where the API is available. We do this only if something sets our `useMediaSession` property to `true`.

The members used to manage a media session are:

* **`#is_controlling_media_session`:** Underlying variable for the `useMediaSession` property.

* **`#media_session_handlers`:** A collection of bound functions used to handle various media session commands. This is a cache, so we're not constantly spawning new bound function objects every time a handler needs to be enabled.

* **`#set_up_media_session()`:** Called when `thisPlayer.useMediaSession` is set to `true`.

* **`#tear_down_media_session()`:** Called when `thisPlayer.useMediaSession` is set to `false`.

* **`#media_session_disable_handler(name)`:** Used internally to disable a given media session command handler. The API doesn't have an enabled/disabled state for handlers; you disable a handler by simply removing it.

* **`#media_session_restore_handler(name)`:** Used internally to enable a given media session command handler.

* **`#update_media_session_metadata()`**

* **`#update_media_session_playback_state()`**

* **`#update_media_session_time(time)`:** Used to update the media duration, playback rate, and current time within the `MediaSession`. The argument is optional; if omitted, we'll query the DOM.