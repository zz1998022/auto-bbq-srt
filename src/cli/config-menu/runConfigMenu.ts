import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { LocalCliConfigStore, renderConfig, type CliConfig } from '../../infrastructure/config/LocalCliConfigStore.js';
import { CONFIG_EXIT_KEY, findConfigMenuItem, renderConfigMenu, type ConfigMenuItem } from './ConfigMenuModel.js';

export async function runConfigMenu(store = new LocalCliConfigStore()): Promise<void> {
  const rl = createInterface({ input, output });

  try {
    while (true) {
      const choice = (await rl.question(`${renderConfigMenu()} `)).trim();

      if (choice === CONFIG_EXIT_KEY || choice === '') {
        return;
      }

      const item = findConfigMenuItem(choice);

      if (!item) {
        console.log('无效选项，请重新输入。');
        continue;
      }

      await runConfigGroupMenu(rl, store, item);
    }
  } finally {
    rl.close();
  }
}

async function runConfigGroupMenu(
  rl: ReturnType<typeof createInterface>,
  store: LocalCliConfigStore,
  item: ConfigMenuItem
): Promise<void> {
  while (true) {
    const config = await store.load();
    const answer = (await rl.question(`${renderGroup(item, config)}\nEnter setting [key=value / 0 back]: `)).trim();

    if (answer === CONFIG_EXIT_KEY || answer === '') {
      return;
    }

    const setting = answer.includes('.') ? answer : `${item.settingPrefix}.${answer}`;
    await store.setSettings([setting]);
    console.log('已保存。');
  }
}

function renderGroup(item: ConfigMenuItem, config: CliConfig): string {
  const lines = [`${item.label} Settings`, ''];

  for (const field of item.fields) {
    lines.push(`${item.settingPrefix}.${field} = ${renderFieldValue(config, item.settingPrefix, field)}`);
  }

  return lines.join('\n');
}

function renderFieldValue(config: CliConfig, prefix: string, field: string): string {
  const group = config[prefix];

  if (!group || typeof group !== 'object' || Array.isArray(group)) {
    return '<empty>';
  }

  const rendered = renderConfig({ [field]: (group as CliConfig)[field] });
  const parsed = JSON.parse(rendered) as Record<string, unknown>;
  const value = parsed[field];

  return value === undefined ? '<empty>' : String(value);
}
