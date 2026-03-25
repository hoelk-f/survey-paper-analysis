from pathlib import Path

import fitz


class PdfService:
    def extract_text(self, pdf_path: Path) -> tuple[str, int]:
        with fitz.open(pdf_path) as document:
            pages = [page.get_text("text") for page in document]
            text = "\n\n".join(chunk.strip() for chunk in pages if chunk.strip()).strip()
            return text, document.page_count

    def get_page_count(self, pdf_path: Path) -> int:
        with fitz.open(pdf_path) as document:
            return document.page_count


_pdf_service = PdfService()


def get_pdf_service() -> PdfService:
    return _pdf_service
