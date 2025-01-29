
# Theming

## Selecting a theme

Windows Media Player has two basic views: "Library" view and "Now Playing" view.

The **Library** view is the UI you see when you first open Windows Media Player: your music library up top, and at the bottom of the window, a bar with the player controls. This view is sufficient for audio, but cannot show video. The **Now Playing** view displays the currently playing video (or, for music, the album art) with the player controls overlaid atop it; the controls are shown at 92% scale (though the button icons remain at 100% scale).

The following attributes are provided for controlling the player's theme:

* **`data-theme="dark"`**  
  Enables the dark theme, matching the appearance of Windows Media Player 11 on Windows XP. This has no effect if controls are overlaid.

* **`data-overlay-controls`**  
  When used as a boolean attribute, this makes the player always display controls overlaid on the currently playing media. This is analogous to WMP's Now Playing view.

* **`data-overlay-controls="video-only"`**  
  Setting the attribute to this specific value makes it overlay controls when the currently-playing media item is a video. We detect videos based on the presence of `videoTracks` in supporting values, using non-zero `videoWidth` and `videoHeight` as a fallback for everything that isn't Safari.

## Configuration variables

The following CSS variables are exposed for theming.

* **`--scale`:** A number indicating the scale at which the controls should be displayed; a value of `1` matches the size of Windows Media Player's UI at standard definition, while `2` matches the high-definition UI.
* **`--min-` and `--max-video-width`, and `...-height`:** Constrain the size of the playing video.

* **`--timestamp-force-font-size`:** If set, forcibly sets the `font-size` of the readout for the current timestamp.
* **`--timestamp-base-font-size`:** The base font size for the current timestamp. Defaults to `12px`.
* **`--timestamp-scale-font-size`:** The font size scaling factor for the current timestamp. Defaults to `var(--scale, 1)`.
* **`--timestamp-min-font-size`:** The minimum font size for the current timestamp. The scaled font size is clamped to this value. Not used if the font size is forced.
* **`--timestamp-max-font-size`:** The maximum font size for the current timestamp. The scaled font size is clamped to this value. Not used if the font size is forced.

## Rearranging the layout

A handful of attributes (and reflecting properties) are provided for controlling the availability and placement of buttons within the UI. If *any* of these attributes are set, then only the controls you list will be displayed; you take on responsibility for deciding where all such controls are laid out. (Note that the Play/Pause button is always visible and cannot be moved.)

| Attribute | Property | Description |
| :- | :- | :- |
| `data-controls-in-gutter-right` | `controlsInGutterRight` | Controls shown off to the right of the controls tray. |
| `data-controls-in-tray-left` | `controlsInTrayLeft` | Controls shown in the left "wing" of the tray. |
| `data-controls-in-tray-right` | `controlsInTrayRight` | Controls shown in the right "wing" of the tray. |

Each attribute accepts a space-separated list of control names. If a control name other than `separator` appears more than once, then the leftmost position is used for that control. (You cannot duplicate built-in buttons.)

The configurable controls are:

* `fullscreen`
* `loop`
* `mute`
* `next`
* `prev`
* `seek` (if not specified, it displays above the tray)
* `separator` (a vertical bar between controls)
* `shuffle`
* `stop`
* `volume` (for the slider)
