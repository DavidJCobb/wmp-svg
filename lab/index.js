// Control preview state
(function() {
   let container = document.getElementById("button-state-select");
   let icon_pick = document.getElementById("play-pause-icon-select");
   let raster    = document.getElementById("raster-preview");
   let vector    = document.getElementById("play-pause-button");
   function update() {
      let icon  = icon_pick.value || "play";
      let state = "normal";
      {
         let radio = container.querySelector("input:checked");
         if (radio)
            state = radio.value || state;
      }
      raster.src = `rips/main-${state}.png`;
      vector.src = `play-pause.svg#${icon}-${state}`;
   }
   update();
   icon_pick.addEventListener("change", update);
   container.addEventListener("change", update); // bubbling
})();

// Control raster/vector split preview
(function() {
   let input = document.getElementById("raster-threshold");
   let view  = document.getElementById("preview");
   function update() {
      view.style.setProperty("--raster-x", input.value + "px");
   }
   update();
   input.addEventListener("input", update);
})();

// Control "Disable alpha" option
(function() {
   let input = document.getElementById("toggle-disable-alpha");
   let view  = document.getElementById("preview");
   function update() {
      let checked = input.checked;
      let nodes   = view.querySelectorAll(".layer :is(img, svg)");
      nodes.forEach(function(node) {
         node.classList[checked ? "add" : "remove"]("disable-alpha");
      });
   }
   update();
   input.addEventListener("change", update);
})();