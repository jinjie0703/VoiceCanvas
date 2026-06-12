# WebSocket 通信协议与数据格式

VoiceCanvas 强依赖 WebSocket 进行前后端之间的低延迟全双工通信，以下是核心的数据契约。

## 客户端 -> 服务端 (Client to Server)

前端发送的消息包含用户的原始意图文本，以及目前画布上全量/关键元素的几何空间状态。通过传递空间状态，赋予了 AI "眼睛" 的能力。

```json
{
  "text": "在右边画一个红色的正方形",
  "canvas_state": [
    {
      "id": "shape:123",
      "type": "geo",
      "text": "中心数据库",
      "x": 100,
      "y": 100,
      "w": 150,
      "h": 80
    }
  ]
}
```

## 服务端 -> 客户端 (Server to Client)

后端通过 Agent 推理后，返回的是一组有序的动作（Action）列表，前端应当按序遍历并执行这批变更。

```json
{
  "actions": [
    {
      "type": "create",
      "shape_type": "geo",
      "props": {
        "geo": "rectangle",
        "color": "red",
        "text": "",
        "x": 300,
        "y": 100
      }
    }
  ]
}
```

### 支持的 Action Type

目前前端渲染引擎主要支持以下基础类型的操作抽象：

- `create`: 创建新的白板图形或关联内容。
- `update`: 修改已存在图形的属性（颜色、文字内容、位置等）。
- `delete`: 删除指定的图形。
- `clear`: 清空整块画布，重置状态。
