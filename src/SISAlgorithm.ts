import { PONFiber } from "./PONFIber";
import { PONNode } from "./PONNode";
import { SISRenderer } from "./SISRenderer";



export class SISAlgorithm {
    nodes: PONNode[]
    fibers: PONFiber[]
    //result: SISResult
    needsIterate: boolean
    stage1ended: boolean
    leaders: number[]
    useCentroids: boolean;


    constructor(nodes: PONNode[], useCentroids: boolean) {
        this.nodes = nodes.slice();
        this.needsIterate = true
        this.useCentroids = useCentroids
        this.clearLeaders()
    }
    clearLeaders() {
        let leaders = new Array(this.nodes.length)
        for (let i = 0; i < leaders.length; i++) {
            leaders[i] = i;
        }
        this.leaders = leaders
    }

    public run() {
        let nodes = this.nodes;
        let onuNodes: PONNode[] = [];
        let oltNodes: PONNode[] = [];
        let onuids: number[] = [];
        let oltids: number[] = [];

        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            if (node.typ == PONNode.ONU) {
                onuNodes.push(node);
                onuids.push(i);
            }
            if (node.typ == PONNode.OLT) {
                oltNodes.push(node);
                oltids.push(i);
            }
        }

        let nearestOltIDforONU: number[] = new Array(onuNodes.length);

        for (let i = 0; i < onuNodes.length; i++) {
            let onuNode = onuNodes[i];

            let nearestOltID = -1;
            let nearestDist = 99999999999;
            for (let j = 0; j < oltNodes.length; j++) {
                let oltNode = oltNodes[j];
                let dx = onuNode.posX - oltNode.posX;
                let dy = onuNode.posY - oltNode.posY;

                let distSquared = dx * dx + dy * dy;

                if (distSquared < nearestDist) {
                    nearestDist = distSquared;
                    nearestOltID = oltids[j];
                }
            }
            nearestOltIDforONU[i] = nearestOltID;

        }


        let fibers: PONFiber[] = []
        for (let i = 0; i < onuNodes.length; i++) {
            //let onuNode = onuNodes[i];

            let onuID = nearestOltIDforONU[i]
            if (onuID != -1) {
                let fiber = new PONFiber(onuID, onuids[i])

                fibers.push(fiber)
            }

        }

        this.fibers = fibers
    }


    public iterate() {
        if (!this.stage1ended) {
            if (this.useCentroids) {
                if (!this.stage1centroids()) {
                    this.stage1ended = true
                }
            } else {
                if (!this.stage1mst()) {
                    this.stage1ended = true
                }
            }
        } else {
            if (!this.stage2()) {
                this.needsIterate = false
            }
        }
    }

    public stage2(): boolean {
        let somethingChanged = false
        let delta = 1;
        let moves: number[][] = [];
        for (let angle = 0.0; angle < Math.PI * 2; angle += Math.PI / 16) {
            moves.push([delta * Math.sin(angle), delta * Math.cos(angle)]);
        }
        let nodes = this.nodes;
        let nodesLength = nodes.length;

        let neighboursArr: number[][] = new Array(nodes.length);
        for (let i = 0; i < neighboursArr.length; i++) {
            neighboursArr[i] = [];
        }
        {
            let fibers = this.fibers;
            for (let i = 0; i < fibers.length; i++) {
                let fiber = fibers[i];
                //let typa = nodes[fiber.nodea].typ;
                //let typb = nodes[fiber.nodeb].typ;
                //if (typa == PONNode.SPLITTER || typb == PONNode.SPLITTER) {
                neighboursArr[fiber.nodea].push(fiber.nodeb);
                neighboursArr[fiber.nodeb].push(fiber.nodea);
                //}
            }
        }
        for (let nodeID = 0; nodeID < nodesLength; nodeID++) {
            let node = this.nodes[nodeID];
            let typ = node.typ;
            if (typ != PONNode.SPLITTER) {
                continue;
            }
            let neighbours = neighboursArr[nodeID];
            node.debug = neighbours.length + "";
            let costPre = SISAlgorithm.costOfOutgoing(nodes, node, neighbours);
            let posX = node.posX;
            let posY = node.posY;
            let bestDirection = -1;
            let bestCost = costPre;
            for (let dir = 0; dir < moves.length; dir++) {
                let dmove = moves[dir];

                node.posX = posX + dmove[0];
                node.posY = posY + dmove[1];
                let costPost = SISAlgorithm.costOfOutgoing(nodes, node, neighbours);
                if (costPost < bestCost) {
                    bestCost = costPost
                    bestDirection = dir
                    break
                }
                node.posX = posX;
                node.posY = posY;

            }

            if (bestDirection != -1) {
                somethingChanged = true
                let bestMove = moves[bestDirection];

                node.posX = posX + bestMove[0];
                node.posY = posY + bestMove[1];
            }



        }

        return somethingChanged
    }

    // find and union
    shouldConnect(a: number, b: number) {
        const la = this.getLeader(a)
        const lb = this.getLeader(b)

        // Check: we shouldn't connect 2 OLTs

        let nodea = this.nodes[la]
        let nodeb = this.nodes[lb]

        if (nodea.typ == PONNode.OLT && nodeb.typ == PONNode.OLT) {
            return false;
        }

        return la != lb
    }

    union(a: number, b: number) {
        // mozliwe, ze trzeba na odwrot
        // aby algorytm dzialal szybciej
        const la = this.getLeader(a)
        if (this.nodes[la].typ == PONNode.OLT) {
            // OLT musi zostac liderem, nie mozemy go podmienic
            const lb = this.getLeader(b)
            this.leaders[lb] = a
            if (this.nodes[lb].typ == PONNode.OLT) {
                throw new Error("proba unii OLT: union(OLT, OLT) - nie mozemy zamienic lidera na OLT")
            }
        } else {
            this.leaders[la] = b
        }



    }

    getLeader(id: number): number {
        let leader = this.leaders[id]
        if (id == leader) {
            return id
        } else {
            leader = this.getLeader(leader)
            this.leaders[id] = leader
            return leader
        }
    }


    public stage1mst(): boolean {
        let somethingChanged = false;
        let nodes = this.nodes;
        let neighboursArr: number[][] = new Array(nodes.length);
        for (let i = 0; i < neighboursArr.length; i++) {
            neighboursArr[i] = [];
        }

        let nodesLength = nodes.length;
        let edges: number[][] = [];
        for (let i = 0; i < nodesLength; i++) {
            let nodea = nodes[i];
            for (let j = 0; j < nodesLength; j++) {
                let nodeb = nodes[j];

                let dx = nodea.posX - nodeb.posX;
                let dy = nodea.posY - nodeb.posY;
                let distance = dx * dx + dy * dy;

                let edge = [distance, i, j];
                edges.push(edge);
            }
        }

        edges.sort((a, b) => a[0] - b[0]);

        let fibers: PONFiber[] = []
        for (const edge of edges) {
            let nodeid_a = edge[1];
            let nodeid_b = edge[2];
            if (this.shouldConnect(nodeid_a, nodeid_b)) {
                this.union(nodeid_a, nodeid_b)
                fibers.push(new PONFiber(nodeid_a, nodeid_b))
            }
        }
        this.fibers = fibers

        this.placeSplittersAtJunctions()

        return somethingChanged;
    }


    placeSplittersAtJunctions() {
        let nodes = this.nodes;
        let neighboursArr: number[][] = new Array(nodes.length);
        for (let i = 0; i < neighboursArr.length; i++) {
            neighboursArr[i] = [];
        }
        {
            let fibers = this.fibers;
            for (let i = 0; i < fibers.length; i++) {
                let fiber = fibers[i];
                let typa = nodes[fiber.nodea].typ;
                let typb = nodes[fiber.nodeb].typ;
                if (typa == PONNode.ONU || typb == PONNode.ONU) {
                    neighboursArr[fiber.nodea].push(fiber.nodeb);
                    neighboursArr[fiber.nodeb].push(fiber.nodea);
                }
            }
        }
        //this.removeOLTtoOLTfibers()
        let nodeToSplitterMap: number[] = new Array(this.nodes.length);
        for (let i = 0; i < nodeToSplitterMap.length; i++) {
            nodeToSplitterMap[i] = -1;
        }

        for (let nodeid = 0; nodeid < neighboursArr.length; nodeid++) {
            let node = this.nodes[nodeid];
            let neighbours = neighboursArr[nodeid];

            if (neighbours.length >= 2) {
                let splitter = new PONNode(node.posX, node.posY, PONNode.SPLITTER);
                let splitterid = nodes.length;
                nodes.push(splitter);

                nodeToSplitterMap[nodeid] = splitterid;

            }
        }

        {
            let fibers = this.fibers;
            for (let i = 0; i < fibers.length; i++) {
                let fiber = fibers[i];
                let typa = nodes[fiber.nodea].typ;
                let typb = nodes[fiber.nodeb].typ;
                if (typa == PONNode.ONU) {
                    const newid = nodeToSplitterMap[fiber.nodea];
                    if (newid != -1) {
                        fiber.nodea = newid;
                    }
                }
                if (typb == PONNode.ONU) {
                    const newid = nodeToSplitterMap[fiber.nodeb];
                    if (newid != -1) {
                        fiber.nodeb = newid;
                    }
                }
            }
        }
        for (let nodeid = 0; nodeid < nodeToSplitterMap.length; nodeid++) {
            let splitterid = nodeToSplitterMap[nodeid];

            if (splitterid != -1) {
                this.fibers.push(new PONFiber(splitterid, nodeid))
            }
        }

    }
    // removeOLTtoOLTfibers() {
    //     let fibers = this.fibers;
    //     let nodes = this.nodes;
    //     let newFibers = [];
    //     for (let i = 0; i < fibers.length; i++) {
    //         let fiber = fibers[i];
    //         let typa = nodes[fiber.nodea].typ;
    //         let typb = nodes[fiber.nodeb].typ;
    //         if (typa != PONNode.SPLITTER || typb != PONNode.SPLITTER) {

    //         } else {
    //             newFibers.push(fiber)
    //         }
    //     }
    //     this.fibers = newFibers
    // }

    public stage1centroids(): boolean {
        let somethingChanged = false;
        let nodes = this.nodes;
        let neighboursArr: number[][] = new Array(nodes.length);
        for (let i = 0; i < neighboursArr.length; i++) {
            neighboursArr[i] = [];
        }
        {
            let fibers = this.fibers;
            for (let i = 0; i < fibers.length; i++) {
                let fiber = fibers[i];
                let typ = nodes[fiber.nodea].typ;
                if (typ == PONNode.OLT || typ == PONNode.SPLITTER) {
                    neighboursArr[fiber.nodea].push(fiber.nodeb);
                }
            }
        }
        let nodesLength = nodes.length;

        for (let nodeID = 0; nodeID < nodesLength; nodeID++) {
            let node = nodes[nodeID];
            let typ = node.typ;
            let neighbours = neighboursArr[nodeID];
            // Dla kazdego OLT lub splittera szukamy gdzie postawic nowy splitter
            if (typ == PONNode.OLT || typ == PONNode.SPLITTER) {
                let costPre = SISAlgorithm.costOfOutgoing(nodes, node, neighbours);
                let maxBitmask = (1 << Math.min(10, neighbours.length)) - 1;

                let minimalNeighbours: number[] = [];
                let minimalSplitterNeighbours: number[] = [];
                let minimalCost = 999999999;
                let minimalSplitter = null;
                // Zlozonosc wyszukiwania minimalnej kombinacji to 2^n
                for (let mask = 0; mask <= maxBitmask; mask++) {


                    let newNeighbours = SISAlgorithm.extractFromMask(neighbours, mask);
                    let myNeighbours = SISAlgorithm.extractFromMask(neighbours, ~mask);
                    let sumx = node.posX;
                    let sumy = node.posY;
                    for (let j = 0; j < newNeighbours.length; j++) {
                        let neigh = nodes[neighbours[j]];
                        sumx += neigh.posX;
                        sumy += neigh.posY;
                    }
                    sumx = Math.floor(sumx / (1 + newNeighbours.length));
                    sumy = Math.floor(sumy / (1 + newNeighbours.length));

                    let splitter = new PONNode(sumx, sumy, PONNode.SPLITTER);
                    myNeighbours.push(nodes.length);
                    nodes.push(splitter);
                    let costPost = SISAlgorithm.costOfOutgoing(nodes, node, myNeighbours);
                    costPost += SISAlgorithm.costOfOutgoing(nodes, splitter, newNeighbours);
                    nodes.pop();




                    if (costPost < minimalCost) {
                        minimalCost = costPost;
                        minimalSplitter = splitter;
                        minimalNeighbours = myNeighbours;
                        minimalSplitterNeighbours = newNeighbours;
                    }
                }


                if (minimalCost < costPre) {
                    somethingChanged = true
                    let splitterID = nodes.length;
                    nodes.push(minimalSplitter);
                    neighboursArr.push([]);
                    neighboursArr[splitterID] = minimalSplitterNeighbours;
                    neighboursArr[nodeID] = minimalNeighbours;
                    let newFibers = [];
                    // remove old edges
                    for (let e = 0; e < this.fibers.length; e++) {
                        let fiber = this.fibers[e];
                        if (fiber.nodea != nodeID) {
                            newFibers.push(fiber);
                        }
                    }
                    // add new edges
                    for (const neigh of minimalNeighbours) {
                        newFibers.push(new PONFiber(nodeID, neigh));
                    }
                    for (const neigh of minimalSplitterNeighbours) {
                        newFibers.push(new PONFiber(splitterID, neigh));
                    }
                    //newFibers.push(new PONFiber(nodeID, splitterID));

                    this.fibers = newFibers;
                }


            }

        }

        return somethingChanged
    }

    static extractFromMask(neighbours: number[], mask: number): number[] {
        let arr = [];
        for (let j = 0; j < neighbours.length; j++) {
            if ((mask & (1 << j)) != 0) {
                arr.push(neighbours[j]);
            }
        }
        return arr;
    }

    static costOfOutgoing(nodes: PONNode[], node: PONNode, neighbours: number[]): number {
        let cost = 0;
        for (let i = 0; i < neighbours.length; i++) {
            let other = nodes[neighbours[i]];

            let dx = other.posX - node.posX;
            let dy = other.posY - node.posY;
            let distance = Math.sqrt(dx * dx + dy * dy);
            cost += distance;
        }
        return cost;
    }
}


