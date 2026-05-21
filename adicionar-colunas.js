const Database = require("better-sqlite3");
const db = new Database("brasilflix.db");

try {
    db.exec("ALTER TABLE users ADD COLUMN phone TEXT");
    console.log("Coluna phone adicionada.");
} catch (e) {
    console.log("phone já existe.");
}

try {
    db.exec("ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0");
    console.log("is_premium OK.");
} catch (e) {
    console.log("is_premium já existe.");
}

try {
    db.exec("ALTER TABLE users ADD COLUMN premium_expires_at TEXT");
    console.log("premium_expires_at adicionada.");
} catch (e) {
    console.log("premium_expires_at já existe.");
}

console.log("✅ Colunas verificadas.");