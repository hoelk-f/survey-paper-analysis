import type { TemplateSchema } from "../types";
import { SurfaceCard } from "./SurfaceCard";

export function SchemaPreview({ schema }: { schema: TemplateSchema | null }) {
  return (
    <SurfaceCard title="Schema" subtitle={schema ? `${schema.sheets.length} sheets` : "Template columns"}>
      {!schema ? (
        <p className="text-sm text-slate-400">No template loaded.</p>
      ) : (
        <div className="space-y-4">
          {schema.sheets.map((sheet) => (
            <div key={sheet.name} className="rounded-2xl border border-white/10 bg-panelAlt/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-display text-lg font-semibold text-white">{sheet.name}</div>
                  <div className="text-sm text-slate-400">
                    Row {sheet.header_row_index} {"->"} {sheet.data_start_row_index}
                  </div>
                </div>
                <div className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  {sheet.columns.length}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {sheet.columns.map((column) => (
                  <span
                    key={`${sheet.name}-${column.excel_column}`}
                    className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-sm text-slate-200"
                  >
                    {column.excel_column}: {column.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
