const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const { getDb } = require('../db/schema');

// Initialize Gemini
let ai;
try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} catch (e) {
    console.warn('⚠️ Gemini AI not initialized. Ensure GEMINI_API_KEY is set in environment.');
}

router.post('/analyze-alert/:id', async (req, res) => {
    try {
        if (!ai) {
            return res.status(503).json({ error: 'AI Service Not Configured', message: 'GEMINI_API_KEY is missing.' });
        }

        const alertId = req.params.id;
        const db = getDb();

        // Fetch Alert
        const alert = db.prepare(`SELECT * FROM alerts WHERE id = ?`).get(alertId);
        if (!alert) {
            db.close();
            return res.status(404).json({ error: 'Alert not found' });
        }

        // Fetch related Event
        const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(alert.event_id);

        // Fetch related Threat Intel
        const threatIntel = db.prepare(`SELECT * FROM threat_intel WHERE ioc_value = ?`).get(alert.source_ip) || null;

        db.close();

        const contextPrompt = `
You are a top-tier Level 3 SOC Analyst. Please analyze this critical security alert and provide an Executive Summary and actionable Remediation Steps.

Format your response exactly as valid JSON with two keys:
1. "executive_summary": A concise, 3-4 sentence paragraph explaining what happened, the severity, the attacker, and the potential impact in plain English suitable for management.
2. "remediation_steps": An array of strings, where each string is a clear, actionable technical step a junior analyst should take immediately to contain or resolve this threat.

Alert Details:
- Title: ${alert.title}
- Description: ${alert.description}
- Severity: ${alert.severity}
- Attacker IP: ${alert.source_ip}
- Target IP: ${alert.dest_ip}
- MITRE Tactic/Technique: ${alert.mitre_tactic} / ${alert.mitre_technique}

Raw Log Payload triggering this alert:
${event ? event.raw_log : 'N/A'}

Threat Intelligence Context on Attacker:
${threatIntel ? `${threatIntel.threat_type} (Confidence: ${threatIntel.confidence}%). Notes: ${threatIntel.description}` : 'No known public threat intelligence for this IP.'}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contextPrompt,
            config: {
                temperature: 0.2, // Keep interpretations grounded and factual
                responseMimeType: 'application/json'
            }
        });

        const aiOutput = JSON.parse(response.text);

        res.json({
            analysis: aiOutput
        });

    } catch (error) {
        console.error('AI Analysis Error:', error);
        res.status(500).json({ error: 'AI Analysis Failed', details: error.message });
    }
});

module.exports = router;
