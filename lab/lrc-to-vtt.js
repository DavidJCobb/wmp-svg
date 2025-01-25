
//
// Given the data in a *.LRC file, generate VTT data.
//
function lrc_to_vtt(data, track) {
   let offset = 0;
   let lyrics = [];
   
   data = data.split("\n");
   for(let line of data) {
      if (line.startsWith("#"))
         continue;
      
      let stamp = line.match(/^\[(\d+)\:(\d+(?:\.\d+)?)\]/);
      if (stamp) {
         let min  = +stamp[1];
         let sec  = +stamp[2];
         let text = line.substring(stamp[0].length);
         lyrics.push({
            text: text,
            time: ((min * 60) + sec) - offset,
         });
         continue;
      }
      
      let match = line.match(/^\[[^:\]+:[^\]]*]/);
      if (!match)
         continue;
      
      let key = match[1];
      let val = match[2].trim();
      if (key == "offset") {
         val = +val;
         if (!isNaN(val)) {
            offset = val;
         }
         continue;
      }
   }
   
   function fmt_time(time) {
      let min = Math.floor(time / 60);
      let hrs = Math.floor(min / 60);
      min = min % 60;
      let sec = time % 60;
      let msc = Math.floor(sec * 1000) % 1000;
      min = (min + "").padStart(2, '0');
      sec = (Math.floor(sec) + "").padStart(2, '0');
      msc = (msc + "").substring(0, 3).padStart(3, '0');
      if (hrs > 0) {
         hrs = (hrs + "").padStart(2, '0');
         return `${hrs}:${min}:${sec}.${msc}`;
      }
      return `${min}:${sec}.${msc}`;
   }
   
   let out = "WEBVTT\n\n";
   for(let i = 0; i < lyrics.length; ++i) {
      let end = 999999999;
      if (i + 1 < lyrics.length)
         end = lyrics[i + 1].time;
      
      if (i > 0) {
         out += "\n\n";
      }
      out += fmt_time(lyrics[i].time);
      out += " --> ";
      out += fmt_time(end);
      out += "\n";
      out += lyrics[i].text.replaceAll("\n\n", "\n\xA0\n");
   }
   return out;
}