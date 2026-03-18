type ExecutionLog = {
    nodeId: string;
    label: string;
    status: string;
    output: string;
    duration: number;
};
export declare function getExecutionState(projectId: string): "running" | "paused" | "stopping" | "idle";
export declare function pauseProject(projectId: string): boolean;
export declare function resumeProject(projectId: string): boolean;
export declare function stopProject(projectId: string): boolean;
export declare function recordHTMLToVideo(htmlPath: string, outputPath: string, durationSec?: number): Promise<string>;
export declare function executeProject(projectId: string, onProgress?: (log: ExecutionLog) => void, onNodeStart?: (nodeId: string, label: string) => void): Promise<ExecutionLog[]>;
export declare function executeNode(projectId: string, nodeId: string): Promise<ExecutionLog>;
export declare function htmlToVideo(projectId: string, htmlFileName: string, durationSec?: number): Promise<string>;
export {};
