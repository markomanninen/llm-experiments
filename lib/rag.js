const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, useDefaults: true });

const { RAGApplicationBuilder, Ollama, LocalEmbeddings, TextLoader, YoutubeLoader, PdfLoader, WebLoader, JsonLoader, BaseLoader, YoutubeChannelLoader, YoutubeSearchLoader, SitemapLoader, ConfluenceLoader } = require('@llm-tools/embedjs');
const { HNSWDb } = require('@llm-tools/embedjs/vectorDb/hnswlib');
const { LanceDb } = require('@llm-tools/embedjs/vectorDb/lance');
const { LmdbCache } = require('@llm-tools/embedjs/cache/lmdb');

const indexSourcesSchema = require('../tools/rag/schemas/index_sources.json');

const serverUrl = 'http://localhost:5000/embed';
const dimensions = 384;
const searchResultCount = 30;

// Define the full schema as provided
const schema = {
    "description": "Schema for configuring data loaders from various sources using the @llm-tools/embedjs library.",
    "type": "object",
    "properties": indexSourcesSchema.arguments.properties,
    "required": ["loaders"],
    "additionalProperties": false
};

// Map loader names to their classes
const loaderMap = {
    TextLoader,
    YoutubeLoader,
    PdfLoader,
    WebLoader,
    JsonLoader,
    BaseLoader,
    YoutubeChannelLoader,
    YoutubeSearchLoader,
    SitemapLoader,
    ConfluenceLoader
};

let llmApplication = null;

async function initRAG() {
    if (!llmApplication) {
        llmApplication = await new RAGApplicationBuilder()
            .setEmbeddingModel(new LocalEmbeddings(serverUrl, dimensions))
            .setModel(new Ollama({
                modelName: 'llama3',
                baseUrl: 'http://localhost:11434'
            }))
            .setSearchResultCount(searchResultCount)
            //.setVectorDb(new HNSWDb())
            .setVectorDb(new LanceDb({ path: '.db' }))
            .setCache(new LmdbCache({ path: './llmcache' }))
            .build();
    }
}

async function indexSourcesRAG({ loaders }) {

    await initRAG();
    
    let logs = [];

    try {
        const validate = ajv.compile(schema);
        if (!validate({ loaders })) {
            throw new Error(`Configuration validation failed: ${ajv.errorsText(validate.errors)}`);
        }

        for (const loader of loaders) {
            try {
                const LoaderClass = loaderMap[loader.type];
                if (!LoaderClass) {
                    throw new Error(`Loader type ${loader.type} not found.`);
                }
                await llmApplication.addLoader(new LoaderClass(loader.config));
                console.log('\x1b[33m%s\x1b[0m', '   Indexing:', loader.type);
                logs.push(`Added loader ${loader.type} for indexing with arguments: ${JSON.stringify(loader.config)}.`);
            } catch (error) {
                logs.push(`Failed to dynamically load module ${loader.type}:`, error);
            }
        }

        return { success: true, message: logs.join('\n') };
    } catch (error) {
        console.error('Error with embedding sources:', error);
        return { success: false, message: "Failed to embed sources.", error };
    }
}

async function findSourcesRAG({ query }) {
    
    if (!query) return { success: false, message: "Query not provided." };

    await initRAG();

    try {
        const response = await llmApplication.query(query);
        console.log(`\x1b[33m   ${response.result}\x1b[0m`);
        return { success: true, message: response.result };
    } catch (error) {
        console.error('Error with searching sources:', error);
        return { success: false, message: "Failed to search sources.", error };
    }
}

module.exports = {
    indexSourcesRAG,
    findSourcesRAG
};

