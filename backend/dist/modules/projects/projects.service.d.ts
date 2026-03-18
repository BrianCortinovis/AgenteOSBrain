export declare function getAllProjects(): unknown[];
export declare function getProjectById(id: string): unknown;
export declare function createProject(data: {
    name: string;
    description?: string;
}): unknown;
export declare function updateProject(id: string, data: Partial<{
    name: string;
    description: string;
    status: string;
}>): unknown;
export declare function deleteProject(id: string): void;
export declare function duplicateProject(id: string): unknown;
