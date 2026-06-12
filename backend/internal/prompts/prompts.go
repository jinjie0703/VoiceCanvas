package prompts

import (
	_ "embed"
)

//go:embed system_prompt.md
var SystemPrompt string

//go:embed cmd_create_svg.md
var CmdCreateSVG string
