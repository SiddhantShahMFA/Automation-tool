import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getNotionClient } from '@/lib/notion/client';
import { prdToNotionBlocks, buildNotionPageProperties } from '@/lib/notion/blocks';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: prdId } = await params;

        const prdDoc = await prisma.prdDocument.findUnique({
            where: { id: prdId },
        });

        if (!prdDoc) {
            return NextResponse.json({ error: 'PRD document not found' }, { status: 404 });
        }

        // Idempotency: if already published, return existing URL
        if (prdDoc.notionPageId && prdDoc.notionPageUrl) {
            return NextResponse.json({
                success: true,
                alreadyPublished: true,
                notionPageId: prdDoc.notionPageId,
                notionPageUrl: prdDoc.notionPageUrl,
            });
        }

        if (!prdDoc.contentJson) {
            return NextResponse.json(
                { error: 'PRD has no content to publish. Generate it first.' },
                { status: 400 }
            );
        }

        const settings = await prisma.workspaceSettings.findUnique({
            where: { id: 'default' },
        });

        if (!settings?.notionDatabaseId) {
            return NextResponse.json(
                { error: 'Notion database not configured. Complete setup first.' },
                { status: 400 }
            );
        }

        const notion = await getNotionClient();
        const prdContent = prdDoc.contentJson as unknown;

        // Build Notion page
        const blocks = prdToNotionBlocks(prdContent as Parameters<typeof prdToNotionBlocks>[0]);
        const properties = buildNotionPageProperties(
            prdContent as Parameters<typeof buildNotionPageProperties>[0],
            prdDoc.version,
            prdDoc.sourceSummary || undefined
        );

        // Create page in Notion
        const page = await notion.pages.create({
            parent: { database_id: settings.notionDatabaseId },
            properties: properties as any,
            children: blocks,
        });

        // Extract URL
        const notionPageUrl = 'url' in page ? (page.url as string) : `https://notion.so/${page.id.replace(/-/g, '')}`;

        // Update local record
        await prisma.prdDocument.update({
            where: { id: prdId },
            data: {
                notionPageId: page.id,
                notionPageUrl,
                status: 'published',
            },
        });

        // Audit event
        await prisma.auditEvent.create({
            data: {
                action: 'prd_published',
                entityType: 'prd_document',
                entityId: prdId,
                metadata: { notionPageId: page.id, notionPageUrl },
            },
        });

        return NextResponse.json({
            success: true,
            notionPageId: page.id,
            notionPageUrl,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Publish error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
