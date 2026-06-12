# VoiceCanvas Agent Rules

## Safety (安全与权限红线)
1. **禁止破坏性清理**：绝对不要执行 `rm -rf` 等破坏性命令来清理项目目录或删除未知文件。
2. **依赖防破坏**：严禁擅自覆盖 `frontend/package.json` 或 `backend/go.mod` 导致大版本依赖降级或丢失，如果要新增包，请仅使用 `npm install <pkg>` 或 `go get <pkg>`。
3. **敏感信息保护**：生成代码或日志演示时，禁止明文打印或硬编码包含真实的 DashScope / ModelScope API Key 字符串。

## Style (代码与审美规范)
1. **UI 审美边界**：前端必须采用“专业工程/极简设计”风格，大量使用 `slate` (石板灰)、`sky` (天蓝)、`emerald` (翠绿)。**严格禁止使用 `violet/purple/fuchsia` (紫色系)** 等泛滥的 AI 感配色。
2. **CSS 规范**：优先在 TSX 内直接书写 Tailwind CSS v4 的 class。如果必须在 `index.css` 写全局样式，必须加前缀，防止污染 TLDraw 原生节点。
3. **TypeScript 类型规范 (禁用 any)**：严格禁止在 TypeScript 代码中使用 `any` 类型。若类型不确定，请使用 `unknown` 并进行类型收窄，或通过 `Record<string, unknown>`、`Parameters<T>` 等泛型工具提取精确类型。必须保证项目能通过 `@typescript-eslint/no-explicit-any` 检查。
4. **Go 代码标准**：遵循标准 `gofmt`。业务层返回的错误必须由外层 Handle 统一记录，业务方法避免滥用 `panic`。

## Workflow (操作流规范)
1. **构建校验强制性**：如果在前端添加了未使用的变量或导入项，或者调整了 TypeScript 接口，必须立刻在终端执行 `npm run build` 进行静默校验，通过后才能报告任务完成。
2. **测试边界**：如果要测试后端的 LLM 通信能力，可以使用 Mock Parser 模式运行以免无端消耗 API 账单额度。
