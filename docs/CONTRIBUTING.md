# 贡献与开发指南 (Contributing)

感谢您参与 VoiceCanvas 的开发！为保证代码质量、追踪变更历史以及协同效率，请严格遵循以下约定。

## 1. 代码提交流程

我们禁止任何人（包括 AI Agent）直接向 `main` 分支进行 Push。请按照以下流程进行开发：

1. **创建分支**：从最新的 `main` 切出新分支，格式为 `类型/简短描述`（例：`feat/voice-controls`, `fix/layout-bug`）。
2. **提交代码**：请保持提交的原子性，每次 Commit 尽可能只解决一个特定的问题或完成一个小功能。
3. **提交 PR (Pull Request)**：在 GitHub 提交 PR。PR 描述中必须包含 "标题"、"功能描述"、"实现思路"、"测试方式" 四个核心段落，等待核心维护者 Review 且构建通过后方可合并。

## 2. Commit 规范 (Conventional Commits)

每一次代码提交的 `git commit message` 必须满足以下前缀规范：

- `feat:` 新增业务级功能或特性
- `fix:` 修复 Bug
- `docs:` 仅修改文档（如 README、docs 目录下的文件）
- `style:` 代码格式化、样式调整、变量重命名等不影响逻辑的变动
- `refactor:` 代码重构（不增加新功能，也不修复 bug）
- `test:` 添加或修改测试用例
- `chore:` 构建过程、依赖包升级或辅助工具的变动

## 3. 自动化提交流程 (针对 AI 辅助开发)

本项目在 `.agents/skills` 下配备了智能体专用的 PR 工具（如 `create_standard_pr` 技能）。
如果您在使用 AI 辅助开发，在您验收满意后，可直接向智能体下达指令（如：“开始提 PR 吧”），智能体会自动拦截、校验您的分支、执行多模块验证编译，并自动起草符合规范的 Pull Request 描述推送到远端。
