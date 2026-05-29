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

安装依赖：

```bash
pnpm install
```

运行 mock 翻译：

```bash
pnpm auto-bbq translate tests/fixtures/sample.srt -o output.zh.srt --provider mock
```

查看任务状态：

```bash
pnpm auto-bbq inspect <jobId>
```

恢复任务：

```bash
pnpm auto-bbq resume <jobId>
```

打开配置菜单：

```bash
pnpm auto-bbq config
```

开发检查：

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

## TODO

- 接通 CLI-first 配置持久化。
- 将 OpenAI / Anthropic / OpenAI-compatible Provider 接入 `translate` 命令。
- 支持真实 LLM 翻译所需的 API Key、model、baseUrl 配置。
- 完善失败 chunk 的精确续跑策略。
- 支持双语字幕输出。
- 支持术语表和角色名一致性。
- 支持批量 SRT 翻译。
- 支持更多字幕格式。
