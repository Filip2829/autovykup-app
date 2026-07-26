import { supabase } from "../supabase.js";
import { mapCustomerRow } from "./customers.js";

export const customerDemandStatuses = [
  { value: "active", label: "Aktivní" },
  { value: "paused", label: "Pozastavená" },
  { value: "fulfilled", label: "Vyřešená" },
  { value: "cancelled", label: "Zrušená" },
];

export const customerDemandPriorities = [
  { value: "low", label: "Nízká" },
  { value: "normal", label: "Běžná" },
  { value: "high", label: "Vysoká" },
  { value: "urgent", label: "Urgentní" },
];

const textFields = {
  title: "title",
  status: "status",
  priority: "priority",
};

const nullableTextFields = {
  notes: "notes",
};

const numberFields = {
  minPrice: "min_price",
  maxPrice: "max_price",
  minYear: "min_year",
  maxYear: "max_year",
  maxMileage: "max_mileage",
  minPowerKw: "min_power_kw",
  maxPowerKw: "max_power_kw",
};

const arrayFields = {
  makes: "makes",
  models: "models",
  bodyTypes: "body_types",
  fuelTypes: "fuel_types",
  transmissions: "transmissions",
  drivetrains: "drivetrains",
  requiredEquipment: "required_equipment",
  preferredEquipment: "preferred_equipment",
  preferredColors: "preferred_colors",
  excludedColors: "excluded_colors",
};

const integerFields = new Set([
  "minYear",
  "maxYear",
  "maxMileage",
  "minPowerKw",
  "maxPowerKw",
]);

function trimText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value) {
  const normalized = trimText(value);
  return normalized || null;
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function nullableNumber(value) {
  if (!hasValue(value)) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeDemandTextArray(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];
  const seen = new Set();

  return items.reduce((normalized, item) => {
    const text = trimText(String(item ?? ""));
    const key = text.toLocaleLowerCase("cs-CZ");

    if (!text || seen.has(key)) return normalized;

    seen.add(key);
    normalized.push(text);
    return normalized;
  }, []);
}

export function mapCustomerDemandRow(row = {}) {
  return {
    id: row.id ?? null,
    customerId: row.customer_id ?? null,
    title: row.title ?? "",
    status: row.status ?? "active",
    priority: row.priority ?? "normal",
    notes: row.notes ?? "",
    minPrice: row.min_price ?? null,
    maxPrice: row.max_price ?? null,
    makes: Array.isArray(row.makes) ? row.makes : [],
    models: Array.isArray(row.models) ? row.models : [],
    bodyTypes: Array.isArray(row.body_types) ? row.body_types : [],
    fuelTypes: Array.isArray(row.fuel_types) ? row.fuel_types : [],
    transmissions: Array.isArray(row.transmissions) ? row.transmissions : [],
    drivetrains: Array.isArray(row.drivetrains) ? row.drivetrains : [],
    minYear: row.min_year ?? null,
    maxYear: row.max_year ?? null,
    maxMileage: row.max_mileage ?? null,
    minPowerKw: row.min_power_kw ?? null,
    maxPowerKw: row.max_power_kw ?? null,
    requiredEquipment: Array.isArray(row.required_equipment)
      ? row.required_equipment
      : [],
    preferredEquipment: Array.isArray(row.preferred_equipment)
      ? row.preferred_equipment
      : [],
    preferredColors: Array.isArray(row.preferred_colors)
      ? row.preferred_colors
      : [],
    excludedColors: Array.isArray(row.excluded_colors)
      ? row.excluded_colors
      : [],
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function mapCustomerDemandWithCustomer(row = {}) {
  const relatedCustomer = Array.isArray(row.customer)
    ? row.customer[0]
    : row.customer;

  return {
    ...mapCustomerDemandRow(row),
    customer: relatedCustomer ? mapCustomerRow(relatedCustomer) : null,
  };
}

export function mapCustomerDemandChangesToPayload(changes = {}) {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(changes, "customerId")) {
    payload.customer_id = changes.customerId;
  }

  Object.entries(textFields).forEach(([uiField, databaseField]) => {
    if (!Object.prototype.hasOwnProperty.call(changes, uiField)) return;
    payload[databaseField] = trimText(changes[uiField]);
  });

  Object.entries(nullableTextFields).forEach(([uiField, databaseField]) => {
    if (!Object.prototype.hasOwnProperty.call(changes, uiField)) return;
    payload[databaseField] = nullableText(changes[uiField]);
  });

  Object.entries(numberFields).forEach(([uiField, databaseField]) => {
    if (!Object.prototype.hasOwnProperty.call(changes, uiField)) return;
    payload[databaseField] = nullableNumber(changes[uiField]);
  });

  Object.entries(arrayFields).forEach(([uiField, databaseField]) => {
    if (!Object.prototype.hasOwnProperty.call(changes, uiField)) return;
    payload[databaseField] = normalizeDemandTextArray(changes[uiField]);
  });

  return payload;
}

export function validateCustomerDemand(demand = {}) {
  if (!trimText(demand.title)) {
    return { valid: false, error: "Vyplňte název poptávky." };
  }

  if (
    !customerDemandStatuses.some((status) => status.value === demand.status)
  ) {
    return { valid: false, error: "Vyberte platný stav poptávky." };
  }

  if (
    !customerDemandPriorities.some(
      (priority) => priority.value === demand.priority
    )
  ) {
    return { valid: false, error: "Vyberte platnou prioritu poptávky." };
  }

  for (const [field, label] of [
    ["minPrice", "Minimální cena"],
    ["maxPrice", "Maximální cena"],
    ["minYear", "Minimální rok"],
    ["maxYear", "Maximální rok"],
    ["maxMileage", "Maximální nájezd"],
    ["minPowerKw", "Minimální výkon"],
    ["maxPowerKw", "Maximální výkon"],
  ]) {
    if (!hasValue(demand[field])) continue;

    const number = Number(demand[field]);
    if (!Number.isFinite(number) || number < 0) {
      return {
        valid: false,
        error: `${label} musí být nezáporné číslo.`,
      };
    }

    if (integerFields.has(field) && !Number.isInteger(number)) {
      return {
        valid: false,
        error: `${label} musí být celé číslo.`,
      };
    }
  }

  for (const [minimumField, maximumField, label] of [
    ["minPrice", "maxPrice", "Cenové rozpětí"],
    ["minYear", "maxYear", "Rozpětí roku"],
    ["minPowerKw", "maxPowerKw", "Rozpětí výkonu"],
  ]) {
    if (
      hasValue(demand[minimumField])
      && hasValue(demand[maximumField])
      && Number(demand[minimumField]) > Number(demand[maximumField])
    ) {
      return {
        valid: false,
        error: `${label} má minimum vyšší než maximum.`,
      };
    }
  }

  return { valid: true, error: "" };
}

function customerDemandServiceError(action, error) {
  const detail = error?.message ? `: ${error.message}` : "";
  return new Error(`${action} se nepodařilo${detail}`);
}

export function createCustomerDemandsService(client = supabase) {
  return {
    async loadCustomerDemands(customerId) {
      if (!customerId) {
        throw new Error("Pro načtení poptávek chybí zákazník.");
      }

      const { data, error } = await client
        .from("customer_demands")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) {
        throw customerDemandServiceError("Načtení poptávek", error);
      }

      return (data || []).map(mapCustomerDemandRow);
    },

    async loadActiveCustomerDemandsWithCustomers() {
      const { data, error } = await client
        .from("customer_demands")
        .select(`
          *,
          customer:customers (
            id,
            first_name,
            last_name,
            phone,
            email,
            notes,
            status,
            last_contact_at,
            next_contact_at,
            created_at,
            updated_at
          )
        `)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (error) {
        throw customerDemandServiceError(
          "Načtení aktivních poptávek",
          error
        );
      }

      return (data || []).map(mapCustomerDemandWithCustomer);
    },

    async createCustomerDemand(demand) {
      const validation = validateCustomerDemand(demand);
      if (!validation.valid) throw new Error(validation.error);

      const payload = mapCustomerDemandChangesToPayload(demand);
      const { data, error } = await client
        .from("customer_demands")
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw customerDemandServiceError("Vytvoření poptávky", error);
      }

      return mapCustomerDemandRow(data);
    },

    async updateCustomerDemand(demandId, customerId, changes) {
      if (!demandId) throw new Error("Pro úpravu poptávky chybí její ID.");
      if (!customerId) {
        throw new Error("Pro úpravu poptávky chybí zákazník.");
      }

      const validation = validateCustomerDemand(changes);
      if (!validation.valid) throw new Error(validation.error);

      const payload = mapCustomerDemandChangesToPayload(changes);
      delete payload.customer_id;

      const { data, error } = await client
        .from("customer_demands")
        .update(payload)
        .eq("id", demandId)
        .eq("customer_id", customerId)
        .select()
        .single();

      if (error) {
        throw customerDemandServiceError("Uložení poptávky", error);
      }

      return mapCustomerDemandRow(data);
    },

    async deleteCustomerDemand(demandId, customerId) {
      if (!demandId) throw new Error("Pro smazání poptávky chybí její ID.");
      if (!customerId) {
        throw new Error("Pro smazání poptávky chybí zákazník.");
      }

      const { error } = await client
        .from("customer_demands")
        .delete()
        .eq("id", demandId)
        .eq("customer_id", customerId);

      if (error) {
        throw customerDemandServiceError("Smazání poptávky", error);
      }
    },
  };
}

const customerDemandsService = createCustomerDemandsService();

export function loadCustomerDemands(customerId) {
  return customerDemandsService.loadCustomerDemands(customerId);
}

export function createCustomerDemand(demand) {
  return customerDemandsService.createCustomerDemand(demand);
}

export function loadActiveCustomerDemandsWithCustomers() {
  return customerDemandsService.loadActiveCustomerDemandsWithCustomers();
}

export function updateCustomerDemand(demandId, customerId, changes) {
  return customerDemandsService.updateCustomerDemand(
    demandId,
    customerId,
    changes
  );
}

export function deleteCustomerDemand(demandId, customerId) {
  return customerDemandsService.deleteCustomerDemand(demandId, customerId);
}
