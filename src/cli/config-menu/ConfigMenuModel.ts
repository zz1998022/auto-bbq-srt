export interface ConfigMenuItem {
  readonly key: string;
  readonly label: string;
  readonly settingPrefix: string;
  readonly fields: readonly string[];
}

export const CONFIG_MENU_ITEMS: readonly ConfigMenuItem[] = [
  { key: '1', label: 'LLM Provider', settingPrefix: 'llm', fields: ['provider', 'apiKey', 'model', 'baseUrl'] }
  // 下面这些分组暂时只支持脚本化 set 存储，还没有完整接入 CLI 使用流程，先不暴露给交互菜单。
  // {
  //   key: '2',
  //   label: 'Translation',
  //   settingPrefix: 'translation',
  //   fields: ['sourceLanguage', 'targetLanguage', 'style', 'maxRetries', 'partialOutput']
  // },
  // {
  //   key: '3',
  //   label: 'Chunk',
  //   settingPrefix: 'chunk',
  //   fields: ['maxLines', 'maxChars', 'contextBeforeLines', 'contextAfterLines']
  // },
  // { key: '4', label: 'Cache', settingPrefix: 'cache', fields: ['enabled', 'type', 'dir'] },
  // { key: '5', label: 'Output', settingPrefix: 'output', fields: ['mode', 'bilingualOrder'] },
  // { key: '6', label: 'Logging', settingPrefix: 'logging', fields: ['level'] }
];

export const CONFIG_EXIT_KEY = '0';

export function renderConfigMenu(): string {
  const lines = ['Auto BBQ Options', ''];

  for (const item of CONFIG_MENU_ITEMS) {
    lines.push(`[${item.key}] ${item.label}`);
  }

  lines.push(`[${CONFIG_EXIT_KEY}] Exit`, '', `Press a key [1...${CONFIG_MENU_ITEMS.length} / ${CONFIG_EXIT_KEY}]:`);

  return lines.join('\n');
}

export function findConfigMenuItem(key: string): ConfigMenuItem | undefined {
  return CONFIG_MENU_ITEMS.find((item) => item.key === key);
}
