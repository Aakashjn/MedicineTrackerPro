const request = require("supertest");
const app = require("../server"); // Adjust path if necessary
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// Suppress console.error output during tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});
afterAll(() => {
    console.error = originalConsoleError;
});

const dbPath = "./test_database.sqlite";
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // Use a consistent secret

let db;

// Helper function to initialize the test database schema
async function initializeTestDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath);
        db.serialize(() => {
            const dropTableStatements = [
                `DROP TABLE IF EXISTS users`,
                `DROP TABLE IF EXISTS medicines`,
                `DROP TABLE IF EXISTS schedules`,
                `DROP TABLE IF EXISTS medicine_history`
            ];

            const createTableStatements = [
                `
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                `,
                `
                CREATE TABLE medicines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    dosage TEXT NOT NULL,
                    frequency TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    end_date TEXT,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
                `,
                `
                CREATE TABLE schedules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    medicine_id INTEGER NOT NULL,
                    scheduled_date TEXT NOT NULL,
                    scheduled_time TEXT NOT NULL,
                    taken BOOLEAN DEFAULT FALSE,
                    taken_at DATETIME,
                    FOREIGN KEY (medicine_id) REFERENCES medicines(id)
                )
                `,
                `
                CREATE TABLE medicine_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    medicine_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    action TEXT NOT NULL, -- 'taken' or 'missed'
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (medicine_id) REFERENCES medicines(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
                `
            ];

            // Execute drop statements
            dropTableStatements.forEach(stmt => db.run(stmt));

            // Execute create statements
            let completed = 0;
            const totalStatements = createTableStatements.length;

            createTableStatements.forEach((stmt, index) => {
                db.run(stmt, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    completed++;
                    if (completed === totalStatements) {
                        resolve();
                    }
                });
            });

            // Handle case where there are no create statements (shouldn't happen here, but good practice)
            if (totalStatements === 0) {
                resolve();
            }
        });
    });
}

// Global beforeAll hook to set up the database once for all tests
beforeAll(async () => {
    await initializeTestDatabase();
});

// Global afterAll hook to close the database connection
afterAll(async () => {
    await new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err); else resolve();
        });
    });
});

/**
 * Helper function to register and log in a user.
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{authToken: string, userId: number}>}
 */
async function registerAndLoginUser(username, email, password) {
    await request(app)
        .post("/api/auth/register")
        .send({ username, email, password });

    const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email, password });

    return { authToken: loginRes.body.token, userId: loginRes.body.user.id };
}

/**
 * Helper function to add a medicine for a given user.
 * @param {string} authToken
 * @param {object} medicineDetails
 * @returns {Promise<number>} - The ID of the created medicine.
 */
async function addMedicine(authToken, medicineDetails) {
    const medRes = await request(app)
        .post("/api/medicines")
        .set("Authorization", `Bearer ${authToken}`)
        .send(medicineDetails);
    return medRes.body.medicine.id;
}


describe("Auth API", () => {
    it("should register a new user", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({
                username: "testuser",
                email: "test@example.com",
                password: "password123"
            });
        expect(res.statusCode).toEqual(201);
        expect(res.body.message).toEqual("User registered successfully");
        expect(res.body.user).toHaveProperty("id");
        expect(res.body.user.username).toEqual("testuser");
    });

    it("should not register a user with existing email", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({
                username: "anotheruser",
                email: "test@example.com",
                password: "password123"
            });
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual("User with this email already exists");
    });

    it("should login an existing user", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: "test@example.com",
                password: "password123"
            });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("token");
        expect(res.body.user).toHaveProperty("id");
        expect(res.body.user.email).toEqual("test@example.com");
    });

    it("should not login with incorrect password", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: "test@example.com",
                password: "wrongpassword"
            });
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toEqual("Invalid credentials");
    });

    it("should not login with non-existent email", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: "nonexistent@example.com",
                password: "password123"
            });
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toEqual("Invalid credentials");
    });
});

describe("Medicine API", () => {
    let authToken;
    let userId;

    beforeAll(async () => {
        ({ authToken, userId } = await registerAndLoginUser("meduser", "med@example.com", "password123"));
    });

    it("should add a new medicine", async () => {
        const res = await request(app)
            .post("/api/medicines")
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                name: "Aspirin",
                dosage: "100mg",
                frequency: "daily",
                start_date: "2025-01-01",
                notes: "Take with food"
            });
        expect(res.statusCode).toEqual(201);
        expect(res.body.medicine).toHaveProperty("id");
        expect(res.body.medicine.name).toEqual("Aspirin");
        expect(res.body.medicine.user_id).toEqual(userId);
    });

    it("should get all medicines for a user", async () => {
        const res = await request(app)
            .get("/api/medicines")
            .set("Authorization", `Bearer ${authToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.medicines).toBeInstanceOf(Array);
        expect(res.body.medicines.length).toBeGreaterThan(0);
        expect(res.body.medicines[0].name).toEqual("Aspirin");
    });

    it("should update an existing medicine", async () => {
        const medicineId = await addMedicine(authToken, {
            name: "Ibuprofen",
            dosage: "200mg",
            frequency: "twice-daily",
            start_date: "2025-01-05",
            notes: "For pain"
        });

        const res = await request(app)
            .put(`/api/medicines/${medicineId}`)
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                name: "Ibuprofen",
                dosage: "400mg",
                frequency: "twice-daily",
                start_date: "2025-01-05",
                notes: "For severe pain"
            });
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toEqual("Medicine updated successfully");
    });

    it("should delete a medicine", async () => {
        const medicineId = await addMedicine(authToken, {
            name: "Paracetamol",
            dosage: "500mg",
            frequency: "daily",
            start_date: "2025-01-10"
        });

        const res = await request(app)
            .delete(`/api/medicines/${medicineId}`)
            .set("Authorization", `Bearer ${authToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toEqual("Medicine deleted successfully");

        const getRes = await request(app)
            .get("/api/medicines")
            .set("Authorization", `Bearer ${authToken}`);
        expect(getRes.body.medicines.some(m => m.id === medicineId)).toBeFalsy();
    });

    it("should not allow unauthorized access to medicines", async () => {
        const res = await request(app).get("/api/medicines");
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toEqual("Access token required");
    });
});

describe("Schedule API", () => {
    let authToken;
    let userId;
    let medicineId;

    beforeAll(async () => {
        ({ authToken, userId } = await registerAndLoginUser("scheduleuser", "schedule@example.com", "password123"));

        medicineId = await addMedicine(authToken, {
            name: "Vitamin C",
            dosage: "1000mg",
            frequency: "daily",
            start_date: "2025-06-26",
            notes: "Daily dose"
        });

        // Ensure schedules are generated for the medicine
        const generatedSchedulesRes = await request(app)
            .get("/api/schedules/today")
            .set("Authorization", `Bearer ${authToken}`);
        expect(generatedSchedulesRes.statusCode).toEqual(200);
        expect(generatedSchedulesRes.body.schedules.length).toBeGreaterThan(0);
    });

    it("should get today's schedules for a user", async () => {
        const res = await request(app)
            .get("/api/schedules/today")
            .set("Authorization", `Bearer ${authToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.schedules).toBeInstanceOf(Array);
        expect(res.body.schedules.length).toBeGreaterThan(0);
        expect(res.body.schedules[0]).toHaveProperty("medicine_id", medicineId);
        expect(res.body.schedules[0]).toHaveProperty("scheduled_date", new Date().toISOString().split("T")[0]);
    });

    it("should mark a schedule as taken", async () => {
        const todayRes = await request(app)
            .get("/api/schedules/today")
            .set("Authorization", `Bearer ${authToken}`);
        expect(todayRes.body.schedules.length).toBeGreaterThan(0); // Ensure there's at least one schedule
        const scheduleId = todayRes.body.schedules[0].id;

        const res = await request(app)
            .put(`/api/schedules/${scheduleId}/taken`)
            .set("Authorization", `Bearer ${authToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toEqual("Schedule marked as taken");

        // Verify it's marked as taken
        const updatedSchedule = await new Promise((resolve, reject) => {
            db.get(`SELECT taken FROM schedules WHERE id = ?`, [scheduleId], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
        expect(updatedSchedule).toHaveProperty("taken", 1); // SQLite stores BOOLEAN as 0 or 1
    });

    it("should get all schedules for a user", async () => {
        const res = await request(app)
            .get("/api/schedules")
            .set("Authorization", `Bearer ${authToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.schedules).toBeInstanceOf(Array);
        expect(res.body.schedules.length).toBeGreaterThan(0);
    });

    it("should not allow unauthorized access to schedules", async () => {
        const res = await request(app).get("/api/schedules/today");
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toEqual("Access token required");
    });
});

describe("History API", () => {
    let authToken;
    let userId;
    let medicineId;

    beforeAll(async () => {
        ({ authToken, userId } = await registerAndLoginUser("historyuser", "history@example.com", "password123"));

        medicineId = await addMedicine(authToken, {
            name: "Pain Reliever",
            dosage: "250mg",
            frequency: "daily",
            start_date: "2025-06-26",
            notes: "For headaches"
        });

        const todayRes = await request(app)
            .get("/api/schedules/today")
            .set("Authorization", `Bearer ${authToken}`);
        const scheduleId = todayRes.body.schedules[0].id;

        await request(app)
            .put(`/api/schedules/${scheduleId}/taken`)
            .set("Authorization", `Bearer ${authToken}`);
    });

    it("should get medicine history for a user", async () => {
        const res = await request(app)
            .get("/api/history")
            .set("Authorization", `Bearer ${authToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.history).toBeInstanceOf(Array);
        expect(res.body.history.length).toBeGreaterThan(0);
        expect(res.body.history[0]).toHaveProperty("status", "taken");
        expect(res.body.history[0]).toHaveProperty("medicine_name", "Pain Reliever");
    });

    it("should not allow unauthorized access to history", async () => {
        const res = await request(app).get("/api/history");
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toEqual("Access token required");
    });
});

describe("Stats API", () => {
    let authToken;
    let userId;

    beforeAll(async () => {
        ({ authToken, userId } = await registerAndLoginUser("statsuser", "stats@example.com", "password123"));

        const medicineId = await addMedicine(authToken, {
            name: "Stat Medicine",
            dosage: "10mg",
            frequency: "daily",
            start_date: "2025-06-26",
            notes: "For stats"
        });

        const todayRes = await request(app)
            .get("/api/schedules/today")
            .set("Authorization", `Bearer ${authToken}`);
        const scheduleId = todayRes.body.schedules[0].id;

        await request(app)
            .put(`/api/schedules/${scheduleId}/taken`)
            .set("Authorization", `Bearer ${authToken}`);
    });

    it("should get user statistics", async () => {
        const res = await request(app)
            .get("/api/stats")
            .set("Authorization", `Bearer ${authToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.stats).toHaveProperty("totalMedicines");
        expect(res.body.stats).toHaveProperty("totalDosesTaken");
        expect(res.body.stats).toHaveProperty("adherenceRate");
        expect(res.body.stats.totalMedicines).toBeGreaterThan(0);
        expect(res.body.stats.totalDosesTaken).toBeGreaterThan(0);
        expect(res.body.stats.adherenceRate).toBeGreaterThanOrEqual(0);
    });

    it("should not allow unauthorized access to stats", async () => {
        const res = await request(app).get("/api/stats");
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toEqual("Access token required");
    });
});
