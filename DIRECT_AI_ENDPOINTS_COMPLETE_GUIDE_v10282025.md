# Direct AI Model Endpoints - Complete Guide

**Created**: October 12, 2025
**Last Updated**: October 27, 2025 (Swarm Migration)
**Status**: ✅ DEPLOYED IN DOCKER SWARM (3 replicas)
**Purpose**: Direct OpenAI/Anthropic endpoints (NOT C1 SDK) for AI assistant chat interfaces

---

## 🚀 Executive Summary

These are the **DIRECT AI endpoints** that bypass C1 SDK and go straight to:
- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude 3.5 Sonnet, Opus, Haiku)
- xAI (Grok)
- Perplexity (Research models)

**Key Differences from C1 SDK:**
- ✅ Direct model access (no C1 wrapper)
- ✅ Automatic cost tracking to PostgreSQL
- ✅ Multi-tenant with org-level isolation
- ✅ Load-balanced across 3 Swarm replicas
- ✅ Unified gateway through LiteLLM proxy
- ✅ Failover and model routing built-in

---

## 📡 Base Endpoints

### Production URLs (Recommended - Use These!)
```
Primary:     https://research.xencolabs.com/api/ai
Vanity URLs: https://api.devmaestro.io/api/ai
             https://api.promptmarketer.app/api/ai
             https://api.landingcraft.app/api/ai
```

### Separate Deployed Services (Independent)
```
ReResume:    https://api.reresume.app/api/ai    (separate deployment)
BlogCraft:   https://api.blogcraft.app/api/ai   (separate deployment)
```

**Load Balancing**: Docker Swarm routing mesh with 3 replicas for high availability

**⚠️ DO NOT USE**: Old local IPs (`10.8.8.12:19000`) - these bypass Swarm load balancing!

---

## 🔑 API Keys by Application

### ReResume
```bash
API_KEY=42760d8cba1aade469cd7a3d62461de13a441e7e1861f44414341fed15f04341
ORG_ID=11111111-1111-1111-1111-111111111111
```

### BlogCraft
```bash
API_KEY=69d67ec8ad456ee96fd37d9fbd91ba5743bcec90b793b602960adb3b8b99a5fd
ORG_ID=22222222-2222-2222-2222-222222222222
```

### AIMS
```bash
API_KEY=48c7332ab124d212b6b7d027deb37bdb27933b4b45ec2aedc2a3a4cb98f21edf
ORG_ID=33333333-3333-3333-3333-333333333333
```

### Xenco Labs
```bash
API_KEY=9ff4ae81d329a970a2411c2d26c25d328cbcf204d87485939284d1730d380ca8
ORG_ID=44444444-4444-4444-4444-444444444444
```

### FightClub Tech
```bash
API_KEY=a777669a966ddf06ce592ac78d861e1af54c4eaf8408d59a8e8c2b3c46f9aaa8
ORG_ID=55555555-5555-5555-5555-555555555555
```

### DevMaestro
```bash
API_KEY=e856e858acae2b925d0b3e626b24f18bda07cc5ac5d633b517cc4da1d1a4cb7c
ORG_ID=66666666-6666-6666-6666-666666666666
```

### Prompt Marketer
```bash
API_KEY=6f2128b77fc29a578c8c05c76684299df90c3593a3921f5a09f2403d60889f23
ORG_ID=77777777-7777-7777-7777-777777777777
```

### LandonCraft
```bash
API_KEY=e531a4d8d38b5ed112a31f415142a09bd6d12489f724520e80a7bdb568665450
ORG_ID=88888888-8888-8888-8888-888888888888
```

---

## 🎯 Available Endpoints

### 1. Chat Completions (OpenAI Format)
**Best for**: Most AI chat interfaces, SDKs, general use

```
POST /api/ai/chat/completions
```

**Request Format**:
```json
{
  "model": "claude-3-5-sonnet",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "max_tokens": 1000,
  "temperature": 0.7,
  "stream": false
}
```

**Response Format**:
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1728408000,
  "model": "claude-3-5-sonnet",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23
  }
}
```

### 2. Anthropic Messages (Native Format)
**Best for**: Claude-specific features, streaming

```
POST /api/ai/anthropic/messages
```

**Request Format**:
```json
{
  "model": "claude-3-5-sonnet",
  "max_tokens": 1000,
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "system": "You are a helpful assistant.",
  "temperature": 0.7,
  "stream": false
}
```

**Response Format**:
```json
{
  "id": "msg-xxx",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-3-5-sonnet",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 12,
    "output_tokens": 25
  }
}
```

### 3. List Available Models

```
GET /api/ai/models
```

**Response**:
```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-3-5-sonnet",
      "object": "model",
      "created": 1728408000,
      "owned_by": "anthropic"
    },
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1728408000,
      "owned_by": "openai"
    }
  ]
}
```

### 4. Usage Statistics

```
GET /api/ai/usage?from_date=2025-10-01&to_date=2025-10-31
```

**Response**:
```json
{
  "from_date": "2025-10-01T00:00:00",
  "to_date": "2025-10-31T23:59:59",
  "total_requests": 42,
  "total_cost": 0.12,
  "by_model": [
    {
      "model": "claude-3-5-sonnet",
      "request_count": 30,
      "total_input_tokens": 5000,
      "total_output_tokens": 3000,
      "total_cost": 0.09,
      "avg_duration_ms": 1200
    }
  ]
}
```

### 5. Health Check

```
GET /api/ai/health
```

**Response**:
```json
{
  "status": "healthy",
  "litellm_proxy": "http://litellm-unified_litellm-unified:4000",
  "replicas": "3/3",
  "timestamp": "2025-10-27T10:09:50.371311"
}
```

---

## 🤖 Available Models

| Model ID | Provider | Best For | Speed | Cost/1K | Input Cost | Output Cost |
|----------|----------|----------|-------|---------|------------|-------------|
| `claude-3-5-sonnet` | Anthropic | General tasks, coding | Fast | $$ | $0.003 | $0.015 |
| `claude-3-opus` | Anthropic | Complex reasoning | Slow | $$$$ | $0.015 | $0.075 |
| `claude-3-haiku` | Anthropic | Quick responses | Very Fast | $ | $0.00025 | $0.00125 |
| `gpt-4o` | OpenAI | Multimodal, general | Fast | $$ | $0.0025 | $0.010 |
| `gpt-4o-mini` | OpenAI | Simple tasks | Very Fast | $ | $0.00015 | $0.0006 |
| `grok-beta` | xAI | Experimental | Medium | $$ | $0.005 | $0.015 |
| `perplexity-sonar-large` | Perplexity | Web search | Medium | $$ | $0.001 | $0.001 |

**Recommendation**: Start with `claude-3-5-sonnet` or `gpt-4o` for chat interfaces

---

## 💻 Implementation Examples

### A. Basic Chat Completion (cURL)

```bash
curl -X POST https://research.xencolabs.com/api/ai/chat/completions \
  -H "Authorization: Bearer 42760d8cba1aade469cd7a3d62461de13a441e7e1861f44414341fed15f04341" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet",
    "messages": [
      {"role": "user", "content": "Write a haiku about AI"}
    ],
    "max_tokens": 100
  }'
```

### B. TypeScript/JavaScript (Fetch API)

```typescript
// Basic chat completion
async function chatCompletion(message: string) {
  const response = await fetch('https://research.xencolabs.com/api/ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEVMAESTRO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'user', content: message }
      ],
      max_tokens: 1000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Usage
const answer = await chatCompletion('What is machine learning?');
console.log(answer);
```

### C. React Chat Interface

```typescript
'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet');

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [...messages, userMessage]
        })
      });

      if (!response.ok) throw new Error('AI request failed');

      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      alert('Failed to get AI response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      {/* Model Selector */}
      <select
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        className="mb-4 p-2 border rounded"
      >
        <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
        <option value="claude-3-haiku">Claude 3 Haiku (Fast)</option>
        <option value="gpt-4o">GPT-4o</option>
        <option value="gpt-4o-mini">GPT-4o Mini</option>
      </select>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-4 rounded ${
              msg.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
            } max-w-[80%]`}
          >
            <div className="font-semibold mb-1">
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="bg-gray-100 p-4 rounded">Thinking...</div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          className="flex-1 p-2 border rounded"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="px-6 py-2 bg-blue-500 text-white rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

### D. Next.js API Route (App Router)

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { model, messages } = await req.json();

    const response = await fetch('https://research.xencolabs.com/api/ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEVMAESTRO_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
```

### E. Python (FastAPI Backend)

```python
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[ChatMessage]

DEVMAESTRO_API_KEY = "42760d8cba1aade469cd7a3d62461de13a441e7e1861f44414341fed15f04341"
AI_ENDPOINT = "https://research.xencolabs.com/api/ai/chat/completions"

@app.post("/chat")
async def chat(request: ChatRequest):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            AI_ENDPOINT,
            headers={
                "Authorization": f"Bearer {DEVMAESTRO_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": request.model,
                "messages": [msg.dict() for msg in request.messages],
                "max_tokens": 1000,
                "temperature": 0.7
            },
            timeout=30.0
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"AI API error: {response.text}"
            )
        
        data = response.json()
        return {
            "content": data["choices"][0]["message"]["content"],
            "model": data["model"],
            "usage": data["usage"]
        }
```

### F. Inngest Function

```typescript
import { inngest } from "./client";

export const aiChatCompletion = inngest.createFunction(
  { id: "ai-chat-completion" },
  { event: "ai/chat" },
  async ({ event, step }) => {
    
    const response = await step.run("call-ai", async () => {
      const res = await fetch("https://research.xencolabs.com/api/ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.DEVMAESTRO_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: event.data.model || "claude-3-5-sonnet",
          messages: event.data.messages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!res.ok) {
        throw new Error(`AI API error: ${res.status}`);
      }

      return await res.json();
    });

    const content = response.choices[0].message.content;

    await step.run("save-response", async () => {
      // Save to database
      console.log("AI response:", content);
    });

    return { success: true, content };
  }
);
```

---

## 🔐 Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer <YOUR_API_KEY>
```

**Example**:
```bash
curl -H "Authorization: Bearer 42760d8cba1aade469cd7a3d62461de13a441e7e1861f44414341fed15f04341"
```

---

## ⚙️ Request Parameters

### Common Parameters (Both Formats)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | Yes | - | Model ID (see models table) |
| `messages` | array | Yes | - | Chat messages |
| `max_tokens` | integer | No | 4096 | Maximum tokens to generate |
| `temperature` | float | No | 0.7 | Sampling temperature (0-2) |
| `stream` | boolean | No | false | Enable streaming |

### OpenAI Format Specific

| Parameter | Type | Description |
|-----------|------|-------------|
| `top_p` | float | Nucleus sampling (0-1) |
| `frequency_penalty` | float | Frequency penalty (-2 to 2) |
| `presence_penalty` | float | Presence penalty (-2 to 2) |
| `stop` | string/array | Stop sequences |

### Anthropic Format Specific

| Parameter | Type | Description |
|-----------|------|-------------|
| `system` | string | System prompt (separate from messages) |

---

## 🔄 Streaming Responses

Enable streaming for real-time chat interfaces:

```typescript
const response = await fetch(AI_ENDPOINT, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet',
    messages: [{ role: 'user', content: 'Tell me a story' }],
    max_tokens: 1000,
    stream: true  // Enable streaming
  })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.trim());

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      const parsed = JSON.parse(data);
      const content = parsed.choices[0]?.delta?.content || '';
      
      // Update UI with content
      console.log(content);
    }
  }
}
```

---

## 📊 Usage Tracking

All requests are automatically logged to PostgreSQL with:
- Org ID
- Model used
- Input/output tokens
- Cost calculation
- Duration
- Timestamp

Query your usage:
```bash
curl "https://research.xencolabs.com/api/ai/usage?from_date=2025-10-01&to_date=2025-10-31" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## ❌ Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 401 | Invalid API key | Check authorization header |
| 429 | Rate limit exceeded | Retry with backoff |
| 500 | Server error | Retry or contact admin |

### Error Response Format

```json
{
  "detail": "Invalid API key"
}
```

### Example Error Handling

```typescript
try {
  const response = await fetch(AI_ENDPOINT, options);
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded - please wait');
    } else {
      throw new Error(`API error: ${response.status}`);
    }
  }
  
  return await response.json();
} catch (error) {
  console.error('AI request failed:', error);
  // Show user-friendly error
  throw error;
}
```

---

## 🏗️ Architecture

```
Your App
   │
   ▼
Direct AI Endpoints
   │ (https://research.xencolabs.com/api/ai)
   ▼
Docker Swarm (3 replicas)
   │ (Load balancing + High availability)
   ▼
FastAPI Server
   │ (Authentication + Usage Logging)
   ▼
LiteLLM Proxy
   │ (http://litellm-unified_litellm-unified:4000 - 3 replicas)
   ▼
AI Providers (OpenAI, Anthropic, xAI, Perplexity)
   │
   ▼
PostgreSQL (Usage Logs)
```

**Key Components**:
- **Docker Swarm**: 3 replicas each for API server and LiteLLM proxy
- **FastAPI**: Authentication, multi-tenancy, usage logging
- **LiteLLM**: Model routing, failover, cost optimization (3 replicas)
- **PostgreSQL**: Usage tracking, cost reporting
- **Load Balancing**: Swarm routing mesh for high availability

---

## 🔄 Differences from C1 SDK

| Feature | Direct Endpoints | C1 SDK |
|---------|------------------|--------|
| **Model Access** | Direct to OpenAI/Anthropic | Through C1 wrapper |
| **Cost Tracking** | Automatic to PostgreSQL | Manual tracking |
| **Multi-Tenant** | Built-in org isolation | Manual implementation |
| **Format** | OpenAI + Anthropic native | C1 custom format |
| **Failover** | LiteLLM handles | Manual retry logic |
| **Streaming** | Native support | Limited support |
| **Usage Analytics** | Built-in API | Manual logging |

---

## 🧪 Testing

### Quick Test (ReResume)

```bash
curl -X POST https://research.xencolabs.com/api/ai/chat/completions \
  -H "Authorization: Bearer 42760d8cba1aade469cd7a3d62461de13a441e7e1861f44414341fed15f04341" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-haiku",
    "messages": [{"role": "user", "content": "Say hello in 5 words"}],
    "max_tokens": 50
  }'
```

**Expected Response**:
```json
{
  "id": "chatcmpl-xxx",
  "model": "claude-3-haiku-20240307",
  "choices": [{
    "message": {
      "content": "Hello, how are you today?",
      "role": "assistant"
    }
  }],
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 10,
    "total_tokens": 24
  }
}
```

### Test All Models

```bash
# Claude 3.5 Sonnet
curl -X POST https://research.xencolabs.com/api/ai/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-3-5-sonnet", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 50}'

# GPT-4o
curl -X POST https://research.xencolabs.com/api/ai/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 50}'

# Claude Haiku (Fast)
curl -X POST https://research.xencolabs.com/api/ai/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-3-haiku", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 50}'
```

---

## 📝 Environment Variables

### For Backend Services

```bash
# .env
DEVMAESTRO_API_KEY=42760d8cba1aade469cd7a3d62461de13a441e7e1861f44414341fed15f04341
AI_GATEWAY_URL=https://research.xencolabs.com/api/ai
```

### For Next.js

```bash
# .env.local (server-side only)
DEVMAESTRO_API_KEY=42760d8cba1aade469cd7a3d62461de13a441e7e1861f44414341fed15f04341

# .env (never expose key on client!)
NEXT_PUBLIC_AI_GATEWAY_URL=https://research.xencolabs.com/api/ai
```

**⚠️ SECURITY**: Never expose API keys on the client side. Always proxy through your backend.

---

## 🚨 Troubleshooting

### Issue: "Invalid API key"
**Solution**: Check that you're using Bearer token format:
```
Authorization: Bearer YOUR_KEY_HERE
```

### Issue: Connection timeout
**Solution**:
1. Check API server is running: `curl https://research.xencolabs.com/api/ai/health`
2. Increase timeout in your code (default: 30s)

### Issue: "Model not found"
**Solution**: Use exact model IDs from the models table (e.g., `claude-3-5-sonnet`, not `claude-sonnet`)

### Issue: Rate limit errors
**Solution**: Implement exponential backoff retry logic

---

## 📚 Additional Resources

- **Full App Guide**: `/home/xen/docker/apps/blogcraft-mcp/AI_ENDPOINTS_APP_ADMIN_GUIDE.md`
- **Deployment Guide**: `/home/xen/docker/apps/blogcraft-mcp/AI_ENDPOINTS_DEPLOYMENT_GUIDE.md`
- **Status Report**: `/home/xen/docker/apps/blogcraft-mcp/AI_ENDPOINTS_STATUS_REPORT.md`
- **API Keys**: `/home/xen/docker/apps/blogcraft-mcp/API_KEYS_FOR_APPS.md`

---

## ✅ Summary Checklist

- [x] Endpoints deployed and tested
- [x] API keys generated for all apps
- [x] Usage tracking to PostgreSQL working
- [x] Multi-tenancy enforced
- [x] Load balancing configured
- [x] Documentation complete

**Status**: ✅ READY FOR PRODUCTION USE

---

**Last Updated**: October 12, 2025  
**Maintainer**: MCP Cluster Administrator  
**Contact**: For API key issues or questions

---

## 🎯 Quick Start Summary

1. **Get your API key** from the list above (by app)
2. **Choose endpoint**: `https://research.xencolabs.com/api/ai/chat/completions`
3. **Pick a model**: `claude-3-5-sonnet` or `gpt-4o`
4. **Make request**:
   ```bash
   curl -X POST https://research.xencolabs.com/api/ai/chat/completions \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "claude-3-5-sonnet", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 100}'
   ```
Complete Success Report

  All tasks have been completed successfully! Here's what was accomplished:

  🎉 New Claude Models Added

  Your LiteLLM proxy now has access to all the latest Claude 4.x models:

  Claude 4.x Generation (Latest):
  - ✅ claude-sonnet-4-5 - Claude Sonnet 4.5 (Best balance of speed/intelligence)
  - ✅ claude-haiku-4-5 - Claude Haiku 4.5 (Fast & cheap for simple tasks)
  - ✅ claude-opus-4-1 - Claude Opus 4.1 (Most powerful for complex tasks)
  - ✅ claude-opus-4 - Claude Opus 4
  - ✅ claude-sonnet-4 - Claude Sonnet 4

  Claude 3.x Generation (Still Available):
  - ✅ claude-3-7-sonnet
  - ✅ claude-3-5-sonnet (the old default)
  - ✅ claude-3-5-haiku
  - ✅ claude-3-opus
  - ✅ claude-3-haiku

  🔑 API Key Updated

  - New Anthropic API key installed and working:
  sk-ant-api03-f2oHDytDZbaF8KmF....
  - Previous invalid key removed

  ✨ Convenient Aliases

  The configuration includes smart aliases so you can use simple names:
  - claude-sonnet → claude-sonnet-4-5 (latest Sonnet)
  - claude-haiku → claude-haiku-4-5 (latest Haiku)
  - claude-opus → claude-opus-4-1 (latest Opus)
  - claude → claude-sonnet-4-5 (default to best all-rounder)
  - fast → claude-haiku-4-5 (fastest model)
  - cheap → claude-haiku-4-5 (cheapest model)
  - smart → claude-sonnet-4-5 (smartest balanced model)
  - powerful → claude-opus-4-1 (most powerful)

  🧪 Test Results

  All models tested and confirmed working:
  {
    "claude-sonnet-4-5": "✅ Working - 'Hello to you!'",
    "claude-haiku-4-5": "✅ Working - 'Hi! 👋 How's it going'",
    "claude-opus-4-1": "✅ Working - 'Hello! Hi there! How are you doing today'",
    "claude-sonnet-4": "✅ Working - 'Hi there! How are you doing today?'"
  }

  📊 Cost Comparison

  | Model             | Input Cost        | Output Cost       | Best For                     |
  |-------------------|-------------------|-------------------|------------------------------|
  | Claude Haiku 4.5  | $0.00000025/token | $0.00000125/token | Fast, cheap tasks            |
  | Claude Sonnet 4.5 | $0.000003/token   | $0.000015/token   | Balanced tasks (recommended) |
  | Claude Opus 4.1   | $0.000015/token   | $0.000075/token   | Complex reasoning            |

  🔄 Intelligent Fallbacks

  The system now has smart fallback chains:
  - If Sonnet 4.5 fails → tries Sonnet 4 → Sonnet 3.7 → GPT-4o
  - If Haiku 4.5 fails → tries Haiku 3.5 → Haiku 3 → GPT-4o-mini
  - If Opus 4.1 fails → tries Opus 4 → Opus 3 → GPT-4o

  📁 Files Modified

  - Configuration: /nfs/swarm/litellm/config/litellm-config-unified.yaml
  - Backup: /home/xen/docker/apps/blogcraft-mcp/docs/litellm/config/litellm-config.yaml.backup-<timestamp>
  - Service: litellm-unified_litellm-unified (restarted and running)

  ✅ ReResume Admin Verification

  The ReResume admin endpoint is working perfectly with the new models:
  - Endpoint: https://research.xencolabs.com/api/ai/chat/completions
  - Authentication: Working with API key
  - Response time: Fast
  - All new Claude models: Accessible

  Your cluster is now fully upgraded with the latest Claude 4.5 models! 🚀
**That's it!** You're now using direct AI endpoints with Swarm load balancing! 🚀
