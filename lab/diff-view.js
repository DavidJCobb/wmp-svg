
class DiffViewElement extends HTMLElement {
   #shadow;
   #filter_picker;
   #slider;
   #width = 100;
   
   #has_ever_been_connected = false;
   
   constructor() {
      super();
      
      let shadow = this.#shadow = this.attachShadow({ mode: "open" });
      shadow.innerHTML = `
<link rel="stylesheet" href="diff-view.css" />
<div>
   <div class="view">
      <slot name="vector"></slot>
      <slot name="raster"></slot>
   </div>
   <slot name="controls"></slot>
   <div class="built-in-controls">
      <label>Raster: <input type="range" min="0" max="100" value="100" /></label>
      <label>
         Filter:
         <select>
            <option value="" selected>None</option>
            <option value="disable-alpha">Disable alpha</option>
            <option value="show-alpha">Show alpha</option>
         </select>
      </label>
   </div>
</div>
      `;
      
      this.#slider = shadow.querySelector("input");
      this.#slider.addEventListener("input", this.#on_threshold_input.bind(this));
      
      this.#filter_picker = shadow.querySelector("select");
      this.#filter_picker.addEventListener("change", this.#on_filter_change.bind(this));
   }
   
   #on_threshold_input() {
      this.threshold = this.#slider.value;
   }
   #on_filter_change() {
      let f = this.#filter_picker.value;
      if (f)
         f = `url('#filter-${f}')`;
      this.style.setProperty("--filter", f);
   }
   
   connectedCallback() {
      if (this.#has_ever_been_connected)
         return;
      this.#has_ever_been_connected = true;
      
      this.style.setProperty("--threshold", "100px");
      {
         let v = 100;
         if (this.hasAttribute("width")) {
            let u = +this.getAttribute("width");
            if (!isNaN(u) && u > 0)
               v = u;
         }
         this.width = v;
      }
   }
   
   #sync_observed_attribute(name, value) {
      if (!this.#has_ever_been_connected)
         return;
      this.#is_synching_attribute = true;
      this.setAttribute(name, value);
      this.#is_synching_attribute = false;
   }
   
   static observedAttributes = [ "width", "height" ];
   //
   #is_synching_attribute = false;
   attributeChangedCallback(name, prior, after) {
      if (this.#is_synching_attribute)
         return;
      switch (name) {
         case "width":
            try { // swallow errors if the attribute value isn't valid
               this.width = after;
            } catch(e) {}
            break;
         case "height":
            try { // swallow errors if the attribute value isn't valid
               this.height = after;
            } catch(e) {}
            break;
      }
   }
   
   get width() { return this.#width; }
   set width(v) {
      v = +v;
      if (isNaN(v) || v <= 0)
         throw new Error("width must be a positive non-zero number");
      this.#width = v;
      this.style.setProperty("--width", v + "px");
      this.#slider.max = v;
      this.#sync_observed_attribute("width", v);
   }
   
   get threshold() { return +this.#slider.value; }
   set threshold(v) {
      v = +v;
      if (isNaN(v) || v < 0)
         throw new Error("threshold must be a non-negative number");
      this.#slider.value = v;
      this.style.setProperty("--threshold", v + "px");
   }
};
customElements.define(
   "diff-view",
   DiffViewElement
);