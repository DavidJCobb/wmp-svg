
# Ripped files

The original WMP assets aren't mine to distribute, so I won't be committing them to Github; but for the lab, they'd go in here.

## Extracting WMP assets

You'll want to start by copying the file `C:\windows\systemresources\wmploc.DLL.mun` to someplace that isn't a system folder, so you can open it up with tools like Resource Hacker.

Opening `wmploc.DLL.mun` in Resource Hacker, you'll find some basic assets in the Bitmaps section, such as the background for the play/pause area in dark-theme WMP 11 (bitmap 32164). The real gold mine, however, is the top-level 257 folder, which has most of the visual assets including HD versions of the play/pause buttons.

### Skin assets

| `wmploc.DLL.mun` path | Description |
| :- | :- |
| 256/BCB.JS | WMP JScript file related to the breadcrumb navbar |
| 256/CAPTIONS.JS | WMP JScript file related to captions and lyrics |
| 256/MAINAPPSKIN2.JS | WMP JScript file |
| 256/TASKBAR.JS | WMP theme JScript file for the taskbar player |
| 256/132 | WMP theme JScript file defining "open state" and "play state" enums |
| 256/142 | WMP theme JScript file |
| 256/143 | WMP theme JScript file for play/pause and associated buttons |
| 256/4004 | WMP theme JScript file related to album art |
| 256/4011 | WMP theme JScript file: full-screen, top |
| 256/4013 | WMP theme JScript file: full-screen, bottom |

#### Findings

* Play-state icons with IDs >= 30000 were meant for "Vista Plus"
* Breadcrumb assets
  * 5228 = overflow image
  * 5235 = overflow arrow
  * 5236 = overflow arrow, bidi
  * 5237 = overflow arrow, down
  * 5650 = button, hover, some sort of override?
  * 5651 = button, down
  * 5652 = button, hover
  * 5655 = button, initial
  * 5660 = split menu button, up
  * 5661 = split menu button, down
  * 5662 = split menu button, hover
  * 5663 = split menu button, bidi, up
  * 5664 = split menu button, bidi, down
  * 5665 = split menu button, bidi, hover
* Player assets
  * 3882 = seek slider thumb (per `PLAYER.JS`)
* Volume icons
  * 5244 = volume muted
  * 5245 = volume in range (0, 33%)
  * 5246 = volume in range [33%, 66%)
  * 5247 = volume >= 66%
  * 5248 = volume not muted but at 0


### High-value image assets

| `wmploc.DLL.mun` path | Path in this folder | Description |
| :- | :- | :- |
| Bitmap/5100 |  | Play/Burn/Sync tab (dark theme) |
| 257/2033 |  | Taskbar mini-player, all buttons, vertical, normal |
| 257/2035 |  | Taskbar mini-player, all buttons, vertical, disabled |
| 257/2036 |  | Taskbar mini-player, all buttons, vertical, active |
| 257/2037 |  | Taskbar mini-player, all buttons, vertical, hover |
| 257/2105 |  | Taskbar mini-player, all buttons, vertical, normal |
| 257/2107 |  | Taskbar mini-player, all buttons, vertical, disabled |
| 257/2108 |  | Taskbar mini-player, all buttons, vertical, active |
| 257/2109 |  | Taskbar mini-player, all buttons, vertical, hover |
| 257/2110 |  | Volume slider track, vertical, empty |
| 257/2111 |  | Volume slider track, vertical, full |
| 257/2112 |  | Volume slider thumb, normal |
| 257/2113 |  | Volume slider thumb, hover |
| 257/2114 |  | Volume slider thumb, active |
| 257/2174 |  | Taskbar mini-player, background, horizontal, grey |
| 257/2175 |  | Taskbar mini-player, background, vertical, grey |
| 257/3164 |  | Highest-resolution groove for stop/prev/play/pause/next/etc. buttons to sit in |
| 257/3881 |  | Seek slider track (filled) |
| 257/3882 |  | Seek slider thumb (non-mouseover) |
| 257/4059 |  | Seek slider thumb (non-mouseover, when time is at 0) |
| 257/4174 |  | Shuffle glyph, on |
| 257/4175 |  | Shuffle glyph, off |
| 257/4176 |  | Repeat glyph, on |
| 257/4177 |  | Repeat glyph, off |
| 257/4253 | main-normal.png | Highest-resolution stop/prev/play/pause/next buttons, normal state |
| 257/4254 | main-active.png | Highest-resolution stop/prev/play/pause/next buttons, pressed state |
| 257/4255 | main-hover.png | Highest-resolution stop/prev/play/pause/next buttons, hover state |
| 257/4263 |  | Highest-resolution play icon |
| 257/4264 |  | Highest-resolution pause icon |
| 257/4266 |  | Highest-resolution next icon, enabled |
| 257/4267 |  | Highest-resolution next icon, disabled |
| 257/4268 |  | Highest-resolution previous icon, enabled |
| 257/4269 |  | Highest-resolution previous icon, disabled |
| 257/4270 |  | Highest-resolution rewind icon, enabled |
| 257/4272 |  | Highest-resolution fast-forward icon, enabled |
| 257/4274 |  | Highest-resolution shuffle icon, hover? |
| 257/4275 |  | Highest-resolution shuffle icon, normal |
| 257/4276 |  | Highest-resolution loop icon, hover? |
| 257/4277 |  | Highest-resolution loop icon, hover |
| 257/4279 |  | Highest-resolution stop icon, enabled |
| 257/4280 |  | Highest-resolution stop icon, disabled |
| 257/4626 |  | Button with menu, normal |
| 257/4627 |  | Button with menu, active |
| 257/4628 |  | Button with menu, hover |
| 257/4629 |  | Button with menu, disabled |
| 257/4732 |  | Button with menu, wide, active |
| 257/4733 |  | Button with menu, wide, hover |
| 257/4735 |  | Button with menu, wide, disabled |
| 257/4737 |  | Button with menu, wide, normal |
| 257/5244 |  | Volume icon, mute |
| 257/5245 |  | Volume icon, min |
| 257/5246 |  | Volume icon, medium |
| 257/5247 |  | Volume icon, max |
| 257/5248 |  | Volume icon, bare |
| 257/5355 |  | Highest-resolution prev/next navigation, normal |
| 257/5356 |  | Highest-resolution prev/next navigation, active |
| 257/5357 |  | Highest-resolution prev/next navigation, hover |
| 257/5358 |  | Highest-resolution prev/next navigation, disabled |
| 257/5362 |  | Highest-resolution groove for prev/next nav buttons to sit in |
| 257/7805 |  | Additional hover glow for play-pause button |