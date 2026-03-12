import { Client } from '@notionhq/client';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export interface NotionConfig {
    token: string;
}

export async function getNotionClient(): Promise<Client> {
    const credential = await prisma.integrationCredential.findUnique({
        where: { type: 'notion' },
    });

    if (!credential) {
        throw new Error('Notion integration not configured. Complete setup first.');
    }

    const config: NotionConfig = JSON.parse(decrypt(credential.encryptedConfig));
    return new Client({ auth: config.token });
}

export async function verifyNotionToken(
    token: string
): Promise<{
    valid: boolean;
    databases: Array<{ id: string; title: string }>;
    error?: string;
}> {
    try {
        const client = new Client({ auth: token });

        // Verify the token by checking the bot user
        await client.users.me({});

        // Search for databases accessible to this integration
        const searchResult = await client.search({
            page_size: 50,
        });

        console.log("== RAW NOTION DOCS ==");
        searchResult.results.forEach(r => {
            console.log(`Type: ${r.object}, ID: ${r.id}, Title: ${'title' in r ? JSON.stringify(r.title) : 'none'}`);
        });

        const searchableResults = searchResult.results as Array<Record<string, unknown>>;

        const databases = searchableResults
            .filter((result) => result.object === 'database' || result.object === 'data_source')
            .map((db) => {
                const titleProp = Array.isArray(db.title) ? db.title : [];
                let titleStr = '';
                if (Array.isArray(titleProp)) {
                    titleStr = titleProp.map((t: { plain_text?: string }) => t.plain_text || '').join('');
                }
                const dbWithName = db as { id: string; object: string; name?: string; parent?: { type?: string; database_id?: string } };
                const finalTitle = titleStr || dbWithName.name || 'Untitled';

                let realId = typeof dbWithName.id === 'string' ? dbWithName.id : '';
                if (db.object === 'data_source' && dbWithName.parent?.type === 'database_id') {
                    realId = dbWithName.parent.database_id || String(db.id);
                }

                return { id: String(realId), title: finalTitle };
            });

        return { valid: true, databases };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { valid: false, databases: [], error: `Notion verification failed: ${message}` };
    }
}
