const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.join(__dirname, "..");
let directory, timer;
(async () => {
  directory = await fs.mkdtemp("/tmp/esfera-gpu-");
  app.setPath("userData", directory);
  const shader = await import(
    pathToFileURL(path.join(root, "lib/panorama-material.mjs")).href
  );
  const projection = await import(
    pathToFileURL(path.join(root, "lib/projection.mjs")).href
  );
  const variants = [0, 15, 30, 65, 100].map((zoom) => ({
    zoom,
    ...projection.parameters(zoom, -35),
  }));
  const rendererCode = `
const { ipcRenderer } = require('electron');
const THREE = require(${JSON.stringify(path.join(root, "node_modules/three/build/three.cjs"))});
window.addEventListener('DOMContentLoaded', () => {
  try {
    const shader = ${JSON.stringify({ vertex: shader.panoramaVertexShader, fragment: shader.panoramaFragmentShader })};
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(640, 420);
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const target = new THREE.WebGLRenderTarget(640,420);
    const W=2048,H=1024;
    function texture(shift, old) {
      const data = new Uint8Array(W*H*4);
      for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
        const xx=(x+shift)%W, i=(y*W+x)*4;
        data[i]=128+90*Math.sin(xx/W*Math.PI*2*63);
        data[i+1]=((Math.floor(xx/4)+Math.floor(y/4))%2)*220+20;
        data[i+2]=128+90*Math.cos(y/H*Math.PI*2*17);
        data[i+3]=255;
      }
      const tex=new THREE.DataTexture(data,W,H);
      tex.colorSpace=THREE.SRGBColorSpace;
      tex.wrapS=old?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;
      tex.wrapT=THREE.ClampToEdgeWrapping;
      tex.generateMipmaps=true;
      tex.minFilter=THREE.LinearMipmapLinearFilter;
      tex.magFilter=THREE.LinearFilter;
      tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
      tex.needsUpdate=true;
      return tex;
    }
    const empty=new THREE.DataTexture(new Uint8Array(4),1,1);empty.needsUpdate=true;
    const stats=[];
    for(const old of [true,false]) {
      const original=texture(0,old), shifted=texture(W/4,old);
      const fragment=old?shader.fragment.replaceAll('textureGrad(image, uv, dx, dy)','texture2D(image, uv)').replaceAll('textureGrad(selection, uv, dx, dy)','texture2D(selection, uv)'):shader.fragment;
      const material=new THREE.ShaderMaterial({ vertexShader:shader.vertex,fragmentShader:fragment,
        uniforms:{ image:{value:original}, selection:{value:empty}, showSelection:{value:0}, lon:{value:0},lat:{value:-35*Math.PI/180},aspect:{value:640/420},fov:{value:1},stereoFov:{value:1},blend:{value:0} } });
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(mesh);
      for(const p of ${JSON.stringify(variants)}) {
        for(const key of ['fov','stereoFov','blend']) material.uniforms[key].value=p[key];
        function render(image,longitude) {
          material.uniforms.image.value=image;material.uniforms.lon.value=longitude*Math.PI/180;
          renderer.setRenderTarget(target);renderer.render(scene,camera);
          const pixels=new Uint8Array(640*420*4);renderer.readRenderTargetPixels(target,0,0,640,420,pixels);return pixels;
        }
        const a=render(original,15),b=render(shifted,-75);
        let max=0,sum=0,changed=0;
        for(let i=0;i<a.length;i+=4) {
          const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
          max=Math.max(max,d);sum+=d;if(d>8)changed++;
        }
        stats.push({old,zoom:p.zoom,max,mean:sum/(640*420),changed});
      }
      scene.remove(mesh);material.dispose();mesh.geometry.dispose();original.dispose();shifted.dispose();
    }
    if(renderer.getContext().getError()!==0) throw Error('WebGL returned an error');
    ipcRenderer.send('audit-result',{stats});
  } catch(error) { ipcRenderer.send('audit-result',{error:error.stack}); }
});`;
  await fs.writeFile(path.join(directory, "preload.cjs"), rendererCode);
  await app.whenReady();
  timer = setTimeout(() => {
    console.error("GPU test timed out");
    app.exit(1);
  }, 60000);
  ipcMain.once("audit-result", (_event, result) => {
    console.log(JSON.stringify(result, null, 2));
    clearTimeout(timer);
    const fixed = result.stats?.filter((row) => !row.old) || [];
    const reference = result.stats?.filter((row) => row.old) || [];
    const passed =
      !result.error &&
      fixed.length === 5 &&
      fixed.every((row) => row.changed === 0 && row.mean < 0.02) &&
      reference.every((row) => row.changed > 100);
    app.exit(passed ? 0 : 1);
  });
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(directory, "preload.cjs"),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      offscreen: true,
    },
  });
  win.loadURL("about:blank");
})().catch((error) => {
  console.error(error);
  app.exit(1);
});
