
class WMPlayerSliderElement extends HTMLElement {
   #internals;
   #shadow;
   #track_full;
   #track_bare;
   #thumb;
   
   #bound_drag_move_handler;
   #bound_drag_stop_handler;
   
   #orientation = "horizontal";
   #minimum = 0;
   #maximum = 100;
   #step    = 0;
   #value   = 0;
   
   #has_ever_been_connected = false;
   #is_dragging = false;
   
   constructor() {
      super();
      this.#internals = this.attachInternals();
      this.#shadow    = this.attachShadow({ mode: "open" });
      {
         let link = document.createElement("link");
         link.setAttribute("rel", "stylesheet");
         link.setAttribute("href", "wmplayer.slider.css");
         this.#shadow.append(link);
      }
      
      this.#track_bare = document.createElement("div");
      this.#track_full = document.createElement("div");
      this.#thumb = document.createElement("div");
      
      this.#track_bare.classList.add("track-bare");
      this.#track_full.classList.add("track-full");
      this.#thumb.classList.add("thumb");
      
      this.#shadow.append(
         this.#track_bare,
         this.#track_full,
         this.#thumb
      );
      
      {
         let bound = this.#on_drag_start.bind(this);
         this.addEventListener("mousedown", bound);
         this.addEventListener("pointerdown", bound);
         this.addEventListener("touchstart", bound);
      }
      this.#bound_drag_move_handler = this.#on_drag_tick.bind(this);
      this.#bound_drag_stop_handler = this.#on_drag_end.bind(this);
   }
   
   #setting_attribute = false;
   static observedAttributes = ["max", "min", "step"];
   attributeChangedCallback(name, prior, after) {
      if (this.#setting_attribute)
         return;
      switch (name) {
         case "max":
            this.maximum = after;
            return;
         case "min":
            this.minimum = after;
            return;
         case "step":
            this.step = after;
            return;
      }
   }
   
   connectedCallback() {
      if (this.#has_ever_been_connected)
         return;
      this.#has_ever_been_connected = true;
      
      let attr;
      
      attr = this.getAttribute("max");
      if (!isNaN(+attr))
         this.maximum = +attr;
      
      attr = this.getAttribute("min");
      if (!isNaN(+attr))
         this.minimum = +attr;
      
      attr = this.getAttribute("step");
      if (!isNaN(+attr))
         this.step = +attr;
      
      attr = this.getAttribute("value");
      if (!isNaN(+attr))
         this.value = +attr;
   }
   
   get value() { return this.#value; }
   set value(v) {
      this.#value = Math.min(this.#maximum, Math.max(this.#minimum, +v));
      this.style.setProperty("--value", v);
   }
   
   get step() { return this.#step; }
   set step(v) {
      this.#step = Math.max(0, +v);
      
      this.#setting_attribute = true;
      this.setAttribute("step", v);
      this.#setting_attribute = false;
   }
   
   get minimum() { return this.#minimum; }
   set minimum(v) {
      v = +v;
      this.#minimum = v;
      this.style.setProperty("--minimum", v);
      if (this.#value < v)
         this.#value = v;
      
      this.#setting_attribute = true;
      this.setAttribute("min", v);
      this.#setting_attribute = false;
   }
   
   get maximum() { return this.#maximum; }
   set maximum(v) {
      v = +v;
      this.#maximum = v;
      this.style.setProperty("--maximum", v);
      if (this.#value > v)
         this.#value = v;
      
      this.#setting_attribute = true;
      this.setAttribute("max", v);
      this.#setting_attribute = false;
   }
   
   is_being_edited() { return this.#is_dragging; }
   
   #pointer_pos_to_slider_pos(e) {
      let bounds = this.getBoundingClientRect();
      let thumb  = this.#thumb.getBoundingClientRect();
      let start;
      let end;
      let pointer;
      if (this.#orientation == "vertical") {
         let thumb_half_size = thumb.height / 2;
         start   = bounds.top    + thumb_half_size;
         end     = bounds.bottom - thumb_half_size;
         pointer = e.clientY;
      } else {
         let thumb_half_size = thumb.width / 2;
         start   = bounds.left  + thumb_half_size;
         end     = bounds.right - thumb_half_size;
         pointer = e.clientX;
      }
      return (pointer - start) / (end - start);
   }
   
   #on_drag_start(e) {
      if (e.button)
         return;
      
      this.#is_dragging = true;
      if (this.#internals.states)
         this.#internals.states.add("active");
      
      e.preventDefault();
      {
         window.addEventListener("mousemove",   this.#bound_drag_move_handler);
         window.addEventListener("pointermove", this.#bound_drag_move_handler);
         window.addEventListener("touchmove",   this.#bound_drag_move_handler);
         window.addEventListener("mouseup",     this.#bound_drag_stop_handler);
         window.addEventListener("pointerup",   this.#bound_drag_stop_handler);
         window.addEventListener("touchend",    this.#bound_drag_stop_handler);
      }
      if (e.target != this.#thumb) {
         let pos = this.#pointer_pos_to_slider_pos(e);
         this.#set_relative_position(pos);
         this.dispatchEvent(new Event("change"));
      }
      this.dispatchEvent(new Event("edit-start"));
   }
   #on_drag_tick(e) {
      e.preventDefault();
      let pos = this.#pointer_pos_to_slider_pos(e);
      this.#set_relative_position(pos);
      this.dispatchEvent(new Event("change"));
   }
   #on_drag_end(e) {
      this.#is_dragging = false;
      {
         window.removeEventListener("mousemove",   this.#bound_drag_move_handler);
         window.removeEventListener("pointermove", this.#bound_drag_move_handler);
         window.removeEventListener("touchmove",   this.#bound_drag_move_handler);
         window.removeEventListener("mouseup",     this.#bound_drag_stop_handler);
         window.removeEventListener("pointerup",   this.#bound_drag_stop_handler);
         window.removeEventListener("touchend",    this.#bound_drag_stop_handler);
      }
      if (this.#internals.states)
         this.#internals.states.delete("active");
      
      if (this.#step) {
         this.style.setProperty("--value", this.#value);
      }
      this.dispatchEvent(new Event("edit-stop"));
   }
   
   #clamp(value) {
      return Math.max(this.#minimum, Math.min(this.#maximum, value));
   }
   
   #set_relative_position(pos) { // v is in the range [0, 1]
      if (pos < 0)
         pos = 0;
      else if (pos > 1)
         pos = 1;
      
      let value = pos * (this.#maximum - this.#minimum) + this.#minimum;
      if (this.#is_dragging) {
         if (this.#step)
            this.#value = this.#clamp(Math.round(value / this.#step) * this.#step);
         else
            this.#value = value;
      } else {
         if (this.#step)
            value = this.#clamp(Math.round(value / this.#step) * this.#step);
         this.#value = value;
      }
      this.style.setProperty("--value", value);
   }
};
customElements.define(
   "wm-slider",
   WMPlayerSliderElement
);

class WMPlayerElement extends HTMLElement {
   #shadow;
   #internals;
   
   #media;
   #play_pause_button;
   #seek_slider;
   #stop_button;
   #volume_slider;
   
   #setting_attribute = false;
   
   static #HTML = `
<link rel="stylesheet" href="wmplayer.css" />
<video></video>
<wm-slider class="seek"></wm-slider>
<div class="controls"><!--
--><div class="left"><!--
   --><button class="basic-button shuffle">Shuffle</button><!--
   --><button class="basic-button loop">Loop</button><!--
   --><hr /><!--
   --><button class="basic-button stop" disabled>Stop</button><!--
   --><button class="prev-rw" disabled>Previous</button><!--
--></div><!--
--><button class="play-pause">Play</button><!--
--><div class="right"><!--
   --><button class="next-ff" disabled>Next</button><!--
   --><button class="basic-button mute">Mute</button><!--
   --><wm-slider class="volume constant-thumb circular-thumb" min="0" max="100" value="100"></wm-slider><!--
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
      
      this.observedAttributes = [];
      
      for(const name of [
         // HTMLMediaElement:
         "autoplay",
         //"controls",
         //"controlslist",
         "src",
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
      this.#media.addEventListener("timeupdate", this.#on_current_time_change.bind(this));
      this.#media.addEventListener("durationchange", this.#on_duration_change.bind(this));
      this.#media.addEventListener("volumechange", this.#on_volume_change.bind(this));
      this.#media.addEventListener("play", this.#update_play_state.bind(this));
      this.#media.addEventListener("pause", this.#update_play_state.bind(this));
      this.#media.addEventListener("ended", this.#update_play_state.bind(this));
      {
         let bound = this.#update_buffering_state.bind(this);
         this.#media.addEventListener("buffering", bound);
         this.#media.addEventListener("stalled", bound);
         this.#media.addEventListener("canplay", bound);
         this.#media.addEventListener("canplaythrough", bound);
      }
      
      this.#seek_slider = this.#shadow.querySelector(".seek");
      this.#seek_slider.addEventListener("change", this.#on_seek_slider_change.bind(this));
      
      this.#play_pause_button = this.#shadow.querySelector("button.play-pause");
      this.#play_pause_button.addEventListener("click", this.#on_play_pause_click.bind(this));
      
      this.#stop_button = this.#shadow.querySelector("button.stop");
      this.#stop_button.addEventListener("click", this.#on_stop_click.bind(this));
      
      this.#volume_slider = this.#shadow.querySelector(".volume");
      this.#volume_slider.addEventListener("change", this.#on_volume_slider_change.bind(this));
   }
   
   attributeChangedCallback(name, prior, after) {
      if (this.#setting_attribute)
         return;
      this.#media.setAttribute(name, after);
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
      this.#volume_slider = this.#media.volume;
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
      this.#media.pause();
      this.#media.currentTime = 0;
      this.#stop_button.setAttribute("disabled", "disabled");
   }
   
   #on_seek_slider_change(e) {
      this.#media.currentTime = this.#seek_slider.value;
   }
   #on_volume_slider_change(e) {
      this.#media.volume = this.#seek_slider.value;
   }
   
   #update_play_state() {
      if (this.#media.paused) {
         this.#internals.states.add("paused");
         this.#internals.states.delete("playing");
      } else {
         this.#internals.states.add("playing");
         this.#internals.states.delete("paused");
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