
The shuffle feature works by maintaining a list of shuffle-eligible playlist indices in parallel to the playlist itself. Every time you start playing a given playlist item, that index is removed from the list of shuffle-eligible playlist indices. When shuffle is enabled, attempting to advance to the next playlist item instead selects a random index from the list of shuffle-eligible playlist indices. We then advance to the playlist item at that index and remove it from the list of shuffle-eligible playlist indices. This approach ensures that no playlist item will ever be surfaced twice by shuffle until after all items in the playlist have been played at least once.

## Design

Comparing this to the approach of maintaining two playlists (the original playlist and a pre-randomized one):

**Advantages**

* If the user manually jumps to a specific playlist item, we can mark that item as ineligible for shuffle and then continue shuffling after it finishes. If instead we pre-generated a randomized order for the playlist, then we'd have to account for the user jumping around that order.

* If the user skips an item, we can still come back to it later. This is good for cases where the user may want to listem to an item, but not right this second; but it's bad for cases where the user wants to persistently skip an item (see "disadvantages" below).

**Disadvantages**

* We don't remember history: if the user clicks the "Previous" button in order to replay the last-shuffled media, then we'll instead go to the previous item (relative to the current item) in the original playlist, rather than the previously-played item in the shuffled order. A pre-generated randomized order would act as a history that we can navigate backward through.

* We have to account for the edge-case of the user pausing the player and then mashing the "next" button to jump through the list. We don't want to render playlist items ineligible for shuffling if they haven't actually started playing; yet if the user clicks the "next" button, we need to make sure that they're actually taken to a different item (i.e. if the item they're currently on never started playing, then it's still eligible for shuffling, so A can lead to A unless we specifically catch that case).

* **[NOT YET FIXED]** Suppose the user has a playlist of ten items, and shuffles through nine of them before pausing the player. They don't want to listen to the tenth item right now, so they try to skip it. They'll be taken to another media item, *but* after that, the player will repeatedly lead them back to that tenth item unless and until they let it start playing, because that tenth item is the only index still in the shuffle-eligible indices, and we only reset that list once *everything* has started playing. What's more: if the user instead pauses the player *after* the tenth item starts, and *then* skips it, this problem won't happen. Users who encounter both behaviors may feel like the player is acting inconsistently.

  * What we may want to do is, when the player is paused and the user skips *n* tracks in a row, temporarily consider those *n* tracks ineligible. Make them eligible again once any media starts playing. If, as a result of the skipping, the user runs out of eligible tracks, reset the eligible index list.


## Implementation

The bulk of the shuffling logic is implemented in `WMPlaylist`. Some setup is needed to achieve this: the player must inform `WMPlaylist` as to whether Loop and Shuffle are currently enabled.
