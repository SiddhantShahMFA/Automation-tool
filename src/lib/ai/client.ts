import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export interface ModelConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
    headersJson?: string;
}

export async function getModelClient(): Promise<{ client: OpenAI; model: string }> {
    const credential = await prisma.integrationCredential.findUnique({
        where: { type: 'model' },
    });

    if (!credential) {
        throw new Error('Model provider not configured. Complete setup first.');
    }

    const config: ModelConfig = JSON.parse(decrypt(credential.encryptedConfig));

    const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        defaultHeaders: config.headersJson
            ? JSON.parse(config.headersJson)
            : undefined,
    });

    return { client, model: config.model };
}

export async function verifyModelConfig(config: ModelConfig): Promise<{ valid: boolean; error?: string }> {
    try {
        const client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            defaultHeaders: config.headersJson
                ? JSON.parse(config.headersJson)
                : undefined,
        });

        const response = await client.chat.completions.create({
            model: config.model,
            messages: [{ role: 'user', content: 'Reply with OK' }],
            max_tokens: 5,
        });

        if (response.choices?.[0]?.message) {
            return { valid: true };
        }

        return { valid: false, error: 'Unexpected response from model endpoint.' };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { valid: false, error: `Model verification failed: ${message}` };
    }
}
