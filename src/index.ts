//export {run} from '@oclif/core'

import { SISRenderer } from "./SISRenderer";

let canvasDom = document.getElementById("siscanvas");




const resizeGetter = ()=>{
    return {width: window.innerWidth, height: window.innerHeight};
}
if (canvasDom instanceof HTMLCanvasElement) {
    let sisr = new SISRenderer(canvasDom, resizeGetter);
    sisr.start();
} else {
    console.log("canvas not found:", canvasDom);
}


