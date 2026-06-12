---
name: create_standard_pr
description: 当用户要求提交代码或创建 PR 时触发。用于执行代码检查、生成规范的 commit message 并标准化提交流程。
---

# Create Standard PR Skill

## 触发条件
当用户要求“帮我提交代码”、“保存当前工作”或“创建一个 PR”时自动触发。

## Instructions (执行步骤)
当你需要为用户创建 PR 时，请严格按照以下步骤执行：

1. **状态检查**：运行 `git status` 和 `git diff` 查看当前所有更改。
2. **代码质量验证**：
   - 运行前端 `npm run build` 和后端 `go build` 确保没有任何致命编译错误。如果报错，请尝试修复或中止提交流程并提醒用户。
3. **生成 Commit 并提交**：
   - 根据 `git diff` 的内容，思考并生成符合 Conventional Commits 规范的 message。
   - 执行 `git add .` 和 `git commit -m "<你的message>"`。
4. **推送到远程**：
   - 获取当前分支名，执行 `git push origin <当前分支名>`。
5. **起草 PR 描述**：
   - 根据修改内容，为用户自动草拟一份结构化的 PR 描述文本（必须包含：功能描述、实现思路、测试方式）。
   - 由于我们可能没有在本地安装或认证 `gh` CLI 工具，请将起草好的 PR 描述通过界面发送给用户，并引导用户前往 GitHub 网页端点击 "Compare & pull request" 按钮完成最终的 PR 创建。
