
The intuitively obvious way to implement rewinding &mdash; ignoring all technical considerations and focusing solely on user expectations and the generally accepted definition of the word "rewind" &mdash; would be to just play the video in reverse. However, as of this writing, most web browsers don't actually support doing that, i.e. setting a negative `playbackRate` on an `HTMLMediaElement` throws an error. Fortunately, Windows Media Player doesn't support that either, and the behavior it *does* use is acceptable enough.

When Windows Media Player engages "fast rewind," it jumps backward through the video one keyframe at a time, at 5x speed while muting audio. We can't jump from keyframe to keyframe, but we can still mimic this behavior well enough. Both we and Windows Media Player pause the video while doing this, which solves the muting without us having to shim `this.#media.muted`; the user can see the play/pause button visibly change, but that's the case in WMP, too.

Rewinding is disabled for audio-only media, in part due to the above implementation and in part because continuous rewinding wouldn't be useful for audio (and we'd want to mute videos while doing it). Most users will not be able to tell how far they are into an audio track just by listening to the reversed audio. The seek slider is better for jumping back through audio.

## UI/UX

* In Windows Media Player, there are situations where it is impossible to move to the previous or next media item (i.e. because there isn't one), but still possible to rewind and fast-forward. In these scenarios, the buttons show the rewind and fast-forward glyphs, but still only perform these functions when clicked and held for a second, consistent with their tooltips. We mimic these ergonomics.

* In Windows Media Player, the Rewind and Fast-Forward features *only* trigger when the buttons are *clicked* and held; pressing and holding Space or Enter is not sufficient. Keyboard users instead have to use keyboard shortcuts (specifically, accelerator keys) to toggle the features on and off. We implement the former restriction, but don't offer keyboard shortcuts, so these features are not currently keyboard-accessible.

## Implementation

Rewind is implemented almost the same way as fast-forwarding, sharing much of the same state and variables. The two features in tandem are internally called "fast playback."

### Variables

We start with some simple state variables:

* **`#fast_playback_type`:** An enum indicating whether we're rewinding (-1), fast-forwarding (1), or doing nothing (0).
* **`#fast_playback_timeout`:** This is used to queue fast playback to occur. Fast-forwarding and rewinding are both initiated by clicking and holding the respective buttons, so this timeout handles the delay between `mousedown` and the function activating.
* **`#fast_playback_paused`:** Indicates whether the player was paused when fast playback began. We have to pause in order to rewind, so this tells us whether to automatically resume playback once fast playback ends.

  Notably, Windows Media Player itself doesn't automatically resume playback. We diverge from that behavior because it feels more intuitive to do so.
* **`#fast_rewind_interval`:** The number of real-time seconds between rewind steps. We adjust this interval based on the length of the playing media.
* **`#fast_rewind_timeout`:** This timeout is used to actually carry out the rewind operation, jumping back by *(n * 5)* seconds every *n* seconds.

We also have this variable:

* **`#bound_fast_playback_stop_on_release_handler`:** A bound listener. Fast-forwarding and rewinding are both initiated by clicking and holding the respective buttons, so we have to react to `mousedown` and `mouseup` separately... but if we only listen for `mouseup` on the button itself, then we'll miss it if the user moves the mouse, focuses another window, or otherwise interrupts the fast-forward/rewind operation through any means but releasing the mouse. Therefore, we must add and remove event listeners on the `window`, and we may as well just `bind` our listener once and reuse it rather than spawning new bound function objects.


### Functions

* **`#queue_fast_playback`:** Called by the `mousedown` handlers on the Previous and Next buttons, to trigger Rewind or Fast Forward when the buttons are held down for long enough.
* **`#cancel_queued_fast_playback`:** Called by the `mouseup` handler used to catch those buttons being released.
* **`#set_is_fast_playback`:** Internal setter for `#fast_playback_type`, initiating or ending fast playback. This adjusts the `<video />` element's `playbackRate` as appropriate, updates button styles, and similar.
* **`#fast_rewind_handler`:** This is the function that gets called on the `#fast_rewind_timeout` timer, to jump back a certain amount of time.
