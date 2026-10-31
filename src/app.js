const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const pool = require("./db/database");

app.set("views", path.join(__dirname, "../views"));

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active
            FROM passes
        `);

        const totalPasses = result.rows[0].total;
        const activePasses = result.rows[0].active;

        res.render("index.ejs", { totalPasses, activePasses });

    } catch (error) {
        console.error(error);
        res.status(500).send("Pogreška pri dohvaćanju statistike.");
    }
});

app.get("/manage", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM passes ORDER BY issued_at DESC"
        );

        const passes = result.rows;

        res.render("manage-passes.ejs", { passes });

    } catch (error) {
        console.error(error);
        res.status(500).send("Pogreška pri dohvaćanju propusnica.");
    }
});

app.get("/pass/:id", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM passes WHERE id = $1",
            [req.params.id]
        );

        const pass = result.rows[0];

        if (!pass) {
            return res.status(404).send("Propusnica nije pronađena.");
        }

        res.render("pass-info.ejs", { pass });

    } catch (error) {
        console.error(error);
        res.status(500).send("Pogreška pri dohvaćanju propusnice.");
    }
});

app.listen(port, () =>{
    console.log(`Server is running on: http://localhost:${port}`);
});