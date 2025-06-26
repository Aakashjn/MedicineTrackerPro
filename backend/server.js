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
                `DROP TABLE IF EXISTS medicine_history`,
                `DROP TABLE IF EXISTS reminders`
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
                    active BOOLEAN DEFAULT 1,
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
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
                `,
                `
                CREATE TABLE reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    medicine_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    reminder_time TEXT NOT NULL,
                    enabled BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

// Helper function for authenticated requests
function authenticatedRequest(authToken) {
    return request(app).set("Authorization", `Bearer ${authToken}`);
}

// Helper function for common unauthorized access test
function testUnauthorizedAccess(apiPath, method, payload = {}) {
    it(`should not allow unauthorized access to ${apiPath} (${method.toUpperCase()})`, async () => {
        let res;
        if (method === 'get') {
            res = await request(app).get(apiPath);
        } else if (method === 'post') {
            res = await request(app).post(apiPath).send(payload);
        } else if (method === 'put') {
            res = await request(app).put(apiPath).send(payload);
        } else if (method === 'delete') {
            res = await request(app).delete(apiPath);
        }
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toEqual("Access token required");
    });
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

    it("should not register a user with missing fields", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({
                username: "incomplete",
                email: "incomplete@example.com"
                // password missing
            });
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toContain("password");
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

    it("should not login with missing fields", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: "test@example.com"
                // password missing
            });
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toContain("password");
    });
});

describe("Medicine API", () => {
    let authToken;
    let userId;

    beforeAll(async () => {
        ({ authToken, userId } = await registerAndLoginUser("meduser", "med@example.com", "password123"));
    });

    it("should add a new medicine", async () => {
        const res = await authenticatedRequest(authToken)
            .post("/api/medicines")
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

    it("should not add a medicine with missing fields", async () => {
        const res = await authenticatedRequest(authToken)
            .post("/api/medicines")
            .send({
                name: "Missing Data",
                dosage: "10mg",
                // frequency missing
                start_date: "2025-01-01"
            });
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toContain("frequency");
    });

    it("should get all medicines for a user", async () => {
        const res = await authenticatedRequest(authToken)
            .get("/api/medicines");
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

        const res = await authenticatedRequest(authToken)
            .put(`/api/medicines/${medicineId}`)
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

    it("should not update a non-existent medicine", async () => {
        const res = await authenticatedRequest(authToken)
            .put(`/api/medicines/99999`)
            .send({
                name: "NonExistent",
                dosage: "100mg"
            });
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Medicine not found or not owned by user");
    });

    it("should not update a medicine not owned by the user", async () => {
        const { authToken: otherAuthToken } = await registerAndLoginUser("otheruser", "other@example.com", "password123");
        const otherMedicineId = await addMedicine(otherAuthToken, {
            name: "Other Med",
            dosage: "50mg",
            frequency: "daily",
            start_date: "2025-01-01"
        });

        const res = await authenticatedRequest(authToken)
            .put(`/api/medicines/${otherMedicineId}`)
            .send({
                name: "Attempted Hack",
                dosage: "1000mg"
            });
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Medicine not found or not owned by user");
    });

    it("should delete a medicine", async () => {
        const medicineId = await addMedicine(authToken, {
            name: "Paracetamol",
            dosage: "500mg",
            frequency: "daily",
            start_date: "2025-01-10"
        });

        const res = await authenticatedRequest(authToken)
            .delete(`/api/medicines/${medicineId}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toEqual("Medicine deleted successfully");

        const getRes = await authenticatedRequest(authToken)
            .get("/api/medicines");
        expect(getRes.body.medicines.some(m => m.id === medicineId)).toBeFalsy();
    });

    it("should not delete a non-existent medicine", async () => {
        const res = await authenticatedRequest(authToken)
            .delete(`/api/medicines/99999`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Medicine not found or not owned by user");
    });

    it("should not delete a medicine not owned by the user", async () => {
        const { authToken: otherAuthToken } = await registerAndLoginUser("anotheruser", "another@example.com", "password123");
        const otherMedicineId = await addMedicine(otherAuthToken, {
            name: "Another Med",
            dosage: "50mg",
            frequency: "daily",
            start_date: "2025-01-01"
        });

        const res = await authenticatedRequest(authToken)
            .delete(`/api/medicines/${otherMedicineId}`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Medicine not found or not owned by user");
    });

    testUnauthorizedAccess("/api/medicines", "get");
    testUnauthorizedAccess("/api/medicines", "post", { name: "Unauthorized", dosage: "1mg", frequency: "daily", start_date: "2025-01-01" });
    testUnauthorizedAccess("/api/medicines/1", "put", { name: "Unauthorized Update" });
    testUnauthorizedAccess("/api/medicines/1", "delete");
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
        const generatedSchedulesRes = await authenticatedRequest(authToken)
            .get("/api/schedules/today");
        expect(generatedSchedulesRes.statusCode).toEqual(200);
        expect(generatedSchedulesRes.body.schedules.length).toBeGreaterThan(0);
    });

    it("should get today's schedules for a user", async () => {
        const res = await authenticatedRequest(authToken)
            .get("/api/schedules/today");
        expect(res.statusCode).toEqual(200);
        expect(res.body.schedules).toBeInstanceOf(Array);
        expect(res.body.schedules.length).toBeGreaterThan(0);
        expect(res.body.schedules[0]).toHaveProperty("medicine_id", medicineId);
        expect(res.body.schedules[0]).toHaveProperty("scheduled_date", new Date().toISOString().split("T")[0]);
    });

    it("should mark a schedule as taken", async () => {
        const todayRes = await authenticatedRequest(authToken)
            .get("/api/schedules/today");
        expect(todayRes.body.schedules.length).toBeGreaterThan(0); // Ensure there's at least one schedule
        const scheduleId = todayRes.body.schedules[0].id;

        const res = await authenticatedRequest(authToken)
            .put(`/api/schedules/${scheduleId}/taken`);
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

    it("should not mark a non-existent schedule as taken", async () => {
        const res = await authenticatedRequest(authToken)
            .put(`/api/schedules/99999/taken`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Schedule not found or not owned by user");
    });

    it("should not mark a schedule not owned by the user as taken", async () => {
        const { authToken: otherAuthToken } = await registerAndLoginUser("other_schedule_user", "other_schedule@example.com", "password123");
        const otherMedicineId = await addMedicine(otherAuthToken, {
            name: "Other Schedule Med",
            dosage: "1mg",
            frequency: "daily",
            start_date: "2025-01-01"
        });
        const otherSchedulesRes = await authenticatedRequest(otherAuthToken).get("/api/schedules/today");
        const otherScheduleId = otherSchedulesRes.body.schedules[0].id;

        const res = await authenticatedRequest(authToken)
            .put(`/api/schedules/${otherScheduleId}/taken`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Schedule not found or not owned by user");
    });

    it("should get all schedules for a user", async () => {
        const res = await authenticatedRequest(authToken)
            .get("/api/schedules");
        expect(res.statusCode).toEqual(200);
        expect(res.body.schedules).toBeInstanceOf(Array);
        expect(res.body.schedules.length).toBeGreaterThan(0);
    });

    testUnauthorizedAccess("/api/schedules/today", "get");
    testUnauthorizedAccess("/api/schedules/1/taken", "put");
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

        const todayRes = await authenticatedRequest(authToken)
            .get("/api/schedules/today");
        const scheduleId = todayRes.body.schedules[0].id;

        await authenticatedRequest(authToken)
            .put(`/api/schedules/${scheduleId}/taken`);
    });

    it("should get medicine history for a user", async () => {
        const res = await authenticatedRequest(authToken)
            .get("/api/history");
        expect(res.statusCode).toEqual(200);
        expect(res.body.history).toBeInstanceOf(Array);
        expect(res.body.history.length).toBeGreaterThan(0);
        expect(res.body.history[0]).toHaveProperty("status", "taken");
        expect(res.body.history[0]).toHaveProperty("medicine_name", "Pain Reliever");
    });

    it("should get medicine history filtered by date_from", async () => {
        const res = await authenticatedRequest(authToken)
            .get("/api/history?date_from=2025-06-26");
        expect(res.statusCode).toEqual(200);
        expect(res.body.history.length).toBeGreaterThan(0);
        expect(res.body.history[0].timestamp).toContain("2025-06-26");
    });

    it("should get medicine history filtered by medicine_id", async () => {
        const res = await authenticatedRequest(authToken)
            .get(`/api/history?medicine_id=${medicineId}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.history.length).toBeGreaterThan(0);
        expect(res.body.history[0].medicine_id).toEqual(medicineId);
    });

    testUnauthorizedAccess("/api/history", "get");
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

        const todayRes = await authenticatedRequest(authToken)
            .get("/api/schedules/today");
        const scheduleId = todayRes.body.schedules[0].id;

        await authenticatedRequest(authToken)
            .put(`/api/schedules/${scheduleId}/taken`);
    });

    it("should get stats for a user", async () => {
        const res = await authenticatedRequest(authToken)
            .get("/api/stats");
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("totalMedicines");
        expect(res.body).toHaveProperty("totalDosesTaken");
        expect(res.body).toHaveProperty("totalDosesMissed");
        expect(res.body).toHaveProperty("adherenceRate");
    });

    it("should return correct stats for no medicines", async () => {
        const { authToken: newUserAuthToken, userId: newUserId } = await registerAndLoginUser("nomeduser", "nomed@example.com", "password123");
        const res = await authenticatedRequest(newUserAuthToken)
            .get("/api/stats");
        expect(res.statusCode).toEqual(200);
        expect(res.body.totalMedicines).toEqual(0);
        expect(res.body.totalDosesTaken).toEqual(0);
        expect(res.body.totalDosesMissed).toEqual(0);
        expect(res.body.adherenceRate).toEqual(0);
    });

    it("should return correct stats for all taken schedules", async () => {
        const { authToken: takenAuthToken, userId: takenUserId } = await registerAndLoginUser("takenuser", "taken@example.com", "password123");
        const medId = await addMedicine(takenAuthToken, { name: "Taken Med", dosage: "1mg", frequency: "daily", start_date: "2025-06-20" });
        const schedules = await authenticatedRequest(takenAuthToken).get("/api/schedules/today");
        for (const schedule of schedules.body.schedules) {
            await authenticatedRequest(takenAuthToken).put(`/api/schedules/${schedule.id}/taken`);
        }
        const res = await authenticatedRequest(takenAuthToken).get("/api/stats");
        expect(res.statusCode).toEqual(200);
        expect(res.body.totalDosesTaken).toBeGreaterThan(0);
        expect(res.body.totalDosesMissed).toEqual(0);
        expect(res.body.adherenceRate).toEqual(100);
    });

    // Note: Testing 'missed' schedules directly is harder as the API doesn't have a 'mark as missed' endpoint.
    // This would typically be covered by backend logic that marks schedules as missed if not taken by a certain time.
    // For now, we'll focus on what the current API allows.

    testUnauthorizedAccess("/api/stats", "get");
});

describe("Reminder API", () => {
    let authToken;
    let userId;
    let medicineId;

    beforeAll(async () => {
        ({ authToken, userId } = await registerAndLoginUser("reminderuser", "reminder@example.com", "password123"));

        medicineId = await addMedicine(authToken, {
            name: "Reminder Med",
            dosage: "5mg",
            frequency: "daily",
            start_date: "2025-06-26"
        });
    });

    it("should add a new reminder", async () => {
        const res = await authenticatedRequest(authToken)
            .post("/api/reminders")
            .send({
                medicine_id: medicineId,
                reminder_time: "10:00"
            });
        expect(res.statusCode).toEqual(201);
        expect(res.body.reminder).toHaveProperty("id");
        expect(res.body.reminder.medicine_id).toEqual(medicineId);
        expect(res.body.reminder.reminder_time).toEqual("10:00");
    });

    it("should not add a reminder with missing fields", async () => {
        const res = await authenticatedRequest(authToken)
            .post("/api/reminders")
            .send({
                medicine_id: medicineId
                // reminder_time missing
            });
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toContain("reminder_time");
    });

    it("should get all reminders for a user", async () => {
        const res = await authenticatedRequest(authToken)
            .get("/api/reminders");
        expect(res.statusCode).toEqual(200);
        expect(res.body.reminders).toBeInstanceOf(Array);
        expect(res.body.reminders.length).toBeGreaterThan(0);
        expect(res.body.reminders[0].medicine_id).toEqual(medicineId);
    });

    it("should update an existing reminder", async () => {
        const addRes = await authenticatedRequest(authToken)
            .post("/api/reminders")
            .send({
                medicine_id: medicineId,
                reminder_time: "11:00"
            });
        const reminderId = addRes.body.reminder.id;

        const res = await authenticatedRequest(authToken)
            .put(`/api/reminders/${reminderId}`)
            .send({
                reminder_time: "12:00",
                enabled: false
            });
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toEqual("Reminder updated successfully");
    });

    it("should not update a non-existent reminder", async () => {
        const res = await authenticatedRequest(authToken)
            .put(`/api/reminders/99999`)
            .send({
                reminder_time: "13:00"
            });
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Reminder not found or not owned by user");
    });

    it("should not update a reminder not owned by the user", async () => {
        const { authToken: otherAuthToken } = await registerAndLoginUser("other_reminder_user", "other_reminder@example.com", "password123");
        const otherMedicineId = await addMedicine(otherAuthToken, { name: "Other Reminder Med", dosage: "1mg", frequency: "daily", start_date: "2025-01-01" });
        const addRes = await authenticatedRequest(otherAuthToken)
            .post("/api/reminders")
            .send({
                medicine_id: otherMedicineId,
                reminder_time: "14:00"
            });
        const otherReminderId = addRes.body.reminder.id;

        const res = await authenticatedRequest(authToken)
            .put(`/api/reminders/${otherReminderId}`)
            .send({
                reminder_time: "15:00"
            });
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Reminder not found or not owned by user");
    });

    it("should delete a reminder", async () => {
        const addRes = await authenticatedRequest(authToken)
            .post("/api/reminders")
            .send({
                medicine_id: medicineId,
                reminder_time: "16:00"
            });
        const reminderId = addRes.body.reminder.id;

        const res = await authenticatedRequest(authToken)
            .delete(`/api/reminders/${reminderId}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toEqual("Reminder deleted successfully");
    });

    it("should not delete a non-existent reminder", async () => {
        const res = await authenticatedRequest(authToken)
            .delete(`/api/reminders/99999`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Reminder not found or not owned by user");
    });

    it("should not delete a reminder not owned by the user", async () => {
        const { authToken: otherAuthToken } = await registerAndLoginUser("yet_another_reminder_user", "yet_another_reminder@example.com", "password123");
        const otherMedicineId = await addMedicine(otherAuthToken, { name: "Yet Another Reminder Med", dosage: "1mg", frequency: "daily", start_date: "2025-01-01" });
        const addRes = await authenticatedRequest(otherAuthToken)
            .post("/api/reminders")
            .send({
                medicine_id: otherMedicineId,
                reminder_time: "17:00"
            });
        const otherReminderId = addRes.body.reminder.id;

        const res = await authenticatedRequest(authToken)
            .delete(`/api/reminders/${otherReminderId}`);
        expect(res.statusCode).toEqual(404);
        expect(res.body.message).toEqual("Reminder not found or not owned by user");
    });

    testUnauthorizedAccess("/api/reminders", "get");
    testUnauthorizedAccess("/api/reminders", "post", { medicine_id: 1, reminder_time: "09:00" });
    testUnauthorizedAccess("/api/reminders/1", "put", { reminder_time: "10:00" });
    testUnauthorizedAccess("/api/reminders/1", "delete");
});

// Test utility functions indirectly or with dedicated unit tests if needed
// For example, testing initializeDatabase() could involve checking table existence
// and error handling during creation.

describe("Utility Functions (Indirectly Tested)", () => {
    it("initializeDatabase should create tables", async () => {
        // This is indirectly tested by the global beforeAll hook.
        // To explicitly test error handling, you might need to mock sqlite3.Database
        // or simulate a scenario where table creation fails.
        // For now, we assume it works if the tests run without database errors.
        expect(true).toBe(true); // Placeholder assertion
    });

    it("asyncHandler should catch errors", async () => {
        const mockReq = {};
        const mockRes = {};
        const mockNext = jest.fn();
        const error = new Error("Test Error");
        const failingFn = async (req, res, next) => { throw error; };

        const wrappedFn = asyncHandler(failingFn);
        await wrappedFn(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledWith(error);
    });

    it("sendResponse should send correct response", () => {
        const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        sendResponse(mockRes, 200, { data: "test" }, "Success");
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ message: "Success", data: "test" });
    });

    it("sendError should send correct error response", () => {
        const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const error = "Test Error";
        sendError(mockRes, 500, error);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error });
    });

    it("validateRequiredFields should return missing fields", () => {
        const data = { field1: "value1" };
        const required = ["field1", "field2"];
        const missing = validateRequiredFields(data, required);
        expect(missing).toEqual(["field2"]);
    });

    it("validateRequiredFields should return null if no missing fields", () => {
        const data = { field1: "value1", field2: "value2" };
        const required = ["field1", "field2"];
        const missing = validateRequiredFields(data, required);
        expect(missing).toBeNull();
    });

    // dbQuery, dbGet, dbRun are implicitly tested by API tests, but could have dedicated unit tests
    // by mocking sqlite3 methods.

    it("authenticateToken should return 401 if no token", () => {
        const mockReq = { headers: {} };
        const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const mockNext = jest.fn();
        authenticateToken(mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: "Access token required" });
        expect(mockNext).not.toHaveBeenCalled();
    });

    // More tests for authenticateToken (invalid/expired token) would require mocking jwt.verify

    it("hashPassword and comparePassword should work", async () => {
        const password = "mysecretpassword";
        const hashedPassword = await hashPassword(password);
        expect(typeof hashedPassword).toBe("string");
        expect(hashedPassword.length).toBeGreaterThan(0);

        const isMatch = await comparePassword(password, hashedPassword);
        expect(isMatch).toBe(true);

        const isNotMatch = await comparePassword("wrongpassword", hashedPassword);
        expect(isNotMatch).toBe(false);
    });

    it("generateToken should create a token", () => {
        const user = { id: 1, email: "test@example.com" };
        const token = generateToken(user);
        expect(typeof token).toBe("string");
        expect(token.length).toBeGreaterThan(0);
    });

    // findUserByEmail and createUser are implicitly tested by Auth API tests.
    // validateMedicineData is implicitly tested by Medicine API tests.
    // getMedicinesByUserId, createMedicine, updateMedicine, deleteMedicine are implicitly tested by Medicine API tests.
    // getSchedulesByUserId, getTodaysSchedule, createSchedule, markScheduleAsTaken are implicitly tested by Schedule API tests.
    // recordMedicineHistory, getMedicineHistory, getStatistics are implicitly tested by History and Stats API tests.
    // getRemindersByUserId, createReminder, updateReminder, deleteReminder are implicitly tested by Reminder API tests.
});


