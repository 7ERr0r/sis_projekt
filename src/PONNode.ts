


export class PONNode {
    public static OLT = 0;
    public static ONU = 1;
    public static SPLITTER = 2;

    // 0 - OLT
    // 1 - ONU
    // 2 - splitter
    public typ: number;

    public posX: number;
    public posY: number;

    public debug: string;




    public constructor(posX: number, posY: number, typ: number) {
        this.posX = posX;
        this.posY = posY;
        this.typ = typ;
        this.debug = "";
    }

    public static typToString(typ: number) {
        if(typ == 0) {
            return "OLT";
        }
        if(typ == 1) {
            return "ONU";
        }
        if(typ == 2) {
            return "SPLITTER";
        }
    }
    public static stringToTyp(name: string) {
        if(name == "OLT") {
            return 0;
        }
        if(name == "ONU") {
            return 1;
        }
        if(name == "SPLITTER") {
            return 2;
        }
    }
    public static closestNodeTo(nodes: PONNode[], targetx: number, targety: number): PONNode {

        let closestNode = null;
        let closestDistance = 999999999;
        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];

            let dx = node.posX - targetx;
            let dy = node.posY - targety;
            let distance = dx * dx + dy * dy;

            if (distance < closestDistance) {
                closestDistance = distance;
                closestNode = node;
            }
        }
        return closestNode;
    }

}

