
class WMPlaylistItem {
   #audio_only = false;
   #src        = null;
   #sources    = []; // Array<HTMLSourceElement>
   #tracks     = []; // Array<HTMLTrackElement>
   
   constructor(o) {
      this.#audio_only = o?.audio_only || false; // force audio-only even if a video file
      this.#src        = o?.src || null;
      this.#realize(o?.tracks, o?.sources);
   }
   
   get empty() {
      if (this.#src)
         return false;
      if (this.#sources.length == 0)
         return true;
      for(let source of this.#sources) {
         if (source.src || source.srcset)
            return false;
      }
      return true;
   }
   
   populateMediaElement(media) {
      media.src = this.#src || "";
      media.append(this.#sources.concat(this.#tracks));
      media.currentTime = 0;
   }
   
   #realize(tracks, sources) {
      if (sources) {
         let list = sources;
         let size = list.length;
         for(let i = 0; i < size; ++i) {
            let item = list[i];
            if (item instanceof HTMLSourceElement) {
               this.#sources.push(item);
               continue;
            }
            let node = document.createElement("source");
            for(let attr of ["height", "media", "sizes", "src", "srcset", "type", "width"]) {
               let data = item[attr];
               if (data)
                  node[attr] = data;
            }
            this.#sources.push(node);
         }
      }
      if (tracks) {
         let list = tracks;
         let size = list.length;
         for(let i = 0; i < size; ++i) {
            let item = list[i];
            if (item instanceof HTMLTrackElement) {
               this.#tracks.push(item);
               continue;
            }
            let node = document.createElement("track");
            for(let attr of ["kind", "label", "src", "srclang"]) {
               let data = item[attr];
               if (data)
                  node[attr] = data;
            }
            if (item.default)
               node.setAttribute("default", "default");
            this.#tracks.push(node);
         }
      }
   }
};

class WMPlayerElement extends HTMLElement {
   #playlist = []; // Array<WMPlaylistItem>
   #autoplay = false;
   #loop     = false;
   #shuffle  = false;
   //
   #fast_forward_delay = 1; // hold Next down for this many seconds to start fast-forwarding
   #fast_forward_speed = 4; // WMP uses 5, but Gecko mutes audio for speeds outside [0.25, 4]
   
   #current_playlist_index         = 0;
   #current_playlist_index_started = false;
   #playlist_shuffle_indices       = [];
   
   #hold_to_fast_forward_timeout = null;
   #is_fast_forwarding = false;
   
   #shadow;
   #internals;
   
   #media;
   
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
<link rel="stylesheet" href="wmplayer.css" />
<div class="content">
   <video></video>
</div>
<wm-slider class="seek"></wm-slider>
<div class="controls">
   <div class="left">
      <input type="checkbox" aria-label="Shuffle" aria-role="switch" class="basic-button shuffle" />
      <input type="checkbox" aria-label="Loop" aria-role="switch" class="basic-button loop" />
      <hr />
      <button class="basic-button stop" disabled title="Stop">Stop</button>
      <button class="prev-rw" disabled>Previous</button>
   </div>
   <button class="play-pause">Play</button>
   <div class="right">
      <button class="next-ff" disabled title="Next (press and hold to fast-forward)">Next</button>
      <input type="checkbox" aria-label="Mute" aria-role="switch" class="basic-button mute" />
      <wm-slider aria-label="Volume" class="volume constant-thumb circular-thumb" min="0" max="100" value="100" step="1" title="Volume"></wm-slider>
   </div>
</div>
   `.trim();
   
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
      for(const name of [
         // HTMLMediaElement:
         "audioTracks",
         "crossOrigin",
         "currentTime",
         "defaultPlaybackRate",
         "disableRemotePlayback",
         //"muted",
         "playbackRate",
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
      this.observedAttributes = [ "autoplay", "src" ];
      
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
   
   constructor() {
      super();
      this.#internals = this.attachInternals();
      this.#shadow    = this.attachShadow({ mode: "open" });
      
      let template = document.createElement("template");
      template.innerHTML = WMPlayerElement.#HTML;
      this.#shadow.append(template.content.cloneNode(true));
      
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
      //this.#next_button.addEventListener("click", this.#on_next_click.bind(this));
      this.#next_button.addEventListener("mousedown", this.#on_next_mousedown.bind(this));
      this.#next_button.addEventListener("mouseup", this.#on_next_mouseup.bind(this));
      
      
      this.#prev_button = this.#shadow.querySelector(".prev-rw");
      this.#prev_button.addEventListener("click", this.#on_prev_click.bind(this));
      
      //
      // JavaScript code can in some cases create a custom element instance 
      // and set properties on it before the element is upgraded (i.e. before 
      // the custom element constructor runs), even when the custom element 
      // has already been defined. This means that clients can inadvertently 
      // bypass any class-level [gs]etters, setting values as instance-level 
      // expando properties instead. We'll need to fix these up here.
      //
      for(let name of Object.getOwnPropertyNames(this)) {
         if (name[0] == '#')
            continue;
         let desc = Object.getOwnPropertyDescriptor(this.constructor.prototype, name);
         if (!desc) {
            //
            // Expando. (NOTE: This logic wouldn't be enough were we concerned 
            // with any [gs]etters on our base/ancestor classes.)
            //
            continue;
         }
         if (!desc.get && !desc.set) {
            //
            // Not a [gs]etter.
            //
            continue;
         }
         let value = this[name];
         delete this[name];
         if (desc.set) {
            this[name] = value;
         }
      }
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
      if (!this.#playlist.length)
         return;
      if (this.#current_playlist_index != 0)
         return;
      if (!this.#media.paused)
         return;
      if (this.#media.currentTime != 0)
         return;
      this.#ready_to_autoplay = false;
      this.#media.play();
   }
   
   get currentPlaylistIndex() { return this.#current_playlist_index; }
   set currentPlaylistIndex(v) { this.#set_playlist_index(v); }
   
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
      if (this.#is_fast_forwarding) {
         this.#media.playbackRate = v;
      }
   }
   
   get loop() { return this.#loop; }
   set loop(v) {
      v = !!v;
      if (v == this.#loop)
         return;
      this.#loop = v;
      this.#loop_button.checked = v;
      if (this.#playlist.length == 1) {
         this.#media[v ? "setAttribute" : "removeAttribute"]("loop", "loop");
      }
      this.#update_loop_tooltip();
      this.#update_prev_next_state();
   }
   
   get muted() { return this.#media.muted; }
   set muted(v) {
      v = !!v;
      this.#media.muted = v;
      this.#mute_button.checked = v;
      this.#update_mute_tooltip(v);
      this.#update_mute_glyph(this.#volume_slider.value);
   }
   
   get shuffle() { return this.#shuffle; }
   set shuffle(v) {
      v = !!v;
      if (v == this.#shuffle)
         return;
      this.#shuffle = v;
      this.#shuffle_button.checked = v;
      this.#update_shuffle_tooltip();
   }
   
   //
   // Custom element lifecycle
   //
   
   #has_ever_been_connected = false;
   #ready_to_autoplay       = true;
   
   #disqualify_autoplay_on_playback_control_by_user() {
      //
      // If the user interacts with any part of the player that actually influences 
      // playback, e.g. the seek slider or play/pause button, then disqualify any 
      // pending autoplay. (We don't care about interactions with widgets that don't 
      // alter the flow of playback, e.g. the Shuffle button or the Volume slider.)
      //
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
         this.#update_prev_next_state();
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
            this.#replace_playlist([ item ]);
            this.#try_autoplay();
         }
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
   // Playlist
   //
   
   #mark_current_playlist_item_for_no_shuffle() {
      if (!this.#current_playlist_index_started) {
         this.#current_playlist_index_started = true;
         
         let list = this.#playlist_shuffle_indices;
         let i    = list.indexOf(this.#current_playlist_index);
         if (i >= 0)
            list.splice(i, 1);
      }
   }
   #on_playlist_modified() {
      let no_media = this.#playlist.length == 0;
      
      this.#play_pause_button.disabled = no_media;
      if (no_media)
         this.#stop_button.disabled = true;
      
      this.#update_prev_next_state();
      
      if (this.#playlist.length == 1) {
         this.#media[this.#loop ? "setAttribute" : "removeAttribute"]("loop", "loop");
      } else {
         this.#media.removeAttribute("loop");
      }
   }
   #replace_playlist(items) {
      this.#playlist = items;
      this.#playlist_shuffle_indices = Object.keys(items);
      this.#media.pause();
      this.#on_playlist_modified();
      this.#set_playlist_index(0);
   }
   
   // Returns `true` if we successfully navigated to another playlist 
   // item, or `false` if there was nothing to navigate to.
   #set_playlist_index(v) {
      v = +v;
      if (v < 0 || v >= this.#playlist.length) {
         if (!this.#loop || !this.#playlist.length)
            return false;
         
         if (v < 0)
            v = this.#playlist.length - 1;
         else
            v = 0;
      }
      this.#current_playlist_index = v;
      this.#current_playlist_index_started = false;
      
      let item = this.#playlist[v];
      let next = this.#playlist[v + 1];
      this.#media.pause();
      item.populateMediaElement(this.#media);
      this.#update_prev_next_state();
      if (v > 0) {
         this.#stop_button.disabled = false;
      }
      if (next) {
         // TODO: (optionally?) preload
      }
      return true;
   }
   
   // Returns `true` if we successfully navigated to another playlist 
   // item, or `false` if there was nothing to navigate to. Applies 
   // all relevant "shuffle" logic.
   #to_next_playlist_item(ignore_shuffle) {
      let next = this.#current_playlist_index + 1;
      if (this.#shuffle && !ignore_shuffle) {
         if (this.#playlist.length == 1) {
            return false;
         }
         let i;
         let list = this.#playlist_shuffle_indices;
         if (list.length) {
            //
            // EDGE-CASE: Suppose you enable shuffle, pause the player, 
            // and click "next" five times. None of the media that you 
            // skip should be disqualified from shuffling in the future: 
            // we should only disqualify media once it actually starts 
            // to play...
            //
            // BUT (and this is the edge-case) because we don't prevent 
            // media from being shuffled to unless it's started playing, 
            // if we only roll for a random playlist item one time, then 
            // we may actually navigate from the current playlist item 
            // to itself. We need to re-roll in those cases.
            //
            // This will only happen if the player pauses the player and 
            // then clicks the "next" button.
            //
            do {
               i    = Math.floor(Math.random() * list.length);
               next = list[i];
            } while (next == this.#current_playlist_index);
         } else {
            i    = Math.floor(Math.random() * this.#playlist.length);
            next = i;
            this.#playlist_shuffle_indices = Object.keys(this.#playlist);
            this.#playlist_shuffle_indices.splice(i, 1);
         }
      }
      return this.#set_playlist_index(next);
   }
   
   addToPlaylist(item) {
      if (!(item instanceof WMPlaylistItem)) {
         if (item + "" === item) {
            if (!item)
               return;
            item = new WMPlaylistItem({ src: item });
         } else {
            item = new WMPlaylistItem(item);
            if (item.empty)
               return;
         }
      }
      this.#playlist.push(item);
      this.#playlist_shuffle_indices.push(this.#playlist.length - 1);
      this.#on_playlist_modified();
   }
   clearPlaylist() {
      this.#media.pause();
      this.#media.src = "";
      this.#playlist = [];
      this.#current_playlist_index = 0;
      this.#current_playlist_index_started = false;
      this.#playlist_shuffle_indices = [];
      this.#on_playlist_modified();
   }
   
   toPrevMedia() {
      let playing = !this.#media.paused;
      if (!this.#set_playlist_index(this.#current_playlist_index - 1))
         return;
      if (playing)
         this.#media.play();
   }
   toNextMedia(ignore_shuffle) {
      let playing = !this.#media.paused;
      if (!this.#to_next_playlist_item(ignore_shuffle))
         return;
      if (playing)
         this.#media.play();
   }
   
   //
   // Media events
   //
   
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
      this.#seek_slider.value = this.#media.currentTime;
   }
   #on_volume_change(e) {
      if (this.#volume_slider.is_being_edited())
         return;
      let value = Math.floor(this.#media.volume * 100);
      this.#volume_slider.value = value;
      this.#update_mute_glyph(value);
   }
   
   #on_media_play(e) {
      this.#mark_current_playlist_item_for_no_shuffle();
      this.#update_play_state();
   }
   #on_media_ended(e) {
      //
      // WARNING: The `ended` event doesn't fire if a video has the HTML `loop` attribute, 
      // reaches its end, and loops. It only fires if the video isn't looping.
      //
      if (this.#to_next_playlist_item())
         this.#media.play();
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
      this.#shuffle = this.#shuffle_button.checked;
      this.#update_shuffle_tooltip();
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
   // Volume button
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
      this.#disqualify_autoplay_on_playback_control_by_user();
      if (this.#media.paused) {
         this.#media.play();
         this.#stop_button.removeAttribute("disabled");
      } else {
         this.#media.pause();
      }
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
   // Previous/Next buttons
   //
   
   /*#on_next_click() {
      this.#disqualify_autoplay_on_playback_control_by_user();
      this.toNextMedia();
   }*/
   #on_prev_click() {
      this.#disqualify_autoplay_on_playback_control_by_user();
      if (this.#media.currentTime > 3) {
         this.#media.currentTime = 0;
         return;
      }
      this.toPrevMedia();
   }
   
   #on_next_mousedown() {
      this.#disqualify_autoplay_on_playback_control_by_user();
      this.#hold_to_fast_forward_timeout = window.setTimeout(this.#held_to_fast_forward.bind(this), this.#fast_forward_delay * 1000);
   }
   #held_to_fast_forward() {
      this.#hold_to_fast_forward_timeout = null;
      this.#media.playbackRate = this.#fast_forward_speed;
      this.#is_fast_forwarding = true;
      this.#next_button.classList.add("fast-forward");
      if (this.#media.paused) {
         this.#media.play();
      }
   }
   #on_next_mouseup() {
      if (this.#hold_to_fast_forward_timeout !== null) {
         clearTimeout(this.#hold_to_fast_forward_timeout);
         this.#hold_to_fast_forward_timeout = null;
      }
      if (this.#is_fast_forwarding) {
         this.#media.playbackRate = 1.0;
         this.#is_fast_forwarding = false;
         this.#next_button.classList.remove("fast-forward");
      } else {
         this.toNextMedia();
      }
   }
   
   #update_prev_next_state() {
      let no_prev = false;
      let no_next = false;
      {
         let count = this.#playlist.length;
         if (!count) {
            no_prev = no_next = true;
         } else if (!this.#loop) {
            let current = this.#current_playlist_index;
            no_prev = current == 0;
            no_next = current == count - 1;
         }
      }
      this.#prev_button.disabled = no_prev;
      this.#next_button.disabled = no_next;
   }
   
   //
   // Simple UI interactions
   //
   
   #on_stop_click(e) {
      this.#disqualify_autoplay_on_playback_control_by_user();
      this.#set_playlist_index(0); // also pauses the media
      this.#update_play_state();
      this.#stop_button.setAttribute("disabled", "disabled");
   }
   
   #on_seek_slider_change(e) {
      this.#media.currentTime = this.#seek_slider.value;
      this.#disqualify_autoplay_on_playback_control_by_user();
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
   
};
customElements.define(
   "wm-player",
   WMPlayerElement
);