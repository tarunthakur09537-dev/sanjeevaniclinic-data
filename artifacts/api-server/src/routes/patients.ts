import { Router, type IRouter } from "express";

const router: IRouter = Router();

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = "Patients";
const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

function airtableHeaders() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
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
    date: record.fields.date ?? "",
    time: record.fields.time ?? "",
  };
}

router.get("/patients/debug", async (req, res) => {
  const baseId = AIRTABLE_BASE_ID ?? "(missing)";
  const apiKeySet = !!AIRTABLE_API_KEY;
  const testUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?maxRecords=1`;

  try {
    const response = await fetch(testUrl, { headers: airtableHeaders() });
    const body = await response.text();
    res.json({
      baseId: baseId.substring(0, 8) + "...",
      tableName: AIRTABLE_TABLE_NAME,
      apiKeySet,
      airtableStatus: response.status,
      airtableResponse: body,
      urlCalled: testUrl.replace(baseId, baseId.substring(0, 5) + "..."),
    });
  } catch (err) {
    res.json({ error: String(err), baseId: baseId.substring(0, 8) + "...", tableName: AIRTABLE_TABLE_NAME });
  }
});

router.get("/patients", async (req, res) => {
  try {
    const date = req.query.date as string | undefined;

    let url = AIRTABLE_BASE_URL + "?pageSize=100";
    if (date) {
      const filterFormula = `SEARCH("${date}",{date})`;
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

    const countUrl =
      AIRTABLE_BASE_URL +
      `?fields[]=patient_id&filterByFormula=${encodeURIComponent(`SEARCH("${date}",{date})`)}&pageSize=100`;

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
      date,
      time,
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
