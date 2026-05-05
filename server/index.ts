import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import {
  getCatalog,
  getGraphData,
  listCatalogs,
  searchModules,
} from "./moduleData";
import authRouter, { attachUser } from "./auth/routes";
import savedStatesRouter from "./savedStates/routes";

const PORT = Number(process.env.PORT || 5175);
const APP_URL = process.env.APP_URL || "http://localhost:5174";
const app = express();

app.use(cors({ origin: APP_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.use("/api/auth", authRouter);
app.use("/api/saved-states", savedStatesRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/catalogs", (_req, res) => {
  res.json(listCatalogs());
});

app.get("/api/modules", (req, res) => {
  const catalog = getCatalog(req.query.catalog);
  const year = typeof req.query.year === "string" ? req.query.year : null;
  const graph = getGraphData(catalog, year);
  res.json({
    catalog: { id: catalog.id, name: catalog.name, years: catalog.years || [] },
    selectedYear: graph.selectedYear,
    nodes: graph.nodes,
    prereqRules: graph.prereqRules,
    edges: graph.edges,
  });
});

app.get("/api/modules/search", (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const year = typeof req.query.year === "string" ? req.query.year : null;
  res.json(searchModules(query, year));
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`App expected at ${APP_URL}`);
});
