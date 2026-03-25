import type { TemplateSchema } from "../types";

interface TemplateGuidanceEditorProps {
  schema: TemplateSchema | null;
  onChange: (schema: TemplateSchema) => void;
  maxHeightClassName?: string;
}

export function TemplateGuidanceEditor({
  schema,
  onChange,
  maxHeightClassName = "max-h-[24rem]",
}: TemplateGuidanceEditorProps) {
  const scrollClassName = `${maxHeightClassName} space-y-4 overflow-y-auto pr-1`.trim();

  if (!schema || schema.sheets.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
      <div className="mb-3 text-sm font-medium text-white">Column Guidance</div>
      <div className={scrollClassName}>
        {schema.sheets.map((sheet) => (
          <div key={sheet.name} className="rounded-xl bg-white/5 p-4">
            <div className="mb-3 text-sm font-semibold text-white">{sheet.name}</div>
            <div className="grid gap-3">
              {sheet.columns.map((column) => (
                <label key={`${sheet.name}-${column.name}`} className="block rounded-xl border border-white/8 bg-black/10 p-3">
                  <div className="mb-1 text-sm font-medium text-white">{column.name}</div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">{column.excel_column}</div>
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
                    placeholder="Explain what this column should contain."
                    value={column.description || ""}
                    onChange={(event) => {
                      const nextSchema: TemplateSchema = {
                        ...schema,
                        sheets: schema.sheets.map((currentSheet) =>
                          currentSheet.name !== sheet.name
                            ? currentSheet
                            : {
                                ...currentSheet,
                                columns: currentSheet.columns.map((currentColumn) =>
                                  currentColumn.name !== column.name
                                    ? currentColumn
                                    : {
                                        ...currentColumn,
                                        description: event.target.value,
                                      },
                                ),
                              },
                        ),
                      };
                      onChange(nextSchema);
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
