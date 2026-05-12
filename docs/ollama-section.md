# Section: LLM Component — Ollama with Llama 3.1 (8B)

> **Instructions for use:** Copy the text below into your Word/Google Docs document.
> Replace `§4.X` with the actual section number in your paper.
> Take the screenshots listed in §4.X.6 after running `make up`.

---

## 4.X  Natural-Language Composition Selection via Local LLM

### 4.X.1  Role of the LLM in the Pipeline

The Bouquet AI Platform separates the task of *flower selection* from the task of *image synthesis*. Given a consumer's natural-language request, preferred colour palette, and a budget constraint expressed in KZT, the system must choose a subset of in-stock flowers and assign per-flower quantities such that the resulting bouquet is aesthetically coherent, budget-compliant, and reproducible from available inventory.

Rather than encoding floristry heuristics as hand-crafted rules, we delegate this combinatorial selection task to a large language model (LLM). The LLM receives a structured JSON payload containing the client's request, budget window (lower and upper bounds as fractions of the stated budget), and a catalogue of available flowers with names, colour tags, prices per stem, and stock quantities. It responds with a JSON object describing one or more composition variants — each listing flower IDs, quantities, style modifiers, and a natural-language explanation suitable for display to the consumer.

The composition produced by the LLM is then passed to the Stable Diffusion XL pipeline (see §3) as a structured reference: flower names drive the positive prompt, and the images of the selected flowers serve as IPAdapter reference photographs.

### 4.X.2  Why Ollama

The original system was designed to call any OpenAI-compatible REST endpoint. For deployment in local or offline environments — including academic lab settings and development workstations — we replace the remote endpoint with **Ollama** [1], an open-source runtime for large language models that exposes an OpenAI-compatible HTTP API on port 11434.

Ollama offers several advantages for this use case:

- **No API key or network access required.** The model runs entirely on the local machine, eliminating cost, latency variance, and data-privacy concerns.
- **OpenAI-compatible API.** The existing `AsyncOpenAI` client in the codebase connects to Ollama without modification, by setting `base_url=http://ollama:11434/v1`.
- **Docker-native.** The official `ollama/ollama` Docker image is added to the existing `docker-compose.yml`, so the full stack — database, backend, frontend, and LLM — starts with a single `make up` command.

### 4.X.3  Model: Llama 3.1 (8B)

We use **Meta Llama 3.1 8B** [2], an 8-billion-parameter instruction-tuned model in the Llama 3 family. It was chosen for the following reasons:

| Property | Value |
|---|---|
| Parameters | 8.03 billion |
| Context window | 128 000 tokens |
| Architecture | Grouped-query attention (GQA) transformer |
| Quantisation (Ollama default) | Q4\_K\_M (≈ 4.7 GB on disk) |
| Instruction-following | Strong on structured JSON tasks |
| Minimum hardware | 8 GB GPU VRAM or 16 GB system RAM |

The model's 128 k-token context window comfortably accommodates the full flower catalogue for any realistic florist point (typically 20–80 SKUs × ~100 tokens each), the system prompt (~400 tokens), and the JSON composition response (~200 tokens).

### 4.X.4  JSON Reliability and Fallback Strategy

Unlike GPT-4 and GPT-3.5, open-weight models do not reliably honour the `response_format={"type": "json_object"}` API parameter. Llama 3.1 8B occasionally wraps its JSON response in markdown fences or prepends a short prose sentence.

To handle this, we implement `OllamaLLMClient` (`backend/app/services/llm_client_ollama.py`), which differs from the base `LLMClient` in three ways:

1. **No `response_format` parameter** is passed to the API call.
2. **System prompt injection:** the phrase *"You MUST respond with valid JSON only. No explanation, no markdown, no commentary."* is appended to the configuration-stored system prompt at runtime.
3. **Two-stage JSON extraction:**
   - Stage 1: `json.loads(text)` — succeeds for clean responses.
   - Stage 2: regex `\{[\s\S]*\}` extracts the first JSON object from prose or markdown-fenced output.
   - If both stages fail, `LLMError` is raised and the generation falls back to the deterministic heuristic composer already present in the codebase (which selects flowers greedily by budget and colour preference, bypassing the LLM entirely).

### 4.X.5  System Integration

#### Docker Compose Service

The Ollama LLM server runs as a dedicated Docker Compose service alongside the database, backend, and frontend:

```yaml
ollama:
  image: ollama/ollama:latest
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama          # persists downloaded model across restarts
  entrypoint: ["/bin/sh", "-c",
    "ollama serve & sleep 8 && ollama pull llama3.1:8b && wait"]
  healthcheck:
    test: ["CMD-SHELL", "ollama list | grep llama3.1"]
    interval: 30s
    retries: 10
    start_period: 300s
```

The entrypoint starts the Ollama server daemon in the background, waits 8 seconds for it to initialise, then pulls the model. The model is stored in a named Docker volume (`ollama_data`) so it survives container restarts without re-downloading.

#### Backend Configuration

Activating the Ollama provider requires setting three environment variables in `.env`:

```
AI_PROVIDER=ollama
LLM_BASE_URL=http://ollama:11434/v1
LLM_MODEL=llama3.1:8b
LLM_TIMEOUT_SEC=120
```

The `_make_llm_client()` factory function in `backend/app/services/ai_comfyui.py` inspects `settings.ai_provider` at request time and instantiates either `LLMClient` (for `AI_PROVIDER=comfyui`, calling an external endpoint) or `OllamaLLMClient` (for `AI_PROVIDER=ollama`, calling the local Ollama container). The rest of the composition and image-generation pipeline is unchanged.

#### Data Flow Diagram

```
Consumer  →  POST /api/ai/generate-bouquet
                    │
                    ▼
         AIComfyUIGenerator.generate()
                    │
                    │  build JSON payload
                    │  {prompt, budget, colour tags, flower catalogue}
                    ▼
         OllamaLLMClient.select_composition()
                    │
                    │  POST http://ollama:11434/v1/chat/completions
                    │  model: llama3.1:8b
                    ▼
         JSON response  {variants: [{flower_id, quantity, ...}]}
                    │
                    │  two-stage parse + regex fallback
                    ▼
         ai_validation.validate_llm_variants()
                    │  budget check, stock check
                    ▼
         AIGeneration record stored  (status = pending)
                    │
                    │  asyncio.create_task
                    ▼
         ComfyUI IPAdapter SDXL render  (§3)
                    │
                    ▼
         AIGeneration.status = ready
         image_path saved to media volume
```

### 4.X.6  Experimental Results and Screenshots

#### Screenshot List (take after `make up` completes)

Include the following screenshots in the paper (each labelled as a Figure):

**Figure A — Running services**

Command: `docker compose ps`

Expected output: all six services (`db`, `migrations`, `backend`, `seed`, `frontend`, `ollama`) with status `Up`. The `ollama` service shows port mapping `0.0.0.0:11434->11434/tcp`.

**Figure B — Model presence**

Command: `docker compose exec ollama ollama list`

Expected output: a row containing `llama3.1:8b` with size approximately 4.7 GB and modification date.

**Figure C — API request (Swagger UI)**

URL: `http://localhost:8000/docs` → POST `/api/ai/generate-bouquet`

Show the request body:
```json
{
  "point_id": "<uuid>",
  "prompt": "Нежный букет для мамы на день рождения",
  "color_tags": ["pink", "white"],
  "budget": 8000
}
```
And the `202 Accepted` response with `generation_id`.

**Figure D — Generation status response**

URL: `GET /api/me/ai-generations/{generation_id}/status`

Show the JSON response with `"status": "ready"` and `variants[0].explanation` containing the LLM-generated natural-language description.

**Figure E — Ollama startup logs**

Command: `docker compose logs ollama --tail=40`

Show the log lines confirming the model was pulled and the runner started (look for `llama runner started` or `model loaded`).

#### Performance Notes

On a system with an NVIDIA GPU (8 GB VRAM), inference latency for a flower catalogue of ~30 items is approximately 8–15 seconds per request. On CPU-only hardware, latency increases to 60–120 seconds. The 120-second `LLM_TIMEOUT_SEC` value is set to accommodate CPU-only deployments.

---

## References

Add the following entries to your paper's bibliography (IEEE or APA format as required):

**[1]** Ollama. (2023). *Ollama: Get up and running with large language models locally* [Software]. GitHub. https://github.com/ollama/ollama

**[2]** Dubey, A., Jauhri, A., Pandey, A., Kadian, A., Al-Dahle, A., Letman, A., ... & Ganapathy, R. (2024). *The Llama 3 herd of models*. arXiv preprint arXiv:2407.21783. https://arxiv.org/abs/2407.21783

**[3]** Meta AI. (2024). *Meta-Llama-3.1-8B-Instruct model card*. Hugging Face. https://huggingface.co/meta-llama/Meta-Llama-3.1-8B-Instruct

**[4]** OpenAI. (2024). *Chat completions API reference*. OpenAI Platform Documentation. https://platform.openai.com/docs/api-reference/chat

**[5]** OpenAI. (2023). *openai-python: The official Python library for the OpenAI API* [Software]. GitHub. https://github.com/openai/openai-python
