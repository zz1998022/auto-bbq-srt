# auto-bbq-srt

`auto-bbq-srt` 是一个基于 Node.js + TypeScript 的自动字幕翻译 CLI 工具，也就是“自动烤肉机”。

项目目标是读取 `.srt` 等字幕文件，通过可插拔 LLM Provider 翻译字幕文本，校验翻译结果，并在保留原始时间轴和字幕结构的前提下导出新字幕。

## 当前状态

项目处于阶段 0：工程初始化。

当前已建立：

- TypeScript + ESM 项目骨架
- CLI 入口和命令注册结构
- Vitest 测试配置
- tsup 构建配置
- CLI-first 配置命令骨架和测试字幕 fixture

后续阶段会逐步实现 SRT parser、exporter、chunker、Mock LLM Provider、翻译流水线、缓存和 Job Store。

## 本地开发

```bash
pnpm install
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

项目使用 Husky 在提交前执行 lint、格式检查、类型检查和单元测试。提交信息需要使用中文，并说明清楚本次改动的内容和目的。

## CLI 目标

用户配置 Provider 和高级默认项时优先使用 CLI，不要求手写配置文件：

```bash
auto-bbq config
auto-bbq config set --setting llm.provider=openai --setting llm.apiKey=sk-... --setting llm.model=gpt-4.1-mini
auto-bbq config set --setting llm.provider=openai-compatible --setting llm.apiKey=sk-... --setting llm.model=deepseek-chat --setting llm.baseUrl=https://api.example.com/v1
auto-bbq config set --setting translation.targetLanguage=zh-CN
auto-bbq config set --setting chunk.maxLines=30 --setting cache.enabled=true --setting output.mode=replace --setting logging.level=info
auto-bbq config show
```

`auto-bbq config` 默认打开编号式交互菜单：

```text
Auto BBQ Options

[1] LLM Provider
[2] Translation
[3] Chunk
[4] Cache
[5] Output
[6] Logging
[0] Exit

Press a key [1...6 / 0]:
```

官方 OpenAI / Anthropic 如果没有配置 `llm.baseUrl`，CLI 后续实现时必须写入官方默认端点；第三方兼容服务必须显式配置 `llm.baseUrl`。API Key 由用户通过 CLI 配置，不能要求用户手写配置文件或 `.env`。

`translate` 命令只保留高频入口参数。translation、chunk、cache、output、logging 这些默认行为通过 `config set --setting` 管理，以 CLI 中保存的设置为准。

第一版可运行目标：

```bash
auto-bbq translate tests/fixtures/sample.srt -o output.zh.srt --provider mock
```

最终常用命令：

```bash
auto-bbq translate input.srt -o output.zh.srt --target zh-CN
```

## 安全

不要提交：

- API Key
- 真实用户字幕原文
- 真实用户字幕缓存
- 真实任务输出
