import fs from 'node:fs';
import path from 'node:path';

export interface PromptMetadata {
  version: string;
  purpose: string;
  inputVariables: string[];
  changelog: string[];
}

export interface RenderedPrompt {
  promptText: string;
  promptVersion: string;
}

interface PromptTemplate {
  templateId: string;
  metadata: PromptMetadata;
  body: string;
}

function parseFrontMatter(frontMatter: string): Map<string, string | string[]> {
  const entries = new Map<string, string | string[]>();
  let currentListKey: string | undefined;

  for (const line of frontMatter.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const listItemMatch = trimmed.match(/^-\s+(.+)$/);

    if (listItemMatch && currentListKey) {
      const existing = entries.get(currentListKey);
      const list = Array.isArray(existing) ? existing : [];
      list.push(listItemMatch[1].trim());
      entries.set(currentListKey, list);
      continue;
    }

    currentListKey = undefined;

    const keyValueMatch = trimmed.match(/^([a-z_]+):\s*(.*)$/);

    if (!keyValueMatch) {
      throw new Error(`Invalid prompt metadata line: "${line}"`);
    }

    const key = keyValueMatch[1];
    const rawValue = keyValueMatch[2].trim();

    if (rawValue.length === 0) {
      currentListKey = key;
      entries.set(key, []);
      continue;
    }

    entries.set(key, rawValue);
  }

  return entries;
}

function parseTemplate(templateId: string, fileContent: string): PromptTemplate {
  const frontMatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontMatterMatch) {
    throw new Error(`Prompt template "${templateId}" is missing front matter.`);
  }

  const metadataEntries = parseFrontMatter(frontMatterMatch[1]);
  const version = metadataEntries.get('version');
  const purpose = metadataEntries.get('purpose');
  const inputVariables = metadataEntries.get('input_variables');
  const changelog = metadataEntries.get('changelog');

  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`Prompt template "${templateId}" must define a non-empty version.`);
  }

  if (typeof purpose !== 'string' || purpose.length === 0) {
    throw new Error(`Prompt template "${templateId}" must define a non-empty purpose.`);
  }

  if (!Array.isArray(inputVariables) || inputVariables.length === 0) {
    throw new Error(`Prompt template "${templateId}" must define input_variables.`);
  }

  const body = frontMatterMatch[2];
  const placeholders = [...body.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map((match) => match[1]);

  for (const variableName of inputVariables) {
    if (!placeholders.includes(variableName)) {
      throw new Error(
        `Prompt template "${templateId}" declares input variable "${variableName}" but does not use it in the template body.`
      );
    }
  }

  return {
    templateId,
    metadata: {
      version,
      purpose,
      inputVariables,
      changelog: Array.isArray(changelog) ? changelog : []
    },
    body
  };
}

export class PromptLoader {
  public constructor(private readonly promptsDirectory: string) {}

  public render(promptName: string, variables: Record<string, string>, version = 'v1'): RenderedPrompt {
    if (!/^[a-z0-9-]+$/.test(promptName)) {
      throw new Error(`Invalid prompt name "${promptName}".`);
    }

    if (!/^[a-z0-9-]+$/.test(version)) {
      throw new Error(`Invalid prompt version "${version}".`);
    }

    const templateId = `${promptName}-${version}`;
    const filePath = path.join(this.promptsDirectory, `${templateId}.md`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const template = parseTemplate(templateId, fileContent);
    const missingVariables = template.metadata.inputVariables.filter((variableName) => variables[variableName] === undefined);

    if (missingVariables.length > 0) {
      throw new Error(`Prompt template "${template.templateId}" is missing variables: ${missingVariables.join(', ')}`);
    }

    const promptText = template.body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, variableName: string) => {
      return variables[variableName] ?? '';
    });

    return {
      promptText,
      promptVersion: `${promptName}-${template.metadata.version}`
    };
  }
}
