# API Sentinel

An AI-powered API security auditor. API Sentinel analyzes an OpenAPI/Swagger specification and automatically detects potential vulnerabilities based on the OWASP API Security Top 10 (BOLA, BFLA, missing rate limiting, mass assignment, excessive data exposure...).

## Features

- OpenAPI import — drag & drop an OpenAPI/Swagger specification (JSON)
- Automatic parsing — extracts routes, HTTP methods, and parameters
- AI-powered analysis — generates attack scenarios and recommendations via Gemini/Groq
- Visual dashboard — route cards with risk badges, filters, and search
- Global security score — overview of the audited API's overall risk level

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Java 21, Spring Boot |
| Database | PostgreSQL |
| AI | Gemini / Groq API |
| OpenAPI parsing | swagger-parser |

## OWASP Vulnerabilities Covered

- BOLA (Broken Object Level Authorization)
- BFLA (Broken Function Level Authorization)
- Missing rate limiting
- Mass assignment
- Excessive data exposure

## License

This project is licensed under the MIT License.