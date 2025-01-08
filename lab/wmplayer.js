
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
   #loop     = false;
   #shuffle  = false;
   
   #current_playlist_index         = 0;
   #current_playlist_index_started = false;
   #playlist_shuffle_indices       = [];
   
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
<div class="controls"><!--
--><div class="left"><!--
   --><input type="checkbox" class="basic-button shuffle" /><!--
   --><input type="checkbox" class="basic-button loop" /><!--
   --><hr /><!--
   --><button class="basic-button stop" disabled title="Stop">Stop</button><!--
   --><button class="prev-rw" disabled>Previous</button><!--
--></div><!--
--><button class="play-pause">Play</button><!--
--><div class="right"><!--
   --><button class="next-ff" disabled>Next</button><!--
   --><input type="checkbox" class="basic-button mute" /><!--
   --><wm-slider class="volume constant-thumb circular-thumb" min="0" max="1" value="1" step="0.01" title="Volume"></wm-slider><!--
--></div><!--
--></div>
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
      
      for(const name of [
         // HTMLMediaElement:
         "audioTracks",
         "crossOrigin",
         "currentTime",
         "defaultPlaybackRate",
         "disableRemotePlayback",
         "muted",
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
      
      this.observedAttributes = [ "src" ];
      
      for(const name of [
         // HTMLMediaElement:
         "autoplay",
         //"controls",
         //"controlslist",
         //"src",
         // HTMLVideoElement:
         "height",
         "poster",
         "width",
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
      this.#volume_slider.addEventListener("change", this.#on_volume_slider_change.bind(this));
      
      this.#next_button = this.#shadow.querySelector(".next-ff");
      this.#next_button.addEventListener("click", this.toNextMedia.bind(this));
      this.#prev_button = this.#shadow.querySelector(".prev-rw");
      this.#prev_button.addEventListener("click", this.#on_prev_click.bind(this));
   }
   
   //
   // Accessors and APIs
   //
   
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
   
   attributeChangedCallback(name, prior, after) {
      if (this.#setting_attribute)
         return;
      this.#media.setAttribute(name, after);
      
      if (name == "loop") {
         let state = after !== null;
         this.#loop_button.checked = state;
         this.#update_loop_tooltip(state);
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
         }
      }
   }
   
   #has_ever_been_connected = false;
   connectedCallback() {
      if (this.#has_ever_been_connected)
         return;
      this.#has_ever_been_connected = true;
      
      for(let name of this.constructor.observedAttributes) {
         let attr = this.getAttribute(name);
         if (attr === null)
            continue;
         this.#media.setAttribute(name, attr);
      }
      
      this.#update_play_state();
      this.#update_shuffle_tooltip();
      this.#update_loop_tooltip(this.loop);
      this.#update_mute_tooltip();
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
      if (no_media) {
         this.#stop_button.disabled = true;
         this.#next_button.disabled = true;
         this.#prev_button.disabled = true;
      } else {
         this.#next_button.disabled = this.#current_playlist_index == this.#playlist.length - 1;
         this.#prev_button.disabled = this.#current_playlist_index == 0;
      }
      
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
      this.#next_button.disabled = v == this.#playlist.length - 1;
      this.#prev_button.disabled = v == 0;
      if (v > 0) {
         this.#stop_button.disabled = false;
      }
      if (next) {
         // TODO: preload
      }
      return true;
   }
   
   // Returns `true` if we successfully navigated to another playlist 
   // item, or `false` if there was nothing to navigate to.
   #to_next_playlist_item(ignore_shuffle) {
      let next = this.#current_playlist_index + 1;
      if (this.#shuffle && !ignore_shuffle) {
         if (this.#playlist.length == 1) {
            return false;
         }
         let i;
         let list = this.#playlist_shuffle_indices;
         if (list.length) {
            i    = Math.floor(Math.random() * list.length);
            next = list[i];
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
      if (this.#set_playlist_index(this.#current_playlist_index - 1)) {
         this.#media.play();
      }
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
   
   #on_current_time_change(e) {
      if (this.#seek_slider.is_being_edited())
         return;
      this.#seek_slider.value = this.#media.currentTime;
   }
   #on_duration_change(e) {
      this.#seek_slider.maximum = this.#media.duration;
   }
   #on_volume_change(e) {
      if (this.#volume_slider.is_being_edited())
         return;
      this.#volume_slider.value = this.#media.volume;
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
      let state = this.#mute_button.checked;
      this.#media.muted = state;
      this.#update_mute_tooltip(state);
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
   // Simple UI interactions
   //
   
   #on_prev_click() {
      if (this.#media.currentTime > 3) {
         this.#media.currentTime = 0;
         return;
      }
      this.toPrevMedia();
   }
   
   #on_play_pause_click(e) {
      if (this.#media.paused) {
         this.#media.play();
         this.#stop_button.removeAttribute("disabled");
      } else {
         this.#media.pause();
      }
   }
   #on_stop_click(e) {
      this.#set_playlist_index(0); // also pauses the media
      this.#update_play_state();
      this.#stop_button.setAttribute("disabled", "disabled");
   }
   
   #on_seek_slider_change(e) {
      this.#media.currentTime = this.#seek_slider.value;
   }
   #on_volume_slider_change(e) {
      this.#media.volume = this.#seek_slider.value;
   }
   
   //
   // Misc
   //
   
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
   
};
customElements.define(
   "wm-player",
   WMPlayerElement
);