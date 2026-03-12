export interface PrdRequirementContent {
    id?: string;
    title: string;
    description: string;
    priority?: string;
}

export interface PrdContent {
    title: string;
    overview: string;
    goals: string[];
    targetUsers: Array<{ persona: string; description: string }>;
    scope: { inScope: string[]; outOfScope: string[] };
    functionalRequirements: PrdRequirementContent[];
    nonFunctionalRequirements: PrdRequirementContent[];
    openQuestions: string[];
    assumptions: string[];
    changeLog: Array<{ version: string; date: string; changes: string }>;
}

export interface NormalizedRequirementInput {
    category: 'functional' | 'non_functional';
    displayId: string | null;
    title: string;
    description: string;
    priority: string | null;
}

export interface TimelineEntry {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
