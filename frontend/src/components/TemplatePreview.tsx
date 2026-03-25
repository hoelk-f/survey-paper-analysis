import type { TemplateSchema } from "../types";

interface TemplatePreviewProps {
  filename?: string | null;
  schema: TemplateSchema | null;
  maxHeightClassName?: string;
}

export function TemplatePreview({
  filename,
  schema,
  maxHeightClassName = "max-h-[22rem]",
}: TemplatePreviewProps) {
  const scrollClassName = `${maxHeightClassName} space-y-3 overflow-y-auto pr-1`.trim();

  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
      <div className="mb-3 text-sm font-medium text-white">{filename || schema?.workbook_filename || "Template"}</div>
      <div className={scrollClassName}>
        {!schema || schema.sheets.length === 0 ? (
          <div className="rounded-xl bg-white/5 p-3 text-sm text-slate-500">No template preview available.</div>
        ) : (
          schema.sheets.map((sheet) => (
            <div key={sheet.name} className="rounded-xl bg-white/5 p-3">
              <div className="text-sm font-semibold text-white">{sheet.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {sheet.columns.map((column) => (
                  <span
                    key={`${sheet.name}-${column.name}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                  >
                    {column.name}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
