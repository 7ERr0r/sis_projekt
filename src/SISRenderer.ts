import { PONNode } from "./PONNode"
import { encode, decode } from "@msgpack/msgpack";
import { SISAlgorithm } from "./SISAlgorithm";
import { PONFiber } from "./PONFIber";

export class SISRenderer {
    // Network nodes - OLT and OLT
    nodes: Array<PONNode> = []
    // Actual calculation algorithm
    algorithm: SISAlgorithm


    // if we need to save PON nodes
    dirtySave: boolean
    // if we need to calculate PON algorithm
    dirtyAlgorithm: boolean

    canvasDom: HTMLCanvasElement
    context: CanvasRenderingContext2D
    canvasWidth: number
    canvasHeight: number
    resizeGetter: () => any
    lastDimensions: { width: any; height: number; };
    animationRequest: number
    saveInterval: any
    lastMouseX: number
    lastMouseY: number
    algorithmException: any;
    draggingNode: PONNode
    useCentroids: boolean
    frameCounter: number;






    public constructor(canvas: HTMLCanvasElement, resizeGetter: () => any) {
        this.canvasDom = canvas
        this.context = canvas.getContext("2d")!
        this.canvasWidth = 0
        this.canvasHeight = 0
        this.resizeGetter = resizeGetter
        this.lastDimensions = { width: 0, height: 0 }
        this.animationRequest = -1
        this.dirtySave = false
        this.dirtyAlgorithm = false
        this.saveInterval = null
        this.lastMouseX = -1
        this.lastMouseY = -1
        this.algorithmException = null
        this.useCentroids = false
        this.frameCounter = 0
    }


    public start() {
        {
            console.log("starting...")
            if(localStorage.getItem("pon_nodes") == null) {
                localStorage.setItem("pon_nodes", "OLT 164 108 \nONU 220 73 \nONU 245 122 \nONU 297 92 \nONU 372 112 \nONU 417 81 \nONU 431 138 \nONU 498 81 \nONU 515 128 \nONU 582 81 \nONU 594 135 \nONU 697 49 \nONU 680 124 \nONU 800 78 \nONU 798 121 \nOLT 797 248 \nONU 731 231 \nONU 683 256 \nONU 644 29 \nONU 650 82 \nONU 728 103 \nONU 614 271 \nONU 625 225 \nONU 554 237 \nONU 537 269 \nONU 452 249 \nONU 418 276 \nONU 348 245 \nONU 296 277 \nONU 254 227 \nONU 208 255 \nONU 150 283 \nONU 138 232 \nONU 175 209 \n\n")
            }

            let nodesStr = localStorage.getItem("pon_nodes");
            if (nodesStr != null) {
                this.nodes = SISRenderer.stringToNodes(nodesStr)
                this.dirtyAlgorithm = true
            }
        }
        this.onResize(null);
        window.addEventListener("resize", (e) => this.onResize(e));
        window.addEventListener("keydown", (e) => this.handleKeyDown(e))
        window.addEventListener("keyup", (e) => this.handleKeyUp(e))

        //this.canvasDom.addEventListener("click", (e) => this.handleClick(e))
        this.canvasDom.addEventListener("mousemove", (e) => this.handleMouseMove(e))
        this.canvasDom.addEventListener("mousedown", (e) => this.handleMouseDown(e))
        this.canvasDom.addEventListener("mouseup", (e) => this.handleMouseUp(e))
        this.saveInterval = window.setInterval(() => this.saveIfDirty(), 1000);

        (<any>window).pon = function () {
            return localStorage.getItem("pon_nodes")
        };
    }


    public handleKeyDown(e: KeyboardEvent) {
        let lower = e.key.toLowerCase();
        if (lower == 'u') {
            this.addNodeAt(this.lastMouseX, this.lastMouseY, PONNode.ONU)
        }
        if (lower == 't') {
            this.addNodeAt(this.lastMouseX, this.lastMouseY, PONNode.OLT)
        }
        if (lower == 'a') {
            this.dirtyAlgorithm = true
            this.useCentroids = !this.useCentroids
        }
        if (lower == 'r') {
            console.log("resetting")
            this.nodes = []
            this.dirtySave = this.dirtyAlgorithm = true
        }

    }
    public handleKeyUp(e: KeyboardEvent) {
        let lower = e.key.toLowerCase();
        // if (lower == 'd') {
        //     this.debug = false;
        // }
    }

    public saveIfDirty() {
        if (this.dirtySave) {
            this.dirtySave = false
            console.log("saving...");
            localStorage.setItem("pon_nodes", SISRenderer.nodesToString(this.nodes))
        }
    }

    public getDimensions() {
        const targetDimensions = this.resizeGetter();
        this.lastDimensions = targetDimensions;
        return targetDimensions;
    }

    public onResize(e: UIEvent | null) {
        const targetDimensions = this.getDimensions();
        //console.log(targetDimensions);
        const width = targetDimensions.width;
        const height = targetDimensions.height - 10;

        this.canvasWidth = this.canvasDom.width = width;
        this.canvasHeight = this.canvasDom.height = height;


        this.animate();
    }
    public animate() {
        if (this.animationRequest != -1) {
            return;
        }


        this.animationRequest = window.requestAnimationFrame(() => {
            this.animationRequest = -1;
            if (this.algorithmException == null) {
                this.render();
                this.animate();
            }

        });



    }
    public handleMouseMove(e: MouseEvent) {
        this.lastMouseX = e.clientX
        this.lastMouseY = e.clientY

        if (this.draggingNode) {
            this.draggingNode.posX = this.lastMouseX
            this.draggingNode.posY = this.lastMouseY
        }
    }
    public handleClick(e: MouseEvent) {
        this.addNodeAt(e.clientX, e.clientY, PONNode.ONU)
    }

    public handleMouseDown(e: MouseEvent) {
        this.lastMouseX = e.clientX
        this.lastMouseY = e.clientY
        let closest = PONNode.closestNodeTo(this.nodes, this.lastMouseX, this.lastMouseY);

        if (closest != null) {
            let dx = closest.posX - this.lastMouseX;
            let dy = closest.posY - this.lastMouseY;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 20) {
                this.draggingNode = closest
            }
        }
    }
    public handleMouseUp(e: MouseEvent) {
        this.lastMouseX = e.clientX
        this.lastMouseY = e.clientY

        this.draggingNode = null
        this.dirtyAlgorithm = true
        this.dirtySave = true

        
    }

    public addNodeAt(posX: number, posY: number, typ: number) {
        this.nodes.push(new PONNode(posX, posY, typ))
        this.dirtySave = this.dirtyAlgorithm = true
    }

    idleCallback() {
        try {
            if (this.dirtyAlgorithm) {
                this.dirtyAlgorithm = false
                let startTime = Date.now()
                {
                    this.algorithm = new SISAlgorithm(this.nodes, this.useCentroids)
                    this.algorithm.run()
                }
                let took = Date.now() - startTime
                console.log("algorithm took " + (Math.floor(took * 10) / 10) + "ms")
            }


            let iterate = this.algorithm != null && this.algorithm.needsIterate
            if (iterate) {
                let startTime = Date.now()
                {

                    this.algorithm.iterate()
                }
                let took = Date.now() - startTime
                //console.log("iteration took " + (Math.floor(took * 10) / 10) + "ms")
            }
        } catch (e) {
            this.algorithmException = e
            throw e;
        }
    }

    public render() {
        this.context.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

        let nodes = this.nodes
        if (this.algorithm != null) {
            nodes = this.algorithm.nodes
            this.renderAlgorithmOutput()
        } else {
            this.renderEquipment(nodes)
        }
        this.renderTooltip(nodes)

        if(this.frameCounter++ < 60*4 || (this.lastMouseX < 200 && this.lastMouseY < 60)) {
            this.context.fillStyle = "#EEEEEE"
            this.context.fillRect(0, 0, 300, 210)
            this.context.fillStyle = "black"
            this.context.font = "30px Arial"
            this.context.fillText("klawisz T = OLT", 10, 10+40*1)
            this.context.fillText("klawisz U = ONU", 10, 10+40*2)
            this.context.fillText("klawisz R = reset", 10, 10+40*3)
            this.context.fillText("klawisz A = algorytm", 10, 10+40*4)
        }


        let iterate = this.algorithm != null && this.algorithm.needsIterate
        if (this.dirtyAlgorithm || iterate) {
            window.requestIdleCallback(() => this.idleCallback())
        }
    }

    public renderAlgorithmOutput() {
        let alg = this.algorithm
        if (alg != null) {

            this.renderEdges(alg.nodes, alg.fibers)
            this.renderEquipment(alg.nodes)

        }


    }

    public renderEdges(nodes: PONNode[], edges: PONFiber[]) {
        const c = this.context

        for (let i = 0; i < edges.length; i++) {
            let edge = edges[i];


            let nodea = nodes[edge.nodea]
            let nodeb = nodes[edge.nodeb]
            if (!nodea || !nodeb) {
                continue
            }
            let ax = nodea.posX
            let ay = nodea.posY
            let bx = nodeb.posX
            let by = nodeb.posY

            c.beginPath()

            c.moveTo(ax, ay)
            c.lineTo(bx, by)
            c.stroke()
            c.closePath()

        }
    }


    public renderEquipment(eq: PONNode[]) {
        const c = this.context

        for (let i = 0; i < eq.length; i++) {
            let node = eq[i];

            let radius = 10
            if (node.typ == PONNode.ONU) {
                c.fillStyle = "green";
            }
            if (node.typ == PONNode.OLT) {
                c.fillStyle = "red";
            }
            if (node.typ == PONNode.SPLITTER) {
                c.fillStyle = "orange";
                radius = 6
            }

            // circle
            c.beginPath()
            c.arc(node.posX, node.posY, radius, 0, Math.PI * 2, true)
            c.fill()
            c.stroke()

        }
    }

    public renderTooltip(nodes: PONNode[]) {
        let closest = PONNode.closestNodeTo(nodes, this.lastMouseX, this.lastMouseY);

        if (closest != null) {
            let dx = closest.posX - this.lastMouseX;
            let dy = closest.posY - this.lastMouseY;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 20) {
                this.context.fillStyle = "#AAAAAA";
                this.context.font = "20px Tahoma";
                let tipx = this.lastMouseX + 10;
                let tipy = this.lastMouseY - 10;
                let text = PONNode.typToString(closest.typ)+" "+closest.debug;
                let width = this.context.measureText(text).width;

                this.context.fillRect(tipx, tipy - 30 + 5, width + 10, 30);
                this.context.fillStyle = "black";
                this.context.fillText(text, tipx + 5, tipy);
            }
        }
    }



    public static nodesToString(nodes: Array<PONNode>): string {
        let s = "";
        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];

            s += PONNode.typToString(node.typ) + " ";
            s += Math.floor(node.posX) + " ";
            s += Math.floor(node.posY) + " ";
            s += "\n";
        }
        return s;
    }

    public static stringToNodes(str: string): Array<PONNode> {
        let nodes: Array<PONNode> = [];
        let lines = str.split("\n");
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.length > 2) {
                let params = line.split(" ");

                let typ = PONNode.stringToTyp(params[0]);
                let x = parseInt(params[1]);
                let y = parseInt(params[2]);

                let node = new PONNode(x, y, typ);
                nodes.push(node);
            }
        }
        return nodes;
    }
}
