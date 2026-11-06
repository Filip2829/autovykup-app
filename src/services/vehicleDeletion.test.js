import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteVehicleEverywhere, cleanupDeletedVehicleFiles } from "./vehicleDeletion.js";
import { drainVehicleFiles } from "../../supabase/functions/cleanup-vehicle-files/cleanup.js";

function deletionClient({ deletion = { data: { id: 4 }, error: null }, cleanup = { data: { pending: 0 }, error: null } } = {}) {
  const calls = [];
  const query = {
    delete() { calls.push("delete"); return this; },
    eq(key, value) { calls.push([key, value]); return this; },
    select(value) { calls.push(["select", value]); return this; },
    async single() { return deletion; },
  };
  return { calls, from(name) { assert.equal(name, "cars"); return query; }, functions: { async invoke(name) { calls.push(name); return cleanup; } } };
}
test("successful deletion confirms the returned vehicle then cleans its queued files", async () => {
  const client = deletionClient();
  assert.deepEqual(await deleteVehicleEverywhere(client, 4), { deletedId: 4, cleanupPending: false });
  assert.deepEqual(client.calls, ["delete", ["id", 4], ["select", "id"], "cleanup-vehicle-files"]);
});
test("failed or silently denied deletion never starts file cleanup", async () => {
  for (const deletion of [{ data: null, error: new Error("blocked") }, { data: null, error: null }]) {
    const client = deletionClient({ deletion });
    await assert.rejects(deleteVehicleEverywhere(client, 4));
    assert.equal(client.calls.includes("cleanup-vehicle-files"), false);
  }
});
test("invalid ids never issue a database mutation", async () => {
  const client = deletionClient();
  for (const id of [null, undefined, "4 OR true", ""]) await assert.rejects(deleteVehicleEverywhere(client, id));
  assert.equal(client.calls.length, 0);
});
test("cleanup failure does not report the already deleted vehicle as undeleted", async () => {
  const client = deletionClient({ cleanup: { data: null, error: new Error("offline") } });
  assert.deepEqual(await deleteVehicleEverywhere(client, 4), { deletedId: 4, cleanupPending: true });
});
test("a partially drained queue is reported as pending", async () => {
  await assert.rejects(cleanupDeletedVehicleFiles(deletionClient({ cleanup: { data: { pending: 1 }, error: null } })));
});
function cleanupDb({ failStorage = false, failAcknowledge = false } = {}) {
  let pending = 1;
  const paths = [];
  return { paths, storage: { from(bucket) { assert.equal(bucket, "valuation-photos"); return { async remove(items) { paths.push(...items); return { error: failStorage ? new Error("offline") : null }; } }; } },
    from(table) {
      assert.equal(table, "vehicle_file_cleanup");
      let deleting = false;
      return {
        select(_fields, options) { if (options?.head) return Promise.resolve({ count: pending }); return this; },
        order() { return this; },
        async limit() { return { data: pending ? [{ bucket_id: "valuation-photos", object_path: "request/photo.jpg" }] : [] }; },
        delete() { deleting = true; return this; },
        eq() { return this; },
        then(resolve) { if (deleting && !failAcknowledge) pending = 0; return Promise.resolve({ error: failAcknowledge ? new Error("db offline") : null }).then(resolve); },
      };
    },
  };
}
test("cleanup removes queued storage objects and only then acknowledges the job", async () => {
  const db = cleanupDb();
  assert.deepEqual(await drainVehicleFiles(db), { removed: 1, pending: 0 });
  assert.deepEqual(db.paths, ["request/photo.jpg"]);
});
test("storage or acknowledgement failure retains a durable job for safe retry", async () => {
  for (const options of [{ failStorage: true }, { failAcknowledge: true }]) {
    assert.deepEqual(await drainVehicleFiles(cleanupDb(options)), { removed: 0, pending: 1 });
  }
});
