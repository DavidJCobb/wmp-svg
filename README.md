
# wmp-svg

This is an attempt at recreating the glassy buttons and theming of Windows Media Player 11 and 12 using SVG graphics. The original graphics were rasters, and though they are relatively easy to extract from Windows Media Player's system files, they are relatively low-resolution and unfit for use on high-DPI displays such as smartphones. (The graphical area that bounds the stop, previous, play/pause, and next buttons is 364x102px at its highest available resolution.)

The ultimate goal is to be able to build an HTML5 video player UI that recreates the WMP 11/12 look, while being of acceptable quality on high-DPI displays. Additionally, it could be possible to use these graphics elsewhere (e.g. handwriting `QPainter` calls using the SVGs as a guide, to use this theme in Qt; or rendering these SVGs out to new rasters and using them in skinnable programs like WinAmp or VLC).

A 100% perfect reproduction of the original graphics is likely impossible and not a goal of this project; however, I do intend to get as close to the originals as I possibly can.

Additionally, the primary focus here is the graphics, not so much the player itself and its underlying JavaScript. I'm not deliberately cutting corners, but I'm also not stressing too much about organizing the script code perfectly.