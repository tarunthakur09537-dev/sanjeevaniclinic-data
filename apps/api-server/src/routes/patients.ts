import { Router, type IRouter } from "express";

const router: IRouter = Router();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

// Sanitize: user may have pasted the full Airtable URL path instead of just the Base ID.
function sanitizeBaseId(raw: string | undefined): string {
  if (!raw) return "";
  const firstSegment = raw.split(/[/?]/)[0];
  if (firstSegment.startsWith("app")) return firstSegment;
  return "app" + firstSegment;
}

const AIRTABLE_BASE_ID = sanitizeBaseId(process.env.AIRTABLE_BASE_ID);
const AIRTABLE_TABLE_NAME = "Patients";
const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

function airtableHeaders() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// Convert DD-MM-YYYY → YYYY-MM-DD (for Airtable Date field)
function toISODate(ddmmyyyy: string): string {
  const parts = ddmmyyyy.split("-");
  if (parts.length !== 3) return ddmmyyyy;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Convert Airtable date (YYYY-MM-DDTxx or YYYY-MM-DD) → DD-MM-YYYY
function toDDMMYYYY(isoDate: string | undefined): string {
  if (!isoDate) return "";
  const datePart = isoDate.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Extract HH:MM from ISO timestamp (Airtable Created time field)
function toHHMM(isoTimestamp: string | undefined): string {
  if (!isoTimestamp) return "";
  // Parse as UTC and format to IST (UTC+5:30) or just show UTC HH:MM
  try {
    const d = new Date(isoTimestamp);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
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

function mapRecord(record: AirtableRecord) {
  return {
    id: record.id,
    patient_id: record.fields.patient_id ?? "",
    name: record.fields.name ?? "",
    phone: record.fields.phone ?? "",
    disease: record.fields.disease ?? "",
    age: record.fields.age ?? null,
    gender: record.fields.gender ?? null,
    date: toDDMMYYYY(record.fields.date),
    // time is a Computed "Created time" field in Airtable — read-only, extract HH:MM from it
    time: toHHMM(record.fields.time),
  };
}

router.get("/patients/debug", async (req, res) => {
  const apiKeySet = !!AIRTABLE_API_KEY;
  try {
    const testRes = await fetch(AIRTABLE_BASE_URL + "?maxRecords=1", { headers: airtableHeaders() });
    const testBody = await testRes.text();
    res.json({
      resolvedBaseId: AIRTABLE_BASE_ID,
      tableName: AIRTABLE_TABLE_NAME,
      apiKeySet,
      testStatus: testRes.status,
      testResponse: testBody.substring(0, 300),
    });
  } catch (err) {
    res.json({ error: String(err) });
  }
});

router.get("/patients", async (req, res) => {
  try {
    const date = req.query.date as string | undefined; // DD-MM-YYYY

    let url = AIRTABLE_BASE_URL + "?pageSize=100";
    if (date) {
      // Convert to ISO for Airtable Date field filter
      const isoDate = toISODate(date);
      // DATESTR() converts Airtable date to YYYY-MM-DD string for comparison
      const filterFormula = `DATESTR({date})="${isoDate}"`;
      url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
    }
    url += "&sort[0][field]=patient_id&sort[0][direction]=asc";

    const response = await fetch(url, { headers: airtableHeaders() });
    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ errText, status: response.status }, "Airtable fetch error");
      res.status(502).json({ error: "airtable_error", message: "Failed to fetch from Airtable" });
      return;
    }

    const data = (await response.json()) as { records: AirtableRecord[] };
    const patients = (data.records || []).map(mapRecord);
    res.json(patients);
  } catch (err) {
    req.log.error({ err }, "Error fetching patients");
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
      date?: string; // DD-MM-YYYY from frontend
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

    // Convert date to ISO for Airtable Date field
    const isoDate = date ? toISODate(date) : new Date().toISOString().split("T")[0];

    // Count existing patients for this date to generate sequential patient_id
    const countUrl =
      AIRTABLE_BASE_URL +
      `?fields[]=patient_id&filterByFormula=${encodeURIComponent(`DATESTR({date})="${isoDate}"`)}&pageSize=100`;

    const countRes = await fetch(countUrl, { headers: airtableHeaders() });
    if (!countRes.ok) {
      const errText = await countRes.text();
      req.log.error({ errText, status: countRes.status }, "Airtable count error");
      res.status(502).json({ error: "airtable_error", message: "Failed to count patients" });
      return;
    }

    const countData = (await countRes.json()) as { records: AirtableRecord[] };
    const nextId = String((countData.records || []).length + 1).padStart(3, "0");

    const fields: Record<string, string | null | undefined> = {
      patient_id: nextId,
      name: name.trim(),
      phone: phone.trim(),
      disease: disease.trim(),
      date: isoDate,   // Airtable Date field — YYYY-MM-DD
      // Note: "time" is a Computed/Created-time field in Airtable — do NOT write to it
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
      res.status(502).json({ error: "airtable_error", message: "Failed to create patient in Airtable" });
      return;
    }

    const created = (await createRes.json()) as AirtableRecord;
    res.status(201).json(mapRecord(created));
  } catch (err) {
    req.log.error({ err }, "Error creating patient");
    res.status(500).json({ error: "internal_error", message: "Internal server error" });
  }
});

export default router;
