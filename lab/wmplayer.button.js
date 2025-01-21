
class WMPlayerButtonElement extends HTMLElement {
   static formAssociated = true;
   #internals;
   #shadow;
   
   #action   = "custom";
   #checked  = false;
   #disabled = false;
   #type     = "action";
   
   #shadow_wrap;
   #hitbox;
   
   constructor() {
      super();
      this.#internals = this.attachInternals();
      this.#shadow    = this.attachShadow({ delegatesFocus: true, mode: "closed" });
      this.#shadow.innerHTML = `
<link rel="stylesheet" href="wmplayer.button.css" />
<div>
   <div class='hitbox'></div>
   <div class='graphic'><slot></slot></div>
   <div class='glyph'></div>
</div>`;
      
      this.#shadow_wrap = this.#shadow.children[1];
      this.#hitbox      = this.#shadow_wrap.children[0];
      
      this.#internals.role = "button";
      
      this.#hitbox.addEventListener("click",   this.#default_click_handler.bind(this));
      this.#hitbox.addEventListener("keydown", this.#default_keypress_handler.bind(this));
   }
   
   #has_ever_been_connected = false;
   #is_synching_attribute   = false;
   static observedAttributes = [ "checked", "disabled", "type", "data-command" ];
   
   connectedCallback() {
      if (this.#has_ever_been_connected)
         return;
      this.#has_ever_been_connected = true;
      
      this.#sync_attribute_to_dom("checked",  this.#checked ? "checked" : null);
      this.#sync_attribute_to_dom("disabled", this.#disabled ? "disabled" : null);
      if (!this.#disabled) {
         this.#hitbox.setAttribute("tabindex", "0");
      }
      this.#sync_attribute_to_dom("type",     this.#type);
   }
   attributeChangedCallback(name, prior, after) {
      if (this.#is_synching_attribute)
         return;
      switch (name) {
         case "checked":
         case "disabled":
            this[name] = after !== null; // invoke setter
            break;
         case "type":
            try {
               this.type = after; // invoke setter
            } catch (e) {} // swallow disallowed values
            break;
            
         // Make things easier for our stylesheet. Chrome mishandles selectors 
         // of the form `:host(foo) { &:host(bar) { ... } }` such that they 
         // never match, and copying this attribute to the wrapper DIV within 
         // the shadow DOM allows us to avoid that problem.
         case "data-command":
            this.#shadow_wrap[after === null ? "removeAttribute" : "setAttribute"]("data-command", after);
            break;
      }
   }
   
   #sync_attribute_to_dom(name, value) {
      //if (!this.#has_ever_been_connected)
      //   return;
      this.#is_synching_attribute = true;
      if (value === null)
         this.removeAttribute(name);
      else
         this.setAttribute(name, value);
      this.#is_synching_attribute = false;
   }
   
   get checked() { return this.#checked; }
   set checked(v) {
      v = !!v;
      this.#checked = v;
      this.#sync_attribute_to_dom("checked", v ? "checked" : null);
      this.#update_aria_pressed();
   }
   
   get disabled() { return this.hasAttribute("disabled"); }
   set disabled(v) {
      v = !!v;
      this.#disabled = v;
      this.#internals.ariaDisabled = v ? "true" : "false";
      if (v) {
         this.#hitbox.removeAttribute("tabindex");
      } else {
         this.#hitbox.setAttribute("tabindex", 0);
      }
      this.#sync_attribute_to_dom("disabled", v ? "disabled" : null);
   }
   
   get type() { return this.#type; }
   set type(v) {
      switch (v) {
         case "action":
         case "toggle":
            break;
         default:
            throw new Error("unsupported button type");
      }
      this.#type = v;
      this.#sync_attribute_to_dom("type", v);
      this.#update_aria_pressed();
   }
   
   #update_aria_pressed() {
      if (this.#type == "toggle") {
         this.#internals.ariaPressed = this.#checked ? "true" : "false";
      } else {
         this.#internals.ariaPressed = "undefined";
      }
   }
   
   #default_click_handler(e) {
      if (e.defaultPrevented)
         return;
      if (this.#disabled) {
         e.preventDefault();
         e.stopImmediatePropagation();
         return;
      }
      //
      // Clone and re-fire the event; that way, we can allow outside 
      // code to preventDefault in order to prevent toggle buttons 
      // from being toggled.
      //
      e.preventDefault();
      e.stopImmediatePropagation();
      let cloned = new (e.constructor)(e.type, e);
      this.dispatchEvent(cloned);
      if (!cloned.defaultPrevented) {
         if (this.#type == "toggle") {
            this.checked = !this.#checked;
            this.#update_aria_pressed();
         }
      }
   }
   #default_keypress_handler(e) {
      if (e.code != "Space" && e.code != "Enter")
         return;
      if (e.defaultPrevented)
         return;
      e.preventDefault();
      if (e.repeat)
         return;
      this.#hitbox.dispatchEvent(new PointerEvent("click", {
         bubbles:    true,
         cancelable: true,
         composed:   true,  // fire beyond our shadow DOM
         
         button:     0,
         ctrlKey:    false, // Firefox does not forward this from the keypress
         detail:     0,     // click count (e.g. 2 for a double-click)
         isPrimary:  true,
         pointerId:  -1,
         shiftKey:   false, // Firefox does not forward this from the keypress
      }));
   }
};
customElements.define(
   "wm-button",
   WMPlayerButtonElement
);