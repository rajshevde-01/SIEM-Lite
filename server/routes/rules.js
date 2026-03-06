const express = require('express');
const { getDb } = require('../db/schema');
const { v4: uuidv4 } = require('uuid');

module.exports = function (engine) {
    const router = express.Router();

    // GET /api/rules
    router.get('/', (req, res) => {
        const db = getDb();
        try {
            const rules = db.prepare('SELECT * FROM rules ORDER BY created_at DESC').all();
            res.json({ rules });
        } catch (err) {
            res.status(500).json({ error: err.message });
        } finally {
            db.close();
        }
    });

    // POST /api/rules
    router.post('/', (req, res) => {
        const db = getDb();
        try {
            const { name, description, category, severity, mitre_tactic, mitre_technique, logic } = req.body;
            const id = uuidv4();
            db.prepare(`
                INSERT INTO rules (id, name, description, category, severity, mitre_tactic, mitre_technique, logic, enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `).run(id, name, description, category, severity, mitre_tactic, mitre_technique, logic);

            if (engine) engine.reloadRules();
            res.status(201).json({ id, message: 'Rule created' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        } finally {
            db.close();
        }
    });

    // PATCH /api/rules/:id
    router.patch('/:id', (req, res) => {
        const db = getDb();
        try {
            const { enabled, name, description, severity, logic } = req.body;
            const updates = [];
            const params = [];
            if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
            if (name) { updates.push('name = ?'); params.push(name); }
            if (description) { updates.push('description = ?'); params.push(description); }
            if (severity) { updates.push('severity = ?'); params.push(severity); }
            if (logic) { updates.push('logic = ?'); params.push(JSON.stringify(logic)); }
            updates.push("updated_at = datetime('now')");
            params.push(req.params.id);
            db.prepare(`UPDATE rules SET ${updates.join(', ')} WHERE id = ?`).run(...params);
            const rule = db.prepare('SELECT * FROM rules WHERE id = ?').get(req.params.id);

            if (engine) engine.reloadRules();
            res.json(rule);
        } catch (err) {
            res.status(500).json({ error: err.message });
        } finally {
            db.close();
        }
    });

    // DELETE /api/rules/:id
    router.delete('/:id', (req, res) => {
        const db = getDb();
        try {
            db.prepare('DELETE FROM rules WHERE id = ?').run(req.params.id);
            if (engine) engine.reloadRules();
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        } finally {
            db.close();
        }
    });

    return router;
};
