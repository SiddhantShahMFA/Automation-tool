import { prisma } from './src/lib/db';

async function run() {
    await prisma.workspaceSettings.update({
        where: { id: 'default' },
        data: { notionDatabaseId: '31bda78b-28e7-809c-86c6-f56f1a5152f7' }
    });
    console.log("Updated DB");
}
run().catch(console.error);
