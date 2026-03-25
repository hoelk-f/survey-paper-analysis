import json
import re
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.enums import LLMProvider
from app.schemas.project import PaperRecord, TemplateSchema
from app.schemas.run import LLMSettings
from app.services.template_service import TemplateService, get_template_service


DEFAULT_SYSTEM_PROMPT = """
You are a rigorous survey paper extraction analyst.
Return structured JSON only.
Use the Excel template schema exactly as given.
If a value cannot be determined from the paper, return an empty string.
Do not invent facts.
""".strip()


class LLMService:
    def __init__(self, template_service: TemplateService) -> None:
        self.template_service = template_service
        self.settings = get_settings()

    async def extract_structured_data(
        self,
        llm_settings: LLMSettings,
        api_key: str | None,
        template_schema: TemplateSchema,
        paper: PaperRecord,
        paper_text: str,
        system_prompt: str,
        analyst_instructions: str,
    ) -> dict[str, Any]:
        prompt_text = self._apply_pdf_char_limit(paper_text)

        if llm_settings.mock_mode or not api_key or llm_settings.provider == LLMProvider.MOCK:
            raw = json.dumps(
                self._build_mock_response(template_schema=template_schema, paper=paper, paper_text=prompt_text),
                indent=2,
            )
        elif llm_settings.provider == LLMProvider.OPENAI:
            raw = await self._call_openai(
                api_key=api_key,
                model=llm_settings.model,
                temperature=llm_settings.temperature,
                system_prompt=system_prompt,
                analyst_instructions=analyst_instructions,
                template_schema=template_schema,
                paper=paper,
                paper_text=prompt_text,
            )
        elif llm_settings.provider == LLMProvider.ANTHROPIC:
            raw = await self._call_anthropic(
                api_key=api_key,
                model=llm_settings.model,
                temperature=llm_settings.temperature,
                system_prompt=system_prompt,
                analyst_instructions=analyst_instructions,
                template_schema=template_schema,
                paper=paper,
                paper_text=prompt_text,
            )
        else:
            raise ValueError(f"Unsupported LLM provider: {llm_settings.provider}")

        parsed = self._parse_response(raw)
        normalized_output, warnings, notes, confidence = self._normalize_output(parsed, template_schema)
        return {
            "raw_text": raw,
            "normalized_output": normalized_output,
            "validation_warnings": warnings,
            "notes": notes,
            "confidence": confidence,
        }

    async def list_openai_models(self, api_key: str) -> list[str]:
        url = f"{self.settings.openai_base_url.rstrip('/')}/models"
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            payload = response.json()

        models: list[str] = []
        for item in payload.get("data", []):
            model_id = item.get("id")
            if not isinstance(model_id, str):
                continue
            if model_id.startswith("ft:"):
                continue
            if not model_id.startswith(("gpt-", "o1", "o3", "o4", "o5", "chatgpt-")):
                continue
            if any(
                blocked in model_id
                for blocked in ("audio", "realtime", "transcribe", "tts", "image", "dall-e", "whisper", "embedding", "moderation")
            ):
                continue
            models.append(model_id)

        unique_models = sorted(set(models))
        return unique_models or ["gpt-4.1-mini"]

    async def _call_openai(
        self,
        api_key: str,
        model: str,
        temperature: float,
        system_prompt: str,
        analyst_instructions: str,
        template_schema: TemplateSchema,
        paper: PaperRecord,
        paper_text: str,
    ) -> str:
        url = f"{self.settings.openai_base_url.rstrip('/')}/chat/completions"
        body = {
            "model": model,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": self._compose_system_prompt(system_prompt)},
                {
                    "role": "user",
                    "content": self._compose_user_prompt(
                        analyst_instructions=analyst_instructions,
                        template_schema=template_schema,
                        paper=paper,
                        paper_text=paper_text,
                    ),
                },
            ],
        }
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            response.raise_for_status()
            payload = response.json()
        return payload["choices"][0]["message"]["content"]

    async def _call_anthropic(
        self,
        api_key: str,
        model: str,
        temperature: float,
        system_prompt: str,
        analyst_instructions: str,
        template_schema: TemplateSchema,
        paper: PaperRecord,
        paper_text: str,
    ) -> str:
        url = f"{self.settings.anthropic_base_url.rstrip('/')}/messages"
        body = {
            "model": model,
            "max_tokens": 4096,
            "temperature": temperature,
            "system": self._compose_system_prompt(system_prompt),
            "messages": [
                {
                    "role": "user",
                    "content": self._compose_user_prompt(
                        analyst_instructions=analyst_instructions,
                        template_schema=template_schema,
                        paper=paper,
                        paper_text=paper_text,
                    ),
                }
            ],
        }
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                url,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=body,
            )
            response.raise_for_status()
            payload = response.json()

        blocks = [item["text"] for item in payload.get("content", []) if item.get("type") == "text"]
        return "\n".join(blocks)

    def _apply_pdf_char_limit(self, paper_text: str) -> str:
        if self.settings.max_pdf_chars <= 0:
            return paper_text
        return paper_text[: self.settings.max_pdf_chars]

    def _compose_system_prompt(self, user_system_prompt: str) -> str:
        if user_system_prompt.strip():
            return f"{DEFAULT_SYSTEM_PROMPT}\n\nAdditional system instructions:\n{user_system_prompt.strip()}"
        return DEFAULT_SYSTEM_PROMPT

    def _compose_user_prompt(
        self,
        analyst_instructions: str,
        template_schema: TemplateSchema,
        paper: PaperRecord,
        paper_text: str,
    ) -> str:
        schema = self.template_service.build_prompt_schema(template_schema)
        output_contract = {
            "sheets": {
                sheet_name: {"row": {column_name: "string" for column_name in columns}}
                for sheet_name, columns in schema.items()
            },
            "paper_summary": "string",
            "confidence": "low | medium | high",
        }
        analyst_block = analyst_instructions.strip() or "No extra analyst instructions were provided."
        return f"""
Analyze this survey paper and populate every requested sheet row from the Excel template.
Process this paper independently.

Paper filename: {paper.original_filename}

Analyst instructions:
{analyst_block}

Template schema and column guidance:
{json.dumps(schema, indent=2)}

Return JSON only with this exact top-level structure:
{json.dumps(output_contract, indent=2)}

Paper text:
{paper_text}
""".strip()

    def _parse_response(self, raw_text: str) -> dict[str, Any]:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()

        if not cleaned.startswith("{"):
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start == -1 or end == -1:
                raise ValueError("LLM response did not contain a JSON object.")
            cleaned = cleaned[start : end + 1]

        return json.loads(cleaned)

    def _normalize_output(
        self,
        parsed: dict[str, Any],
        template_schema: TemplateSchema,
    ) -> tuple[dict[str, dict[str, str]], list[str], str | None, str | None]:
        warnings: list[str] = []
        sheets_payload = parsed.get("sheets", parsed)
        normalized_output: dict[str, dict[str, str]] = {}

        for sheet in template_schema.sheets:
            row_payload = self._find_sheet_payload(sheet.name, sheets_payload)
            if row_payload is None:
                warnings.append(f"Missing sheet '{sheet.name}' in LLM output.")
                normalized_output[sheet.name] = {column.name: "" for column in sheet.columns}
                continue

            if isinstance(row_payload, dict) and isinstance(row_payload.get("row"), dict):
                row_payload = row_payload["row"]

            if not isinstance(row_payload, dict):
                warnings.append(f"Sheet '{sheet.name}' did not contain a row object.")
                normalized_output[sheet.name] = {column.name: "" for column in sheet.columns}
                continue

            normalized_row: dict[str, str] = {}
            for column in sheet.columns:
                value = self._find_column_value(column.name, row_payload)
                if value is None:
                    warnings.append(f"Missing column '{column.name}' on sheet '{sheet.name}'.")
                    normalized_row[column.name] = ""
                else:
                    normalized_row[column.name] = self._stringify_value(value)
            normalized_output[sheet.name] = normalized_row

        return (
            normalized_output,
            warnings,
            self._stringify_optional(parsed.get("paper_summary")),
            self._stringify_optional(parsed.get("confidence")),
        )

    def _find_sheet_payload(self, sheet_name: str, sheets_payload: Any) -> Any:
        if not isinstance(sheets_payload, dict):
            return None
        if sheet_name in sheets_payload:
            return sheets_payload[sheet_name]
        lower_map = {str(key).strip().lower(): value for key, value in sheets_payload.items()}
        return lower_map.get(sheet_name.lower())

    def _find_column_value(self, column_name: str, row_payload: dict[str, Any]) -> Any:
        if column_name in row_payload:
            return row_payload[column_name]
        lower_map = {str(key).strip().lower(): value for key, value in row_payload.items()}
        return lower_map.get(column_name.lower())

    def _stringify_value(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, (int, float, bool)):
            return str(value)
        if isinstance(value, list):
            return "; ".join(self._stringify_value(item) for item in value if item is not None)
        return json.dumps(value, ensure_ascii=False)

    def _stringify_optional(self, value: Any) -> str | None:
        if value in (None, ""):
            return None
        return self._stringify_value(value)

    def _build_mock_response(
        self,
        template_schema: TemplateSchema,
        paper: PaperRecord,
        paper_text: str,
    ) -> dict[str, Any]:
        title = self._extract_title(paper_text) or Path(paper.original_filename).stem
        year = self._extract_year(paper_text)
        rows: dict[str, dict[str, dict[str, str]]] = {}

        for sheet in template_schema.sheets:
            row: dict[str, str] = {}
            for column in sheet.columns:
                lowered = column.name.lower()
                if "title" in lowered:
                    row[column.name] = title
                elif "year" in lowered:
                    row[column.name] = year or ""
                elif "author" in lowered:
                    row[column.name] = self._extract_authors(paper_text)
                elif "country" in lowered:
                    row[column.name] = self._extract_country(paper_text)
                elif "aim" in lowered or "objective" in lowered:
                    row[column.name] = "Mock mode: objective inferred from the abstract or introduction."
                elif "method" in lowered or "design" in lowered:
                    row[column.name] = "Mock mode: methodology summary pending live LLM extraction."
                elif "sample" in lowered or "participants" in lowered:
                    row[column.name] = self._extract_sample_size(paper_text)
                elif "source" in lowered or "file" in lowered:
                    row[column.name] = paper.original_filename
                else:
                    row[column.name] = f"Mock value for {column.name}"
            rows[sheet.name] = {"row": row}

        return {
            "sheets": rows,
            "paper_summary": "Generated in mock mode because no API key was supplied.",
            "confidence": "low",
        }

    def _extract_title(self, paper_text: str) -> str | None:
        for line in paper_text.splitlines():
            candidate = line.strip()
            if 15 <= len(candidate) <= 180:
                return candidate
        return None

    def _extract_year(self, paper_text: str) -> str | None:
        match = re.search(r"\b(19|20)\d{2}\b", paper_text)
        return match.group(0) if match else None

    def _extract_authors(self, paper_text: str) -> str:
        lines = [line.strip() for line in paper_text.splitlines() if line.strip()]
        if len(lines) >= 2 and len(lines[1].split()) <= 12:
            return lines[1]
        return "Unknown"

    def _extract_country(self, paper_text: str) -> str:
        countries = [
            "United States",
            "United Kingdom",
            "Germany",
            "France",
            "Spain",
            "Italy",
            "Canada",
            "Australia",
            "China",
            "Japan",
            "India",
            "Brazil",
        ]
        lowered_text = paper_text.lower()
        for country in countries:
            if country.lower() in lowered_text:
                return country
        return ""

    def _extract_sample_size(self, paper_text: str) -> str:
        patterns = [
            r"\b(n\s*=\s*\d+)\b",
            r"\b(\d+\s+participants)\b",
            r"\b(sample size\s*[:=]?\s*\d+)\b",
        ]
        for pattern in patterns:
            match = re.search(pattern, paper_text, flags=re.IGNORECASE)
            if match:
                return match.group(1)
        return ""


_llm_service = LLMService(get_template_service())


def get_llm_service() -> LLMService:
    return _llm_service
