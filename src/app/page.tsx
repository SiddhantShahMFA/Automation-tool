import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function HomePage() {
  let setupComplete = false;

  try {
    const settings = await prisma.workspaceSettings.findUnique({
      where: { id: 'default' },
    });
    setupComplete = settings?.setupCompleted ?? false;
  } catch {
    // DB may not be migrated yet — redirect to setup
  }

  if (setupComplete) {
    redirect('/projects');
  } else {
    redirect('/setup');
  }
}
