export declare function getGraph(projectId: string): {
    nodes: unknown[];
    edges: unknown[];
};
export declare function saveGraph(projectId: string, data: {
    nodes: any[];
    edges: any[];
}): {
    nodes: unknown[];
    edges: unknown[];
};
export declare function createNode(projectId: string, data: any): unknown;
export declare function updateNode(id: string, data: any): unknown;
export declare function deleteNode(id: string): void;
export declare function createEdge(projectId: string, data: any): unknown;
export declare function deleteEdge(id: string): void;
