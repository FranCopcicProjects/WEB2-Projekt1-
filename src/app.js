const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
const port = process.env.PORT || 3000;
const pool = require("./db/database");
const qrcode = require("qrcode");
const { auth, requiresAuth } = require("express-openid-connect");
const { auth: jwtAuth, requiredScopes } = require("express-oauth2-jwt-bearer");

const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SESSION_SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.CLIENT_ID,
    issuerBaseURL: process.env.ISSUER_BASE_URL,
    clientSecret: process.env.CLIENT_SECRET,
    routes: {
        logout: false
    },
    authorizationParams: {
        response_type: "code",
        scope: "openid profile email"
    }
};

app.use(auth(config));

const checkJwt = jwtAuth({
    audience: process.env.API_AUDIENCE,
    issuerBaseURL: process.env.ISSUER_BASE_URL
});

app.post("/logout", (req, res) => {
    res.oidc.logout();
});

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

        const isAuthenticated = req.oidc.isAuthenticated();

        const username = isAuthenticated ? (req.oidc.user?.name ?? req.oidc.user?.sub) : null;

        res.render("index.ejs", {
            totalPasses,
            activePasses,
            isAuthenticated,
            username
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Pogreška pri dohvaćanju statistike.");
    }
});

app.get("/manage", requiresAuth(), async (req, res) => {
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
        if (error.code === "22P02") {
            return res.status(404).send("Propusnica nije pronađena.");
        }

        console.error(error);
        res.status(500).send("Pogreška pri dohvaćanju propusnice.");
    }
});

app.get("/passes/:id", checkJwt, requiredScopes("read:passes"), async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM passes WHERE id = $1",
            [req.params.id]
        );

        const pass = result.rows[0];

        if (!pass) {
            return res.status(404).send("Propusnica nije pronađena.");
        }

        res.json({
            id: pass.id,
            name: pass.name,
            document: pass.document,
            issuedAt: pass.issued_at,
            status: pass.status
        });

    } catch (error) {
        if (error.code === "22P02") {
            return res.status(404).send("Propusnica nije pronađena.");
        }

        console.error(error);
        res.status(500).send("Pogreška pri dohvaćanju propusnice.");
    }
});

app.post("/passes", checkJwt, requiredScopes("create:passes"), async (req, res) => {
    try {
        const { name, document } = req.body || {};

        if (
            typeof name !== "string" ||
            typeof document !== "string" ||
            !name.trim() ||
            !document.trim()
        ) {
            return res.status(400).send("Ime i dokument ne smiju biti prazni.");
        }

        const result = await pool.query(
            `INSERT INTO passes (name, document)
             VALUES ($1, $2)
             RETURNING id`,
            [name, document]
        );

        const id = result.rows[0].id;

        const publicUrl = `${process.env.BASE_URL}/pass/${id}`;
        
        const apiUrl = `${process.env.BASE_URL}/passes/${id}`;

        const qrCode = await qrcode.toBuffer(publicUrl, {
            type: "png"
        });

        res.set("Location", apiUrl);
        res.type("png");
        res.status(201).send(qrCode);

    } catch (error) {
        console.error(error);
        res.status(500).send("Pogreška pri izdavanju propusnice.");
    }
});

app.post("/passes/:id/cancel", requiresAuth(), async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE passes
             SET status = 'CANCELLED'
             WHERE id = $1 AND status = 'ACTIVE'`,
            [req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).send("Aktivna propusnica nije pronađena.");
        }

        res.redirect("/manage");

    } catch (error) {
        if (error.code === "22P02") {
            return res.status(404).send("Propusnica nije pronađena.");
        }

        console.error(error);
        res.status(500).send("Pogreška pri poništavanju propusnice.");
    }
});

app.post("/passes/:id/delete", requiresAuth(), async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM passes WHERE id = $1",
            [req.params.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).send("Propusnica nije pronađena.");
        }

        res.redirect("/manage");

    } catch (error) {
        if (error.code === "22P02") {
            return res.status(404).send("Propusnica nije pronađena.");
        }

        console.error(error);
        res.status(500).send("Pogreška pri brisanju propusnice.");
    }
});

app.listen(port, () =>{
    console.log(`Server is running on: http://localhost:${port}`);
});