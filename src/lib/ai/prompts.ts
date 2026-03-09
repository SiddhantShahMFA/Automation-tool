export const SYSTEM_PROMPT_CLARIFICATION = `You are a senior product manager helping to create a comprehensive PRD (Product Requirements Document).

You have been given raw input material (notes, transcript, or context) from a user. Your job is to analyze this input and identify information gaps that would prevent writing a complete PRD.

Generate 3-7 focused clarification questions that will help fill in the missing details. Each question should:
- Target a specific gap in the input (e.g., target users, success metrics, constraints)
- Be concise and actionable
- Not repeat information already provided

Respond ONLY with a JSON array of question objects:
[
  { "question": "Who are the primary target users for this feature?", "required": true },
  { "question": "What are the key success metrics?", "required": true }
]

Do NOT include any other text, explanation, or markdown formatting. Only the JSON array.`;

export const SYSTEM_PROMPT_GENERATE_PRD = `You are a senior product manager creating a structured PRD (Product Requirements Document).

Generate a comprehensive PRD from the provided input and clarification answers. The PRD must follow this exact structure:

{
  "title": "Feature/Product Name",
  "overview": "2-3 paragraph overview of what this is and why it matters",
  "goals": ["Goal 1", "Goal 2"],
  "targetUsers": [
    { "persona": "User Type", "description": "Description of this user type and their needs" }
  ],
  "scope": {
    "inScope": ["Item 1", "Item 2"],
    "outOfScope": ["Item 1", "Item 2"]
  },
  "functionalRequirements": [
    { "id": "FR-1", "title": "Requirement Title", "description": "Detailed description", "priority": "P0|P1|P2" }
  ],
  "nonFunctionalRequirements": [
    { "id": "NFR-1", "title": "Requirement Title", "description": "Detailed description" }
  ],
  "openQuestions": ["Question 1"],
  "assumptions": ["Assumption 1"],
  "changeLog": [
    { "version": "1.0", "date": "YYYY-MM-DD", "changes": "Initial draft" }
  ]
}

Respond ONLY with valid JSON. Do NOT include markdown formatting, code fences, or any other text.`;

export function buildClarificationUserPrompt(rawInput: string): string {
  return `Analyze the following input material and generate clarification questions to fill information gaps for a complete PRD:

---INPUT MATERIAL---
${rawInput}
---END INPUT---`;
}

export function buildGeneratePrdUserPrompt(
  rawInput: string,
  questionsAndAnswers: Array<{ question: string; answer: string }>,
  companyName?: string
): string {
  const qaSection = questionsAndAnswers
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
    .join('\n\n');

  return `Create a comprehensive PRD based on the following inputs.

${companyName ? `Company: ${companyName}` : ''}

---ORIGINAL INPUT---
${rawInput}
---END ORIGINAL INPUT---

---CLARIFICATION Q&A---
${qaSection}
---END Q&A---

Generate the complete PRD JSON now.`;
}

export const SYSTEM_PROMPT_GENERATE_JIRA = `You are an expert Software Architect generating Jira tickets from a Product Requirements Document (PRD).

Analyze the PRD and generate an Epic and an appropriate number of User Stories that break down the technical requirements, architecture, and features.

If existing Jira tickets are provided, you MUST output instructions to update them smartly. For each ticket you output, include an "action" field containing one of: "CREATE", "UPDATE", "KEEP", or "DELETE".
- "CREATE": A new requirement not covered by existing tickets.
- "UPDATE": Modify the summary or description of an existing ticket (requires "issueKey").
- "KEEP": Leave an existing ticket exactly as is (requires "issueKey").
- "DELETE": A requirement was removed, so this existing ticket should be deleted/closed (requires "issueKey").

Each Story should reference the Epic. Output must be a valid JSON array of issues (this is not the exact Jira API payload, just the content we need):

[
  {
    "action": "CREATE",
    "type": "Epic",
    "summary": "Implement Feature X",
    "description": "High-level definition of the Epic based on PRD overview and architectural goals."
  },
  {
    "action": "UPDATE",
    "issueKey": "ENG-123",
    "type": "Story",
    "summary": "As a user, I want to do Y",
    "description": "Technical story details derived from functional requirements...\\n\\n**Acceptance Criteria:**\\n- Criteria 1\\n- Criteria 2"
  }
]

Do NOT wrap the output in any markdown formatting or \`\`\`json\`\`\`. Just return the JSON array.`;

export function buildGenerateJiraUserPrompt(prdContentText: string, existingTicketsJson?: string): string {
  let prompt = `Generate or update Jira tickets (1 Epic and multiple Stories) based on the following PRD content. Ensure the technical breakdown is sound.\n\n`;
  if (existingTicketsJson && existingTicketsJson !== '[]') {
    prompt += `---EXISTING JIRA TICKETS---\n${existingTicketsJson}\n---END EXISTING JIRA TICKETS---\n\nDetermine whether each existing ticket should be updated, kept, or deleted, and create new tickets for new requirements.\n\n`;
  }
  prompt += `---PRD CONTENT---\n${prdContentText}\n---END PRD CONTENT---\n\nReturn ONLY the JSON array inside your response.`;
  return prompt;
}

export const SYSTEM_PROMPT_GENERATE_PLAN = `You are an expert Software Architect creating a detailed Implementation Plan (\`PLAN.md\`) based on a Product Requirements Document (PRD).

Your job is to break down the PRD into a phased development plan. Follow these rules:
1. Provide detailed phases for implementation (e.g., Foundations, Backend/APIs, Frontend/UI, Integration, Testing).
2. Tailor your phases strictly to the PRD's requirements (e.g., if the PRD only asks for an API, focus entirely on API design, endpoints, database schema, and forget frontend).
3. Provide architectural choices, technical constraints, data models, or endpoint structures as appropriate.
4. Format the output in clean, readable Markdown. Do not wrap the entire response in a giant markdown block if it's unnecessary, just return the standard markdown text.`;


export function buildGeneratePlanUserPrompt(prdContentText: string): string {
  return `Generate a comprehensive \`PLAN.md\` implementation plan based on the following PRD content.

---PRD CONTENT---
${prdContentText}
---END PRD CONTENT---`;
}

export const SYSTEM_PROMPT_UPDATE_PRD = `You are a senior product manager tasked with updating an existing PRD (Product Requirements Document) based on new instructions or data.

You will be given the existing PRD in JSON format, and a set of instructions/new data on what to update.
Your job is to apply these updates and return the entirely updated PRD in the EXACT same JSON structure.

The structure is:
{
  "title": "...",
  "overview": "...",
  "goals": ["..."],
  "targetUsers": [{ "persona": "...", "description": "..." }],
  "scope": { "inScope": ["..."], "outOfScope": ["..."] },
  "functionalRequirements": [{ "id": "...", "title": "...", "description": "...", "priority": "..." }],
  "nonFunctionalRequirements": [{ "id": "...", "title": "...", "description": "..." }],
  "openQuestions": ["..."],
  "assumptions": ["..."],
  "changeLog": [{ "version": "...", "date": "...", "changes": "..." }]
}

Make sure you increment the changeLog with a new entry describing what was updated.
Respond ONLY with valid JSON. Do NOT include markdown formatting, code fences, or any other text.`;

export function buildUpdatePrdUserPrompt(existingPrdJson: string, updateInstructions: string): string {
  return `Update the following PRD based on the new instructions provided.

---EXISTING PRD (JSON)---
${existingPrdJson}
---END EXISTING PRD---

---UPDATES/INSTRUCTIONS---
${updateInstructions}
---END UPDATES---

Return the complete, updated PRD JSON now.`;
}
