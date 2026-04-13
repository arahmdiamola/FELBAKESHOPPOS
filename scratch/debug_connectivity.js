import { initDb } from '../server/db.js';

async function debug() {
    const db = await initDb();
    console.log("--- BRANCHES ---");
    const branches = await db.all("SELECT id, name, last_seen FROM branches");
    console.table(branches);
    
    console.log("--- BRANCH SESSIONS ---");
    const sessions = await db.all("SELECT * FROM branch_sessions");
    console.table(sessions);
    
    console.log("--- SAMPLES USERS ---");
    const users = await db.all("SELECT id, name, branch_id FROM users LIMIT 5");
    console.table(users);
    
    process.exit(0);
}

debug();
