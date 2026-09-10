# API Sentinel

API Sentinel is an AI-powered API security auditor. It analyzes OpenAPI and Swagger specifications and automatically detects potential vulnerabilities based on the OWASP API Security Top 10.

---

## Features

- **OpenAPI Import** — Drag and drop an OpenAPI/Swagger specification (JSON) to begin analysis
- **Automatic Parsing** — Extracts routes, HTTP methods, and parameters from the imported specification
- **AI-Powered Analysis** — Generates attack scenarios and remediation recommendations via Gemini/Groq
- **Visual Dashboard** — Displays route cards with risk badges, filtering, and search
- **Global Security Score** — Summarizes the audited API's overall risk level
- **Audit History** — Provides access to previously analyzed APIs and their results

---

## Technology Stack

- **Frontend:** React
- **Backend:** Java 21, Spring Boot
- **Database:** PostgreSQL
- **AI Engine:** Gemini API
- **Specification Parsing:** Swagger Parser

---

## Prerequisites

- Node.js and npm
- Java 21 and Maven (or the included Maven wrapper)
- A running PostgreSQL instance
- A valid Gemini/Groq API key for AI-powered analysis

---

## Getting Started

### Frontend

Open the `api-sentinel-frontend` folder in your editor of choice and run:

```
npm install
npm run dev
```

### Backend

Open the `api-sentinel-backend` folder in IntelliJ IDEA and run the Spring Boot application, or launch it from the terminal:

```
.\mvnw.cmd spring-boot:run
```

---

## Build

**Frontend:**

```
npm run build
```

**Backend:**

```
mvn clean package
```

---

## Usage

- **Importing a specification** — Drag and drop an OpenAPI/Swagger JSON file from the dashboard to begin analysis
- **Reviewing results** — Each parsed route appears as a card with a risk badge; use search and filters to narrow results
- **Interpreting the security score** — The global security score reflects the aggregate risk across all analyzed endpoints
- **Accessing audit history** — Previously analyzed specifications remain available for ongoing review

---

## License

Distributed under the MIT License. See the `LICENSE` file for details.