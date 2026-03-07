export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    let message = "Failed to delete document";
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // Keep generic message when JSON parsing fails.
    }
    throw new Error(message);
  }
}

export async function deleteAllDocuments(): Promise<void> {
  const listResponse = await fetch("/api/documents");
  if (!listResponse.ok) {
    throw new Error("Failed to fetch documents before delete-all");
  }

  const data = await listResponse.json();
  const docs: Array<{ id: string }> = Array.isArray(data?.documents) ? data.documents : [];
  if (!docs.length) return;

  await Promise.all(docs.map((doc) => deleteDocument(doc.id)));
}
