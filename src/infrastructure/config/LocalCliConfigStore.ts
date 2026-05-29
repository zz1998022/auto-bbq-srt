import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { ConfigError } from '../../shared/errors/AppError.js';

export type CliConfig = Record<string, unknown>;

export interface ParsedSetting {
  key: string;
  value: unknown;
}

export class LocalCliConfigStore {
  constructor(private readonly configPath = resolveDefaultConfigPath()) {}

  async load(): Promise<CliConfig> {
    try {
      const content = await readFile(this.configPath, 'utf8');
      const parsed = JSON.parse(content) as unknown;

      if (!isRecord(parsed)) {
        throw new ConfigError('本地配置文件格式错误：顶层必须是对象。');
      }

      return parsed;
    } catch (error) {
      if (isNotFoundError(error)) {
        return {};
      }

      throw error;
    }
  }

  async save(config: CliConfig): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  }

  async setSettings(settings: string[]): Promise<CliConfig> {
    const config = await this.load();

    for (const setting of settings) {
      applySetting(config, parseSetting(setting));
    }

    await this.save(config);
    return config;
  }
}

export function resolveDefaultConfigPath(): string {
  return process.env.AUTO_BBQ_CONFIG_PATH ?? join(homedir(), '.auto-bbq', 'config.json');
}

export function parseSetting(setting: string): ParsedSetting {
  const separatorIndex = setting.indexOf('=');

  if (separatorIndex <= 0) {
    throw new ConfigError(`配置项格式错误：${setting}，请使用 key=value。`);
  }

  const key = setting.slice(0, separatorIndex).trim();
  const rawValue = setting.slice(separatorIndex + 1).trim();

  if (!isValidSettingKey(key)) {
    throw new ConfigError(`配置项 key 不合法：${key}`);
  }

  return {
    key,
    value: parseSettingValue(rawValue)
  };
}

export function applySetting(config: CliConfig, setting: ParsedSetting): void {
  const parts = setting.key.split('.');
  let cursor: CliConfig = config;

  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];

    if (next === undefined) {
      cursor[part] = {};
    } else if (!isRecord(next)) {
      throw new ConfigError(`配置路径冲突：${setting.key}`);
    }

    cursor = cursor[part] as CliConfig;
  }

  const leaf = parts.at(-1);

  if (!leaf) {
    throw new ConfigError(`配置项 key 不合法：${setting.key}`);
  }

  cursor[leaf] = setting.value;
}

export function maskSecrets(config: CliConfig): CliConfig {
  return maskValue(config) as CliConfig;
}

export function renderConfig(config: CliConfig): string {
  return JSON.stringify(maskSecrets(config), null, 2);
}

function parseSettingValue(value: string): unknown {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (value === 'null') {
    return null;
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return stripMatchingQuotes(value);
}

function stripMatchingQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function maskValue(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskValue(item));
  }

  if (!isRecord(value)) {
    return shouldMaskKey(key) && typeof value === 'string' ? maskSecret(value) : value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [entryKey, maskValue(entryValue, entryKey)])
  );
}

function maskSecret(value: string): string {
  if (value.length <= 8) {
    return '********';
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function shouldMaskKey(key: string): boolean {
  return /api[-_]?key|apikey|secret|token/i.test(key);
}

function isValidSettingKey(key: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/.test(key);
}

function isRecord(value: unknown): value is CliConfig {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}
