import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getNotionClient } from '@/lib/notion/client';
import { getModelClient } from '@/lib/ai/client';
import { prdToNotionBlocks, buildNotionPageProperties } from '@/lib/notion/blocks';
import { SYSTEM_PROMPT_UPDATE_PRD, buildUpdatePrdUserPrompt } from '@/lib/ai/prompts';

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
        const updatedPrdContent = JSON.parse(cleaned);

        // 3. Save Update Log in database and update PRD
        const newVersion = prdDoc.version + 1;

        await prisma.prdUpdateLog.create({
            data: {
                prdDocumentId: prdDoc.id,
                previousContent: prdDoc.contentJson,
                newContent: updatedPrdContent,
                changesSummary: instructions
            }
        });

        await prisma.prdDocument.update({
            where: { id: prdDoc.id },
            data: {
                contentJson: updatedPrdContent,
                version: newVersion,
                title: updatedPrdContent.title || prdDoc.title,
                status: 'published' // Ensure it's marked as published
            }
        });

        // 4. Update the Notion Page
        const notion = await getNotionClient();

        // Wait... we have to delete existing blocks first because Notion doesn't overwrite
        let hasMore = true;
        let nextCursor: string | undefined = undefined;
        while (hasMore) {
            const children: any = await notion.blocks.children.list({
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
        const blocks = prdToNotionBlocks(updatedPrdContent as any);
        const properties = buildNotionPageProperties(
            updatedPrdContent as any,
            newVersion,
            prdDoc.sourceSummary || undefined
        );

        // Append new blocks
        await notion.blocks.children.append({
            block_id: pageId,
            children: blocks as any,
        });

        // Update properties (Title, Status, Version, Last Updated, etc.)
        await notion.pages.update({
            page_id: pageId,
            properties: properties as any
        });

        return NextResponse.json({
            success: true,
            notionPageUrl: notionUrl,
            prdDocumentId: prdDoc.id,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Update Notion PRD error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
