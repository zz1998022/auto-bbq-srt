# auto-bbq-srt

## 技术栈

- Runtime: Node.js 20+
- Language: TypeScript + ESM
- Package Manager: pnpm
- CLI: commander
- Build: tsup
- Test: Vitest
- Lint / Format: ESLint + Prettier
- Git Hooks: Husky
- LLM Provider: OpenAI / Anthropic / OpenAI-compatible / Mock

## 项目结构

```text
auto-bbq-srt/
├─ bin/
│  └─ auto-bbq.ts                 # CLI 可执行入口
├─ src/
│  ├─ app/                         # 应用用例层，编排翻译和恢复任务
│  │  ├─ ResumeTranslationUseCase.ts # 恢复已有翻译任务
│  │  └─ TranslateSubtitleUseCase.ts # 执行单个字幕翻译任务
│  ├─ cli/                         # CLI 命令注册和交互入口
│  │  ├─ cli.ts                    # commander 主程序
│  │  ├─ commands/                 # translate / resume / inspect 等命令
│  │  └─ config-menu/              # 编号式配置菜单模型
│  ├─ domain/                      # 纯领域模型和接口
│  │  ├─ llm/                      # LLM 统一接口
│  │  ├─ subtitle/                 # 字幕文档、字幕行、时间轴等模型
│  │  └─ translation/              # 翻译任务、chunk、校验结果等模型
│  ├─ infrastructure/              # 文件系统、缓存、JobStore 等基础设施
│  │  ├─ cache/                    # chunk 级翻译缓存
│  │  ├─ fs/                       # 文件读写抽象
│  │  ├─ hash/                     # 稳定 hash 工具
│  │  └─ job-store/                # 本地任务状态存储
│  ├─ pipeline/                    # 后续流水线步骤扩展目录
│  ├─ prompts/                     # 版本化 Prompt 模板
│  │  └─ subtitle-translate.md     # 字幕翻译 Prompt
│  ├─ providers/                   # LLM Provider 适配层
│  │  ├─ anthropic/                # Anthropic Messages API 适配
│  │  ├─ mock/                     # 本地 mock provider
│  │  ├─ openai/                   # 官方 OpenAI API 适配
│  │  ├─ openai-compatible/        # 第三方 OpenAI 风格接口适配
│  │  ├─ shared/                   # Provider 共享 HTTP 工具
│  │  └─ LlmProviderFactory.ts     # Provider 工厂
│  ├─ shared/                      # 跨模块共享能力
│  │  └─ errors/                   # 应用错误类型
│  ├─ subtitle/                    # 字幕解析、导出、分块实现
│  │  ├─ chunkers/                 # 字幕分块器
│  │  ├─ exporters/                # 字幕导出器
│  │  └─ parsers/                  # 字幕解析器
│  └─ translation/                 # 翻译文本处理和质量校验
│     └─ validators/               # 翻译结果校验器
├─ tests/
│  ├─ fixtures/                    # 测试字幕样本
│  ├─ integration/                 # CLI 集成测试
│  └─ unit/                        # 单元测试
├─ package.json                    # 项目脚本和依赖
├─ tsconfig.json                   # TypeScript 配置
├─ tsup.config.ts                  # 构建配置
└─ vitest.config.ts                # 测试配置
```

## 使用方法

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置模型

配置会保存到用户本地 `~/.auto-bbq/config.json`，不需要手写配置文件。

OpenAI：

```bash
pnpm auto-bbq config set --setting llm.provider=openai --setting llm.apiKey=sk-... --setting llm.model=gpt-4.1-mini
```

Anthropic：

```bash
pnpm auto-bbq config set --setting llm.provider=anthropic --setting llm.apiKey=sk-ant-... --setting llm.model=claude-sonnet-4-5
```

OpenAI-compatible，例如 PPIO：

```bash
pnpm auto-bbq config set --setting llm.provider=openai-compatible --setting llm.apiKey=sk-... --setting llm.model=deepseek/deepseek-v4-pro --setting llm.baseUrl=https://api.ppio.com/openai/v1
```

查看当前配置：

```bash
pnpm auto-bbq config show
```

`config show` 会隐藏 API Key，只显示脱敏后的值。

### 3. 设置翻译参数

这些设置会持久保存到 `~/.auto-bbq/config.json`，后续执行 `translate` 会自动读取。

默认目标语言是 `zh-CN`，默认失败后重试 3 次：

```bash
pnpm auto-bbq config set --setting translation.targetLanguage=zh-CN
pnpm auto-bbq config set --setting translation.style=natural-subtitle
pnpm auto-bbq config set --setting translation.maxRetries=3
```

`translation.style` 是给普通用户用的翻译风格配置，不需要改 Prompt 文件。它会写入提示词里的 `{{style}}`，可以按内容类型自定义，例如：

```bash
pnpm auto-bbq config set --setting translation.style=日常口语，适合动漫字幕，保留轻松语气
pnpm auto-bbq config set --setting translation.style=自然流畅，适合纪录片字幕，术语准确
pnpm auto-bbq config set --setting translation.style=简洁直白，适合游戏解说字幕，少用长句
```

如果风格文本里包含空格，建议用引号包起来：

```bash
pnpm auto-bbq config set --setting "translation.style=自然口语，适合 YouTube 字幕，保留吐槽感"
```

也可以在翻译命令里临时指定目标语言：

```bash
pnpm auto-bbq translate "D:\path\input.srt" -o "D:\path\output.zh.srt" --target ja-JP
```

命令里的 `--target` 只影响这一次翻译，不会改掉本地保存的 `translation.targetLanguage`。

### 4. 运行翻译

真实模型翻译：

```bash
pnpm auto-bbq translate "D:\path\input.srt" -o "D:\path\output.zh.srt" --target zh-CN
```

本地 mock 测试：

```bash
pnpm auto-bbq translate tests/fixtures/sample.srt -o output.zh.srt --provider mock
```

翻译时会显示 chunk 进度条，并每 5 秒刷新一条动画、漫画或游戏分类的一言。

命令完成后会输出：

```text
Job: <jobId>
Translated <lineCount> subtitle lines in <chunkCount> chunk(s).
Output: <outputFile>
```

### 5. 查看任务状态

```bash
pnpm auto-bbq inspect <jobId>
```

任务数据保存在 `.auto-bbq/jobs/<jobId>/`，包括 manifest、chunk 输入、chunk 输出和原始模型响应。

### 6. 恢复任务

```bash
pnpm auto-bbq resume <jobId>
```

如果任务已经成功，`resume` 会直接返回状态；如果任务失败或中断，会按原任务信息重新执行。

### 7. 配置菜单

```bash
pnpm auto-bbq config
```

当前交互菜单只开放 `LLM Provider`，其他未完全接入的分组暂时隐藏。

### 8. 常用配置 key

```text
llm.provider=openai | anthropic | openai-compatible | mock
llm.apiKey=sk-...
llm.model=gpt-4.1-mini
llm.baseUrl=https://api.example.com/v1
translation.targetLanguage=zh-CN
translation.style=natural-subtitle
translation.maxRetries=3
```

### 9. 自定义提示词

大多数情况下只需要配置 `translation.style`，不用改提示词文件。

如果你是开发者，想整体调整模型的翻译规则，可以修改 `src/prompts/subtitle-translate.md`，例如加入角色语气、术语、风格要求。自定义时必须保留下面这些变量：

```text
{{sourceLanguage}}
{{targetLanguage}}
{{style}}
{{previousLines}}
{{currentLines}}
{{nextLines}}
```

也必须保留结构化 JSON 输出契约：

```json
{
  "items": [
    {
      "id": "1",
      "translation": "翻译后的字幕文本"
    }
  ]
}
```

模型只负责返回 `id` 和 `translation`，不要让模型输出完整 SRT；时间轴会由本地程序合并回原字幕。

### 10. 开发检查

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

## TODO

- 完善失败 chunk 的精确续跑策略。
- 支持双语字幕输出。
- 支持术语表和角色名一致性。
- 支持批量 SRT 翻译。
- 支持更多字幕格式。
