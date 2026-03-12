CREATE TABLE "prd_requirements" (
    "id" TEXT NOT NULL,
    "prdDocumentId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "displayId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prd_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "requirement_versions" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "prdVersion" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "requirement_changes" (
    "id" TEXT NOT NULL,
    "prdDocumentId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "prdVersion" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "oldVersionId" TEXT,
    "newVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_changes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jira_tickets" (
    "id" TEXT NOT NULL,
    "prdDocumentId" TEXT NOT NULL,
    "projectKey" TEXT,
    "issueKey" TEXT,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lastAction" TEXT NOT NULL DEFAULT 'CREATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jira_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jira_ticket_requirement_links" (
    "id" TEXT NOT NULL,
    "jiraTicketId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jira_ticket_requirement_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "artifact_versions" (
    "id" TEXT NOT NULL,
    "prdDocumentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prdVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sourceArtifactId" TEXT,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prd_requirements_prdDocumentId_stableKey_key" ON "prd_requirements"("prdDocumentId", "stableKey");
CREATE UNIQUE INDEX "jira_ticket_requirement_links_jiraTicketId_requirementId_key" ON "jira_ticket_requirement_links"("jiraTicketId", "requirementId");

ALTER TABLE "prd_requirements"
    ADD CONSTRAINT "prd_requirements_prdDocumentId_fkey"
    FOREIGN KEY ("prdDocumentId") REFERENCES "prd_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "requirement_versions"
    ADD CONSTRAINT "requirement_versions_requirementId_fkey"
    FOREIGN KEY ("requirementId") REFERENCES "prd_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "requirement_changes"
    ADD CONSTRAINT "requirement_changes_prdDocumentId_fkey"
    FOREIGN KEY ("prdDocumentId") REFERENCES "prd_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "requirement_changes"
    ADD CONSTRAINT "requirement_changes_requirementId_fkey"
    FOREIGN KEY ("requirementId") REFERENCES "prd_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "requirement_changes"
    ADD CONSTRAINT "requirement_changes_oldVersionId_fkey"
    FOREIGN KEY ("oldVersionId") REFERENCES "requirement_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "requirement_changes"
    ADD CONSTRAINT "requirement_changes_newVersionId_fkey"
    FOREIGN KEY ("newVersionId") REFERENCES "requirement_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jira_tickets"
    ADD CONSTRAINT "jira_tickets_prdDocumentId_fkey"
    FOREIGN KEY ("prdDocumentId") REFERENCES "prd_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "jira_ticket_requirement_links"
    ADD CONSTRAINT "jira_ticket_requirement_links_jiraTicketId_fkey"
    FOREIGN KEY ("jiraTicketId") REFERENCES "jira_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "jira_ticket_requirement_links"
    ADD CONSTRAINT "jira_ticket_requirement_links_requirementId_fkey"
    FOREIGN KEY ("requirementId") REFERENCES "prd_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "artifact_versions"
    ADD CONSTRAINT "artifact_versions_prdDocumentId_fkey"
    FOREIGN KEY ("prdDocumentId") REFERENCES "prd_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
