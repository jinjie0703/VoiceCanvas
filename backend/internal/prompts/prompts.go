package prompts

import (
	_ "embed"
)

//go:embed system_prompt.md
var SystemPrompt string

//go:embed enhancer_prompt.md
var EnhancerPrompt string

//go:embed cmd_create_svg.md
var CmdCreateSVG string
