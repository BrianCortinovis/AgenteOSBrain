export declare function getAllDefinitions(): any[];
export declare function getDefinitionById(connectorId: string): any;
export declare function getInstancesByProject(projectId: string): unknown[];
export declare function createInstance(projectId: string, data: any): unknown;
export declare function updateInstance(id: string, data: any): unknown;
export declare function deleteInstance(id: string): void;
export declare function getAllConfiguredInstances(): unknown[];
export declare function getConfiguredInstance(id: string): unknown;
export declare function createConfiguredInstance(data: any): unknown;
export declare function updateConfiguredInstance(id: string, data: any): unknown;
export declare function deleteConfiguredInstance(id: string): void;
export declare function testConnection(connectorId: string, config: Record<string, any>): Promise<{
    success: boolean;
    message: string;
}>;
