
Playlists are implemented in two parts: a `WMPlaylist` object, and `WMPlaylistItem` instances. Currently, the player spawns its own playlist and holds onto it privately; there is no direct accessor to get or set the playlist, though member functions are provided.

The `WMPlaylist` object subclasses `EventTarget` and provides all of the playlist management functionality, emitting events when the playlist changes or when a new item starts playing. The playlist is also responsible for getting a playlist item's data (its URL, track and source elements, etc.) into the player's wrapped `<video />` element by way of calling the `WMPlaylistItem.populateMediaElement` instance method.

The overall API is rather incomplete; it offers just enough functionality for the player itself to work.

## `WMPlaylistItem`

A `WMPlaylistItem` is an immutable data structure which describes a single media item. The constructor accepts an object literal which may supply the following properties:

* **`audio_only`:** Boolean indicating whether the media item is audio-only.
* **`metadata`:** A `MediaMetadata` instance or an object that could be used to construct one.
* **`poster`:** A path to an image to be used as the `poster` for this media item.
* **`sources`:** An array of object literals and/or `HTMLSourceElement`s. We take ownership of any passed-in source elements, while passed-in objects are used to create new source elements (ferrying the `height`, `media`, `sizes`, `src`, `srcset`, `type`, and `width` properties over).
* **`src`:** A path to the media item.
* **`tracks`:** An array of object literals and/or `HTMLTrackElement`s. We take ownership of any passed-in track elements, while passed-in objects are used to create new track elements (ferrying the `default`, `kind`, `label`, `src`, and `srclang` properties over).
  
  In addition to the above-listed properties, an object literal can also specify a `vttText` property. This property, if specified, should be the text content of a VTT file; if no `src` is provided, then we'll wrap this data in a `data:` URI and set it as the `src`.

You can also construct a `WMPlaylistItem` from a path string, in which case we set the `src` and infer the `audio_only` property based on the file extension.