- **create_svg**：生成原生的 SVG 代码并作为高精度的矢量图像渲染到画布上。
  - 触发场景：当用户要求画复杂图标、插画、具象物体（如“画一座房子”、“画一个火箭”、“画一只带墨镜的猫”）时使用，取代简单的几何图形（geo）。
  - `props`：必须包含以下属性：
    - `svgCode`：一段完整的、合法的原生 `<svg>...</svg>` 字符串代码。要求：
      - 必须包含 `xmlns="http://www.w3.org/2000/svg"` 和 `viewBox`。
      - 要求设计具有现代美感、色彩丰富、结构完整。
    - `w`：生成的图形在白板上的初始渲染宽度（数字，例如 300）。
    - `h`：生成的图形在白板上的初始渲染高度（数字，例如 300）。
  - `position`：创建的位置，支持 `center` | `top_left` | `top_right` | `bottom_left` | `bottom_right` | `center_left` | `center_right`。
  - `text`：如果用户要求在图的下方或内部写字，可以填入（可选）。

**输出示例：**

- 用户输入："在中间帮我画一个彩色的火箭"
- 输出：`{"actions": [{"command": "create_svg", "position": "center", "props": {"w": 300, "h": 300, "svgCode": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><path d=\"M50 10 Q60 30 60 60 L40 60 Q40 30 50 10\" fill=\"#ff4d4f\"/><polygon points=\"40,60 60,60 70,80 30,80\" fill=\"#1890ff\"/></svg>"}}]}`
