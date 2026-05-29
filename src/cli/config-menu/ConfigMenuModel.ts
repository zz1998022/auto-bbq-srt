export interface ConfigMenuItem {
  readonly key: string;
  readonly label: string;
  readonly settingPrefix: string;
}

export const CONFIG_MENU_ITEMS: readonly ConfigMenuItem[] = [
  { key: '1', label: 'LLM Provider', settingPrefix: 'llm' },
  { key: '2', label: 'Translation', settingPrefix: 'translation' },
  { key: '3', label: 'Chunk', settingPrefix: 'chunk' },
  { key: '4', label: 'Cache', settingPrefix: 'cache' },
  { key: '5', label: 'Output', settingPrefix: 'output' },
  { key: '6', label: 'Logging', settingPrefix: 'logging' }
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
