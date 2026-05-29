# auto-bbq-srt

一个用 Node.js + TypeScript 写的字幕翻译 CLI。名字里的 bbq 是“烤肉”，目标是把 `.srt` 字幕丢进去，翻译后再导出一份时间轴不乱的新字幕。

这个仓库现在还在打地基：CLI 入口、目录结构、测试、构建和提交检查已经准备好，真正的 SRT 解析和翻译流水线会按阶段继续补。

## 现在有什么

- ESM + TypeScript 项目骨架
- `auto-bbq` CLI 入口
- `config / translate / resume / inspect / cache` 命令骨架
- 编号式配置菜单原型
- Vitest、tsup、ESLint、Prettier、Husky
- 一份最小的 `sample.srt` fixture

## 开发

```bash
pnpm install
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

提交前 Husky 会跑 lint、格式检查、类型检查和单元测试。提交信息需要写中文，并说明这次改了什么、为什么改。

## 配置方式

普通用户不需要手写配置文件。默认入口是：

```bash
auto-bbq config
```

它会打开类似这样的菜单：

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

脚本或高级用法可以直接设置 key：

```bash
auto-bbq config set --setting llm.provider=openai --setting llm.apiKey=sk-... --setting llm.model=gpt-4.1-mini
auto-bbq config set --setting llm.provider=openai-compatible --setting llm.apiKey=sk-... --setting llm.model=deepseek-chat --setting llm.baseUrl=https://api.example.com/v1
auto-bbq config set --setting translation.targetLanguage=zh-CN
auto-bbq config show
```

官方 OpenAI / Anthropic 没配置 `llm.baseUrl` 时，后续实现会使用官方默认端点。第三方兼容接口必须显式配置 `llm.baseUrl`。

## 目标命令

第一版先跑通 mock provider：

```bash
auto-bbq translate tests/fixtures/sample.srt -o output.zh.srt --provider mock
```

最终常用形态：

```bash
auto-bbq translate input.srt -o output.zh.srt --target zh-CN
```

`translate` 会尽量保持清爽，只放输入、输出、目标语言、provider 覆盖和 dry-run 这类高频参数。翻译风格、chunk、缓存、输出模式、日志等级这些默认项走 `auto-bbq config`。

## 不提交这些东西

- API Key
- 真实用户字幕
- 本地缓存
- 任务输出
