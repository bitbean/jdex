import Path from "node:path";
import { fixtures_path } from "@/tests/common/projects";
import { Database } from "@/index";
import { DatabaseUnitTests } from "../Database.tests";

DatabaseUnitTests(
  new Database({
    root: Path.join(fixtures_path, "new-project/data"),
  }),
);
