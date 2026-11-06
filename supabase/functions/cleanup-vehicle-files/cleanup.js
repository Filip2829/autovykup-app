export async function drainVehicleFiles(db, limit = 100) {
  const { data: jobs, error } = await db.from("vehicle_file_cleanup")
    .select("bucket_id,object_path").order("created_at").limit(limit);
  if (error) throw error;
  let removed = 0;
  for (const job of jobs || []) {
    const { error: storageError } = await db.storage.from(job.bucket_id).remove([job.object_path]);
    if (storageError) continue;
    const { error: deleteError } = await db.from("vehicle_file_cleanup").delete()
      .eq("bucket_id", job.bucket_id).eq("object_path", job.object_path);
    if (!deleteError) removed++;
  }
  const { count, error: countError } = await db.from("vehicle_file_cleanup").select("*", { count: "exact", head: true });
  if (countError) throw countError;
  return { removed, pending: count || 0 };
}
