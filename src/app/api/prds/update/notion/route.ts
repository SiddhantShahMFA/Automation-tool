import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getNotionClient } from '@/lib/notion/client';
import { getModelClient } from '@/lib/ai/client';
import { prdToNotionBlocks, buildNotionPageProperties } from '@/lib/notion/blocks';
import { SYSTEM_PROMPT_UPDATE_PRD, buildUpdatePrdUserPrompt } from '@/lib/ai/prompts';
import {
    CANONICAL_SCHEMA_REQUIRED_MESSAGE,
    createArtifactVersion,
    ensureCanonicalPrdState,
    getCanonicalSchemaStatus,
    syncCanonicalPrdState,
} from '@/lib/prd/canonical';
import type { PrdContent } from '@/lib/prd/types';

function extractNotionPageId(url: string): string | null {
    try {
        const urlObj = new URL(url);
        // e.g. https://notion.so/Page-Title-1234567890abcdef1234567890abcdef
        // or https://www.notion.so/workspace/1234567890abcdef1234567890abcdef
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (!lastSegment) return null;

        // The ID is usually the last 32 chars
        const match = lastSegment.match(/([a-f0-9]{32})$/i);
        if (match) {
            return match[1];
        }
        return null; // unable to parse
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const { notionUrl, instructions } = await request.json();

        if (!notionUrl || !instructions) {
            return NextResponse.json(
                { error: 'notionUrl and instructions are required' },
                { status: 400 }
            );
        }

        const pageId = extractNotionPageId(notionUrl);
        if (!pageId) {
            return NextResponse.json(
                { error: 'Invalid Notion URL provided' },
                { status: 400 }
            );
        }

        // 1. Find the PRD locally using the notion URL or page ID
        const prdDoc = await prisma.prdDocument.findFirst({
            where: {
                OR: [
                    { notionPageId: pageId },
                    { notionPageUrl: { contains: pageId } }
                ]
            }
        });

        if (!prdDoc || !prdDoc.contentJson) {
            return NextResponse.json(
                { error: 'PRD not found in local database. Only PRDs generated via this tool can be updated right now.' },
                { status: 404 }
            );
        }

        const canonicalSchema = await getCanonicalSchemaStatus();
        if (canonicalSchema.ready) {
            await ensureCanonicalPrdState(prdDoc.id);
        }

        const existingPrdJson = JSON.stringify(prdDoc.contentJson);

        // 2. Call AI to generate updated PRD content
        const { client, model } = await getModelClient();

        const completion = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT_UPDATE_PRD },
                { role: 'user', content: buildUpdatePrdUserPrompt(existingPrdJson, instructions) }
            ],
            temperature: 0.5,
            max_tokens: 8000,
        });

        const content = completion.choices[0]?.message?.content || '{}';
        const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
        const updatedPrdContent = JSON.parse(cleaned) as PrdContent;

        // 3. Save Update Log in database and update PRD
        const newVersion = prdDoc.version + 1;

        await prisma.prdUpdateLog.create({
            data: {
                prdDocumentId: prdDoc.id,
                previousContent: prdDoc.contentJson,
                newContent: updatedPrdContent as unknown as Prisma.InputJsonValue,
                changesSummary: instructions
            }
        });

        await prisma.prdDocument.update({
            where: { id: prdDoc.id },
            data: {
                contentJson: updatedPrdContent as unknown as Prisma.InputJsonValue,
                version: newVersion,
                title: updatedPrdContent.title || prdDoc.title,
                status: 'published' // Ensure it's marked as published
            }
        });

        const syncResult = canonicalSchema.ready
            ? await syncCanonicalPrdState({
                prdDocumentId: prdDoc.id,
                prdContent: updatedPrdContent,
                prdVersion: newVersion,
                changeSummary: instructions,
            })
            : { changedRequirementIds: [] as string[], artifactVersionIds: [] as string[] };

        // 4. Update the Notion Page
        const notion = await getNotionClient();

        // Wait... we have to delete existing blocks first because Notion doesn't overwrite
        let hasMore = true;
        let nextCursor: string | undefined = undefined;
        while (hasMore) {
            const children = await notion.blocks.children.list({
                block_id: pageId,
                start_cursor: nextCursor,
            });

            // Delete them all
            for (const childBlock of children.results) {
                try {
                    await notion.blocks.delete({ block_id: childBlock.id });
                } catch (delErr) {
                    console.error('Failed to delete block:', childBlock.id, delErr);
                }
            }

            hasMore = children.has_more;
            nextCursor = children.next_cursor || undefined;
        }

        // Add the new blocks
        const blocks = prdToNotionBlocks(updatedPrdContent);
        const properties = buildNotionPageProperties(
            updatedPrdContent,
            newVersion,
            prdDoc.sourceSummary || undefined
        );

        // Append new blocks
        await notion.blocks.children.append({
            block_id: pageId,
            children: blocks as never,
        });

        // Update properties (Title, Status, Version, Last Updated, etc.)
        await notion.pages.update({
            page_id: pageId,
            properties: properties as never
        });

        const artifactVersion = canonicalSchema.ready
            ? await createArtifactVersion({
                prdDocumentId: prdDoc.id,
                type: 'notion_publish',
                prdVersion: newVersion,
                status: 'published',
                payloadJson: {
                    notionPageId: pageId,
                    notionPageUrl: notionUrl,
                    changedRequirementIds: syncResult.changedRequirementIds,
                },
            })
            : null;

        await prisma.auditEvent.create({
            data: {
                action: 'prd_updated',
                entityType: 'prd_document',
                entityId: prdDoc.id,
                metadata: {
                    projectId: prdDoc.projectId,
                    prdVersion: newVersion,
                    changedRequirementIds: syncResult.changedRequirementIds,
                    artifactVersionIds: syncResult.artifactVersionIds,
                    notionArtifactVersionId: artifactVersion?.id || null,
                },
            },
        });

        return NextResponse.json({
            success: true,
            notionPageUrl: notionUrl,
            prdDocumentId: prdDoc.id,
            projectId: prdDoc.projectId,
            version: newVersion,
            changedRequirementIds: syncResult.changedRequirementIds,
            artifactVersionIds: artifactVersion ? [...syncResult.artifactVersionIds, artifactVersion.id] : syncResult.artifactVersionIds,
            canonicalSchemaReady: canonicalSchema.ready,
            warning: canonicalSchema.ready ? null : CANONICAL_SCHEMA_REQUIRED_MESSAGE,
            missingTables: canonicalSchema.ready ? [] : canonicalSchema.missingTables,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Update Notion PRD error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
