# API Sentinel

An AI-powered API security auditor. API Sentinel analyzes an OpenAPI/Swagger specification and automatically detects potential vulnerabilities based on the OWASP API Security Top 10.

## Features

* **OpenAPI import** — drag & drop an OpenAPI/Swagger specification (JSON)
* **Automatic parsing** — extracts routes, HTTP methods, and parameters
* **AI-powered analysis** — generates attack scenarios and recommendations via Gemini/Groq
* **Visual dashboard** — route cards with risk badges, filters, and search
* **Global security score** — overview of the audited API's overall risk level
* **Audit history** — access previously analyzed APIs and their results

## Tech Stack

| Layer           | Technology           |
| --------------- | -------------------- |
| Frontend        | React                |
| Backend         | Java 21, Spring Boot |
| Database        | PostgreSQL           |
| AI              | Gemini API    |
| OpenAPI parsing | Swagger Parser       |

## Development

### Frontend

Open the `api-sentinel-frontend` folder in VS Code and run:

```bash
npm install
npm run dev
```

### Backend

Open the `api-sentinel-backend` folder in IntelliJ IDEA and run the Spring Boot application.

Or, from the backend terminal:

```bash
mvn spring-boot:run
# or
.\mvnw.cmd spring-boot:run
```

### Build

Frontend:

```bash
npm run build
```

Backend:

```bash
mvn clean package
```

## License

This project is licensed under the MIT License.
