-- Le budget hebdomadaire n'est plus proposé : tout le monde revient au budget quotidien.
UPDATE "profiles" SET "budget_mode" = 'daily' WHERE "budget_mode" <> 'daily';
