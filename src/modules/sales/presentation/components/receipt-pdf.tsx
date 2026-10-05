"use client";

import {
  Document,
  Page,
  PDFDownloadLink,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReceiptDTO } from "@/modules/sales/presentation/actions/checkout.action";
import {
  DEFAULT_RECEIPT_STORE,
  type ReceiptStoreInfo,
} from "@/modules/sales/presentation/components/receipt-preview";

const styles = StyleSheet.create({
  page: { padding: 16, fontSize: 9, fontFamily: "Courier" },
  center: { textAlign: "center", marginBottom: 4 },
  title: { fontSize: 13, textAlign: "center", marginBottom: 2 },
  line: {
    borderBottomWidth: 1,
    borderBottomStyle: "dashed",
    marginVertical: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  bold: { fontWeight: "bold" },
});

function ReceiptDocument({
  receipt,
  store,
}: {
  receipt: ReceiptDTO;
  store: ReceiptStoreInfo;
}) {
  return (
    <Document>
      {/* Lebar ~80mm thermal */}
      <Page size={[226, 700]} style={styles.page}>
        <Text style={styles.title}>{store.name}</Text>
        {store.address ? (
          <Text style={styles.center}>{store.address}</Text>
        ) : null}
        {store.phone ? <Text style={styles.center}>{store.phone}</Text> : null}
        <View style={styles.line} />
        <Text>{receipt.invoiceNo}</Text>
        <Text>
          {new Intl.DateTimeFormat("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(receipt.createdAt))}{" "}
          • {receipt.cashierName}
        </Text>
        <View style={styles.line} />
        {receipt.items.map((item, index) => (
          <View key={`${item.sku}-${index}`} style={{ marginBottom: 4 }}>
            <Text style={styles.bold}>{item.productName}</Text>
            <View style={styles.row}>
              <Text>
                {item.qty} x Rp {item.unitPrice.toLocaleString("id-ID")}
              </Text>
              <Text>Rp {item.subtotal.toLocaleString("id-ID")}</Text>
            </View>
            {item.discount > 0 && (
              <View style={styles.row}>
                <Text>Diskon</Text>
                <Text>-Rp {item.discount.toLocaleString("id-ID")}</Text>
              </View>
            )}
          </View>
        ))}
        <View style={styles.line} />
        <View style={styles.row}>
          <Text>Subtotal</Text>
          <Text>Rp {receipt.subtotal.toLocaleString("id-ID")}</Text>
        </View>
        {receipt.discountTotal > 0 && (
          <View style={styles.row}>
            <Text>Diskon</Text>
            <Text>-Rp {receipt.discountTotal.toLocaleString("id-ID")}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.bold}>Total</Text>
          <Text style={styles.bold}>
            Rp {receipt.grandTotal.toLocaleString("id-ID")}
          </Text>
        </View>
        {receipt.payments.map((p, index) => (
          <View key={index} style={styles.row}>
            <Text>{p.paymentMethodName}</Text>
            <Text>Rp {p.amount.toLocaleString("id-ID")}</Text>
          </View>
        ))}
        <View style={styles.row}>
          <Text>Kembali</Text>
          <Text>Rp {receipt.changeAmount.toLocaleString("id-ID")}</Text>
        </View>
        <View style={styles.line} />
        <Text style={styles.center}>{store.footer}</Text>
      </Page>
    </Document>
  );
}

export function ReceiptPdfDownload({
  receipt,
  store = DEFAULT_RECEIPT_STORE,
}: {
  receipt: ReceiptDTO;
  store?: ReceiptStoreInfo;
}) {
  return (
    <PDFDownloadLink
      document={<ReceiptDocument receipt={receipt} store={store} />}
      fileName={`${receipt.invoiceNo}.pdf`}
      className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm"
    >
      {({ loading }) => (loading ? "Menyiapkan PDF..." : "Unduh PDF")}
    </PDFDownloadLink>
  );
}
