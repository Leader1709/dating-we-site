CREATE DATABASE IF NOT EXISTS dating_app;
USE dating_app;

CREATE TABLE IF NOT EXISTS responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_time VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    restaurant VARCHAR(255) NOT NULL,
    dress_type VARCHAR(100) NOT NULL,
    dress_color VARCHAR(50) NOT NULL,
    activity VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
