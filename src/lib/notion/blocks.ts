import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

interface PrdContent {
    title: string;
    overview: string;
    goals: string[];
    targetUsers: Array<{ persona: string; description: string }>;
    scope: { inScope: string[]; outOfScope: string[] };
    functionalRequirements: Array<{ id: string; title: string; description: string; priority: string }>;
    nonFunctionalRequirements: Array<{ id: string; title: string; description: string }>;
    openQuestions: string[];
    assumptions: string[];
    changeLog: Array<{ version: string; date: string; changes: string }>;
}

function heading2(text: string): BlockObjectRequest {
    return {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: {
            rich_text: [{ type: 'text' as const, text: { content: text } }],
        },
    };
}

function heading3(text: string): BlockObjectRequest {
    return {
        object: 'block' as const,
        type: 'heading_3' as const,
        heading_3: {
            rich_text: [{ type: 'text' as const, text: { content: text } }],
        },
    };
}

function paragraph(text: string): BlockObjectRequest {
    return {
        object: 'block' as const,
        type: 'paragraph' as const,
        paragraph: {
            rich_text: [{ type: 'text' as const, text: { content: text } }],
        },
    };
}

function bulletItem(text: string): BlockObjectRequest {
    return {
        object: 'block' as const,
        type: 'bulleted_list_item' as const,
        bulleted_list_item: {
            rich_text: [{ type: 'text' as const, text: { content: text } }],
        },
    };
}

function divider(): BlockObjectRequest {
    return {
        object: 'block' as const,
        type: 'divider' as const,
        divider: {},
    };
}

export function prdToNotionBlocks(prd: PrdContent): BlockObjectRequest[] {
    const blocks: BlockObjectRequest[] = [];

    // Overview
    blocks.push(heading2('Overview'));
    blocks.push(paragraph(prd.overview));
    blocks.push(divider());

    // Goals
    blocks.push(heading2('Goals'));
    for (const goal of prd.goals) {
        blocks.push(bulletItem(goal));
    }
    blocks.push(divider());

    // Target Users
    blocks.push(heading2('Target Users'));
    for (const user of prd.targetUsers) {
        blocks.push(heading3(user.persona));
        blocks.push(paragraph(user.description));
    }
    blocks.push(divider());

    // Scope
    blocks.push(heading2('Scope'));
    blocks.push(heading3('In Scope'));
    for (const item of prd.scope.inScope) {
        blocks.push(bulletItem(item));
    }
    blocks.push(heading3('Out of Scope'));
    for (const item of prd.scope.outOfScope) {
        blocks.push(bulletItem(item));
    }
    blocks.push(divider());

    // Functional Requirements
    blocks.push(heading2('Functional Requirements'));
    for (const req of prd.functionalRequirements) {
        blocks.push(heading3(`${req.id}: ${req.title} [${req.priority}]`));
        blocks.push(paragraph(req.description));
    }
    blocks.push(divider());

    // Non-Functional Requirements
    blocks.push(heading2('Non-Functional Requirements'));
    for (const req of prd.nonFunctionalRequirements) {
        blocks.push(heading3(`${req.id}: ${req.title}`));
        blocks.push(paragraph(req.description));
    }
    blocks.push(divider());

    // Open Questions
    blocks.push(heading2('Open Questions'));
    for (const q of prd.openQuestions) {
        blocks.push(bulletItem(q));
    }

    // Assumptions
    blocks.push(heading2('Assumptions'));
    for (const a of prd.assumptions) {
        blocks.push(bulletItem(a));
    }
    blocks.push(divider());

    // Change Log
    blocks.push(heading2('Change Log'));
    for (const entry of prd.changeLog) {
        blocks.push(bulletItem(`v${entry.version} (${entry.date}): ${entry.changes}`));
    }

    return blocks;
}

export function buildNotionPageProperties(
    prd: PrdContent,
    version: number,
    sourceSummary?: string
) {
    return {
        Title: {
            title: [{ text: { content: prd.title } }],
        },
        Status: {
            rich_text: [{ text: { content: 'Published' } }],
        },
        Version: {
            number: version,
        },
        'Last Updated': {
            date: { start: new Date().toISOString() },
        },
        'Source Summary': {
            rich_text: [{ text: { content: (sourceSummary || '').slice(0, 2000) } }],
        },
    };
}
