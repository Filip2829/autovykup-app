import { supabase } from "../supabase.js";

export const customerStatuses = [
  { value: "active", label: "Aktivní" },
  { value: "inactive", label: "Neaktivní" },
  { value: "archived", label: "Archivovaný" },
];

const customerFields = {
  firstName: "first_name",
  lastName: "last_name",
  phone: "phone",
  email: "email",
  notes: "notes",
  status: "status",
  lastContactAt: "last_contact_at",
  nextContactAt: "next_contact_at",
};

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value) {
  const normalized = trimText(value);
  return normalized || null;
}

function nullableDate(value) {
  if (value === "" || value === null || value === undefined) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function mapCustomerRow(row = {}) {
  return {
    id: row.id ?? null,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    notes: row.notes ?? "",
    status: row.status ?? "active",
    lastContactAt: row.last_contact_at ?? null,
    nextContactAt: row.next_contact_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function mapCustomerChangesToPayload(changes = {}) {
  const payload = {};

  Object.entries(customerFields).forEach(([uiField, databaseField]) => {
    if (!Object.prototype.hasOwnProperty.call(changes, uiField)) return;

    if (uiField === "lastContactAt" || uiField === "nextContactAt") {
      payload[databaseField] = nullableDate(changes[uiField]);
      return;
    }

    if (uiField === "phone" || uiField === "email") {
      payload[databaseField] = nullableText(changes[uiField]);
      return;
    }

    payload[databaseField] = trimText(changes[uiField]);
  });

  return payload;
}

export function validateCustomer(customer = {}) {
  const firstName = trimText(customer.firstName);
  const lastName = trimText(customer.lastName);
  const phone = trimText(customer.phone);
  const email = trimText(customer.email);

  if (!firstName && !lastName && !phone && !email) {
    return {
      valid: false,
      error: "Vyplňte alespoň jméno, příjmení, telefon nebo e-mail.",
    };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      valid: false,
      error: "Zadejte platnou e-mailovou adresu.",
    };
  }

  if (!customerStatuses.some((status) => status.value === customer.status)) {
    return {
      valid: false,
      error: "Vyberte platný stav zákazníka.",
    };
  }

  return { valid: true, error: "" };
}

function customerSearchText(customer) {
  return [
    customer.firstName,
    customer.lastName,
    customer.phone,
    customer.email,
  ]
    .map((value) => String(value || "").toLocaleLowerCase("cs-CZ"))
    .join(" ");
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function filterCustomers(
  customers = [],
  { query = "", status = "active" } = {}
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("cs-CZ");
  const queryDigits = phoneDigits(normalizedQuery);

  return customers.filter((customer) => {
    if (status !== "all" && customer.status !== status) return false;
    if (!normalizedQuery) return true;

    const textMatches = customerSearchText(customer).includes(normalizedQuery);
    const phoneMatches =
      queryDigits.length > 0 &&
      phoneDigits(customer.phone).includes(queryDigits);

    return textMatches || phoneMatches;
  });
}

function customerServiceError(action, error) {
  const detail = error?.message ? `: ${error.message}` : "";
  return new Error(`${action} se nepodařilo${detail}`);
}

export async function loadCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw customerServiceError("Načtení zákazníků", error);
  return (data || []).map(mapCustomerRow);
}

export async function createCustomer(customer) {
  const payload = mapCustomerChangesToPayload(customer);
  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select()
    .single();

  if (error) throw customerServiceError("Vytvoření zákazníka", error);
  return mapCustomerRow(data);
}

export async function updateCustomer(id, changes) {
  const payload = mapCustomerChangesToPayload(changes);
  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw customerServiceError("Uložení zákazníka", error);
  return mapCustomerRow(data);
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) throw customerServiceError("Smazání zákazníka", error);
}
