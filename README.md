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
    - Enable webpu flag: `chrome://flags/#enable-unsafe-webgpu`
    - Make sure hardware acceleration is enabled: `chrome://settings/system` > Use hardware acceleration when available





### Pages
Pushing to `main` branch triggers publish on https://visitlab.pages.fi.muni.cz/chromatin/chromoskein/
