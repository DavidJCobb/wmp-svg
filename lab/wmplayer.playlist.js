
class WMPlaylistItem {
   #audio_only = false;
   #src        = null;
   #sources    = []; // Array<HTMLSourceElement>
   #tracks     = []; // Array<HTMLTrackElement>
   
   constructor(o) {
      if (o+"" === o) {
         let src = o;
         o = { src: o };
         
         let ext = (function() {
            let url;
            try {
               url = new URL(src, window.location.href);
            } catch (e) {
               return;
            }
            let path = url.pathname;
            let i    = path.search(/[\.\/\\][^\.\/\\]*$/);
            if (i < 0 || path[i] != '.')
               return;
           return path.substring(i + 1); 
         })();
         switch (ext) {
            case "aac":
            case "aiff":
            case "flac":
            case "m4a":
            case "mp3":
            case "ogg":
            case "opus":
            case "wav":
            case "wma": // Windows Media Audio
               o.audio_only = true;
         }
      }
      this.#audio_only = o?.audio_only || false; // force audio-only even if a video file
      this.#src        = o?.src || null;
      this.#realize(o?.tracks, o?.sources);
   }
   
   get audio_only() { return this.#audio_only; }
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

class WMPlaylist extends EventTarget {
   #items   = [];
   #index   = 0;
   #loop    = false;
   #shuffle = false;
   
   #indices_for_shuffle   = [];
   #current_index_started = false;
   
   constructor() {
      super();
   }
   
   //
   // Accessors
   //
   
   /*bool*/ empty() /*const*/ { return this.#items.length == 0; }
   
   get currentItem() { return this.#items[this.#index] || null; }
   
   get index() { return this.#index; }
   set index(v) {
      v = +v;
      if (v < 0 || v >= this.#items.length) {
         if (!this.#loop || !this.#items.length)
            return;
         if (v < 0)
            v = this.#items.length - 1;
         else
            v = 0;
      }
      this.#index = v;
      this.#current_index_started = false;
      this.#dispatch_current_item_changed();
   }
   
   get loop() { return this.#loop; }
   set loop(v) {
      v = !!v;
      if (this.#loop == v)
         return;
      this.#loop = v;
      this.dispatchEvent(new CustomEvent("loop-flag-changed", { detail: v }));
   }
   
   get shuffle() { return this.#shuffle; }
   set shuffle(v) {
      v = !!v;
      if (this.#shuffle == v)
         return;
      this.#shuffle = v;
      this.dispatchEvent(new CustomEvent("shuffle-flag-changed", { detail: v }));
   }
   
   get size() { return this.#items.length; }
   
   //
   // Dispatching
   //
   
   #dispatch_current_item_changed() {
      let i    = this.#index;
      let item = null;
      if (this.#items.length == 0) {
         i = null;
      } else {
         item = this.#items[i];
      }
      this.dispatchEvent(new CustomEvent("current-item-changed", { detail: {
         index: i,
         item:  item
      }}));
   }
   
   //
   
   add(item) {
      if (!(item instanceof WMPlaylistItem)) {
         item = new WMPlaylistItem(item);
         if (item.empty)
            return;
      }
      this.#items.push(item);
      this.#indices_for_shuffle.push(this.#items.length - 1);
      this.dispatchEvent(new Event("modified"));
   }
   clear() {
      this.#items = [];
      this.#index = 0;
      this.#indices_for_shuffle   = [];
      this.#current_index_started = 0;
      this.dispatchEvent(new Event("cleared"));
      this.#dispatch_current_item_changed();
   }
   
   // Mark the current item as having started playing, meaning that 
   // we won't shuffle to it again until we've shuffled through all 
   // other items.
   markAsPlayed() {
      if (this.#current_index_started)
         return;
      this.#current_index_started = true;
      
      let list = this.#indices_for_shuffle;
      let i    = list.indexOf(this.#index);
      if (i >= 0)
         list.splice(i, 1);
   }
   
   hasNextItem(ignore_shuffle) {
      if (this.#loop) {
         return true;
      }
      if (ignore_shuffle || !this.#shuffle) {
         return (this.#index < this.#items.length - 1);
      }
      return this.#indices_for_shuffle.length > 0;
   }
   
   // Returns `true` if we successfully navigated to another playlist 
   // item, or `false` if there was nothing to navigate to. Applies 
   // all relevant "shuffle" logic.
   toNext(ignore_shuffle) {
      let next = this.#index + 1;
      if (this.#shuffle && !ignore_shuffle) {
         if (this.#items.length == 1)
            return;
         let i;
         let list = this.#indices_for_shuffle;
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
            } while (next == this.#index);
         } else {
            if (!this.#loop)
               return;
            i    = Math.floor(Math.random() * this.#items.length);
            next = i;
            this.#indices_for_shuffle = Object.keys(this.#items);
            this.#indices_for_shuffle.splice(i, 1);
         }
      }
      let prior = this.#index;
      this.index = next;
      return this.#index != prior;
   }
   
   // Returns `true` if we successfully navigated to another playlist 
   // item, or `false` if there was nothing to navigate to.
   toPrev() {
      let prior = this.#index;
      this.index = this.#index - 1;
      return this.#index != prior;
   }
   
   replace(items) {
      this.#items = Array.from(items); // deliberately clone
      this.#index = 0;
      this.#indices_for_shuffle   = Object.keys(this.#items);
      this.#current_index_started = false;
      this.dispatchEvent(new Event("replaced"));
      this.#dispatch_current_item_changed();
   }
};