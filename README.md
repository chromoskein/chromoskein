## Chromoskein

Chromoskein is a tool for visualizing genomic data with a special focus 3D chromatin structures predicted from Hi-C.

*The project uses WebGPU which is currently under development. In order to run Chromoskein, you will need experimental versions of modern browsers. **We recommend Google Chrome Canary.***

### Development

Chromoskein is developed at [VisitLab](http://visitlab.fi.muni.cz) from Masaryk University, Brno, Czech Republic.

#### Project initialization

Windows 10 (Creator's update and later): 
 - Enable 'Developer mode'
 - Clone with symlinks enabled
  
    `git clone -c core.symlinks=true`

Run dev server
- `cd app`
- `npm run serve`

#### Browser setup:
- Google Chrome Canary
    - Enable *Unsafe WebGPU* flag: `chrome://flags/#enable-unsafe-webgpu`
    - Make sure hardware acceleration is enabled: `chrome://settings/system` > Use hardware acceleration when available
        - Graphics status can be checked in: `chrome://gpu` 
    - Chromoskein on macOS refreshes when data is loaded in 3D viewport? Disable *Back-forward cache* flag: `chrome://flags/#back-forward-cache`. This is probably a bug in Chrome and the flag won't be needed in the future. 





### Pages
Pushing to `main` branch triggers publish on https://visitlab.pages.fi.muni.cz/chromatin/chromoskein/
