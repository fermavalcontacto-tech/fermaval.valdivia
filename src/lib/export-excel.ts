// Client-side Excel export helper (uses ExcelJS dynamically)
export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
};

export async function exportRowsToExcel(opts: {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.sheetName ?? "Datos");
  ws.columns = opts.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  ws.getRow(1).font = { bold: true };
  for (const r of opts.rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  a.click();
  URL.revokeObjectURL(url);
}
