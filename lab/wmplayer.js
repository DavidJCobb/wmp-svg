
class WMPlayerElement extends HTMLElement {
   
   //
   // Options:
   //
   
   #control_names_to_nodes;
   #controls_layout = (function() {
      let out = {
         tray_left:  [],
         tray_right: [],
      };
      let str = {};
      for(let key in out) {
         str[key] = null;
      }
      out.computed  = str;
      out.requested = Object.seal(Object.assign({}, str));
      Object.seal(str);
      Object.seal(out);
      return out;
   })();
   
   #playlist = new WMPlaylist();
   #autoplay = false;
   #loop     = false;
   #shuffle  = false;
   #speed    = 1; // playbackRate
   //
   #fast_forward_delay = 1; // hold Next down for this many seconds to start fast-forwarding
   #fast_forward_speed = 5; // same speed as WMP
   #fast_rewind_speed  = 5;
   
   // If the current time is past this number of seconds, then clicking "Previous" 
   // jumps to the start of the current media item, rather than to the previous 
   // media item in the playlist.
   #previous_button_time_threshold = 3;
   
   //
   // State:
   //
   
   #current_playlist_index         = 0;
   #current_playlist_index_started = false;
   #playlist_shuffle_indices       = [];
   
   #fast_playback_type    = 0; // -1 = rewind, 1 = fast-forward, 0 = neither
   #fast_playback_timeout = null;
   #fast_playback_paused  = false; // if we were paused when fast playback began
   
   #fast_rewind_interval  = 1; // number of real-time seconds between rewind steps
   #fast_rewind_timeout   = null;
   
   #bound_fast_playback_stop_on_release_handler;
   
   #is_stopped = true;
   
   //
   // DOM and similar:
   //
   
   #shadow;
   #internals;
   
   #media;
   
   #current_time_readout;
   #loop_button;
   #mute_button;
   #next_button;
   #play_pause_button;
   #prev_button;
   #seek_slider;
   #shuffle_button;
   #stop_button;
   #volume_slider;
   
   #setting_attribute = false;
   
   static #HTML = `
<link rel="stylesheet" href="wmplayer.button-styles.css" />
<link rel="stylesheet" href="wmplayer.css" />
<div class="main">
   <div class="content">
      <video></video>
   </div>
   <wm-slider class="seek" title="Seek" aria-label="Seek"></wm-slider>
   <div class="gutter-left">
      <time class="current-time" aria-label="Current time"></time>
   </div>
   <div class="controls">
      <div class="left">
         <input type="checkbox" aria-label="Shuffle" aria-role="switch" class="basic-button shuffle" />
         <input type="checkbox" aria-label="Loop" aria-role="switch" class="basic-button loop" />
         <hr />
         <button class="basic-button stop" disabled title="Stop">Stop</button>
         <button class="prev-rw" disabled title="Previous (press and hold to rewind)">Previous</button>
      </div>
      <button class="play-pause">Play</button>
      <div class="right">
         <button class="next-ff" disabled title="Next (press and hold to fast-forward)">Next</button>
         <input type="checkbox" aria-label="Mute" aria-role="switch" class="basic-button mute" />
         <wm-slider aria-label="Volume" class="volume constant-thumb circular-thumb" min="0" max="100" value="100" step="1" title="Volume"></wm-slider>
      </div>
   </div>
</div>
   `.trim();
   
   // ------------------------------------------------------------------------
   
   // Expose properties and methods of the wrapped media element.
   static {
      for(const name of [
         // HTMLMediaElement:
         "buffered",
         "currentSrc",
         "duration",
         "ended",
         "error",
         "mediaKeys",
         "networkState",
         "paused",
         "played",
         "readyState",
         "remote",
         "seekable",
         "seeking",
         "sinkId",
         "textTracks",
         "videoTracks",
         // HTMLVideoElement:
         "videoHeight",
         "videoWidth",
      ]) {
         Object.defineProperty(this, name, {
            get: function() { return this.#media[name]; }
         });
      }
      
      //
      // We handle `muted` ourselves, since there's no event that gets 
      // triggered when a media element is programmatically muted. We 
      // have to intercept that in order to update our UI.
      //
      // We handle `playbackRate` ourselves, so that we can let clients 
      // set the base playback rate independently of fast-forwarding. 
      // We need to shim the setter so that when fast-forwarding stops, 
      // we know what rate to return the video to.
      //
      for(const name of [
         // HTMLMediaElement:
         "audioTracks",
         "crossOrigin",
         "currentTime",
         //"defaultPlaybackRate",
         "disableRemotePlayback",
         //"muted",
         //"playbackRate",
         "preservesPitch",
         "srcObject",
         "volume",
         // HTMLVideoElement:
         "disablePictureInPicture",
      ]) {
         Object.defineProperty(this, name, {
            get: function() { return this.#media[name]; },
            set: function(v) { this.#media[name] = v; }
         });
      }
      
      //
      // Attributes below.
      //
      
      // Start by listing those attributes that we want to handle 
      // entirely by ourselves. After this, we'll register the 
      // attributes we want to automatically mirror to the wrapped 
      // media element.
      this.observedAttributes = [
         "autoplay",
         "src",
         "data-controls-in-tray-left",
         "data-controls-in-tray-right",
      ];
      
      //
      // We handle `autoplay` ourselves.
      //
      // We handle `src` ourselves, since we need somewhat different 
      // logic (owing to us having built-in playlist functionality).
      //
      // We don't forward `controls` or `controlslist` because we're 
      // supplying our own UI; we explicitly want the wrapped media 
      // element to use its default of having no controls.
      //
      // We don't forward `width` or `height` since they're not fully 
      // meaningful in this case. Our player may show its UI outside 
      // the bounds of the video, consuming additional size; in that 
      // case, one would expect `width` and `height` to refer to the 
      // total size of the player, and not just the video dimensions.
      //
      for(const name of [
         // HTMLMediaElement:
         //"autoplay",
         //"controls",
         //"controlslist",
         //"src",
         // HTMLVideoElement:
         //"height",
         "poster",
         //"width",
      ]) {
         this.observedAttributes.push(name);
         Object.defineProperty(this, name, {
            get: function() { return this.#media[name]; },
            set: function(v) {
               this.#setting_attribute = true;
               this.setAttribute(name);
               this.#media[name] = v;
               this.#setting_attribute = false;
            }
         });
      }
      
      // There are some cases where an HTML attribute is reflected by 
      // a JavaScript property with a different name. Handle them here.
      for(const [name, attr] of [
         // HTMLMediaElement:
         ["defaultMuted", "muted"],
      ]) {
         this.observedAttributes.push(attr);
         Object.defineProperty(this, name, {
            get: function() { return this.#media[name]; },
            set: function(v) {
               this.#setting_attribute = true;
               this.setAttribute(attr);
               this.#media[name] = v;
               this.#setting_attribute = false;
            }
         });
      }
      
      for(const name of [
         // HTMLMediaElement:
         "addTextTrack",
         "captureStream",
         "canPlayType",
         "fastSeek",
         "load",
         "pause",
         "play",
         "setMediaKeys",
         "setSinkId",
         // HTMLVideoElement:
         "cancelVideoFrameCallback",
         "getVideoPlaybackQuality",
         "requestPictureInPicture",
         "requestVideoFrameCallback",
      ]) {
         this[name] = function(...args) {
            this.#media[name](...args);
         };
      }
   };
   
   // ------------------------------------------------------------------------
   
   constructor() {
      super();
      this.#internals = this.attachInternals();
      this.#shadow    = this.attachShadow({ mode: "open" });
      
      this.#shadow.innerHTML = WMPlayerElement.#HTML;
      
      this.#playlist.addEventListener("cleared", this.#on_playlist_cleared.bind(this));
      this.#playlist.addEventListener("replaced", this.#on_playlist_replaced.bind(this));
      this.#playlist.addEventListener("modified", this.#on_playlist_modified.bind(this));
      this.#playlist.addEventListener("current-item-changed", this.#on_playlist_current_item_changed.bind(this));
      
      this.#media = this.#shadow.querySelector("video");
      this.#media.addEventListener("loadedmetadata", this.#on_loaded_metadata.bind(this));
      this.#media.addEventListener("timeupdate", this.#on_current_time_change.bind(this));
      this.#media.addEventListener("durationchange", this.#on_duration_change.bind(this));
      this.#media.addEventListener("volumechange", this.#on_volume_change.bind(this));
      this.#media.addEventListener("play", this.#on_media_play.bind(this));
      this.#media.addEventListener("pause", this.#update_play_state.bind(this));
      this.#media.addEventListener("ended", this.#on_media_ended.bind(this));
      {
         let bound = this.#update_buffering_state.bind(this);
         this.#media.addEventListener("buffering", bound);
         this.#media.addEventListener("stalled", bound);
         this.#media.addEventListener("canplay", bound);
         this.#media.addEventListener("canplaythrough", bound);
      }
      
      this.#current_time_readout = this.#shadow.querySelector("time");
      
      this.#seek_slider = this.#shadow.querySelector(".seek");
      this.#seek_slider.keyStepShift = 1;
      this.#seek_slider.keyStep      = 10;
      this.#seek_slider.keyStepCtrl  = 10;
      this.#seek_slider.addEventListener("change", this.#on_seek_slider_change.bind(this));
      
      this.#shuffle_button = this.#shadow.querySelector(".shuffle");
      this.#shuffle_button.addEventListener("change", this.#on_shuffle_ui_toggled.bind(this));
      
      this.#loop_button = this.#shadow.querySelector(".loop");
      this.#loop_button.addEventListener("change", this.#on_loop_ui_toggled.bind(this));
      
      this.#play_pause_button = this.#shadow.querySelector("button.play-pause");
      this.#play_pause_button.addEventListener("click", this.#on_play_pause_click.bind(this));
      
      this.#stop_button = this.#shadow.querySelector("button.stop");
      this.#stop_button.addEventListener("click", this.#on_stop_click.bind(this));
      
      this.#mute_button = this.#shadow.querySelector(".mute");
      this.#mute_button.addEventListener("click", this.#on_mute_ui_toggled.bind(this));
      
      this.#volume_slider = this.#shadow.querySelector(".volume");
      this.#volume_slider.keyStep      = 5;
      this.#volume_slider.keyStepShift = 1;
      this.#volume_slider.keyStepCtrl  = 20; // 1/5 the slider length
      this.#volume_slider.addEventListener("change", this.#on_volume_slider_change.bind(this));
      
      this.#next_button = this.#shadow.querySelector(".next-ff");
      this.#next_button.addEventListener("mousedown", this.#on_next_mousedown.bind(this));
      this.#next_button.addEventListener("mouseup", this.#on_next_mouseup.bind(this));
      this.#next_button.addEventListener("keypress", this.#on_next_keypress.bind(this));
      
      this.#prev_button = this.#shadow.querySelector(".prev-rw");
      this.#prev_button.addEventListener("mousedown", this.#on_prev_mousedown.bind(this));
      this.#prev_button.addEventListener("mouseup", this.#on_prev_mouseup.bind(this));
      this.#prev_button.addEventListener("keypress", this.#on_prev_keypress.bind(this));
      
      // If we only listen for `mouseup` on the Previous and Next buttons, then in the 
      // case where the user presses and holds the mouse on the buttons, but then moves 
      // the cursor off the buttons before releasing it, we'll get stuck fast-forwarding 
      // or rewinding. We work around this by registering and unregistering a handler on 
      // the window.
      this.#bound_fast_playback_stop_on_release_handler = this.#fast_playback_stop_on_release_handler.bind(this);
      
      {
         let bound = this.#disqualify_autoplay_on_playback_control_by_user.bind(this);
         for(let node of [
            this.#next_button,
            this.#play_pause_button,
            this.#prev_button,
            this.#stop_button,
         ]) {
            //
            // If these buttons are activated, then disqualify any autoplay that may be 
            // about to occur.
            //
            // For mouse activations, we have to register for `mousedown` to account for 
            // the user fast-forwarding or rewinding via the alternate functions of the 
            // Next and Previous buttons.
            //
            node.addEventListener("mousedown", bound);
            node.addEventListener("keypress", bound);
         }
         this.#seek_slider.addEventListener("change", bound);
      }
      
      this.#control_names_to_nodes = {
         loop:    this.#loop_button,
         mute:    this.#mute_button,
         next:    this.#next_button,
         prev:    this.#prev_button,
         seek:    this.#seek_slider,
         shuffle: this.#shuffle_button,
         stop:    this.#stop_button,
         volume:  this.#volume_slider,
      };
   }
   
   //
   // State
   //
   
   #can_rewind() {
      if (!this.#has_current_playlist_item())
         return false;
      let item = this.#playlist.currentItem;
      if (item.audio_only)
         return false;
      return true;
   }
   #has_current_playlist_item() {
      if (this.#is_stopped)
         return false;
      if (this.#playlist.length == 0)
         return false;
      return true;
   }
   
   //
   // Accessors
   //
   
   get autoplay() { return this.#autoplay; }
   set autoplay(v) {
      v = !!v;
      if (v == this.#autoplay)
         return;
      this.#autoplay = v;
      if (this.#has_ever_been_connected) {
         this.#setting_attribute = true;
         this[v ? "setAttribute" : "removeAttribute"]("autoplay", "autoplay");
         this.#setting_attribute = false;
      }
      if (this.isConnected) {
         this.#try_autoplay();
      }
   }
   #try_autoplay() {
      if (!this.#ready_to_autoplay)
         return;
      if (!this.#autoplay)
         return;
      if (!this.#playlist.size)
         return;
      if (this.#playlist.index != 0)
         return;
      if (!this.#media.paused)
         return;
      if (this.#media.currentTime != 0)
         return;
      this.#ready_to_autoplay = false;
      this.#media.play();
      this.#set_is_stopped(false);
   }
   
   // Get the current playback rate, accounting for both the desired 
   // base rate (`playbackRate`) and for whether we're fast-forwarding.
   get currentPlaybackRate() { return this.#media.playbackRate; }
   
   get currentPlaylistIndex() { return this.#playlist.index; }
   set currentPlaylistIndex(v) { this.#playlist.index = v; }
   
   get fastForwardDelay() { return this.#fast_forward_delay; }
   set fastForwardDelay(v) {
      v = +v;
      if (v <= 0)
         throw new Error("invalid duration");
      this.#fast_forward_delay = v;
   }
   
   get fastForwardSpeed() { return this.#fast_forward_speed; }
   set fastForwardSpeed(v) {
      v = +v;
      if (v <= 1)
         throw new Error("fast-forward speed multiplier must be greater than 1");
      this.#fast_forward_speed = v;
      if (this.isFastForwarding) {
         this.#media.playbackRate = v;
      }
   }
   
   get isFastForwarding() { return this.#fast_playback_type > 0; }
   set isFastForwarding(v) {
      v = !!v;
      if (v) {
         this.#set_is_fast_playback(1);
      } else if (this.#fast_playback_type > 0) {
         this.#set_is_fast_playback(0);
      }
   }
   
   get loop() { return this.#loop; }
   set loop(v) {
      v = !!v;
      this.#loop = v;
      this.#playlist.loop = v;
      this.#loop_button.checked = v;
      if (this.#playlist.size == 1) {
         this.#media[v ? "setAttribute" : "removeAttribute"]("loop", "loop");
      }
      this.#update_loop_tooltip();
      this.#update_prev_next_state(this.#media.currentTime);
   }
   
   get muted() { return this.#media.muted; }
   set muted(v) {
      v = !!v;
      this.#media.muted = v;
      this.#mute_button.checked = v;
      this.#update_mute_tooltip(v);
      this.#update_mute_glyph(this.#volume_slider.value);
   }
   
   get playbackRate() { return this.#speed; }
   set playbackRate(raw) {
      let v = +raw;
      if (isNaN(v) || v <= 0)
         throw new Error(`playback rate must be a number greater than zero (seen: ${raw})`);
      this.#speed = v;
      if (!this.#fast_playback_type)
         this.#media.playbackRate = v;
      
      // Consistency with WMP internals: halt fast-forwarding if the playback 
      // rate is adjusted during fast-forwarding or fast-rewinding.
      //
      // Ref: https://learn.microsoft.com/en-us/previous-versions/windows/desktop/wmp/controls-fastreverse
      this.#cancel_queued_fast_playback();
      this.#set_is_fast_playback(0);
   }
   
   get shuffle() { return this.#shuffle; }
   set shuffle(v) {
      v = !!v;
      if (v == this.#shuffle)
         return;
      this.#shuffle = v;
      this.#playlist.shuffle = v;
      this.#shuffle_button.checked = v;
      this.#update_shuffle_tooltip();
      this.#update_next_state();
   }
   
   #controls_layout_setter(name, attr, v) {
      if (Array.isArray(v)) {
         v = v.join(" ");
      } else if (v !== null) {
         let u = v + "";
         if (v == u)
            v = v.trim();
         else
            v = u;
      }
      let prior = this.#controls_layout.requested[name];
      this.#controls_layout.requested[name] = v;
      this.#setting_attribute = true;
      this[v !== null ? "setAttribute" : "removeAttribute"](attr, v);
      this.#setting_attribute = false;
      if (prior !== v) {
         this.#update_controls_layout();
      }
   }
   
   get controlsInTrayLeft() { return this.#controls_layout.computed.tray_left; }
   set controlsInTrayLeft(v) {
      this.#controls_layout_setter("tray_left", "data-controls-in-tray-left", v);
   }
   
   get controlsInTrayRight() { return this.#controls_layout.computed.tray_right; }
   set controlsInTrayRight(v) {
      this.#controls_layout_setter("tray_right", "data-controls-in-tray-right", v);
   }
   
   //
   // Public methods (not related to any specific feature)
   //
   
   play() {
      if (this.#playlist.size == 0)
         return;
      this.#media.play();
   }
   pause() { this.#media.pause(); }
   stop() { this.#set_is_stopped(true); }
   
   //
   // Custom element lifecycle
   //
   
   #has_ever_been_connected = false;
   #ready_to_autoplay       = true;
   
   #disqualify_autoplay_on_playback_control_by_user(e) {
      //
      // If the user interacts with any part of the player that actually influences 
      // playback, e.g. the seek slider or play/pause button, then disqualify any 
      // pending autoplay. (We don't care about interactions with widgets that don't 
      // alter the flow of playback, e.g. the Shuffle button or the Volume slider.)
      //
      if (e) {
         if (e instanceof KeyboardEvent) {
            if (e.code != "Enter" && e.code != "Space")
               return;
         } else if (e instanceof MouseEvent) {
            if (e.button != 0)
               return;
         }
      }
      this.#ready_to_autoplay = false;
   }
   
   attributeChangedCallback(name, prior, after) {
      if (this.#setting_attribute)
         return;
      this.#media.setAttribute(name, after);
      
      if (name == "loop") {
         let state = after !== null;
         this.#loop = state;
         this.#loop_button.checked = state;
         this.#update_loop_tooltip(state);
         this.#update_prev_next_state(this.#media.currentTime);
         return;
      }
      if (name == "src") {
         //
         // We want to react to an initially present `src` attribute only (compare to 
         // the `value` attribute indicating defaults on a form element). However, the 
         // ordering of callbacks is not defined. In Firefox, if I observe the `src` 
         // attribute for this callback, then the `src` attribute will be available by 
         // the time our connectedCallback runs; however, if I don't observe the `src` 
         // attribute, then connectedCallback runs before Firefox has parsed, loaded, 
         // and applied the `src` attribute specified in the HTML file. I assume that 
         // other browsers are similarly messy; in general, the custom elements spec 
         // doesn't do a good job of clearly defining the ordering of lifecycle events.
         //
         if (after !== null && after) {
            let item = new WMPlaylistItem({ src: after });
            this.#playlist.replace([ item ]);
            this.#try_autoplay();
         }
         return;
      }
      
      if (name == "data-controls-in-tray-left") {
         if (after)
            after = after.trim();
         this.#controls_layout.requested.tray_left = after;
         this.#update_controls_layout();
         return;
      }
      if (name == "data-controls-in-tray-right") {
         if (after)
            after = after.trim();
         this.#controls_layout.requested.tray_right = after;
         this.#update_controls_layout();
         return;
      }
   }
   
   connectedCallback() {
      if (this.#has_ever_been_connected)
         return;
      this.#has_ever_been_connected = true;
      
      //
      // Copy all observed attributes from ourselves to the wrapped <media/> element.
      //
      for(let name of this.constructor.observedAttributes) {
         if (name == "autoplay" || name == "loop" || name == "src")
            continue;
         let attr = this.getAttribute(name);
         if (attr === null)
            continue;
         this.#media.setAttribute(name, attr);
      }
      
      this.#update_play_state();
      this.#update_shuffle_tooltip();
      
      this.loop = this.hasAttribute("loop");
      
      this.#mute_button.checked = this.#media.muted; // account for `defaultMuted`
      this.#update_mute_tooltip();
      
      window.setTimeout((function() {
         this.#ready_to_autoplay = false;
      }).bind(this), 500);
   }
   
   //
   // Fast playback (i.e. fast-rewind or fast-forward)
   //
   
   #queue_fast_playback(direction, delay) {
      if (this.#fast_playback_timeout !== null) {
         window.clearTimeout(this.#fast_playback_timeout);
      }
      this.#fast_playback_timeout = setTimeout(
         this.#set_is_fast_playback.bind(this, direction),
         delay * 1000
      );
   }
   #cancel_queued_fast_playback() {
      if (this.#fast_playback_timeout !== null) {
         clearTimeout(this.#fast_playback_timeout);
         this.#fast_playback_timeout = null;
      }
   }
   #set_is_fast_playback(direction) {
      if (direction == 0) {
         let changing = this.#fast_playback_type != 0;
         if (this.#fast_rewind_timeout) {
            clearTimeout(this.#fast_rewind_timeout);
            this.#fast_rewind_timeout = null;
         }
         this.#media.playbackRate = this.#speed;
         this.#fast_playback_type = 0;
         this.#prev_button.classList.remove("rewind");
         this.#next_button.classList.remove("fast-forward");
         if (changing) {
            if (this.#fast_playback_paused) {
               //
               // NOTE: We diverge from Windows Media Player's behavior here: we restore 
               // the playback state that the player was in before rewinding or fast-
               // forwarding, i.e. if you fast-forward while paused, you'll be paused 
               // when you stop fast-forwarding. Windows Media Player's behaviors are as 
               // follows:
               //
               //  - After rewinding, always resume playback.
               //
               //  - After fast-forwarding while paused, wait three seconds (identified by 
               //    Microsoft-employed behavioral scientists as the exact length of time 
               //    it takes for a user to assume the player will stay paused); then,
               //    resume playback.
               //
               this.#media.pause();
            } else {
               this.#media.play();
            }
         }
         this.#fast_playback_paused = false;
         return;
      }
      if (this.#fast_playback_type == 0) {
         this.#fast_playback_paused = this.#media.paused;
      }
      if (direction > 0) {
         this.#fast_playback_type = 1; // fast-forwarding
         //
         // Play the media at a fast speed. Simple enough.
         //
         this.#next_button.classList.add("fast-forward");
         this.#media.playbackRate = this.#fast_forward_speed;
         if (this.#media.paused) {
            this.#media.play();
         }
      } else {
         this.#fast_playback_type = -1; // rewinding
         //
         // As of this writing, most browsers don't support negative playback rates 
         // for backwards playback. Fortunately, we can design an alternate behavior 
         // for parity with Windows Media Player: pause the media, and then skip 
         // backwards through it at 500% speed (e.g. every second, jump the current 
         // time back by five seconds). WMP skips backwards through keyframes, but I 
         // don't know that we can do the same. We'll use a fixed timestep.
         //
         this.#prev_button.classList.add("rewind");
         {
            let duration = this.#media.duration;
            let interval = 0.5;
            if (duration) {
               interval = Math.min(0.5, duration / 10);
            }
            this.#fast_rewind_interval = interval;
         }
         this.#media.pause();
         this.#fast_rewind_handler();
      }
   }
   #fast_rewind_handler() {
      this.#fast_rewind_timeout = null;
      if (this.#fast_playback_type >= 0)
         return;
      
      let time = this.#media.currentTime;
      let skip = this.#fast_rewind_interval * 5;
      if (time > skip) {
         time -= skip;
      } else {
         time = 0;
      }
      this.#media.currentTime = time;
      if (time > 0) {
         this.#fast_rewind_timeout = setTimeout(this.#fast_rewind_handler.bind(this), this.#fast_rewind_interval * 1000);
      }
   }
   
   //
   // Playlist
   //
   
   #on_playlist_current_item_changed(e) {
      let index = e.detail.index;
      let item  = e.detail.item;
      
      this.#media.pause();
      item.populateMediaElement(this.#media);
      this.#update_current_time_readout(0);
      this.#update_prev_next_state(0);
      if (index > 0) {
         this.#set_is_stopped(false);
      }
   }
   #on_playlist_cleared() {
      this.#media.pause();
      this.#media.src = "";
      this.#set_is_stopped(true);
   }
   #on_playlist_replaced() {
      this.#media.pause();
   }
   
   #on_playlist_modified() {
      let no_media = this.#playlist.empty();
      
      this.#play_pause_button.disabled = no_media;
      if (no_media) {
         this.#stop_button.disabled = true;
         this.#hide_current_time_readout();
      }
      
      this.#update_prev_next_state(no_media ? 0 : this.#media.currentTime);
      
      if (this.#loop && this.#playlist.size == 1) {
         this.#media.setAttribute("loop", "loop");
      } else {
         this.#media.removeAttribute("loop");
      }
   }
   
   addToPlaylist(item) { this.#playlist.add(item); }
   clearPlaylist() { this.#playlist.clear(); }
   
   toPrevMedia() {
      let playing = !this.#media.paused;
      if (!this.#playlist.toPrev())
         return;
      this.#set_is_stopped(false);
      if (playing)
         this.#media.play();
   }
   toNextMedia(ignore_shuffle) {
      let playing = !this.#media.paused;
      if (!this.#playlist.toNext(ignore_shuffle))
         return;
      this.#set_is_stopped(false);
      if (playing)
         this.#media.play();
   }
   
   //
   // Media events
   //
   
   #_last_prev_enable_state_check = 0;
   
   #on_loaded_metadata(e) {
      this.#media.width  = this.#media.videoWidth  || 0;
      this.#media.height = this.#media.videoHeight || 0;
   }
   #on_duration_change(e) {
      let duration = this.#media.duration;
      this.#seek_slider.maximum = duration;
      this.#seek_slider.keyStep = duration / 5;
   }
   #on_current_time_change(e) {
      if (this.#seek_slider.is_being_edited())
         return;
      let time = this.#media.currentTime;
      this.#seek_slider.value = time;
      this.#update_current_time_readout(time);
      {  // Update the state of the "Previous" button (with debouncing)
         let now = Date.now();
         if (now - this.#_last_prev_enable_state_check > 100) {
            this.#_last_prev_enable_state_check = now;
            this.#update_prev_next_state(time);
         }
      }
   }
   #on_volume_change(e) {
      if (this.#volume_slider.is_being_edited())
         return;
      let value = Math.floor(this.#media.volume * 100);
      this.#volume_slider.value = value;
      this.#update_mute_glyph(value);
   }
   
   #on_media_play(e) {
      this.#playlist.markAsPlayed();
      this.#set_is_stopped(false);
      this.#update_play_state();
   }
   #on_media_ended(e) {
      //
      // WARNING: The `ended` event doesn't fire if a video has the HTML `loop` attribute, 
      // reaches its end, and loops. It only fires if the video isn't looping.
      //
      if (this.#playlist.toNext()) {
         this.#media.play();
         //
         // If you fast-forward past the end of a media item, you should still be fast-
         // forwarding when the next media item starts, for consistency with WMP.
         //
         // Changing the currently playing media can apparently reset `playbackRate`, but 
         // I don't see this documented anywhere, so I have to code defensively. *sigh*
         //
         // NOTE: This behavior will be inconvenient to test on Firefox thanks to a bug: 
         // https://bugzilla.mozilla.org/show_bug.cgi?id=1807968
         //
         if (this.#fast_playback_type > 0) {
            this.#media.playbackRate = this.#fast_forward_speed;
         } else {
            this.#media.playbackRate = this.#speed;
         }
      } else {
         this.#media.poster = ""; // clear any leftover poster from the last playlist item
      }
      this.#update_play_state();
   }
   
   //
   // Loop
   //
   
   #on_loop_ui_toggled() {
      this.loop = !this.#loop;
   }
   #update_loop_tooltip(state) {
      let node = this.#loop_button;
      if (state) {
         node.title = "Turn repeat off";
      } else {
         node.title = "Turn repeat on";
      }
   }
   
   //
   // Shuffle
   //
   
   #on_shuffle_ui_toggled() {
      this.shuffle = this.#shuffle_button.checked;
   }
   #update_shuffle_tooltip() {
      let node = this.#shuffle_button;
      if (this.#shuffle) {
         node.title = "Turn shuffle off";
      } else {
         node.title = "Turn shuffle on";
      }
   }
   
   //
   // Stop
   //
   
   #set_is_stopped(v) {
      this.#is_stopped = v;
      if (v) {
         this.#playlist.index = 0;
         this.#media.pause();
         this.#update_play_state();
         this.#stop_button.disabled = true;
         
         this.#cancel_queued_fast_playback();
         this.#set_is_fast_playback(0);
         
         // NOTE: If we're not already on the zeroth playlist item when we 
         // click "Stop," then switching to that playlist item may trigger 
         // a `durationchange` event and updating of the current timestamp. 
         // This is why we set `#is_stopped` before we change the playlist 
         // index.
         //
         // If we *are* on the zeroth playlist item, then we shouldn't get 
         // any playlist item change or `durationchange` event, so we need 
         // to hide the current time here as well.
         this.#hide_current_time_readout();
      } else {
         this.#stop_button.disabled = false;
      }
   }
   
   #on_stop_click(e) {
      this.#set_is_stopped(true);
   }
   
   //
   // Mute/Volume button
   //
   
   #on_mute_ui_toggled() {
      this.muted = this.#mute_button.checked;
   }
   #update_mute_tooltip(state) {
      let node = this.#mute_button;
      if (state === void 0)
         state = this.#media.muted;
      if (state) {
         node.title = "Sound";
      } else {
         node.title = "Mute";
      }
   }
   
   //
   // Play/Pause button
   //
   
   #on_play_pause_click(e) {
      if (this.#media.paused) {
         this.#media.play();
      } else {
         this.#media.pause();
      }
      this.#set_is_stopped(false);
   }
   #update_play_state() {
      if (this.#media.paused) {
         this.#internals.states.add("paused");
         this.#internals.states.delete("playing");
         this.#play_pause_button.title = "Play";
      } else {
         this.#internals.states.add("playing");
         this.#internals.states.delete("paused");
         this.#play_pause_button.title = "Pause";
      }
   }
   
   //
   // Helpers for Previous/Rewind and Next/Fast Foward buttons
   //
   
   #fast_playback_press_handler() {
      let handler = this.#bound_fast_playback_stop_on_release_handler;
      window.addEventListener("blur",    handler);
      window.addEventListener("mouseup", handler);
   }
   #fast_playback_stop_on_release_handler() {
      this.#set_is_fast_playback(0);
      let handler = this.#bound_fast_playback_stop_on_release_handler;
      window.removeEventListener("blur",    handler);
      window.removeEventListener("mouseup", handler);
   }
   
   //
   // Previous button
   //
   
   #on_prev_click() {
      if (this.#media.currentTime >= this.#previous_button_time_threshold) {
         this.#media.currentTime = 0;
         return;
      }
      this.toPrevMedia();
   }
   
   #on_prev_mousedown(e) {
      if (e.button != 0)
         return;
      if (this.#can_rewind()) {
         this.#queue_fast_playback(-1, this.#fast_forward_delay);
         this.#fast_playback_press_handler();
      }
   }
   #on_prev_mouseup(e) {
      if (e.button != 0)
         return;
      this.#cancel_queued_fast_playback();
      if (this.#fast_playback_type) {
         this.#set_is_fast_playback(0);
      } else {
         this.#on_prev_click();
      }
   }
   #on_prev_keypress(e) {
      if (e.altKey)
         return;
      if (e.code != "Enter" && e.code != "Space")
         return;
      e.preventDefault();
      this.#on_prev_click();
   }
   
   //
   // Next/Fast Forward button
   //
   
   #on_next_mousedown(e) {
      if (e.button != 0)
         return;
      this.#queue_fast_playback(1, this.#fast_forward_delay);
      this.#fast_playback_press_handler();
   }
   #on_next_mouseup(e) {
      if (e.button != 0)
         return;
      this.#cancel_queued_fast_playback();
      if (this.#fast_playback_type) {
         this.#set_is_fast_playback(0);
      } else {
         this.toNextMedia();
      }
   }
   #on_next_keypress(e) {
      if (e.altKey)
         return;
      if (e.code != "Enter" && e.code != "Space")
         return;
      //
      // NOTE: Windows Media Player exposes fast-forwarding via the keyboard 
      // shortcut Ctrl + Shift + F, not via keyboard interactions with the 
      // button itself. This differs from the mouse interactions.
      //
      e.preventDefault();
      this.toNextMedia();
   }
   
   //
   // Simple UI interactions
   //
   
   #on_seek_slider_change(e) {
      let time = this.#seek_slider.value;
      this.#media.currentTime = time;
      this.#update_current_time_readout(time);
      this.#update_prev_state(time);
      this.#set_is_stopped(false);
   }
   #on_volume_slider_change(e) {
      let value = this.#volume_slider.value;
      this.#media.volume = value / 100;
      this.#update_mute_glyph(value);
   }
   
   //
   // UI updates
   //
   
   #update_buffering_state(e) {
      if (e.name == "buffering") {
         this.#internals.states.add("buffering");
         this.#internals.states.delete("stalled");
      } else if (e.name == "stalled") {
         this.#internals.states.add("stalled");
         this.#internals.states.delete("buffering");
      } else {
         this.#internals.states.delete("stalled");
         this.#internals.states.delete("buffering");
      }
   }
   
   #hide_current_time_readout() {
      this.#current_time_readout.textContent = "";
      this.#current_time_readout.removeAttribute("datetime");
   }
   #update_current_time_readout(time) {
      if (this.#is_stopped) {
         this.#hide_current_time_readout();
         return;
      }
      time = +time || 0;
      let show_hours = (time >= 3600 || this.#media.duration >= 3600);
      let h     = 0;
      let m     = Math.floor((time % 3600) / 60);
      let s_sub = time % 60;
      let s     = Math.floor(s_sub);
      let text = (m+"").padStart(2, '0') + ':' + (s+"").padStart(2, '0');
      if (show_hours) {
         h = Math.floor(time / 3600);
         text = (h+"").padStart(2, '0') + ':' + text;
      }
      this.#current_time_readout.textContent = text;
      this.#current_time_readout.setAttribute("datetime", `P${h}H${m}M${s_sub}S`);
   }
   
   #update_mute_glyph(volume) {
      let node  = this.#mute_button;
      let glyph = "high";
      if (this.#media.muted) {
         glyph = "muted";
      } else {
         if (!volume) {
            glyph = "empty";
         } else if (volume < 33) {
            glyph = "low";
         } else if (volume < 66) {
            glyph = "medium";
         } else {
            glyph = "high";
         }
      }
      node.setAttribute("data-glyph", glyph);
   }
   
   #update_prev_state(current_time) {
      const TEXT_FOR_PREVIOUS_ONLY = "Previous";
      const TEXT_FOR_REWIND_ONLY   = "Press and hold to rewind";
      const TEXT_FOR_ALL_BEHAVIORS = "Previous (press and hold to rewind)";
      
      let node = this.#prev_button;
      if ((this.#is_stopped && this.#playlist.index == 0) || this.#playlist.size == 0) {
         //
         // Nothing playing.
         //
         node.classList.remove("can-only-rewind");
         node.disabled = true;
         node.title    = TEXT_FOR_ALL_BEHAVIORS;
         return;
      }
      let can_rewind = this.#can_rewind();
      if (current_time < this.#previous_button_time_threshold) {
         //
         // Too early in the media for the "pressing 'Previous' jumps to the 
         // start of the media" case. If we were in that case, we could skip 
         // all of these extra checks.
         //
         if (!this.#loop && this.#playlist.index == 0) {
            //
            // Can't go back.
            //
            if (can_rewind) {
               node.classList.add("can-only-rewind");
               node.disabled = false;
               node.title    = TEXT_FOR_REWIND_ONLY;
            } else {
               node.classList.remove("can-only-rewind");
               node.disabled = true;
               node.title    = TEXT_FOR_ALL_BEHAVIORS;
            }
            return;
         }
      }
      node.disabled = false;
      node.classList.remove("can-only-rewind");
      if (can_rewind) {
         node.title = TEXT_FOR_ALL_BEHAVIORS;
      } else {
         node.title = TEXT_FOR_PREVIOUS_ONLY;
      }
   }
   #update_next_state() {
      const TEXT_FOR_FAST_FWD_ONLY = "Press and hold to fast-forward";
      const TEXT_FOR_ALL_BEHAVIORS = "Next (press and hold to fast-forward)";
      
      let node = this.#next_button;
      if (this.#playlist.size == 0) {
         node.classList.remove("can-only-fast-forward");
         node.disabled = true;
         node.title    = TEXT_FOR_ALL_BEHAVIORS;
         return;
      }
      //
      // It's always possible to fast-forward, so the button will always be enabled 
      // if we have any media in our playlist. The only real question is whether we 
      // can move to the next media item (i.e. whether there is one).
      //
      node.disabled = false;
      if (this.#playlist.hasNextItem()) {
         node.classList.remove("can-only-fast-forward");
         node.title = TEXT_FOR_ALL_BEHAVIORS;
      } else {
         node.classList.add("can-only-fast-forward");
         node.title = TEXT_FOR_FAST_FWD_ONLY;
      }
   }
   #update_prev_next_state(current_time) {
      this.#update_prev_state(current_time);
      this.#update_next_state();
   }
   
   //
   // Controls layout
   //
   
   #update_controls_layout() {
      let layout    = this.#controls_layout;
      let requested = this.#controls_layout.requested;
      let computed  = this.#controls_layout.computed;
      let empty     = true;
      let used      = {};
      for(let key in this.#control_names_to_nodes) {
         used[key] = false;
      }
      {
         let handle_member = (function(name) {
            computed[name] = null;
            layout[name]   = [];
            
            let list = requested[name];
            if (!list) {
               if (list !== null)
                  empty = false;
               return;
            }
            list = list.split(" ");
            
            let first = true;
            for(let item of list) {
               let node;
               if (item == "separator") {
                  node = document.createElement("hr");
               } else {
                  node = this.#control_names_to_nodes[item];
                  if (!node || used[item]) {
                     continue;
                  }
                  used[item] = true;
               }
               
               empty = false;
               layout[name].push(node);
               if (first) {
                  computed[name] = item;
                  first = false;
               } else {
                  computed[name] += ' ' + item;
               }
            }
         }).bind(this);
         handle_member("tray_left");
         handle_member("tray_right");
      }
      if (empty) {
         layout.tray_left = [
            this.#shuffle_button,
            this.#loop_button,
            document.createElement("hr"),
            this.#stop_button,
            this.#prev_button
         ];
         layout.tray_right = [
            this.#next_button,
            this.#mute_button,
            this.#volume_slider
         ];
      }
      
      function apply_member(name, container) {
         let frag = new DocumentFragment();
         for(let node of layout[name]) {
            frag.append(node);
         }
         container.replaceChildren(frag);
      }
      if (!used.seek) {
         this.#shadow.querySelector(".content").after(this.#seek_slider);
      }
      apply_member("tray_left",  this.#shadow.querySelector(".controls .left"));
      apply_member("tray_right", this.#shadow.querySelector(".controls .right"));
   }
   
};
customElements.define(
   "wm-player",
   WMPlayerElement
);