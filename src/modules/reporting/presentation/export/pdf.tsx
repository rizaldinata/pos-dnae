import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ExportCellValue, ExportColumn, ExportDataset } from "./dataset";
import type { ExportStoreInfo } from "./store";
import { formatRupiah } from "@/shared/lib/format-rupiah";

const FIRST_PAGE_ROWS = 16;
const LATER_PAGE_ROWS = 24;

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 28,
    paddingVertical: 28,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  storeName: { fontSize: 14, textAlign: "center", fontWeight: "bold" },
  storeMeta: {
    fontSize: 8,
    textAlign: "center",
    color: "#6b7280",
    marginTop: 2,
  },
  title: { fontSize: 11, fontWeight: "bold", marginTop: 14 },
  subtitle: { fontSize: 8, color: "#6b7280", marginBottom: 8 },
  continued: { fontSize: 9, fontWeight: "bold", marginBottom: 8 },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#111827",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  headerText: { color: "#ffffff", fontWeight: "bold", fontSize: 7 },
  headerTextRight: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 7,
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  totalsRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontWeight: "bold",
  },
  cell: { fontSize: 7 },
  cellRight: { fontSize: 7, textAlign: "right" },
  empty: { textAlign: "center", color: "#6b7280", marginVertical: 16 },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#6b7280",
  },
});

function display(
  col: ExportColumn,
  value: ExportCellValue | undefined
): string {
  if (value === null || value === undefined) {
    return "-";
  }
  switch (col.type) {
    case "money":
      return formatRupiah(Number(value));
    case "number":
    case "qty":
      return new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 3,
      }).format(Number(value));
    case "percent":
      return `${Math.round(Number(value) * 10) / 10}%`;
    default:
      return String(value);
  }
}

/** Lebar kolom (persen) dari panjang header + sampel nilai. */
function columnWidths(dataset: ExportDataset): number[] {
  const weights = dataset.columns.map((col) => {
    let max = col.label.length;
    for (const row of dataset.rows.slice(0, 80)) {
      max = Math.max(max, display(col, row[col.key]).length);
    }
    return Math.min(Math.max(max, 6), 28);
  });
  const sum = weights.reduce((acc, w) => acc + w, 0) || 1;
  return weights.map((w) => (w / sum) * 100);
}

function chunkRows(rows: ExportDataset["rows"]): ExportDataset["rows"][] {
  if (rows.length <= FIRST_PAGE_ROWS) {
    return [rows];
  }
  const chunks: ExportDataset["rows"][] = [rows.slice(0, FIRST_PAGE_ROWS)];
  for (let i = FIRST_PAGE_ROWS; i < rows.length; i += LATER_PAGE_ROWS) {
    chunks.push(rows.slice(i, i + LATER_PAGE_ROWS));
  }
  return chunks;
}

function ReportDocument({
  dataset,
  store,
}: {
  dataset: ExportDataset;
  store: ExportStoreInfo;
}) {
  const widths = columnWidths(dataset);
  const chunks = chunkRows(dataset.rows);

  return (
    <Document title={dataset.title} author={store.name}>
      {chunks.map((chunk, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {pageIndex === 0 ? (
            <>
              <Text style={styles.storeName}>{store.name}</Text>
              {store.address ? (
                <Text style={styles.storeMeta}>{store.address}</Text>
              ) : null}
              {store.phone ? (
                <Text style={styles.storeMeta}>{store.phone}</Text>
              ) : null}
              <Text style={styles.title}>{dataset.title}</Text>
              <Text style={styles.subtitle}>{dataset.subtitle}</Text>
            </>
          ) : (
            <Text style={styles.continued}>{dataset.title} (lanjutan)</Text>
          )}

          <View style={styles.headerRow}>
            {dataset.columns.map((col, index) => (
              <Text
                key={col.key}
                style={[
                  col.type === "text"
                    ? styles.headerText
                    : styles.headerTextRight,
                  { width: `${widths[index]}%` },
                ]}
              >
                {col.label}
              </Text>
            ))}
          </View>

          {chunk.length === 0 ? (
            <Text style={styles.empty}>Tidak ada data</Text>
          ) : (
            chunk.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.row}>
                {dataset.columns.map((col, index) => (
                  <Text
                    key={col.key}
                    style={[
                      col.type === "text" ? styles.cell : styles.cellRight,
                      { width: `${widths[index]}%` },
                    ]}
                  >
                    {display(col, row[col.key])}
                  </Text>
                ))}
              </View>
            ))
          )}

          {dataset.totals && pageIndex === chunks.length - 1 ? (
            <View style={styles.totalsRow}>
              {dataset.columns.map((col, index) => (
                <Text
                  key={col.key}
                  style={[
                    col.type === "text" ? styles.cell : styles.cellRight,
                    { width: `${widths[index]}%` },
                  ]}
                >
                  {display(col, dataset.totals?.[col.key] ?? null)}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={{ maxWidth: "70%" }}>{store.footer}</Text>
            <Text>
              Halaman {pageIndex + 1} dari {chunks.length}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}

/** Render laporan menjadi buffer PDF. */
export async function buildPdfBuffer(
  dataset: ExportDataset,
  store: ExportStoreInfo
): Promise<Buffer> {
  return renderToBuffer(<ReportDocument dataset={dataset} store={store} />);
}
