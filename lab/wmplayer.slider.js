class WMPlayerSliderElement extends HTMLElement {
   static formAssociated = true;
   
   #internals;
   #shadow;
   #track_full;
   #track_bare;
   #thumb;
   
   #bound_drag_move_handler;
   #bound_drag_stop_handler;
   
   #disabled = false;
   #orientation = "horizontal";
   #minimum  = 0;
   #maximum  = 100;
   #step     = 0; // values are rounded to the nearest multiple of the step
   #value    = 0;
   
   // Control by how much the slider changes when the user uses the arrow keys.
   #key_step       = 0; // change without modifiers.  defaults to the `step`.
   #key_step_ctrl  = 0; // change with the Ctrl key.  defaults to the `step`.
   #key_step_shift = 0; // change with the Shift key. defaults to the `step`.
   
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
      
      this.addEventListener("keydown", this.#on_key_down.bind(this));
      
      this.#internals.ariaRole = "slider";
      this.#internals.ariaValueNow = this.#value;
      this.#internals.ariaValueMin = this.#minimum;
      this.#internals.ariaValueMax = this.#maximum;
      
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
   
   #setting_attribute = false;
   static observedAttributes = ["disabled", "max", "min", "step"];
   attributeChangedCallback(name, prior, after) {
      if (this.#setting_attribute)
         return;
      switch (name) {
         case "disabled":
            this.disabled = (after !== null);
            return;
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
      
      this.disabled = this.#disabled;
      
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
   
   get disabled() { return this.#disabled; }
   set disabled(v) {
      v = !!v;
      this.#disabled = v;
      if (this.#has_ever_been_connected) {
         //
         // - Update ability to receive focus (tabindex)
         // - Update element states
         // - Reflect to `disabled` attribute
         //
         if (v) {
            this.removeAttribute("tabindex");
            if (this.#internals.states) {
               this.#internals.states.delete("active");
               this.#internals.states.add("disabled");
            }
            this.#setting_attribute = true;
            this.setAttribute("disabled", "disabled");
            this.#setting_attribute = false;
         } else {
            this.setAttribute("tabindex", "0");
            if (this.#internals.states) {
               this.#internals.states.delete("disabled");
            }
            this.#setting_attribute = true;
            this.removeAttribute("disabled");
            this.#setting_attribute = false;
         }
      }
      if (v)
         this.#on_drag_end(null);
   }
   
   get value() { return this.#value; }
   set value(v) {
      v = Math.min(this.#maximum, Math.max(this.#minimum, +v));
      this.#value = v;
      this.#internals.ariaValueNow = v;
      this.#internals.setFormValue(v);
      this.style.setProperty("--value", v);
   }
   
   get valueAsNumber() { return this.#value; }
   set valueAsNumber(v) { this.value = v; }
   
   get keyStep() { return this.#key_step; }
   set keyStep(v) { this.#key_step = +v; }
   get keyStepCtrl() { return this.#key_step_ctrl; }
   set keyStepCtrl(v) { this.#key_step_ctrl = +v; }
   get keyStepShift() { return this.#key_step_shift; }
   set keyStepShift(v) { this.#key_step_shift = +v; }
   
   
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
      
      this.#internals.ariaValueMin = v;
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
      
      this.#internals.ariaValueMax = v;
      this.#setting_attribute = true;
      this.setAttribute("max", v);
      this.#setting_attribute = false;
   }
   
   //
   // Form attribute reflection:
   //
   
   get defaultValue() {
      return +this.getAttribute("value");
   }
   set defaultValue(v) {
      this.setAttribute("value", +v);
   }
   
   get labels() { return this.#internals.labels; }
   
   get name() {
      return this.getAttribute("name");
   }
   set name(v) {
      if (v === null)
         this.removeAttribute("name");
      else
         this.setAttribute("name", v+"");
   }
   
   //
   
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
   #on_drag_end() {
      if (!this.#is_dragging)
         return;
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
   
   #on_key_down(e) {
      if (this.disabled)
         return;
      if (e.altKey || (e.shiftKey && e.ctrlKey))
         return;
      
      let magnitude = 0;
      if (this.#orientation == "vertical") {
         switch (e.code) {
            case "ArrowUp":
               magnitude = -1;
               break;
            case "ArrowDown":
               magnitude = 1;
               break;
            default:
               return;
         }
      } else {
         switch (e.code) {
            case "ArrowLeft":
               magnitude = -1;
               break;
            case "ArrowRight":
               magnitude = 1;
               break;
            default:
               return;
         }
      }
      e.preventDefault();
      {
         let step = this.#key_step;
         if (e.ctrlKey)
            step = this.#key_step_ctrl;
         else if (e.shiftKey)
            step = this.#key_step_shift;
         step = Math.max(step, this.#step);
         if (step)
            magnitude *= step;
      }
      this.value = this.#value + magnitude;
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