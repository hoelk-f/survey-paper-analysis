# SPA - Survey Paper Analysis

SPA - Survey Paper Analysis is a full-stack application for extracting structured data from survey paper PDFs into a user-provided Excel template.

The app is organized around `Projects` and `Versions`:
- A `Project` is the top-level analysis container.
- A `Version` is a single extraction run inside a project.
- Every version keeps its own snapshot of PDFs, template, column guidance, prompts, model settings, and outputs.

## What It Does

- Create projects through a guided wizard
- Upload an Excel template and infer the target schema from its headers
- Add column-specific guidance so the LLM knows what each column should contain
- Upload multiple PDFs and process them one by one
- Choose an LLM provider and model in the UI and provide the matching API key there
- Fall back to deterministic mock mode when no API key is provided
- Create refined follow-up versions without overwriting earlier ones
- Reopen older versions and inspect their exact inputs
- Export the completed Excel workbook for any version

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI, Pydantic
- PDF parsing: PyMuPDF
- Excel handling: openpyxl
- Deployment: Docker Compose

## Workflow

1. Create a new project.
2. Upload the Excel template.
3. Review the inferred headers and add optional column guidance.
4. Upload the survey paper PDFs.
5. Select the LLM provider and model and run the first version.
6. Refine the project by creating additional versions with different PDFs, template snapshots, prompts, or settings.
7. Export the generated workbook from the selected version.

## Versioning Model

Each version is independent and stores its own snapshot of:
- uploaded PDFs
- template file
- inferred template schema
- column guidance
- system prompt
- analyst instructions
- model and temperature
- extracted outputs and export workbook

This means a later version can use a different template or additional PDFs without changing earlier versions.

## Installation

Requirements:
- Docker Desktop with Docker Compose

Start the full application:

```powershell
docker compose up -d --build
```

After startup:
- Frontend: `http://localhost:8080`
- Backend health: `http://localhost:8000/api/health`
- Backend via frontend proxy: `http://localhost:8080/api/health`

## Persistence

Application data is stored in the Docker volume `survey_paper_data`.

## Repository Layout

```text
backend/
  app/
    api/
    core/
    schemas/
    services/
    storage/
frontend/
  src/
    api/
    components/
    pages/
docker-compose.yml
```

## Notes

- The UI currently supports OpenAI and a KI4BUW-hosted LLM server (`https://llm.ki4buw.de/v1`).
- If no API key is entered, the backend runs in mock mode.
- Extracted results are a first pass and must be reviewed manually before use.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
