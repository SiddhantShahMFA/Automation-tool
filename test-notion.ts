import { Client } from '@notionhq/client';
import { prisma } from './src/lib/db';
import { decrypt } from './src/lib/encryption';

async function run() {
    const credential = await prisma.integrationCredential.findUnique({
        where: { type: 'notion' },
    });
    if (!credential) {
        console.log('No notion credential found in local DB');
        return;
    }
    const config = JSON.parse(decrypt(credential.encryptedConfig));
    const token = config.token;

    console.log('Token starts with:', token.substring(0, 15) + '...');

    const client = new Client({ auth: token });
    try {
        const res = await client.search({ page_size: 100 });
        console.log(`Found ${res.results.length} total results from search API`);

        for (const r of res.results) {
            console.log(`- Type: ${r.object}`);
            if ('title' in r) {
                console.log('  Title prop exists:', JSON.stringify(r.title));
            }
            if ('properties' in r) {
                console.log('  Properties exist on this object');
            }
        }

        const dbs = res.results.filter(r => (r as any).object === 'database');
        console.log(`\nFiltered specifically to databases: ${dbs.length}`);
    } catch (e) {
        console.error('Error fetching:', e);
    }
}
run().catch(console.error);
