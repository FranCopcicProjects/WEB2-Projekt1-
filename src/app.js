const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;


app.set("views", path.join(__dirname, "../views"));

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.render("index.ejs");
});

app.get("/manage", (req, res) => {
    const passes = [
        {
            id: "1",
            name: "Nesto Bezveze",
            document: "HR-123456789",
            issuedAt: "31.10.2026. 12:00",
            status: "ACTIVE"
        }
    ];
    res.render("manage-passes.ejs", {passes});
});

app.listen(port, () =>{
    console.log(`Server is running on: http://localhost:${port}`);
});