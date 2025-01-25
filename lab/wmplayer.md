
# Features

## Rewind

The intuitively obvious way to implement rewinding &mdash; ignoring all technical considerations and focusing solely on user expectations and the generally accepted definition of the word "rewind" &mdash; would be to just play the video in reverse. However, as of this writing, most web browsers don't actually support doing that, i.e. setting a negative `playbackRate` on an `HTMLMediaElement` throws an error. Fortunately, Windows Media Player doesn't support that either, and the behavior it *does* use is acceptable enough.

When Windows Media Player engages "fast rewind," it jumps backward through the video one keyframe at a time, at 5x speed while muting audio. We can't jump from keyframe to keyframe, but we can still mimic this behavior well enough. Both we and Windows Media Player pause the video while doing this, which solves the muting without us having to shim `this.#media.muted`; the user can see the play/pause button visibly change, but that's the case in WMP, too.

Rewinding is disabled for audio-only media, in part due to the above implementation and in part because continuous rewinding wouldn't be useful for audio (and we'd want to mute videos while doing it). Most users will not be able to tell how far they are into an audio track just by listening to the reversed audio. The seek slider is better for jumping back through audio.

## Shuffle

The shuffle feature works by maintaining a list of shuffle-eligible playlist indices in parallel to the playlist itself. Every time you start playing a given playlist item, that index is removed from the list of shuffle-eligible playlist indices. When shuffle is enabled, attempting to advance to the next playlist item instead selects a random index from the list of shuffle-eligible playlist indices. We then advance to the playlist item at that index and remove it from the list of shuffle-eligible playlist indices. This approach ensures that no playlist item will ever be surfaced twice by shuffle until after all items in the playlist have been played at least once.

Comparing this to the approach of maintaining two playlists (the original playlist and a pre-randomized one):

**Advantages**

* If the user manually jumps to a specific playlist item, we can mark that item as ineligible for shuffle and then continue shuffling after it finishes. If instead we pre-generated a randomized order for the playlist, then we'd have to account for the user jumping around that order.

* If the user skips an item, we can still come back to it later. This is good for cases where the user may want to listem to an item, but not right this second; but it's bad for cases where the user wants to persistently skip an item (see "disadvantages" below).

**Disadvantages**

* We don't remember history: if the user clicks the "Previous" button in order to replay the last-shuffled media, then we'll instead go to the previous item (relative to the current item) in the original playlist, rather than the previously-played item in the shuffled order. A pre-generated randomized order would act as a history that we can navigate backward through.

* We have to account for the edge-case of the user pausing the player and then mashing the "next" button to jump through the list. We don't want to render playlist items ineligible for shuffling if they haven't actually started playing; yet if the user clicks the "next" button, we need to make sure that they're actually taken to a different item (i.e. if the item they're currently on never started playing, then it's still eligible for shuffling, so A can lead to A unless we specifically catch that case).

* **[NOT YET FIXED]** Suppose the user has a playlist of ten items, and shuffles through nine of them before pausing the player. They don't want to listen to the tenth item right now, so they try to skip it. They'll be taken to another media item, *but* after that, the player will repeatedly lead them back to that tenth item unless and until they let it start playing, because that tenth item is the only index still in the shuffle-eligible indices, and we only reset that list once *everything* has started playing. What's more: if the user instead pauses the player *after* the tenth item starts, and *then* skips it, this problem won't happen. Users who encounter both behaviors may feel like the player is acting inconsistently.

  * What we may want to do is, when the player is paused and the user skips *n* tracks in a row, temporarily consider those *n* tracks ineligible. Make them eligible again once any media starts playing. If, as a result of the skipping, the user runs out of eligible tracks, reset the eligible index list.


# Custom elements

## `WMPlayerElement`

A video player element that mimics Windows Media Player 11 and 12's UI. The functionality is similar to `<video />`, but with some additions:

* A built-in system for playlists.
* Accordingly, "loop" cycles from each end of the playlist to the other, and "shuffle" randomizes playback order. "Previous" and "next" buttons are offered as well.

We match WMP's "Library" theme (the normal) and the "Now Playing" theme (wherein player controls are overlaid on the playing media). Our "Library" light theme is barebones, but the "Library" dark theme attempts to match the original WMP 11 dark theme (from Windows XP, as I recall) very closely. You can set `data-theme` to `dark` to enable the dark theme, or add the `data-overlay-controls` boolean attribute to enable the "Now Playing" theme.

CSS variables are offered to allow configuration of the player's visuals.


### Usage notes

* Windows Media Player uses a 500% fast-forward speed ([source](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/wmp/controls-fastforward)), but we default our fast-forward speed to 400% because Gecko will mute media if it has a playback rate outside the range [25%, 400%]. You can set `fastForwardSpeed` to change the speed (the value you specify must be greater than `1` i.e. 100% speed).

* We currently don't support `defaultPlaybackRate` (i.e. we don't expose that property on the underlying `HTMLMediaElement`).
  
  The HTML5 spec implies that `defaultPlaybackRate` and `playbackRate` should both influence the current playback rate of a media element. The spec implies that the former value should be "used by the user agent" when it shows built-in player controls, and explicitly recommends that the latter be used for features like fast-forwarding and slow motion. However, the two values don't stack, and setting `defaultPlaybackRate` doesn't change the actual playback rate in Chrome or Firefox (even if `playbackRate` has never been set before). Moreover, even if setting `defaultPlaybackRate` *did initially* alter the current playback rate, it would be broken by design: `playbackRate` only supports a numeric value, so once you have ever set `playbackRate`, there'd be no way to switch back to `defaultPlaybackRate`. (Yes, you could do `m.playbackRate = m.defaultPlaybackRate`, but thereafter, changing `defaultPlaybackRate` itself would have no effect.) In essence, `defaultPlaybackRate` may as well not even exist.
  
  Set `playbackRate` to change the baseline playback rate. Use the fast-forward and rewind APIs to perform those tasks.

* You can use `data-controls-in-tray-left` and `data-controls-in-tray-right` (reflected by JavaScript properties `controlsInTrayLeft` and `controlsInTrayRight`) to configure which controls (besides the play/pause button) are shown in the tray. If *any* of these attributes are set, then only the controls you list will be displayed.
  
  Each attribute accepts a space-separated list of control names. If a control name other than `separator` appears more than once, then the leftmost position is used for that control. (You cannot duplicate built-in buttons.)
  
  The configurable controls are:
  
  * `loop`
  * `mute`
  * `next`
  * `prev`
  * `seek` (if not specified, it displays above the tray)
  * `separator` (a vertical bar between controls)
  * `shuffle`
  * `stop`
  * `volume` (for the slider)


## `WMPlayerSliderElement`

A custom element that acts a slider. Simple enough. This is depended on by `WMPlayerElement`.

There are two reasons why `<input type="range" />` isn't sufficient for our use case:

* Not all browsers offer the ability to style both halves of the slider track (the "full" half and the "empty" half) separately. Hacks exist, relying on `box-shadow`, but we need a gradient fill, so that doesn't work for us.

* Browsers expose the slider thumb as a pseudo-element. There's no way to target the `:hover` state of the thumb itself separately from the `:hover` state of the entire slider. In Windows Media Player, hovering over the slider doesn't highlight the thumb; you have to hover directly over the thumb to highlight it.

There is a small advantage to rolling our own slider element, beyond working around those two limitations: we could potentially add the ability to highlight arbitrary ranges on the slider. This could be a good way to show what portions of the seek slider have currently buffered, for large or streaming video files as opposed to locally-hosted ones. (Not sure how I'll test that, yet, though.)


# Implementation notes

## Specific features

### Fast-forward and rewind

In Windows Media Player, these are tied to the Next and Previous buttons: click and hold the button for one second to start engaging the feature; then release to stop. There are a few considerations here:

* Traditionally, web APIs define a "click" as a mousedown and mouseup occurring on the same element. Within Windows Media Player, however, once you mousedown on these buttons long enough to activate their secondary functions, you can mouseup anywhere to disengage that function. We need the same behavior, to avoid getting "stuck" fast-forwarding or rewinding, so we temporarily register window-level event listeners for anything that would end a mousedown (e.g. mouseup, blur).

* In Windows Media Player, there are situations where it is impossible to move to the previous or next media item (i.e. because there isn't one), but still possible to rewind and fast-forward. In these scenarios, the buttons show the rewind and fast-forward glyphs, but still only perform these functions when clicked and held for a second, consistent with their tooltips. We mimic these ergonomics.

* In Windows Media Player, the Rewind and Fast-Forward features *only* trigger when the buttons are *clicked* and held; pressing and holding Space or Enter is not sufficient. Keyboard users instead have to use keyboard shortcuts (specifically, accelerator keys) to toggle the features on and off.

## Custom element lifecycle

The lifecycle of a custom element isn't terribly clear: the relative ordering of callbacks is well-defined, but the ordering of these callbacks relative to other operations doesn't seem to be.

### A classification of jank

#### Attributes

To wit: consider the case of a custom element that is present in the HTML source code, after a synchronously-loaded `<script>` tag that defines the element. If attributes are set on that element in the HTML source code (i.e. not dynamically; not post-load), will those attributes be present on the element when its `connectedCallback` runs? The answer is, it depends! In Firefox, attributes in general *may not* be present *unless* they're listed in `observedAttributes`, in which case they seemingly *will always* be present.

```js
class E extends HTMLElement {
   constructor() {
      super();
   }
   
   static observedAttributes = [ "src" ];
   attributeChangedCallback(name, prior, after) {
   }
   
   #is_first_connection = true;
   connectedCallback() {
      if (!this.#is_first_connection)
         return;
      this.#is_first_connection = true;
      
      // If "src" is not in `observedAttributes` above, then this will 
      // basically always read as null, even if the attribute is present 
      // on the element in the page's HTML source code.
      let test = this.getAttribute("src");
   }
};
```

When an element is upgraded (per [the spec](https://html.spec.whatwg.org/multipage/custom-elements.html#upgrades)), the `attributeChangedCallback` will *always* run for each observed attribute, prior to `connectedCallback`. The algorithm explicitly requires that the browser attempt to queue `attributeChangedCallback` for *all* attributes, with the process of queueing `attributeChangedCallback` described as aborting early for non-bserved attributes. If Firefox skips non-observed attributes on the grounds that they'd end up being no-ops, then that may explain why only observed attributes are visible from within `connectedCallback` in that browser.

#### Child elements

Child elements are similarly messy. In general, [it's intentional](https://github.com/WICG/webcomponents/issues/551#issuecomment-241651544) that a custom element is connected before its child nodes are appended, with `MutationObserver` instances being the [intended](https://github.com/WICG/webcomponents/issues/551#issuecomment-241787068) solution for a custom element reacting to its child nodes. (This, despite the fact that there's no reliable way to know if an element has *finished* loading all of its content. The best we can do is use a `MutationObserver` to react to the appearance of a `nextSibling` on the element or any ancestor (or, if it's truly the last element in the document, `DOMContentLoaded`), and that breaks if any JavaScript mucks with the element tree during load. An event like `closeTagReached` has been [proposed](https://github.com/WICG/webcomponents/issues/551#issuecomment-241844398) but seems unpopular given the responses it got when brought up.)

#### Class-level [gs]etters

It's quite common to define getters and setters on a custom element class. Unfortunately, it's possible for JavaScript code to create a custom element instance, and then set properties on it *before* the element is actually upgraded (i.e. before the custom element constructor runs, and before the element is imbued with whatever [gs]etters are defined on the custom element class). If one of the properties being set is [meant to be] a class-level setter, then this can cause clients to inadvertently bypass the setter and create an expando property with the same name on the new custom element.

Put more simply, it's possible for this code to fail under certain circumstances:

```javascript
class Foo extends HTMLElement {
   constructor() {
      super();
      this.real_bar = 5;
   }
   
   set bar(v) { this.real_bar = v; }
};
customElements.define("foo-element", Foo);

(function() {
   let my_foo = /* some code which creates a foo-element */;
   
   my_foo.bar = 12345;
   if (my_foo.real_bar != 12345)
      throw new Error("wtf?");
})();
```

Known scenarios where this code may fail include:

* Cloning a `foo-element` node, or deep-cloning an ancestor thereof. The [algorithm for cloning a single node](https://dom.spec.whatwg.org/#clone-a-single-node) invokes the [element creation algorithm](https://dom.spec.whatwg.org/#concept-create-element) with inputs that cause it to upgrade any created custom elements asynchronously.

Known scenarios where this code should never fail include:

* Creating a `foo-element` node via `document.createElement`. That API [invokes](https://dom.spec.whatwg.org/#ref-for-concept-create-element%E2%91%A0) the element creation algorithm with inputs that should cause it to upgrade a created custom element synchronously.

* Creating a `foo-element` node by setting `someElement.innerHTML` or `someShadowRoot.innerHTML`. [Those APIs](https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#dom-shadowroot-innerhtml) run the [fragment parsing algorithm](https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#fragment-parsing-algorithm-steps). Since we're generally working in HTML rather than XML, that routes to the [HTML fragment parsing algorithm](https://html.spec.whatwg.org/multipage/parsing.html#html-fragment-parsing-algorithm), which spawns an HTML parser that's been configured for the special case of parsing "fragments" like those used for `innerHTML` setters. Within the general HTML parsing rules, the algorithm to [create an element for a \[parsed\] token](https://html.spec.whatwg.org/multipage/parsing.html#create-an-element-for-the-token) invokes the general element creation algorithm, and since we're in the fragment case, it does so with inputs that should cause that algorithm to upgrade a created custom element synchronously.

A common mistake is to have a custom element create its contents using an `HTMLTemplateElement` as an intermediary &mdash; setting the template element's `innerHTML` and then using `myTemplate.content.cloneNode(true)` to move the content into the custom element's shadow root. Doing this can cause any nested custom elements (within the HTML string) to be updated asynchronously, such that attempting to use their setters will instead shadow the setters with expandos. The solution is to set `myShadowRoot.innerHTML` instead.

That said, if you wish to make a custom element behave more sanely when created via `cloneNode`, you could try this, to retroactively apply any bypassed [gs]etters:

```javascript
class Foo extends HTMLElement {
   constructor() {
      super();
      this.real_bar = 5;
      
      for(let name of Object.getOwnPropertyNames(this)) {
         if (name[0] == '#')
            continue;
            
         // NOTE: If we subclassed another custom element, then we'd have to walk 
         // the prototype chain and deal with all base classes, too.
         let desc = Object.getOwnPropertyDescriptor(this.constructor.prototype, name);
         if (!desc) {
            continue; // not an override; ignore
         }
         if (!desc.get && !desc.set) {
            continue; // overridden property not a [gs]etter; ignore
         }
         let value = this[name];
         delete this[name]; // clear the override.
         if (desc.set) {
            this[name] = value; // re-invoke setter with the value that slipped past it
         }
      }
   }
   
   set bar(v) { this.real_bar = v; }
};
customElements.define("foo-element", Foo);
```

Alternatively, you could choose to detect and warn about this scenario:

```javascript
class Foo extends HTMLElement {
   constructor() {
      super();
      
      {
         let broken = [];
         for(let name of Object.getOwnPropertyNames(this)) {
            if (name[0] == '#')
               continue;
               
            // NOTE: If we subclassed another custom element, then we'd have to walk 
            // the prototype chain and deal with all base classes, too.
            let desc = Object.getOwnPropertyDescriptor(this.constructor.prototype, name);
            if (!desc) {
               continue; // not an override; ignore
            }
            if (!desc.get && !desc.set) {
               continue; // overridden property not a [gs]etter; ignore
            }
            broken.push(name);
         }
         if (broken.length) {
            console.groupCollapsed("warning: custom element created improperly");
            console.warn(`the following properties were set on a ${this.constructor.name} custom element before the element was upgraded:`);
            console.log(broken);
            console.log("broken element: ", this);
            console.info("tip: avoid creating custom elements with Element.cloneNode, as this can cause the elements to be upgraded asynchronously (the created element is a bare HTMLElement until the next spin of the event loop); document.createElement and the innerHTML setter are known to avoid this problem");
            console.groupEnd();
         }
      }
   }
};
customElements.define("foo-element", Foo);
```

WMPlayerElement and its sub-components don't take either approach.

### How this influenced the player design

#### Autoplay

We can't guarantee that the `autoplay` and `src` attributes will be ready from `connectedCallback`, nor that they'll be ready at the same time or in any particular order. For this reason, we react to autoplay asynchronously:

* Once `connectedCallback` fires for the first time, the player is eligible for autoplay for up to half a second.

* If the user interacts with any part of the player UI that directly influences the flow of playback, the player immediately becomes ineligible for autoplay. (So, the stop, previous, next, play, and pause buttons and the seek slider would disqualify autoplay, but not the volume slider or the shuffle and loop buttons.)

* The `attributeChangedCallback` handlers for the `autoplay` and `src` attributes, and the JavaScript setter for the `autoplay` property, both check if the player is eligible for autoplay and if autoplay is enabled. If so, we perform autoplay (i.e. start playing the current media) and then make the player ineligible for autoplay.

#### JS-only playlist definitions

I originally wanted the player to be able to contain media elements (e.g. `<video />`) which could themselves contain `<track />`, `<source />`, and similar elements, as a way of fully configuring a playlist. The goal was to subsume these into a "playlist" on load, and then retain the playlist in JavaScript only without reflecting between HTML and JS post-load. This is not wholly without precedent; plenty of HTML attributes on plenty of elements specify only default or initial values (e.g. `<video muted />`). I ended up abandoning this plan for two reasons:

* The fact that there's no (intentionally!) sane and reliable way to handle child elements at load time. Handling child elements in perpetuity (i.e. including dynamic additions, modifications, and removals) would be cumbersome.

* Defining the playlist content wholly in the HTML would only really be *necessary* to support user-agents with JavaScript disabled. In these cases, the playlist functionality would be unworkable (since there's no platform-native way to set up playlists), and preventing all but the first media element from loading and playing would similarly be unworkable (since `preload` doesn't default to `none` and without scripts, I can't force it to). Since the player can only function sanely with JavaScript, better to just make it and its functionality JS-only.

The current design allows the use of the `src` attribute for setting the player's initial video, but you can only manipulate the playlist through JavaScript.