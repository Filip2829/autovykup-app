export async function cleanupDeletedVehicleFiles(client) {
  const { data, error } = await client.functions.invoke("cleanup-vehicle-files", { body: {} });
  if (error || !data || data.pending > 0) {
    throw new Error("Záznam byl smazán. Odstranění některých souborů čeká na opakování při příštím načtení aplikace.");
  }
  return data;
}

export async function deleteVehicleEverywhere(client, carId) {
  if (carId === null || carId === undefined || !/^\d+$/.test(String(carId))) {
    throw new Error("Chybí platné ID vozu.");
  }
  // Returned rows distinguish an actual deletion from a silent RLS denial.
  const { data, error } = await client.from("cars").delete().eq("id", carId).select("id").single();
  if (error || !data) throw new Error(error?.message || "Vůz se nepodařilo smazat. Obnov přehled a ověř oprávnění.");
  try {
    await cleanupDeletedVehicleFiles(client);
    return { deletedId: data.id, cleanupPending: false };
  } catch {
    return { deletedId: data.id, cleanupPending: true };
  }
}
