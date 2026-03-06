import { Client } from '@notionhq/client';
import { prisma } from './src/lib/db';
import { decrypt } from './src/lib/encryption';

async function run() {
    const credential = await prisma.integrationCredential.findUnique({
        where: { type: 'notion' },
    });
    if (!credential) return;
    const config = JSON.parse(decrypt(credential.encryptedConfig));
    const client = new Client({ auth: config.token });

    const res = await client.search({ page_size: 10 });
    const dbs = res.results.filter((r) => r.object === 'data_source' || r.object === 'database');

    if (dbs.length > 0) {
        console.log("FIRST DB OBJECT:");
        console.log(JSON.stringify(dbs[0], null, 2));
    } else {
        console.log("No DBs found in search");
    }
}
run().catch(console.error);
