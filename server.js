import 'dotenv/config';
import express from 'express';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataDir = path.join(__dirname, 'data');
const submissionsFile = path.join(dataDir, 'submissions.json');

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(submissionsFile)) {
    fs.writeFileSync(submissionsFile, '[]', 'utf8');
  }
}

function loadSubmissions() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(submissionsFile, 'utf8'));
  } catch {
    return [];
  }
}

function saveSubmissions(entries) {
  ensureDataFile();
  fs.writeFileSync(submissionsFile, JSON.stringify(entries, null, 2), 'utf8');
}

let submissions = loadSubmissions();

const hasDbConfig = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
const db = hasDbConfig
  ? mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10
    })
  : null;

function isPlaceholder(value) {
  return !value || /your_|example\.com|replace_me|changeme/i.test(value);
}

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const personalEmail = process.env.MY_PERSONAL_EMAIL;
const emailConfigured = Boolean(emailUser && emailPass && personalEmail && !isPlaceholder(emailUser) && !isPlaceholder(emailPass) && !isPlaceholder(personalEmail));

// Nodemailer SMTP Configuration
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: emailUser,
    pass: emailPass
  }
});

// API Endpoint
app.post('/api/submit', async (req, res) => {
  const { dateTime, location, restaurant, dressType, dressColor, activity, userEmail } = req.body;
  const submission = { dateTime, location, restaurant, dressType, dressColor, activity, userEmail, createdAt: new Date().toISOString() };

  try {
    // 1. Save to MySQL if configured
    if (db) {
      try {
        const query = `
          INSERT INTO responses (date_time, location, restaurant, dress_type, dress_color, activity, user_email)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await db.execute(query, [dateTime, location, restaurant, dressType, dressColor, activity, userEmail]);
        console.log('Submission saved to MySQL.');
      } catch (dbError) {
        console.warn('MySQL unavailable; storing submission locally instead:', dbError.message);
      }
    } else {
      console.warn('Database not configured; storing submission locally.');
    }

    // 2. Send emails if SMTP is configured
    if (emailConfigured) {
      const hostMailOptions = {
        from: emailUser,
        to: personalEmail,
        subject: '💖 Date Plan Confirmed!',
        html: `
          <h2>You Have a Date! 🎉</h2>
          <p><strong>Date & Time:</strong> ${dateTime}</p>
          <p><strong>Location:</strong> ${location}</p>
          <p><strong>Restaurant:</strong> ${restaurant}</p>
          <p><strong>Style:</strong> ${dressType} (${dressColor})</p>
          <p><strong>Activity:</strong> ${activity}</p>
          <p><strong>Contact Email:</strong> ${userEmail}</p>
        `
      };

      const userMailOptions = {
        from: emailUser,
        to: userEmail,
        subject: '✨ Date Confirmation',
        html: `
          <h2>Can't wait for our date! 💕</h2>
          <p>Here are the details you submitted:</p>
          <ul>
            <li><strong>When:</strong> ${dateTime}</li>
            <li><strong>Where:</strong> ${restaurant}, ${location}</li>
            <li><strong>Dress Vibe:</strong> ${dressType} (${dressColor})</li>
            <li><strong>Activity:</strong> ${activity}</li>
          </ul>
          <p>See you soon!</p>
        `
      };

      try {
        await Promise.all([
          transporter.sendMail(hostMailOptions),
          transporter.sendMail(userMailOptions)
        ]);
        console.log('Email messages sent successfully.');
      } catch (mailError) {
        console.error('Email sending failed:', mailError.message);
      }
    } else {
      console.warn('Email credentials are not configured. Set real values in .env using your Gmail address and app password.');
    }

    submissions.push(submission);
    saveSubmissions(submissions);
    console.log('Submission accepted:', submission);
    res.status(200).json({ success: true, message: 'Date response recorded.' });
  } catch (error) {
    submissions.push(submission);
    saveSubmissions(submissions);
    console.error('Error processing date request:', error.message);
    res.status(200).json({ success: true, message: 'Date response recorded locally.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server executing on http://localhost:${PORT}`));
