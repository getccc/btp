import json

from openai import AsyncOpenAI

from app.config import settings
from app.utils.logger import get_logger

log = get_logger(__name__)


class DeepSeekClient:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com",
        )
        self.model = "deepseek-chat"

    async def analyze(self, system_prompt: str, user_content: str) -> dict:
        """Send a single analysis request and return parsed JSON."""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            raw = response.choices[0].message.content or "{}"
            result = json.loads(raw)
            log.debug(
                "LLM analyze ok",
                tokens=response.usage.total_tokens if response.usage else 0,
            )
            return result
        except json.JSONDecodeError as exc:
            log.error("LLM returned invalid JSON", error=str(exc), raw=raw[:500])
            return {}
        except Exception as exc:
            log.error("LLM analyze failed", error=str(exc))
            raise

    async def analyze_batch(
        self, items: list[dict], system_prompt: str,
    ) -> list[dict]:
        """Pack multiple items into one request, return parsed results list."""
        user_content = json.dumps(items, ensure_ascii=False)
        result = await self.analyze(system_prompt, user_content)
        if isinstance(result.get("results"), list):
            return result["results"]
        log.warning(
            "LLM batch response missing 'results' array",
            keys=list(result.keys()),
        )
        return []


llm_client = DeepSeekClient()
