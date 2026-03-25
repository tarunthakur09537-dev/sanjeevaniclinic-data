import { Router, type IRouter } from "express";
import { config as loadEnv } from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(moduleDir, "../../../../.env") });

const router: IRouter = Router();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

function parseAirtableResource(raw: string | undefined) {
  if (!raw) {
    return {
      baseId: "",
      tableId: "",
      viewId: "",
    };
  }

  const segments = raw
    .split("?")[0]
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const [baseSegment = "", tableSegment = "", viewSegment = ""] = segments;
  const baseId = baseSegment.startsWith("app") ? baseSegment : `app${baseSegment}`;

  return {
    baseId,
    tableId: tableSegment.startsWith("tbl") ? tableSegment : "",
    viewId: viewSegment.startsWith("viw") ? viewSegment : "",
  };
}

const parsedResource = parseAirtableResource(process.env.AIRTABLE_BASE_ID);
const AIRTABLE_BASE_ID = parsedResource.baseId;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || parsedResource.tableId || "Patients";
const AIRTABLE_VIEW_ID = process.env.AIRTABLE_VIEW_ID || parsedResource.viewId || "";
const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_ID)}`;
const isAirtableConfigured = Boolean(AIRTABLE_API_KEY && AIRTABLE_BASE_ID);
const isLocalDev = !process.env.VERCEL && process.env.NODE_ENV !== "production";
const isLocalFallbackEnabled = !isAirtableConfigured && isLocalDev;
const fallbackOnAirtableError = isLocalDev && process.env.AIRTABLE_FALLBACK_ON_ERROR !== "0";

function airtableHeaders() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function getAirtableErrorMessage(status: number) {
  if (status === 401 || status === 403) {
    return "Airtable rejected the token. Check PAT permissions for this base.";
  }
  if (status === 404) {
    return "Airtable base, table, or view was not found, or this token does not have access to it.";
  }
  return "Failed to fetch from Airtable.";
}

function getLocalPatientsFile() {
  return path.basename(process.cwd()).toLowerCase() === "api-server"
    ? path.join(process.cwd(), "data", "patients.local.json")
    : path.join(process.cwd(), "apps", "api-server", "data", "patients.local.json");
}

function getConfigurationErrorMessage() {
  return "Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env to use Airtable. Local development will fall back to a file store when those values are missing.";
}

function toISODate(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split("-");
  if (parts.length !== 3) return ddmmyyyy;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function toDDMMYYYY(isoDate: string | undefined): string {
  if (!isoDate) return "";
  const datePart = isoDate.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function toHHMM(isoTimestamp: string | undefined): string {
  if (!isoTimestamp) return "";
  try {
    const d = new Date(isoTimestamp);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

function todayDDMMYYYY(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sortPatientsById<T extends { patient_id: string }>(patients: T[]) {
  return [...patients].sort((a, b) =>
    a.patient_id.localeCompare(b.patient_id, undefined, { numeric: true }),
  );
}

interface AirtableRecord {
  id: string;
  fields: {
    patient_id?: string;
    name?: string;
    phone?: string;
    disease?: string;
    age?: string;
    gender?: string;
    date?: string;
    time?: string;
  };
}

interface PatientRecord {
  id: string;
  patient_id: string;
  name: string;
  phone: string;
  disease: string;
  age: string | null;
  gender: string | null;
  date: string;
  time: string;
}

function mapRecord(record: AirtableRecord): PatientRecord {
  return {
    id: record.id,
    patient_id: record.fields.patient_id ?? "",
    name: record.fields.name ?? "",
    phone: record.fields.phone ?? "",
    disease: record.fields.disease ?? "",
    age: record.fields.age ?? null,
    gender: record.fields.gender ?? null,
    date: toDDMMYYYY(record.fields.date),
    time: toHHMM(record.fields.time),
  };
}

async function readLocalPatients(): Promise<PatientRecord[]> {
  try {
    const raw = await readFile(getLocalPatientsFile(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PatientRecord[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeLocalPatients(patients: PatientRecord[]) {
  const file = getLocalPatientsFile();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(sortPatientsById(patients), null, 2) + "\n", "utf8");
}

async function listLocalPatients(date?: string) {
  return sortPatientsById(
    (await readLocalPatients()).filter((patient) => !date || patient.date === date),
  );
}

async function createLocalPatient(input: {
  name: string;
  phone: string;
  disease: string;
  age?: string;
  gender?: string;
  date?: string;
  time?: string;
}) {
  const currentDate = input.date?.trim() || todayDDMMYYYY();
  const patients = await readLocalPatients();
  const nextId = String(
    patients.filter((patient) => patient.date === currentDate).length + 1,
  ).padStart(3, "0");

  const created: PatientRecord = {
    id: `local-${Date.now()}`,
    patient_id: nextId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    disease: input.disease.trim(),
    age: normalizeOptional(input.age),
    gender: normalizeOptional(input.gender),
    date: currentDate,
    time: input.time?.trim() || "",
  };

  await writeLocalPatients([...patients, created]);
  return created;
}

router.get("/patients/debug", async (_req, res) => {
  const apiKeySet = !!AIRTABLE_API_KEY;

  if (!isAirtableConfigured) {
    res.json({
      resolvedBaseId: AIRTABLE_BASE_ID,
      tableId: AIRTABLE_TABLE_ID,
      viewId: AIRTABLE_VIEW_ID || null,
      apiKeySet,
      storageMode: isLocalFallbackEnabled ? "local-file" : "unconfigured",
      localDataFile: isLocalFallbackEnabled ? getLocalPatientsFile() : null,
      message: isLocalFallbackEnabled
        ? "Running in local file mode because Airtable credentials are not set."
        : getConfigurationErrorMessage(),
    });
    return;
  }

  try {
    const testRes = await fetch(AIRTABLE_BASE_URL + "?maxRecords=1", { headers: airtableHeaders() });
    const testBody = await testRes.text();
    res.json({
      resolvedBaseId: AIRTABLE_BASE_ID,
      tableId: AIRTABLE_TABLE_ID,
      viewId: AIRTABLE_VIEW_ID || null,
      apiKeySet,
      storageMode: testRes.ok ? "airtable" : fallbackOnAirtableError ? "airtable-with-local-fallback" : "airtable",
      testStatus: testRes.status,
      testResponse: testBody.substring(0, 300),
    });
  } catch (err) {
    res.json({ error: String(err) });
  }
});

router.get("/patients", async (req, res) => {
  try {
    const date = req.query.date as string | undefined;

    if (!isAirtableConfigured) {
      if (!isLocalFallbackEnabled) {
        res.status(503).json({
          error: "configuration_error",
          message: getConfigurationErrorMessage(),
        });
        return;
      }

      const patients = await listLocalPatients(date);
      res.json(patients);
      return;
    }

    let url = AIRTABLE_BASE_URL + "?pageSize=100";
    if (AIRTABLE_VIEW_ID) {
      url += `&view=${encodeURIComponent(AIRTABLE_VIEW_ID)}`;
    }
    if (date) {
      const isoDate = toISODate(date);
      const filterFormula = `DATESTR({date})="${isoDate}"`;
      url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    }
    url += "&sort[0][field]=patient_id&sort[0][direction]=asc";

    const response = await fetch(url, { headers: airtableHeaders() });
    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ errText, status: response.status }, "Airtable fetch error");
      if (fallbackOnAirtableError) {
        const patients = await listLocalPatients(date);
        res.setHeader("x-data-source", "local-fallback");
        res.json(patients);
        return;
      }
      res.status(502).json({ error: "airtable_error", message: getAirtableErrorMessage(response.status) });
      return;
    }

    const data = (await response.json()) as { records: AirtableRecord[] };
    res.json((data.records || []).map(mapRecord));
  } catch (err) {
    req.log.error({ err }, "Error fetching patients");
    if (fallbackOnAirtableError) {
      const date = req.query.date as string | undefined;
      const patients = await listLocalPatients(date);
      res.setHeader("x-data-source", "local-fallback");
      res.json(patients);
      return;
    }
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

router.post("/patients", async (req, res) => {
  try {
    const { name, phone, disease, age, gender, date, time } = req.body as {
      name?: string;
      phone?: string;
      disease?: string;
      age?: string;
      gender?: string;
      date?: string;
      time?: string;
    };

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: "validation_error", message: "Name required" });
      return;
    }
    if (!phone || phone.trim().length < 10) {
      res.status(400).json({ error: "validation_error", message: "Phone number must be at least 10 digits" });
      return;
    }
    if (!disease || disease.trim().length === 0) {
      res.status(400).json({ error: "validation_error", message: "Disease required" });
      return;
    }

    if (!isAirtableConfigured) {
      if (!isLocalFallbackEnabled) {
        res.status(503).json({
          error: "configuration_error",
          message: getConfigurationErrorMessage(),
        });
        return;
      }

      const created = await createLocalPatient({ name, phone, disease, age, gender, date, time });
      res.status(201).json(created);
      return;
    }

    const isoDate = date ? toISODate(date) : new Date().toISOString().split("T")[0];

    const countUrl =
      AIRTABLE_BASE_URL +
      `?fields[]=patient_id&filterByFormula=${encodeURIComponent(`DATESTR({date})="${isoDate}"`)}&pageSize=100` +
      (AIRTABLE_VIEW_ID ? `&view=${encodeURIComponent(AIRTABLE_VIEW_ID)}` : "");

    const countRes = await fetch(countUrl, { headers: airtableHeaders() });
    if (!countRes.ok) {
      const errText = await countRes.text();
      req.log.error({ errText, status: countRes.status }, "Airtable count error");
      if (fallbackOnAirtableError) {
        const created = await createLocalPatient({ name, phone, disease, age, gender, date, time });
        res.setHeader("x-data-source", "local-fallback");
        res.status(201).json(created);
        return;
      }
      res.status(502).json({ error: "airtable_error", message: getAirtableErrorMessage(countRes.status) });
      return;
    }

    const countData = (await countRes.json()) as { records: AirtableRecord[] };
    const nextId = String((countData.records || []).length + 1).padStart(3, "0");

    const fields: Record<string, string | null | undefined> = {
      patient_id: nextId,
      name: name.trim(),
      phone: phone.trim(),
      disease: disease.trim(),
      date: isoDate,
    };
    if (age && age.trim()) fields.age = age.trim();
    if (gender && gender.trim()) fields.gender = gender.trim();

    const createRes = await fetch(AIRTABLE_BASE_URL, {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      req.log.error({ errText, status: createRes.status }, "Airtable create error");
      if (fallbackOnAirtableError) {
        const created = await createLocalPatient({ name, phone, disease, age, gender, date, time });
        res.setHeader("x-data-source", "local-fallback");
        res.status(201).json(created);
        return;
      }
      res.status(502).json({ error: "airtable_error", message: getAirtableErrorMessage(createRes.status) });
      return;
    }

    const created = (await createRes.json()) as AirtableRecord;
    res.status(201).json(mapRecord(created));
  } catch (err) {
    req.log.error({ err }, "Error creating patient");
    if (fallbackOnAirtableError) {
      const { name, phone, disease, age, gender, date, time } = req.body as {
        name?: string;
        phone?: string;
        disease?: string;
        age?: string;
        gender?: string;
        date?: string;
        time?: string;
      };
      if (name && phone && disease) {
        const created = await createLocalPatient({ name, phone, disease, age, gender, date, time });
        res.setHeader("x-data-source", "local-fallback");
        res.status(201).json(created);
        return;
      }
    }
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

export default router;
