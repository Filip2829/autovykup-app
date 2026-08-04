const supportedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const supportedExtensions = new Set(["pdf", "jpg", "jpeg", "png"]);

function getExtension(value) {
  const cleanValue = String(value || "").split(/[?#]/, 1)[0];
  return cleanValue.split(".").pop()?.toLocaleLowerCase("cs-CZ") || "";
}

function isSupportedUrl(value) {
  return supportedExtensions.has(getExtension(value));
}

export function isSupportedVehicleAnalysisDocument(document = {}) {
  const mimeType = String(document.mimeType || document.mime_type || "")
    .trim()
    .toLocaleLowerCase("cs-CZ");

  if (supportedMimeTypes.has(mimeType)) return true;

  return [
    document.filePath,
    document.file_path,
    document.fileName,
    document.file_name,
  ].some(isSupportedUrl);
}

function addUniqueUrl(urls, seen, value) {
  const url = String(value || "").trim();
  if (!url || !isSupportedUrl(url) || seen.has(url)) return;

  seen.add(url);
  urls.push(url);
}

export async function buildVehicleAnalysisDocumentUrls({
  vehicleDocuments = [],
  technicalCardPhotos = [],
  cebiaFiles = [],
  createSignedUrl,
} = {}) {
  const urls = [];
  const seen = new Set();
  const seenFilePaths = new Set();

  for (const value of [...technicalCardPhotos, ...cebiaFiles]) {
    addUniqueUrl(urls, seen, value);
  }

  for (const document of vehicleDocuments) {
    if (!isSupportedVehicleAnalysisDocument(document)) continue;

    const filePath = document.filePath || document.file_path;
    if (
      !filePath ||
      seenFilePaths.has(filePath) ||
      typeof createSignedUrl !== "function"
    ) {
      continue;
    }

    seenFilePaths.add(filePath);

    const signedUrl = await createSignedUrl(filePath, document);
    addUniqueUrl(urls, seen, signedUrl);
  }

  return urls;
}

export async function getFunctionErrorDetail(error, data) {
  const directDetail = data?.detail || data?.error;
  if (typeof directDetail === "string" && directDetail.trim()) {
    return directDetail.trim();
  }

  if (error?.context && typeof error.context.json === "function") {
    try {
      const responseBody = await error.context.json();
      const responseDetail = responseBody?.detail || responseBody?.error;
      if (typeof responseDetail === "string" && responseDetail.trim()) {
        return responseDetail.trim();
      }
    } catch {
      // The response body is optional; fall back to the Supabase error below.
    }
  }

  return typeof error?.message === "string" && error.message.trim()
    ? error.message.trim()
    : "Neznámá chyba Edge Function.";
}
