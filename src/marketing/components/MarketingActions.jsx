function buildDownloadHtml(cardElement) {
  const styles = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");

  return `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <title>A4 karta vozu</title>
  <style>${styles}</style>
</head>
<body>
  ${cardElement.outerHTML}
</body>
</html>`;
}

function getSafeFileName(value) {
  return String(value || "a4-karta-vozu")
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export default function MarketingActions({ cardRef, fileName }) {
  function printCard() {
    window.print();
  }

  function downloadCard() {
    if (!cardRef.current) return;

    const html = buildDownloadHtml(cardRef.current);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${getSafeFileName(fileName)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="marketingActions">
      <button className="primary" type="button" onClick={printCard}>
        Tisk karty
      </button>
      <button className="primary outline" type="button" onClick={downloadCard}>
        Stáhnout kartu
      </button>
    </div>
  );
}
